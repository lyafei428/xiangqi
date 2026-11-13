// @vitest-environment jsdom
// 集成用例 F3-2：从 App 进对弈题，走进将死着过关；走错显示未达成并可重试。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { findMission } from '../../src/client/missions/content.ts';
import { findDefenseMoves, findMatingMoves } from '../../src/client/missions/mate.ts';
import { generateLegalMoves, parseFen } from '../../src/shared/index.ts';

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
  window.location.hash = '#/missions';
});

function goto(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
}

function tapSquare(board: Element, square: number): void {
  const x = 50 + (square % 9) * 100;
  const y = 50 + Math.floor(square / 9) * 100;
  fireEvent.pointerDown(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(board, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

function boardOf(container: HTMLElement): Element {
  const board = container.querySelector('.board');
  if (board === null) throw new Error('棋盘未渲染');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(VIEW_RECT);
  return board;
}

describe('F3-2 对弈题达成目标即通过', () => {
  it('从题目列表进入，走进将死着过关', async () => {
    const view = render(<App />);
    expect(screen.getByRole('heading', { name: '对弈题' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /对面笑：一步杀/ }));
    await screen.findByRole('heading', { name: /对弈题 · 找杀/ });

    const mission = findMission('mission-flying-general');
    if (mission === undefined) throw new Error('题目缺失');
    const mate = findMatingMoves(parseFen(mission.fen))[0];
    if (mate === undefined) throw new Error('没有将死着');

    const board = boardOf(view.container);
    tapSquare(board, mate.from);
    tapSquare(board, mate.to);

    expect(screen.getByRole('status').textContent).toContain('过关');
    expect(screen.getByText('将死，过关。')).toBeTruthy();
  });

  it('防守题走出化解着即通过', async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /守住将门（左）/ }));
    await screen.findByRole('heading', { name: /对弈题 · 防守/ });

    const mission = findMission('mission-defense-left');
    if (mission === undefined) throw new Error('题目缺失');
    const position = parseFen(mission.fen);
    const defense = findDefenseMoves(position, position.turn)[0];
    if (defense === undefined) throw new Error('没有化解着法');

    const board = boardOf(view.container);
    tapSquare(board, defense.from);
    tapSquare(board, defense.to);

    expect(screen.getByRole('status').textContent).toContain('过关');
    expect(screen.getByText('守住了，过关。')).toBeTruthy();
  });


  it('走错显示未达成；错两次提示，三次给出答案', async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('link', { name: /对面笑：一步杀/ }));
    await screen.findByRole('heading', { name: /对弈题 · 找杀/ });

    const mission = findMission('mission-flying-general');
    if (mission === undefined) throw new Error('题目缺失');
    const position = parseFen(mission.fen);
    const mating = new Set(findMatingMoves(position).map((move) => `${move.from}-${move.to}`));
    const wrong = generateLegalMoves(position).find(
      (move) => !mating.has(`${move.from}-${move.to}`),
    );
    if (wrong === undefined) throw new Error('没有非杀着法');

    const board = boardOf(view.container);
    tapSquare(board, wrong.from);
    tapSquare(board, wrong.to);
    expect(screen.getByRole('status').textContent).toContain('未达成');
    expect(screen.queryByText(/提示：/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.getByText('第 2 次尝试')).toBeTruthy();
    tapSquare(board, wrong.from);
    tapSquare(board, wrong.to);
    expect(screen.getByText(/提示：/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    tapSquare(board, wrong.from);
    tapSquare(board, wrong.to);
    expect(screen.getByText(/正确着法：/)).toBeTruthy();
  });
});
