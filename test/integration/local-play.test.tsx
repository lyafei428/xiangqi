// @vitest-environment jsdom
// 集成用例 F1-1（本地双人走完一局并判和）与 F1-3（计时与认输）。
// 指针事件走的是真实事件链，不直接调用 reducer：Board → session → 引擎 → 记谱 → 面板。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { INITIAL_FEN, indexOf } from '../../src/shared/index.ts';

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

// jsdom 不做布局，把棋盘矩形钉成 viewBox 尺寸，client 坐标才能直接当棋盘坐标用。
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

function setup(): { board: Element; container: HTMLElement } {
  const view = render(<App />);
  const board = view.container.querySelector('.board');
  if (board === null) throw new Error('棋盘未渲染');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
  return { board, container: view.container };
}

function tap(board: Element, x: number, y: number): void {
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

describe('F1-1 本地双人走完一局并判和', () => {
  it('开局渲染 32 枚棋子并提示红方走棋', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.piece')).toHaveLength(32);
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
  });

  it('点选走子后换边并写入记谱', () => {
    const { board, container } = setup();
    tap(board, 150, 750); // 红炮 (1,7)
    expect(container.querySelectorAll('.piece-selected')).toHaveLength(1);
    tap(board, 150, 650); // (1,6)
    expect(screen.getByRole('status').textContent).toContain('黑方走棋');
    expect(container.querySelector('.moves')?.textContent).toContain('炮八进一');
  });

  it('走完 8 着三次重复判和、锁盘，新局复位', () => {
    const { board, container } = setup();
    const moves: readonly (readonly [number, number])[] = [
      [750, 650], // 红炮八进一
      [250, 350], // 黑炮2进1
      [650, 750], // 红炮八退一
      [350, 250], // 黑炮2退1
      [750, 650],
      [250, 350],
      [650, 750],
      [350, 250],
    ];
    for (const [fromY, toY] of moves) {
      tap(board, 150, fromY);
      tap(board, 150, toY);
    }

    expect(screen.getByRole('status').textContent).toContain('和棋 · 三次重复局面');
    expect(container.querySelectorAll('.move-row')).toHaveLength(4);
    expect(container.querySelectorAll('.piece[tabindex="0"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '新局' }));
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    expect(container.querySelectorAll('.move-row')).toHaveLength(0);
  });
});

describe('F1-3 本地计时与认输', () => {
  it('面板从 10:00 起步', () => {
    const { container } = setup();
    expect(container.querySelector('.clock-row')?.textContent).toContain('10:00');
  });

  it('红方时钟归零显示「黑方胜 · 超时」并锁盘', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const { container } = setup();
      act(() => {
        vi.advanceTimersByTime(601_000);
      });
      expect(screen.getByRole('status').textContent).toContain('黑方胜 · 超时');
      expect(container.querySelectorAll('.piece[tabindex="0"]')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('认输立刻结束并锁盘', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: '认输' }));
    expect(screen.getByRole('status').textContent).toContain('黑方胜 · 认输');
    expect(container.querySelectorAll('.piece[tabindex="0"]')).toHaveLength(0);
  });
});

describe('F1-5 关页重开后接着下', () => {
  const MOVES = [
    { from: indexOf(1, 7), to: indexOf(1, 6) },
    { from: indexOf(1, 2), to: indexOf(1, 3) },
  ];

  function storeCurrent(overrides: Record<string, unknown> = {}): void {
    localStorage.setItem(
      'xiangqi.current.v1',
      JSON.stringify({
        id: null,
        startFen: INITIAL_FEN,
        moves: MOVES,
        result: null,
        redMs: 500_000,
        blackMs: 400_000,
        savedAt: Date.now(),
        ...overrides,
      }),
    );
  }

  it('局面、记谱与双方剩余都接上', () => {
    storeCurrent();
    const { container } = setup();
    expect(container.querySelector('.moves')?.textContent).toContain('炮八进一');
    expect(container.querySelector('.moves')?.textContent).toContain('炮2进1');
    // 走了两着后轮到红方；两侧剩余分别按 08:20 / 06:40 接上（允许走秒）。
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    const clocks = screen.getByLabelText('双方用时').textContent ?? '';
    expect(clocks).toMatch(/红 08:(20|19)/);
    expect(clocks).toContain('黑 06:40');
  });

  it('未完成局损坏时丢弃并开新局', () => {
    localStorage.setItem(
      'xiangqi.current.v1',
      '{"id":null,"startFen":"bad","moves":[],"result":null,"redMs":0,"blackMs":0,"savedAt":0}',
    );
    const { container } = setup();
    expect(container.querySelectorAll('.piece')).toHaveLength(32);
    const stored = JSON.parse(localStorage.getItem('xiangqi.current.v1') ?? 'null') as {
      startFen?: string;
      moves?: unknown[];
    } | null;
    // 坏记录被换成新开的空局，而不是原样留着。
    expect(stored?.startFen).toBe(INITIAL_FEN);
    expect(stored?.moves).toHaveLength(0);
  });

  it('未完成局的着法非法时丢弃并开新局', () => {
    // 坐标合法、结构能过，只有逐步重放才发现走不通。
    storeCurrent({ moves: [{ from: indexOf(0, 9), to: indexOf(0, 9) + 1 }] });
    const { container } = setup();
    expect(container.querySelectorAll('.piece')).toHaveLength(32);
    const stored = JSON.parse(localStorage.getItem('xiangqi.current.v1') ?? 'null') as {
      moves?: unknown[];
    } | null;
    expect(stored?.moves).toHaveLength(0);
  });

  it('终局转存棋谱并清掉未完成局', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '认输' }));
    expect(localStorage.getItem('xiangqi.current.v1')).toBeNull();
    const records = JSON.parse(localStorage.getItem('xiangqi.records.v1') ?? '[]') as {
      result?: { type?: string };
      moves?: unknown[];
    }[];
    expect(records).toHaveLength(1);
    expect(records[0]?.result?.type).toBe('resign');
  });
});

