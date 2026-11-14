// 集成用例 F1-9：棋谱库分类浏览与回放。
// 从页面入口走：棋谱页 → 棋谱库 → 筛选 → 打开一条 → 走到末步与带说明的一步。

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { studyRecords } from '../../src/client/study/content.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

function open(): HTMLElement {
  window.location.hash = '#/replay';
  const view = render(<App />);
  return view.container;
}

function openLibrary(): HTMLElement {
  const container = open();
  fireEvent.click(screen.getByRole('button', { name: '棋谱库' }));
  return container;
}

afterEach(cleanup);

describe('F1-9 棋谱库', () => {
  it('切到棋谱库看到四类共 16 条', () => {
    const container = openLibrary();
    expect(container.querySelectorAll('.study-row')).toHaveLength(16);
    expect(screen.getByRole('button', { name: '全部' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '开局' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '中局' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '终局' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '残局' })).toBeTruthy();
  });

  it('按「残局」筛选只剩 4 条', () => {
    const container = openLibrary();
    fireEvent.click(screen.getByRole('button', { name: '残局' }));
    expect(container.querySelectorAll('.study-row')).toHaveLength(4);
    expect(screen.getByText('卧槽马')).toBeTruthy();
    expect(screen.getByText('双马饮泉')).toBeTruthy();
  });

  it('点开一条能走到末步，记谱条数等于步数', () => {
    const container = openLibrary();
    const target = studyRecords[0];
    if (target === undefined) throw new Error('棋谱库内容为空');
    fireEvent.click(screen.getByText(target.title));
    fireEvent.click(screen.getByRole('button', { name: '末' }));
    expect(screen.getByText(`第 ${target.moves.length} / ${target.moves.length} 着`)).toBeTruthy();
    expect(container.querySelectorAll('.replay-move')).toHaveLength(target.moves.length);
  });

  it('走到带说明的那一步，说明出现在棋盘下方', () => {
    const container = openLibrary();
    const target = studyRecords[0];
    if (target === undefined) throw new Error('棋谱库内容为空');
    const note = target.notes.find((item) => item.step > 0);
    if (note === undefined) throw new Error('首条棋谱缺少步进说明');

    fireEvent.click(screen.getByText(target.title));
    fireEvent.change(screen.getByLabelText('回放步数'), { target: { value: String(note.step) } });

    const noteEl = screen.getByText(note.text);
    const board = container.querySelector('.board-fit');
    if (board === null) throw new Error('缺少棋盘');
    expect(board.compareDocumentPosition(noteEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
