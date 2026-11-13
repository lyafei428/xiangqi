// 集成用例 F1-5（棋谱回放、导入导出与续局里的回放侧）。
// 从页面入口走：棋谱页列表 → 回放 → 拖到末步；导入坏文件与好文件；不存在的 id。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { INITIAL_FEN, indexOf } from '../../src/shared/index.ts';
import type { GameRecord } from '../../src/shared/record.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

const MOVES = [
  { from: indexOf(1, 7), to: indexOf(1, 6) },
  { from: indexOf(1, 2), to: indexOf(1, 3) },
  { from: indexOf(1, 6), to: indexOf(1, 7) },
  { from: indexOf(1, 3), to: indexOf(1, 2) },
];

const SAVED_AT = 1_700_000_000_000;

function record(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: SAVED_AT,
    startFen: INITIAL_FEN,
    moves: MOVES,
    result: { type: 'repetition', winner: null },
    redMs: 590_000,
    blackMs: 585_000,
    savedAt: SAVED_AT,
    ...overrides,
  };
}

function seed(items: readonly GameRecord[]): void {
  localStorage.setItem('xiangqi.records.v1', JSON.stringify(items));
}

function open(hash: string): HTMLElement {
  window.location.hash = hash;
  const view = render(<App />);
  return view.container;
}

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

describe('F1-5 棋谱回放', () => {
  it('列表列出已存的棋局', () => {
    seed([record()]);
    const container = open('#/replay');
    expect(container.querySelectorAll('.replay-row')).toHaveLength(1);
    expect(screen.getByText('和棋 · 三次重复局面')).toBeTruthy();
    expect(screen.getByText('4 着')).toBeTruthy();
  });

  it('空库显示「还没有棋谱」', () => {
    open('#/replay');
    expect(screen.getByText('还没有棋谱')).toBeTruthy();
  });

  it('回放可停在任意一步，末步与滑条一致', () => {
    seed([record()]);
    const container = open(`#/replay/${String(SAVED_AT)}`);
    expect(screen.getByText('第 0 / 4 着')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('第 1 / 4 着')).toBeTruthy();
    const current = container.querySelector('.replay-move[aria-current="true"]');
    expect(current?.textContent).toContain('炮八进一');

    fireEvent.change(screen.getByLabelText('回放步数'), { target: { value: '3' } });
    expect(screen.getByText('第 3 / 4 着')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '末' }));
    expect(screen.getByText('第 4 / 4 着')).toBeTruthy();
    expect(container.querySelectorAll('.replay-move')).toHaveLength(4);
  });

  it('不存在的 id：右侧提示且不改写地址', () => {
    seed([record()]);
    open('#/replay/999999');
    expect(screen.getByText('棋谱不存在')).toBeTruthy();
    expect(screen.getByText('和棋 · 三次重复局面')).toBeTruthy();
  });

  it('坏记录显示「这条棋谱无法回放」并可删除', () => {
    // 坐标合法但走法非法：结构校验能过，回放时才暴露。
    seed([record({ moves: [{ from: indexOf(0, 9), to: indexOf(0, 9) + 1 }] })]);
    const container = open(`#/replay/${String(SAVED_AT)}`);
    expect(screen.getByText('这条棋谱无法回放')).toBeTruthy();
    const broken = container.querySelector('.replay-broken');
    if (broken === null) throw new Error('缺少损坏提示区');
    fireEvent.click(broken.querySelector('button') as HTMLButtonElement);
    expect(localStorage.getItem('xiangqi.records.v1')).toBe('[]');
    expect(container.querySelectorAll('.replay-row')).toHaveLength(0);
  });

  it('导出后重新导入能完整回放', async () => {
    seed([record()]);
    const blobs: Blob[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    try {
      open(`#/replay/${String(SAVED_AT)}`);
      fireEvent.click(screen.getByRole('button', { name: '导出' }));
      expect(blobs).toHaveLength(1);
      const exported = await blobs[0]!.text();
      cleanup();

      // 清空库后，再把刚导出的文本走导入。
      localStorage.setItem('xiangqi.records.v1', '[]');
      open('#/replay');
      expect(screen.getByText('还没有棋谱')).toBeTruthy();
      const input = screen.getByLabelText('导入棋谱') as HTMLInputElement;
      const file = new File([exported], 'exported.json', { type: 'application/json' });
      fireEvent.change(input, { target: { files: [file] } });
      expect(await screen.findByText('第 0 / 4 着')).toBeTruthy();
      expect(screen.getByText('和棋 · 三次重复局面')).toBeTruthy();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('导入坏文件给提示，好文件入列表', async () => {
    open('#/replay');
    const input = screen.getByLabelText('导入棋谱') as HTMLInputElement;

    const bad = new File(['{"nope":1}'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText('文件不是有效的棋谱')).toBeTruthy();

    const good = new File([JSON.stringify(record())], 'good.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [good] } });
    // 导入成功会直接跳到该局回放，所以断言落盘与页面切换。
    expect(await screen.findByText('第 0 / 4 着')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('xiangqi.records.v1') ?? '[]') as unknown[];
    expect(stored).toHaveLength(1);
    expect(window.location.hash.startsWith('#/replay/')).toBe(true);
  });
});
