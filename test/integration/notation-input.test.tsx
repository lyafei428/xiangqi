// @vitest-environment jsdom
// 集成用例 F1-8：面板记谱输入走子。
// 入口是输入框与页面级 `/`，走的是 session reducer 与规则引擎，不直接改局面。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { resetAiSession } from '../../src/client/pages/AiPage.tsx';
import { indexOf } from '../../src/shared/index.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/** 人机页挂载时会起 Worker：本用例不需要回子，留一条不回话的线程就够。 */
class SilentWorker {
  postMessage(): void {}
  addEventListener(): void {}
  terminate(): void {}
}

globalThis.Worker = SilentWorker as unknown as typeof Worker;

const elementProto = Element.prototype as Element & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};
if (typeof elementProto.setPointerCapture !== 'function') elementProto.setPointerCapture = () => {};
if (typeof elementProto.releasePointerCapture !== 'function') elementProto.releasePointerCapture = () => {};

// jsdom 不做布局：把棋盘矩形钉成 viewBox 尺寸，客户端坐标才能直接当棋盘坐标用。
const VIEW_RECT = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  width: 900,
  height: 1000,
  right: 900,
  bottom: 1000,
  toJSON: () => ({}),
} as unknown as DOMRect;

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  resetAiSession();
  window.location.hash = '#/play';
});

function setup(): { container: HTMLElement } {
  const view = render(<App />);
  const board = view.container.querySelector('.board');
  if (board === null) throw new Error('棋盘未渲染');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
  return { container: view.container };
}

/**
 * 着法区默认收起（F1.10 的专注态）：要敲记谱先点常驻条上的「着法」展开。
 * 收起态的输入框不可聚焦，直接对它敲字不是用户走得到的路径。
 */
function openMoves(): void {
  fireEvent.click(screen.getByRole('button', { name: '着法' }));
}

function input(): HTMLInputElement {
  return screen.getByLabelText('记谱输入') as HTMLInputElement;
}

/** 像用户那样：先点进输入框，再敲字、回车。 */
function submit(text: string): void {
  const field = input();
  field.focus();
  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

function notations(container: HTMLElement): string {
  return container.querySelector('.moves')?.textContent ?? '';
}

describe('F1-8 面板记谱输入走子', () => {
  it('输入「炮二平五」回车后炮落到中路，着法记录出现该步', () => {
    const { container } = setup();
    openMoves();
    submit('炮二平五');

    expect(notations(container)).toContain('炮二平五');
    const arrived = container.querySelector(`[data-square="${String(indexOf(4, 7))}"]`);
    expect(arrived?.getAttribute('aria-label')).toBe('红方炮，第 5 列第 8 行');
    expect(container.querySelector('.status-line')?.textContent).toContain('黑方走棋');
    // 成功清空并保持焦点：连续输入不用再点一次。
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('输入「炮二平九」不落子，提示留在输入框下方', () => {
    const { container } = setup();
    openMoves();
    submit('炮二平九');

    expect(notations(container)).toContain('尚未走子');
    expect(container.querySelector(`[data-square="${String(indexOf(4, 7))}"]`)).toBeNull();
    expect(input().value).toBe('炮二平九');
    const hint = screen.getByText('这步走不了：检查棋子、纵线和方向');
    expect(hint.getAttribute('role')).toBe('status');
    expect(hint.getAttribute('aria-live')).toBe('polite');
    screen.getByText('如：炮二平五');
    expect(container.querySelector('.status-line')?.textContent).toContain('红方走棋');
  });

  it('输入法未上屏的回车不提交', () => {
    const { container } = setup();
    openMoves();
    const field = input();
    field.focus();
    fireEvent.change(field, { target: { value: '炮二平五' } });
    // 中文输入法候选未落定时按回车：浏览器派发的 keydown 带 isComposing。
    fireEvent(field, new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));

    expect(notations(container)).toContain('尚未走子');
    expect(field.value).toBe('炮二平五');
  });

  it('终局时输入框置灰', () => {
    setup();
    expect(input().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '认输' }));
    expect(input().disabled).toBe(true);
  });

  it('按 / 聚焦记谱输入；着法区收起时先展开再聚焦', () => {
    setup();
    expect(document.activeElement).not.toBe(input());

    // 进页面是专注态：着法区收起，开关的 aria-expanded 与 body 的 hidden 同源。
    const toggle = (): HTMLElement => screen.getByRole('button', { name: '着法' });
    const body = (): Element | null => document.querySelector('.panel-body');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(body()?.hasAttribute('hidden')).toBe(true);

    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(input());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(body()?.hasAttribute('hidden')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '收起着法' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(document.body, { key: '/' });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input());
  });

  it('人机页 AI 回合输入框置灰', () => {
    window.location.hash = '#/ai';
    render(<App />);
    expect(input().disabled).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: '执黑' }));
    expect(input().disabled).toBe(true);
  });
});
