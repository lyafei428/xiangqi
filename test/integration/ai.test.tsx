// @vitest-environment jsdom
// 集成用例 F1-7：人机页的难度与阵营、思考锁、请求规则与终局存谱；F1-10：难度与阵营收成一行摘要。
// 假 Worker 代替真线程：用例自己掌握「什么时候回子」，才能验「思考中点击不发 play」。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { resetAiSession } from '../../src/client/pages/AiPage.tsx';
import type { AiRequest } from '../../src/client/ai/protocol.ts';
import type { Move } from '../../src/shared/index.ts';
import {
  INITIAL_FEN,
  applyMove,
  generateLegalMoves,
  indexOf,
  parseFen,
  toChineseNotation,
  toFen,
} from '../../src/shared/index.ts';

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

interface Listener {
  (event: { data?: unknown; message?: string }): void;
}

/** 假 Worker：只收请求，回子由用例显式触发（真线程在 jsdom 里起不来）。 */
class FakeAiWorker {
  readonly posted: AiRequest[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(_url: unknown) {
    workers.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  postMessage(message: AiRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** 回一着：默认取请求局面里的第一条合法着法。 */
  reply(move?: Move): void {
    const request = this.posted.at(-1);
    if (request === undefined) throw new Error('没有在飞的请求');
    const legal = generateLegalMoves(parseFen(request.fen));
    const chosen = move ?? legal[0];
    if (chosen === undefined) throw new Error('请求的局面没有合法着法');
    this.emit('message', {
      data: { id: request.id, reply: { move: chosen, depth: 2, nodes: 40, elapsedMs: 3 } },
    });
  }

  crash(message = 'worker crashed'): void {
    this.emit('error', { message });
  }

  private emit(type: string, event: { data?: unknown; message?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const workers: FakeAiWorker[] = [];

globalThis.Worker = FakeAiWorker as unknown as typeof Worker;

// jsdom 不做布局：把棋盘矩形钉成 viewBox 尺寸，client 坐标才能直接当棋盘坐标用。
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
  // 着法区的展开态现在会落盘；不清会把上一条用例的展开态带进来。
  localStorage.clear();
  resetAiSession();
  workers.length = 0;
  window.location.hash = '#/ai';
});

function open(): { container: HTMLElement; board: Element } {
  const view = render(<App />);
  const board = view.container.querySelector('.board');
  if (board === null) throw new Error('棋盘未渲染');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
  return { container: view.container, board };
}

function live(): FakeAiWorker {
  const worker = workers.at(-1);
  if (worker === undefined) throw new Error('没有创建 Worker');
  return worker;
}

function tap(board: Element, square: number): void {
  const x = 50 + (square % 9) * 100;
  const y = 50 + Math.floor(square / 9) * 100;
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

/** 玩家走「炮八进一」：开局永远合法，坐标与 navigation 用例一致。 */
const PLAYER_MOVE: Move = { from: indexOf(1, 7), to: indexOf(1, 6) };

function playerMove(board: Element): void {
  tap(board, PLAYER_MOVE.from);
  tap(board, PLAYER_MOVE.to);
}

async function aiReply(move?: Move): Promise<void> {
  await act(async () => {
    live().reply(move);
    await Promise.resolve();
  });
}

function notations(container: HTMLElement): string {
  return container.querySelector('.moves')?.textContent ?? '';
}

describe('F1-7 人机页：难度与阵营', () => {
  it('默认普通档、执红，面板标签随难度变', () => {
    const { container } = open();
    expect(container.querySelectorAll('.piece')).toHaveLength(32);
    expect((screen.getByRole('radio', { name: '普通' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: '执红' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('人机 · 普通')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '高手' }));
    expect((screen.getByRole('radio', { name: '高手' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('人机 · 高手')).toBeTruthy();
    // 只是换档位，还没轮到 AI，一着都不该发。
    expect(live().posted).toHaveLength(0);
  });

  it('换难度后请求的 level 跟着变', () => {
    const { board } = open();
    fireEvent.click(screen.getByRole('radio', { name: '入门' }));
    playerMove(board);
    expect(live().posted).toHaveLength(1);
    expect(live().posted[0]?.level).toBe('easy');
  });

  it('执黑时棋盘翻转：自己的子在下半盘', async () => {
    const { container } = open();
    const yOf = (label: string): number => {
      const piece = container.querySelector(`[aria-label="${label}"]`);
      const transform = piece?.getAttribute('transform') ?? '';
      const matched = /translate\(\s*[-\d.]+[ ,]+([-\d.]+)\s*\)/.exec(transform);
      return Number(matched?.[1] ?? Number.NaN);
    };

    // 默认执红：黑将在上（纵坐标小），红帅在下。
    expect(yOf('黑方將，第 5 列第 1 行')).toBeLessThan(500);
    expect(yOf('红方帥，第 5 列第 10 行')).toBeGreaterThan(500);

    fireEvent.click(screen.getByRole('radio', { name: '执黑' }));

    // 执黑后镜像：黑将落到下半盘，红帅回到上边。
    expect(yOf('黑方將，第 5 列第 1 行')).toBeGreaterThan(500);
    expect(yOf('红方帥，第 5 列第 10 行')).toBeLessThan(500);
  });

  it('换阵营等同重开：AI 执红开局即回一着', async () => {
    const { container } = open();
    fireEvent.click(screen.getByRole('radio', { name: '执黑' }));

    expect(live().posted).toHaveLength(1);
    expect(live().posted[0]?.fen).toBe(INITIAL_FEN);

    const initial = parseFen(INITIAL_FEN);
    const aiMove = generateLegalMoves(initial)[0];
    if (aiMove === undefined) throw new Error('开局没有合法着法');
    await aiReply(aiMove);

    expect(notations(container)).toContain(toChineseNotation(initial, aiMove));
    expect(screen.getByRole('status').textContent).toContain('黑方走棋');
    // 轮到玩家：自己的子可以选了。
    expect(container.querySelectorAll('.piece[tabindex="0"]').length).toBeGreaterThan(0);
    // 换阵营后只有这一笔请求：旧局面的那一笔不会再补。
    expect(live().posted).toHaveLength(1);
  });
});

describe('F1-7 人机页：走子、回子与思考锁', () => {
  it('玩家走一着后 AI 回一着并更新棋盘', async () => {
    const { board, container } = open();
    playerMove(board);

    const afterPlayer = applyMove(parseFen(INITIAL_FEN), PLAYER_MOVE);
    expect(screen.getByRole('status').textContent).toContain('黑方走棋');
    expect(notations(container)).toContain(toChineseNotation(parseFen(INITIAL_FEN), PLAYER_MOVE));
    expect(live().posted).toHaveLength(1);
    expect(live().posted[0]?.fen).toBe(toFen(afterPlayer));
    expect(live().posted[0]?.level).toBe('normal');
    screen.getByText('AI 思考中…');

    const aiMove = { from: indexOf(1, 2), to: indexOf(1, 3) };
    await aiReply(aiMove);

    expect(notations(container)).toContain(toChineseNotation(afterPlayer, aiMove));
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    expect(screen.queryByText('AI 思考中…')).toBeNull();
    // 棋盘跟着回子动了：AI 的炮落在目标交叉点。
    const arrived = container.querySelector(`[data-square="${String(aiMove.to)}"]`);
    expect(arrived?.getAttribute('aria-label')).toBe('黑方砲，第 2 列第 4 行');
    expect(container.querySelectorAll('.piece')).toHaveLength(32);
  });

  it('思考中棋盘只读：点击不产生着法、不再发请求', async () => {
    const { board, container } = open();
    playerMove(board);
    const before = notations(container);
    expect(live().posted).toHaveLength(1);

    // 思考中整块棋盘没有可聚焦的子，点自己的子与落点都不发动作。
    expect(container.querySelectorAll('.piece[tabindex="0"]')).toHaveLength(0);
    tap(board, indexOf(7, 7));
    tap(board, indexOf(7, 6));
    expect(notations(container)).toBe(before);
    expect(live().posted).toHaveLength(1);

    const aiMove = { from: indexOf(1, 2), to: indexOf(1, 3) };
    await aiReply(aiMove);
    // 回子落地后玩家重新可走。
    expect(container.querySelectorAll('.piece[tabindex="0"]').length).toBeGreaterThan(0);
  });
});

describe('F1-7 人机页：终局', () => {
  it('认输即终局：不再发请求、锁盘并写入棋谱库', () => {
    const { board, container } = open();
    fireEvent.click(screen.getByRole('button', { name: '认输' }));

    expect(screen.getByRole('status').textContent).toContain('黑方胜 · 认输');
    expect(container.querySelectorAll('.piece[tabindex="0"]')).toHaveLength(0);

    tap(board, indexOf(1, 7));
    tap(board, indexOf(1, 6));
    expect(live().posted).toHaveLength(0);
    expect(notations(container)).toContain('尚未走子');

    const stored = JSON.parse(localStorage.getItem('xiangqi.records.v1') ?? '[]') as {
      startFen?: string;
      moves?: unknown[];
      result?: { type?: string };
    }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.startFen).toBe(INITIAL_FEN);
    expect(stored[0]?.result?.type).toBe('resign');
    expect(screen.getByText('人机 · 普通')).toBeTruthy();
  });

  it('AI 出错时给提示，不替 AI 走子，新局可重开', async () => {
    const { board, container } = open();
    playerMove(board);
    const before = notations(container);

    await act(async () => {
      live().crash();
      await Promise.resolve();
    });

    screen.getByText('AI 出错，请点新局重开');
    expect(notations(container)).toBe(before);
    expect(live().posted).toHaveLength(1);
    expect(screen.queryByText('AI 思考中…')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '新局' }));
    expect(screen.queryByText('AI 出错，请点新局重开')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('红方走棋');
    expect(notations(container)).toContain('尚未走子');
  });
});

describe('F1-10 人机页专注：难度与阵营收为一行摘要', () => {
  it('未走子时两组控件都在页上，走一着后收成摘要，点摘要再展开', () => {
    const { board } = open();
    const levelGroup = (): HTMLElement | null => screen.queryByRole('radiogroup', { name: '难度' });
    const sideGroup = (): HTMLElement | null => screen.queryByRole('radiogroup', { name: '阵营' });
    const summary = (): HTMLElement | null =>
      screen.queryByRole('button', { name: '难度 高手 · 执红 · 改' });

    // 未走子：难度与阵营就在页上（不属「默认收起」），摘要还没出现。
    expect(levelGroup()).not.toBeNull();
    expect(sideGroup()).not.toBeNull();
    expect(summary()).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '高手' }));

    // 走第一着：两组控件收成一行摘要，摘要写的是当下这一局的档位与阵营，不是默认值。
    playerMove(board);
    expect(levelGroup()).toBeNull();
    expect(sideGroup()).toBeNull();
    expect(summary()?.textContent).toBe('难度 高手 · 执红 · 改');

    // 点摘要：控件展开回来，档位与阵营仍是走子前那一组。
    const button = summary();
    if (button === null) throw new Error('摘要按钮不在页上');
    fireEvent.click(button);
    expect(levelGroup()).not.toBeNull();
    expect(sideGroup()).not.toBeNull();
    expect((screen.getByRole('radio', { name: '高手' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: '执红' }) as HTMLInputElement).checked).toBe(true);
    expect(summary()).toBeNull();
  });

  it('选过之后鼠标移开就收起，新局重新铺开', () => {
    const { container } = open();
    const levelGroup = (): HTMLElement | null => screen.queryByRole('radiogroup', { name: '难度' });
    const summary = (): HTMLElement | null => screen.queryByRole('button', { name: /难度 .* · 改/ });
    const controls = (): Element | null => container.querySelector('.ai-controls');

    // 没选过：指针在组外移动也不收——否则用户还没选就被迫点摘要展开。
    expect(controls()).not.toBeNull();
    fireEvent.pointerMove(document.body);
    expect(levelGroup()).not.toBeNull();

    // 选过难度：指针落到组外就收成摘要（不依赖「先悬停再离开」）。
    fireEvent.click(screen.getByRole('radio', { name: '高手' }));
    expect(controls()).not.toBeNull();
    fireEvent.pointerMove(document.body);
    expect(levelGroup()).toBeNull();
    expect(summary()?.textContent).toBe('难度 高手 · 执红 · 改');

    // 新局：控件组重新铺开（一局里选过一次，不该影响下一局）。
    fireEvent.click(screen.getByRole('button', { name: '新局' }));
    expect(levelGroup()).not.toBeNull();
    expect(summary()).toBeNull();
  });
});

describe('挂载重放（StrictMode 双调用）', () => {
  it('切页回来正轮到 AI 时，第二趟挂载仍能把那一手落下来', async () => {
    const first = render(<App />);
    const firstBoard = first.container.querySelector('.board');
    if (firstBoard === null) throw new Error('棋盘未渲染');
    vi.spyOn(firstBoard, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
    playerMove(firstBoard);
    expect(first.container.textContent).toContain('AI 思考中…');
    first.unmount();

    // dev 下的 StrictMode 会对挂载跑两遍 effect：第一趟的线程被 dispose 掉，
    // 第二趟必须重新发一着，否则页面永远停在「AI 思考中…」。
    const second = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const secondBoard = second.container.querySelector('.board');
    if (secondBoard === null) throw new Error('棋盘未渲染');
    vi.spyOn(secondBoard, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);

    expect(live().posted).toHaveLength(1);
    await aiReply();
    expect(screen.queryByText('AI 思考中…')).toBeNull();
    expect(notations(second.container)).toContain('炮');
  });
});
