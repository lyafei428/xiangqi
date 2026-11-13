// 走法生成与攻击判定。这里只回答"这着从规则上能不能走"，不问"走完自己会不会被将"。

import type { Board, Color, Move, Piece, Position } from './types.ts';
import {
  BOARD_SIZE,
  hasCrossedRiver,
  indexOf,
  isInPalace,
  isOnBoard,
  opposite,
  pieceAt,
  xOf,
  yOf,
} from './board.ts';

interface Step {
  readonly dx: number;
  readonly dy: number;
}

const ORTHOGONAL_STEPS: readonly Step[] = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const DIAGONAL_STEPS: readonly Step[] = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

const KNIGHT_STEPS: readonly Step[] = [
  { dx: 1, dy: 2 },
  { dx: 2, dy: 1 },
  { dx: 2, dy: -1 },
  { dx: 1, dy: -2 },
  { dx: -1, dy: -2 },
  { dx: -2, dy: -1 },
  { dx: -2, dy: 1 },
  { dx: -1, dy: 2 },
];

function canLand(board: Board, to: number, color: Color): boolean {
  const target = pieceAt(board, to);
  return target === null || target.color !== color;
}

function addRookMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of ORTHOGONAL_STEPS) {
    let cx = x + step.dx;
    let cy = y + step.dy;
    while (isOnBoard(cx, cy)) {
      const to = indexOf(cx, cy);
      const target = pieceAt(board, to);
      if (target === null) {
        out.push({ from, to });
      } else {
        if (target.color !== color) out.push({ from, to });
        break;
      }
      cx += step.dx;
      cy += step.dy;
    }
  }
}

function addCannonMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of ORTHOGONAL_STEPS) {
    let cx = x + step.dx;
    let cy = y + step.dy;
    // 炮架出现前等同于车；出现后只能吃炮架后的第一个子，且不能再落到空格。
    let hasScreen = false;
    while (isOnBoard(cx, cy)) {
      const to = indexOf(cx, cy);
      const target = pieceAt(board, to);
      if (!hasScreen) {
        if (target === null) out.push({ from, to });
        else hasScreen = true;
      } else if (target !== null) {
        if (target.color !== color) out.push({ from, to });
        break;
      }
      cx += step.dx;
      cy += step.dy;
    }
  }
}

function addKnightMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of KNIGHT_STEPS) {
    const tx = x + step.dx;
    const ty = y + step.dy;
    if (!isOnBoard(tx, ty)) continue;
    // 马腿沿位移为 2 的那条轴取半：|dx|=2 时腿在 (x+dx/2, y)，|dy|=2 时在 (x, y+dy/2)。
    const legX = Math.abs(step.dx) === 2 ? x + step.dx / 2 : x;
    const legY = Math.abs(step.dy) === 2 ? y + step.dy / 2 : y;
    if (pieceAt(board, indexOf(legX, legY)) !== null) continue;
    const to = indexOf(tx, ty);
    if (!canLand(board, to, color)) continue;
    out.push({ from, to });
  }
}

function addBishopMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of DIAGONAL_STEPS) {
    const tx = x + step.dx * 2;
    const ty = y + step.dy * 2;
    if (!isOnBoard(tx, ty)) continue;
    if (hasCrossedRiver(color, ty)) continue;
    if (pieceAt(board, indexOf(x + step.dx, y + step.dy)) !== null) continue;
    const to = indexOf(tx, ty);
    if (!canLand(board, to, color)) continue;
    out.push({ from, to });
  }
}

function addAdvisorMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of DIAGONAL_STEPS) {
    const tx = x + step.dx;
    const ty = y + step.dy;
    if (!isOnBoard(tx, ty) || !isInPalace(color, tx, ty)) continue;
    const to = indexOf(tx, ty);
    if (!canLand(board, to, color)) continue;
    out.push({ from, to });
  }
}

function addKingMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  for (const step of ORTHOGONAL_STEPS) {
    const tx = x + step.dx;
    const ty = y + step.dy;
    if (!isOnBoard(tx, ty) || !isInPalace(color, tx, ty)) continue;
    const to = indexOf(tx, ty);
    if (!canLand(board, to, color)) continue;
    out.push({ from, to });
  }
}

function addPawnMoves(
  board: Board,
  from: number,
  x: number,
  y: number,
  color: Color,
  out: Move[],
): void {
  const forward = color === 'red' ? -1 : 1;
  const ty = y + forward;
  if (isOnBoard(x, ty)) {
    const to = indexOf(x, ty);
    if (canLand(board, to, color)) out.push({ from, to });
  }
  if (!hasCrossedRiver(color, y)) return;
  for (const dx of [-1, 1]) {
    const tx = x + dx;
    if (!isOnBoard(tx, y)) continue;
    const to = indexOf(tx, y);
    if (canLand(board, to, color)) out.push({ from, to });
  }
}

export function generateMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < BOARD_SIZE; from += 1) {
    const piece = pieceAt(pos.board, from);
    if (piece === null || piece.color !== pos.turn) continue;
    const x = xOf(from);
    const y = yOf(from);
    switch (piece.type) {
      case 'R':
        addRookMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'C':
        addCannonMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'N':
        addKnightMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'B':
        addBishopMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'A':
        addAdvisorMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'K':
        addKingMoves(pos.board, from, x, y, piece.color, moves);
        break;
      case 'P':
        addPawnMoves(pos.board, from, x, y, piece.color, moves);
        break;
    }
  }
  return moves;
}

/** 统计两个同列/同行格之间的棋子数。调用方负责保证二者共线且不重合。 */
function countBetween(board: Board, from: number, to: number): number {
  const fromX = xOf(from);
  const fromY = yOf(from);
  const toX = xOf(to);
  const toY = yOf(to);
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let count = 0;
  let x = fromX + stepX;
  let y = fromY + stepY;
  while (x !== toX || y !== toY) {
    if (pieceAt(board, indexOf(x, y)) !== null) count += 1;
    x += stepX;
    y += stepY;
  }
  return count;
}

function attacksSquare(board: Board, from: number, piece: Piece, to: number): boolean {
  const fromX = xOf(from);
  const fromY = yOf(from);
  const toX = xOf(to);
  const toY = yOf(to);
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return false;

  switch (piece.type) {
    case 'K': {
      // 飞将：同列且中间无子时，将帅攻击该列上任何格。走开后照面由合法着法过滤挡掉，
      // 所以这里不需要第二条规则。
      if (fromX === toX) return countBetween(board, from, to) === 0;
      return isInPalace(piece.color, toX, toY) && Math.abs(dx) + Math.abs(dy) === 1;
    }
    case 'A':
      return Math.abs(dx) === 1 && Math.abs(dy) === 1 && isInPalace(piece.color, toX, toY);
    case 'B':
      return (
        Math.abs(dx) === 2 &&
        Math.abs(dy) === 2 &&
        !hasCrossedRiver(piece.color, toY) &&
        pieceAt(board, indexOf(fromX + dx / 2, fromY + dy / 2)) === null
      );
    case 'N': {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return false;
      const legX = adx === 2 ? fromX + dx / 2 : fromX;
      const legY = ady === 2 ? fromY + dy / 2 : fromY;
      return pieceAt(board, indexOf(legX, legY)) === null;
    }
    case 'R':
      if (fromX !== toX && fromY !== toY) return false;
      return countBetween(board, from, to) === 0;
    case 'C': {
      if (fromX !== toX && fromY !== toY) return false;
      const between = countBetween(board, from, to);
      // 落点有子时要恰隔一子才能吃；落点为空时只能滑行到炮架之前，隔子反而走不到。
      return pieceAt(board, to) === null ? between === 0 : between === 1;
    }
    case 'P': {
      const forward = piece.color === 'red' ? -1 : 1;
      if (dx === 0) return dy === forward;
      return dy === 0 && Math.abs(dx) === 1 && hasCrossedRiver(piece.color, fromY);
    }
  }
}

export function isSquareAttacked(pos: Position, sq: number, by: Color): boolean {
  for (let from = 0; from < BOARD_SIZE; from += 1) {
    const piece = pieceAt(pos.board, from);
    if (piece === null || piece.color !== by) continue;
    if (attacksSquare(pos.board, from, piece, sq)) return true;
  }
  return false;
}

function assertIndexOnBoard(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new Error(`applyMove: index ${index} is outside 0..${BOARD_SIZE - 1}`);
  }
}

/**
 * 不校验合法性：调用方负责确认这着在规则上成立。
 * 但下标必须落在 0..89：越界的 to 不会抛错，只会把定长 90 的棋盘悄悄撑长，
 * 或者给数组挂上负下标属性——坏局面要到很远的判罚环节才显形，那时已无从追查。
 */
export function applyMove(pos: Position, move: Move): Position {
  assertIndexOnBoard(move.from);
  assertIndexOnBoard(move.to);
  if (move.from === move.to) throw new Error(`applyMove: from and to are both ${move.from}`);
  const moving = pieceAt(pos.board, move.from);
  // 起点空着是调用方的程序错误，静默照做会把目标格抹成空格，坏棋盘会一路传下去。
  if (moving === null) throw new Error(`applyMove: no piece at index ${move.from}`);
  const board = pos.board.slice();
  board[move.from] = null;
  board[move.to] = moving;
  return { board, turn: opposite(pos.turn) };
}
