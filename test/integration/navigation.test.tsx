// @vitest-environment jsdom
// 集成用例 F4-1：对弈页走一着，切到课程再切回来，对局状态（棋盘与记谱）仍在。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

const elementProto = Element.prototype as Element & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};
if (typeof elementProto.setPointerCapture !== 'function') elementProto.setPointerCapture = () => {};
if (typeof elementProto.releasePointerCapture !== 'function') elementProto.releasePointerCapture = () => {};

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
  window.location.hash = '#/play';
});

function goto(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
}

function tap(board: Element, x: number, y: number): void {
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

describe('F4-1 切页不丢对局状态', () => {
  it('走一着后去课程再回对弈，棋盘与记谱不变', async () => {
    const view = render(<App />);
    const board = view.container.querySelector('.board');
    if (board === null) throw new Error('棋盘未渲染');
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);

    tap(board, 150, 750); // 红炮 (1,7)
    tap(board, 150, 650); // (1,6)
    expect(screen.getByRole('status').textContent).toContain('黑方走棋');
    expect(view.container.querySelector('.moves')?.textContent).toContain('炮八进一');

    goto('#/learn');
    await screen.findByRole('heading', { name: '课程' });

    goto('#/play');
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('黑方走棋');
    expect(view.container.querySelector('.moves')?.textContent).toContain('炮八进一');
    const labels = Array.from(view.container.querySelectorAll('.piece')).map((piece) =>
      piece.getAttribute('aria-label'),
    );
    expect(labels).toContain('红方炮，第 2 列第 7 行');
  });
});
