// 坐标换算与棋盘操作。全引擎只有这里定义"格"是什么。

import type { Board, Color, Piece, Position } from './types.ts';

export const BOARD_WIDTH = 9;
export const BOARD_HEIGHT = 10;
export const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;

export function indexOf(x: number, y: number): number {
  return y * BOARD_WIDTH + x;
}

export function xOf(index: number): number {
  return index % BOARD_WIDTH;
}

export function yOf(index: number): number {
  return Math.floor(index / BOARD_WIDTH);
}

export function isOnBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
}

export function opposite(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

/** 九宫：红 x∈[3,5] y∈[7,9]，黑 x∈[3,5] y∈[0,2]。 */
export function isInPalace(color: Color, x: number, y: number): boolean {
  if (x < 3 || x > 5) return false;
  return color === 'red' ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

/** 红兵 y ≤ 4 已过河，黑卒 y ≥ 5 已过河。 */
export function hasCrossedRiver(color: Color, y: number): boolean {
  return color === 'red' ? y <= 4 : y >= 5;
}

/** 空数组下标在 noUncheckedIndexedAccess 下是 undefined，这里统一收敛成 null。 */
export function pieceAt(board: Board, index: number): Piece | null {
  return board[index] ?? null;
}

export function emptyBoard(): Board {
  return new Array<Piece | null>(BOARD_SIZE).fill(null);
}

export function positionsEqual(a: Position, b: Position): boolean {
  if (a.turn !== b.turn) return false;
  if (a.board.length !== b.board.length) return false;
  for (let index = 0; index < a.board.length; index += 1) {
    const left = a.board[index] ?? null;
    const right = b.board[index] ?? null;
    if (left === null && right === null) continue;
    if (left === null || right === null) return false;
    if (left.color !== right.color || left.type !== right.type) return false;
  }
  return true;
}
