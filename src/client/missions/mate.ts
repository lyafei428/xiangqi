// 杀法判定：一步杀、强制杀、一着杀威胁。纯函数，只在题目自证与判定时调用。

import type { Color, Move, Position } from '../../shared/index.ts';
import { applyMove, generateLegalMoves, isInCheck, statusOf } from '../../shared/index.ts';

export function opposite(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

/** 只换行棋方，棋盘不动；用于「若对手先走」的威胁判定。 */
export function withTurn(position: Position, color: Color): Position {
  return position.turn === color ? position : { ...position, turn: color };
}

export function isCheckmateAfter(position: Position, move: Move): boolean {
  return statusOf(applyMove(position, move)) === 'checkmate';
}

export function findMatingMoves(position: Position): Move[] {
  return generateLegalMoves(position).filter((move) => isCheckmateAfter(position, move));
}

/**
 * 当前行棋方能否在 plies 着内强制将死。
 * plies = 2 时要求：存在一着，使对手**任意**合法应着之后仍有一着杀。
 */
export function hasMateIn(position: Position, plies: number): boolean {
  if (plies <= 0) return false;
  if (plies === 1) return findMatingMoves(position).length > 0;
  if (plies !== 2) return false;
  for (const move of generateLegalMoves(position)) {
    const after = applyMove(position, move);
    if (statusOf(after) === 'checkmate') return true;
    if (statusOf(after) === 'stalemate') continue;
    const replies = generateLegalMoves(after);
    if (replies.length === 0) continue;
    let everyReplyLoses = true;
    for (const reply of replies) {
      const afterReply = applyMove(after, reply);
      if (findMatingMoves(afterReply).length === 0) {
        everyReplyLoses = false;
        break;
      }
    }
    if (everyReplyLoses) return true;
  }
  return false;
}

/** 若对手先走，是否有一着杀。defender 是当前要防守的一方。 */
export function hasMateInOneThreat(position: Position, defender: Color): boolean {
  const opponent = opposite(defender);
  // 对手正在被将：轮到他走只能应将，谈不上「一着杀」；翻转后的局面也不合法。
  if (isInCheck(position, opponent)) return false;
  return hasMateIn(withTurn(position, opponent), 1);
}

function byFromTo(a: Move, b: Move): number {
  return a.from - b.from || a.to - b.to;
}

/** 当前行棋方在 plies 着内强制将死的见证着法（排序后）。 */
export function findForcingMoves(position: Position, plies: number): Move[] {
  if (plies <= 1) return [...findMatingMoves(position)].sort(byFromTo);
  if (plies !== 2) return [];
  const forcing: Move[] = [];
  for (const move of [...generateLegalMoves(position)].sort(byFromTo)) {
    const after = applyMove(position, move);
    if (statusOf(after) === 'checkmate') {
      forcing.push(move);
      continue;
    }
    if (statusOf(after) === 'stalemate') continue;
    const replies = generateLegalMoves(after);
    if (replies.length === 0) continue;
    if (replies.every((reply) => findMatingMoves(applyMove(after, reply)).length > 0)) {
      forcing.push(move);
    }
  }
  return forcing;
}

/** 当前行棋方化解「对手一着杀」的着法（排序后）。 */
export function findDefenseMoves(position: Position, defender: Color): Move[] {
  return [...generateLegalMoves(position)]
    .filter((move) => {
      const after = applyMove(position, move);
      if (statusOf(after) === 'checkmate') return true;
      return !hasMateInOneThreat(after, defender);
    })
    .sort(byFromTo);
}
