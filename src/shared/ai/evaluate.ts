// 局面评估：子力 + 位置表（兵按推进、马炮按中心）+ 将帅安全。
// 内部按红正黑负累加，出口切成行棋方视角：negamax 每个节点问的都是「我这方净赚多少」。

import type { Board, Color, Piece, PieceType, Position } from '../types.ts';
import { BOARD_HEIGHT, BOARD_SIZE, hasCrossedRiver, indexOf, pieceAt, xOf, yOf } from '../board.ts';

/** 子力价。将帅从不被吃（合法着法已排除自杀），双方各一，计分只会在两边对冲掉。 */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  K: 0,
  R: 900,
  N: 400,
  C: 450,
  A: 200,
  B: 200,
  P: 100,
};

/** 兵每推进一格的小分；过河后再补一笔——过河兵能横走，比未过河的值钱得多。 */
const PAWN_ADVANCE = 10;
const PAWN_CROSSED = 40;

/** 马炮按到棋盘中心的曼哈顿距离给分：边角是死地，中心才发得出力。 */
const KNIGHT_CENTER = 10;
const CANNON_CENTER = 8;

/** 将帅守在九宫底线加分；所在纵线朝对方敞开、迎头就是敌车敌炮时扣分。 */
const KING_HOME_BONUS = 15;
const KING_EXPOSED_PENALTY = 20;

/** 棋盘中心在 (4, 4.5)：纵线正中与横线中缝。最远的边角相隔 8.5。 */
const CENTER_X = 4;
const CENTER_Y = 4.5;
const CENTER_MAX_DISTANCE = 8.5;

function centerBonus(index: number, weight: number): number {
  const distance = Math.abs(xOf(index) - CENTER_X) + Math.abs(yOf(index) - CENTER_Y);
  return Math.round(((CENTER_MAX_DISTANCE - distance) / CENTER_MAX_DISTANCE) * weight);
}

/** 红兵从 y=6 起步向 y=0 推，黑卒从 y=3 起步向 y=9 推（两个横线就是初始局面的兵线）。 */
function pawnAdvance(piece: Piece, index: number): number {
  const y = yOf(index);
  const steps = piece.color === 'red' ? 6 - y : y - 3;
  return steps * PAWN_ADVANCE + (hasCrossedRiver(piece.color, y) ? PAWN_CROSSED : 0);
}

/** 将帅所在纵线上，朝对方方向最近的棋子是敌方车炮就算「被找上门」——静态倾向，不判将。 */
function underFilePressure(board: Board, color: Color, kingIndex: number): boolean {
  const step = color === 'red' ? -1 : 1;
  const x = xOf(kingIndex);
  for (let y = yOf(kingIndex) + step; y >= 0 && y < BOARD_HEIGHT; y += step) {
    const piece = pieceAt(board, indexOf(x, y));
    if (piece === null) continue;
    return piece.color !== color && (piece.type === 'R' || piece.type === 'C');
  }
  return false;
}

function kingSafety(board: Board, color: Color, kingIndex: number): number {
  const homeRank = color === 'red' ? BOARD_HEIGHT - 1 : 0;
  let score = yOf(kingIndex) === homeRank ? KING_HOME_BONUS : 0;
  if (underFilePressure(board, color, kingIndex)) score -= KING_EXPOSED_PENALTY;
  return score;
}

function positionBonus(piece: Piece, index: number): number {
  switch (piece.type) {
    case 'P':
      return pawnAdvance(piece, index);
    case 'N':
      return centerBonus(index, KNIGHT_CENTER);
    case 'C':
      return centerBonus(index, CANNON_CENTER);
    default:
      return 0;
  }
}

export function evaluate(position: Position): number {
  let score = 0;
  let redKing = -1;
  let blackKing = -1;
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const piece = pieceAt(position.board, index);
    if (piece === null) continue;
    if (piece.type === 'K') {
      if (piece.color === 'red') redKing = index;
      else blackKing = index;
    }
    const value = PIECE_VALUES[piece.type] + positionBonus(piece, index);
    score += piece.color === 'red' ? value : -value;
  }
  // 缺将帅是坏局面（FEN 读入层已拦一次）：静默跳过会把「棋盘被写坏」变成「评估偏低」。
  if (redKing < 0) throw new Error('evaluate: red has no king on the board');
  if (blackKing < 0) throw new Error('evaluate: black has no king on the board');
  score += kingSafety(position.board, 'red', redKing) - kingSafety(position.board, 'black', blackKing);
  return position.turn === 'red' ? score : -score;
}
