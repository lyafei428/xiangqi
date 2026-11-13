// 合法着法、将军、终局，以及长将/重复/自然限着这些判罚口径。

import type {
  Board,
  Color,
  GameResult,
  GameStatus,
  HistoryEntry,
  Move,
  Position,
} from './types.ts';
import { BOARD_SIZE, opposite, pieceAt } from './board.ts';
import { fenKey, positionKey, toFen, turnOfFen } from './fen.ts';
import { applyMove, generateMoves, isSquareAttacked } from './moves.ts';

/** 连续 120 着（60 回合）无吃子判和。 */
export const NATURAL_LIMIT = 120;

function findKing(board: Board, color: Color): number {
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const piece = pieceAt(board, index);
    if (piece !== null && piece.color === color && piece.type === 'K') return index;
  }
  return -1;
}

export function isInCheck(pos: Position, color: Color): boolean {
  const king = findKing(pos.board, color);
  // 没有将帅不是"没被将"，是局面坏了：FEN 读入层已拦一次，走到这里说明内存里的局面被写坏。
  if (king < 0) throw new Error(`isInCheck: ${color} has no king on the board`);
  return isSquareAttacked(pos, king, opposite(color));
}

export function generateLegalMoves(pos: Position): Move[] {
  const legal: Move[] = [];
  for (const move of generateMoves(pos)) {
    const after = applyMove(pos, move);
    if (!isInCheck(after, pos.turn)) legal.push(move);
  }
  return legal;
}

export function isLegal(pos: Position, move: Move): boolean {
  return generateLegalMoves(pos).some(
    (candidate) => candidate.from === move.from && candidate.to === move.to,
  );
}

export function statusOf(pos: Position): GameStatus {
  const inCheck = isInCheck(pos, pos.turn);
  const hasLegalMove = generateLegalMoves(pos).length > 0;
  // 困毙在中国象棋是判负，不是国际象棋的和棋。
  if (!hasLegalMove) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}

function buildEntry(before: Position, after: Position, move: Move): HistoryEntry {
  return {
    move,
    fen: toFen(after),
    gaveCheck: isInCheck(after, after.turn),
    captured: pieceAt(before.board, move.to) !== null,
  };
}

/**
 * 只记录一着，不返回新局面。
 * 与 playMove 同样先过合法性：产出的 HistoryEntry 直接喂给重复判罚与自然限着，
 * 掺进非法着法以后就再也查不出来。
 */
export function recordMove(before: Position, move: Move): HistoryEntry {
  if (!isLegal(before, move)) {
    throw new Error(`recordMove: illegal move ${move.from}->${move.to}`);
  }
  return buildEntry(before, applyMove(before, move), move);
}

/**
 * 落子并记账。
 * 非法着法在这里就抛错：它会同时写进 history，而 history 是重复判罚与自然限着的输入，
 * 混进去以后错在几十着之内都看不出来。
 */
export function playMove(
  pos: Position,
  history: readonly HistoryEntry[],
  move: Move,
): { position: Position; history: HistoryEntry[] } {
  if (!isLegal(pos, move)) {
    throw new Error(`playMove: illegal move ${move.from}->${move.to}`);
  }
  const position = applyMove(pos, move);
  return { position, history: [...history, buildEntry(pos, position, move)] };
}

export function repetitionResult(
  position: Position,
  history: readonly HistoryEntry[],
  startFen: string,
): GameResult | null {
  const key = positionKey(position);
  const occurrences: number[] = [];
  // 起始局面在第一着之前就已出现一次，history 里没有它。不补这一项，「双方各自挪回原位」
  // 这类循环要晚一整圈才判和——而那正是三次重复规则最常被用到的场合。
  if (fenKey(startFen) === key) occurrences.push(-1);
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (entry !== undefined && fenKey(entry.fen) === key) occurrences.push(index);
  }
  const second = occurrences[1];
  const third = occurrences[2];
  if (second === undefined || third === undefined) return null;

  // 循环段取「第二次出现到第三次出现」这一整圈，而不是「第一次到第三次」。
  // 后者会把循环之前的着法也混进来：某方在循环前将军过、循环里却不是每着都将军，
  // 就会被判成和棋，把该判负的长将放过去。起始局面计入后这种跨度可能大到整局。
  const cycle = history.slice(second + 1, third + 1);
  let redMoves = 0;
  let redChecks = 0;
  let blackMoves = 0;
  let blackChecks = 0;
  for (const entry of cycle) {
    // 条目里的 FEN 是走完这着之后的场面，所以它的行棋方是走子方的对手。
    const mover = opposite(turnOfFen(entry.fen));
    if (mover === 'red') {
      redMoves += 1;
      if (entry.gaveCheck) redChecks += 1;
    } else {
      blackMoves += 1;
      if (entry.gaveCheck) blackChecks += 1;
    }
  }
  const redPerpetual = redMoves > 0 && redChecks === redMoves;
  const blackPerpetual = blackMoves > 0 && blackChecks === blackMoves;
  // 只有一方每着都将军才判长将；双方都将军或都不将军都按和棋处理。
  if (redPerpetual === blackPerpetual) return { type: 'repetition', winner: null };
  return { type: 'perpetual', winner: redPerpetual ? 'black' : 'red' };
}

export function naturalLimitResult(history: readonly HistoryEntry[]): GameResult | null {
  let quietMoves = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry === undefined || entry.captured) break;
    quietMoves += 1;
  }
  return quietMoves >= NATURAL_LIMIT ? { type: 'natural', winner: null } : null;
}

/** 走子后的完整判定，命中顺序：将死 → 困毙 → 长将/重复 → 自然限着。 */
export function judgeGame(
  position: Position,
  history: readonly HistoryEntry[],
  startFen: string,
): GameResult | null {
  const status = statusOf(position);
  if (status === 'checkmate') return { type: 'checkmate', winner: opposite(position.turn) };
  if (status === 'stalemate') return { type: 'stalemate', winner: opposite(position.turn) };
  return repetitionResult(position, history, startFen) ?? naturalLimitResult(history);
}
