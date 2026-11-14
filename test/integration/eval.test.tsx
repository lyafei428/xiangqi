// @vitest-environment jsdom
// F5-7 集成行：每步胜率在四个棋局页面都出现，开关关掉后都不渲染且记住。
// 断言只取业务可观察结果（有没有数字、两处数字是否一致、开关是否记住）；
// 映射精度留给 test/probability.test.ts。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { setEvalEnabled } from '../../src/client/panel/useEval.ts';
import type { ServerMessage, Snapshot } from '../../src/shared/protocol.ts';
import type { GameRecord } from '../../src/shared/record.ts';
import {
  INITIAL_FEN,
  applyMove,
  createClock,
  indexOf,
  parseFen,
  toChineseNotation,
  toFen,
} from '../../src/shared/index.ts';

// jsdom 没有 ResizeObserver 与 WebSocket，与其它页面用例同一套桩。
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

/** 两着合法着法：红炮进一、黑炮进一。记谱串从引擎取，用例不手写中文记谱。 */
const START = parseFen(INITIAL_FEN);
const FIRST = { from: indexOf(1, 7), to: indexOf(1, 6) };
const FIRST_NOTATION = toChineseNotation(START, FIRST);
const AFTER_FIRST = applyMove(START, FIRST);
const SECOND = { from: indexOf(1, 2), to: indexOf(1, 3) };
const SECOND_NOTATION = toChineseNotation(AFTER_FIRST, SECOND);
const AFTER_SECOND = applyMove(AFTER_FIRST, SECOND);

const SAVED_AT = 1_700_000_000_000;

function record(): GameRecord {
  return {
    id: SAVED_AT,
    startFen: INITIAL_FEN,
    moves: [FIRST, SECOND],
    result: { type: 'resign', winner: 'red' },
    redMs: 590_000,
    blackMs: 585_000,
    savedAt: SAVED_AT,
  };
}

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    room: 'ABC234',
    startFen: INITIAL_FEN,
    fen: INITIAL_FEN,
    seq: 0,
    turn: 'red',
    status: 'playing',
    result: null,
    lastMove: null,
    moves: [],
    moveLog: [],
    red: true,
    black: false,
    players: 1,
    spectators: 0,
    clock: createClock(Date.now()),
    drawOffer: null,
    drawBlocked: null,
    ...overrides,
  };
}

/** 记谱上每一格的百分比数字。 */
function evalCells(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('.move-eval')).map((element) =>
    Number((element.textContent ?? '').replace('%', '')),
  );
}

/** 概率条上的红方数字（从 role="img" 的 aria-label 取）。 */
function barRed(container: HTMLElement): number | null {
  const label = container.querySelector('.eval-track')?.getAttribute('aria-label') ?? '';
  const digits = /(\d+)%/.exec(label)?.[1];
  return digits === undefined ? null : Number(digits);
}

function playMove(notation: string): void {
  const input = screen.getByLabelText('记谱输入');
  fireEvent.change(input, { target: { value: notation } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

afterEach(cleanup);

beforeEach(() => {
  // 开关是模块级的（跨页面共享），用例之间要复位；存储由 test/setup.ts 清空。
  setEvalEnabled(true);
  FakeWebSocket.instances = [];
});

describe('F5-7 每步胜率', () => {
  it('对弈页首次进入就看得见三段条，走两着每格都有百分比', () => {
    window.location.hash = '#/play';
    const view = render(<App />);

    // 着法区默认收起——条如果落在里面就等于看不见（用户 2026-11-14 报的就是这个）。
    expect(view.container.querySelector('.panel-body')?.hasAttribute('hidden')).toBe(true);
    const bar = view.container.querySelector('.eval-bar');
    expect(bar).not.toBeNull();
    expect(bar?.closest('.panel-body')).toBeNull();
    expect(bar?.closest('.panel-focus')).not.toBeNull();
    expect(bar?.textContent).toMatch(/红 \d+%/);
    expect(bar?.textContent).toMatch(/黑 \d+%/);

    playMove(FIRST_NOTATION);
    playMove(SECOND_NOTATION);

    const cells = evalCells(view.container);
    expect(cells).toHaveLength(2);
    const last = cells.at(-1);
    expect(last).toBeDefined();
    // 条上的数字取的就是末格那个数：两处同一口径，读起来才是同一个判断。
    expect(barRed(view.container)).toBe(last);

    const barText = view.container.querySelector('.eval-bar')?.textContent ?? '';
    expect(barText).toContain(`红 ${String(last)}%`);
    expect(barText).toContain(`黑 ${String(100 - (last ?? 0))}%`);

    // 记谱格文本仍是纯记谱：百分比是它的兄弟节点（切页不变的对局用例按整段文本比对）。
    expect(view.container.querySelector('.move-row .move-red')?.textContent).toBe(FIRST_NOTATION);
  });

  it('关掉胜率后条与逐格数字都不渲染，重开页面仍是关', () => {
    window.location.hash = '#/play';
    const view = render(<App />);
    playMove(FIRST_NOTATION);
    expect(view.container.querySelector('.eval-bar')).not.toBeNull();
    expect(evalCells(view.container)).toHaveLength(1);

    fireEvent.click(screen.getByText('设置'));
    fireEvent.click(screen.getByRole('button', { name: /胜率开/ }));

    expect(view.container.querySelector('.eval-bar')).toBeNull();
    expect(evalCells(view.container)).toHaveLength(0);
    expect(window.localStorage.getItem('xiangqi.eval.v1')).toBe('0');

    cleanup();
    const again = render(<App />);
    fireEvent.click(screen.getByText('设置'));
    expect(screen.getByRole('button', { name: /胜率关/ })).toBeTruthy();
    expect(again.container.querySelector('.eval-bar')).toBeNull();
  });

  it('联机页收到快照后条在，数字与末格一致', async () => {
    window.location.hash = '#/online';
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) throw new Error('没有 socket');

    socket.serverSend({
      type: 'joined',
      room: 'ABC234',
      token: 'token-red',
      role: 'player',
      color: 'red',
      snapshot: snapshot(),
    });
    await screen.findByText(/房间 ABC234/);

    socket.serverSend({
      type: 'state',
      snapshot: snapshot({
        players: 2,
        black: true,
        seq: 2,
        fen: toFen(AFTER_SECOND),
        turn: AFTER_SECOND.turn,
        lastMove: SECOND,
        moves: [FIRST_NOTATION, SECOND_NOTATION],
        moveLog: [FIRST, SECOND],
      }),
    });
    await screen.findByText('轮到红方');

    await waitFor(() => expect(evalCells(view.container)).toHaveLength(2));
    expect(barRed(view.container)).toBe(evalCells(view.container).at(-1));
  });

  it('回放页游标走到终局后，条与结果一致', () => {
    window.localStorage.setItem('xiangqi.records.v1', JSON.stringify([record()]));
    window.location.hash = `#/replay/${String(SAVED_AT)}`;
    const view = render(<App />);

    expect(evalCells(view.container)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '末' }));

    // 结果是红胜：条贴满红，两个数字收敛到 100 / 0。
    expect(barRed(view.container)).toBe(100);
    const numbers = view.container.querySelector('.eval-bar')?.textContent ?? '';
    expect(numbers).toContain('红 100%');
    expect(numbers).toContain('黑 0%');
  });
});
