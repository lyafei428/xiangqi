// @vitest-environment jsdom
// 集成用例 F4-1：走一着后切到课程再切回来，对局状态（棋盘与记谱）仍在。
// 对弈与人机各验一次：前者靠 App 级会话，后者靠人机页的模块级持有者。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { resetAiSession } from '../../src/client/pages/AiPage.tsx';
import type { AiRequest } from '../../src/client/ai/protocol.ts';
import {
  generateLegalMoves,
  parseFen,
  toChineseNotation,
} from '../../src/shared/index.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

interface WorkerListener {
  (event: { data?: unknown }): void;
}

/** 假 Worker：收到请求就回一条合法着法，导航用例只关心对局是否原样保留。 */
class FakeAiWorker {
  static readonly instances: FakeAiWorker[] = [];
  readonly posted: AiRequest[] = [];
  private readonly listeners = new Map<string, WorkerListener[]>();

  constructor(_url: unknown) {
    FakeAiWorker.instances.push(this);
  }

  addEventListener(type: string, listener: WorkerListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  postMessage(message: AiRequest): void {
    this.posted.push(message);
    const legal = generateLegalMoves(parseFen(message.fen));
    const move = legal[0];
    if (move === undefined) throw new Error('请求的局面没有合法着法');
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data: { id: message.id, reply: { move, depth: 2, nodes: 40, elapsedMs: 3 } } });
    }
  }

  terminate(): void {}
}

globalThis.Worker = FakeAiWorker as unknown as typeof Worker;

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
  resetAiSession();
  FakeAiWorker.instances.length = 0;
});

function goto(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
}

function tap(board: Element, x: number, y: number): void {
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

function boardOf(container: HTMLElement): Element {
  const board = container.querySelector('.board');
  if (board === null) throw new Error('棋盘未渲染');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
  return board;
}

describe('F4-1 切页不丢对局状态', () => {
  it('走一着后去课程再回对弈，棋盘与记谱不变', async () => {
    const view = render(<App />);
    const board = boardOf(view.container);

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

  it('人机页走一着后去课程再回人机，棋盘与记谱不变', async () => {
    window.location.hash = '#/ai';
    const view = render(<App />);
    expect(screen.getByText('人机 · 普通')).toBeTruthy();
    const board = boardOf(view.container);

    // 玩家走一着，机器立刻回一着（假 Worker 同步回子）。
    await act(async () => {
      tap(board, 150, 750); // 红炮 (1,7)
      tap(board, 150, 650); // (1,6)
      await Promise.resolve();
    });

    const worker = FakeAiWorker.instances.at(-1);
    const request = worker?.posted.at(-1);
    if (request === undefined) throw new Error('AI 没有收到请求');
    const replyPosition = parseFen(request.fen);
    const replyMove = generateLegalMoves(replyPosition)[0];
    if (replyMove === undefined) throw new Error('回复局面没有合法着法');
    const replyNotation = toChineseNotation(replyPosition, replyMove);

    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    const row = view.container.querySelector('.move-row');
    expect(row?.querySelector('.move-red')?.textContent).toBe('炮八进一');
    expect(row?.querySelector('.move-black')?.textContent).toBe(replyNotation);

    goto('#/learn');
    await screen.findByRole('heading', { name: '课程' });

    goto('#/ai');
    await screen.findByText('人机 · 普通');
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    const keptRow = view.container.querySelector('.move-row');
    expect(keptRow?.querySelector('.move-red')?.textContent).toBe('炮八进一');
    expect(keptRow?.querySelector('.move-black')?.textContent).toBe(replyNotation);
    const labels = Array.from(view.container.querySelectorAll('.piece')).map((piece) =>
      piece.getAttribute('aria-label'),
    );
    // 玩家那一着与机器那一着都在棋盘上：炮还在走后的位置。
    expect(labels).toContain('红方炮，第 2 列第 7 行');
    // 回到人机页是玩家的回合：棋盘可点。
    expect(view.container.querySelectorAll('.piece[tabindex="0"]').length).toBeGreaterThan(0);
  });
});
