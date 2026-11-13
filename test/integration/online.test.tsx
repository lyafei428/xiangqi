// @vitest-environment jsdom
// 集成用例 F1-2（联机页）：从大厅建房 → 收到权威快照 → 在棋盘上发送一着。
// 真实 WebSocket 的同步、拒绝与重连在 test/online.test.ts 覆盖。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import type { ServerMessage, Snapshot } from '../../src/shared/protocol.ts';
import {
  INITIAL_FEN,
  applyMove,
  generateLegalMoves,
  parseFen,
  statusOf,
  toChineseNotation,
  toFen,
} from '../../src/shared/index.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

interface Listener {
  (event: { data?: string }): void;
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open', {});
    });
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close', {});
  }

  serverSend(message: ServerMessage): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  private emit(type: string, event: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

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

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    room: 'ABC234',
    fen: INITIAL_FEN,
    seq: 0,
    turn: 'red',
    status: 'playing',
    result: null,
    lastMove: null,
    moves: [],
    red: true,
    black: false,
    players: 1,
    ...overrides,
  };
}

function tapSquare(board: Element, square: number): void {
  const x = 50 + (square % 9) * 100;
  const y = 50 + Math.floor(square / 9) * 100;
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

afterEach(cleanup);

beforeEach(() => {
  window.location.hash = '#/online';
  window.sessionStorage.clear();
  FakeWebSocket.instances = [];
});

describe('F1-2 联机页：建房、权威快照与走子', () => {
  it('建房后收到快照，走一着发出 move', async () => {
    const view = render(<App />);
    expect(screen.getByRole('heading', { name: '联机对战' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) throw new Error('没有 socket');
    await waitFor(() =>
      expect(socket.sent.some((raw) => JSON.parse(raw).type === 'join')).toBe(true),
    );

    socket.serverSend({
      type: 'joined',
      room: 'ABC234',
      token: 'token-red',
      color: 'red',
      snapshot: snapshot(),
    });
    await screen.findByText(/房间 ABC234/);
    expect(screen.getByText('把房间码发给对手：')).toBeTruthy();

    const waiting = snapshot({ players: 2, black: true });
    socket.serverSend({ type: 'state', snapshot: waiting });
    await screen.findByText('轮到红方');

    const board = view.container.querySelector('.board');
    if (board === null) throw new Error('棋盘未渲染');
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);

    const position = parseFen(INITIAL_FEN);
    const move = generateLegalMoves(position)[0];
    if (move === undefined) throw new Error('没有合法着法');
    tapSquare(board, move.from);
    tapSquare(board, move.to);

    await waitFor(() => {
      const sent = socket.sent.map((raw) => JSON.parse(raw) as { type: string });
      expect(sent.some((message) => message.type === 'move')).toBe(true);
    });
    const moveMessage = socket.sent
      .map((raw) => JSON.parse(raw) as { type: string; from?: number; to?: number; seq?: number })
      .find((message) => message.type === 'move');
    expect(moveMessage).toMatchObject({ from: move.from, to: move.to, seq: 0 });

    const next = applyMove(position, move);
    socket.serverSend({
      type: 'state',
      snapshot: snapshot({
        fen: toFen(next),
        seq: 1,
        turn: next.turn,
        status: statusOf(next),
        lastMove: move,
        moves: [toChineseNotation(position, move)],
        players: 2,
        black: true,
      }),
    });
    await screen.findByText('轮到黑方');
    expect(view.container.querySelector('.moves')?.textContent).toContain(
      toChineseNotation(position, move),
    );
  });
});
