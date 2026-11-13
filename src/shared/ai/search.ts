// negamax + alpha-beta：迭代加深、吃子优先排序、叶节点静态吃子搜索。
// 时限全走注入的 now()：这个文件里没有第二处读墙钟的地方，单测才能用伪造时钟跑出确定结果。

import type { Move, Position } from '../types.ts';
import { pieceAt } from '../board.ts';
import { applyMove } from '../moves.ts';
import { generateLegalMoves } from '../rules.ts';
import { PIECE_VALUES, evaluate } from './evaluate.ts';

/** 杀分基数：任何真实评估都远小于它，找到杀永远压过多吃一子。 */
const MATE = 100_000;

/** 静态搜索的层数上限：只追叶节点附近的吃子交换，追太深会把预算烧进长兑换。 */
const QUIESCENCE_MAX_PLY = 4;

export interface SearchLimits {
  readonly maxDepth: number;
  readonly budgetMs: number;
  readonly now: () => number;
}

export interface SearchResult {
  readonly move: Move;
  /** 实际跑完的最深层数；0 表示第一层都没跑完，着法退回 generateLegalMoves 的第一枚。 */
  readonly depth: number;
  /** 进入 alpha-beta 与静态搜索的次数。 */
  readonly nodes: number;
  readonly elapsedMs: number;
}

interface SearchContext {
  readonly now: () => number;
  readonly deadline: number;
  nodes: number;
  aborted: boolean;
}

interface RootResult {
  readonly move: Move;
  readonly score: number;
}

function sameMove(left: Move, right: Move): boolean {
  return left.from === right.from && left.to === right.to;
}

/**
 * 吃子优先 + MVV-LVA：先用小代价吃大子。
 * alpha-beta 先搜最可能好的着法才剪得动；同分时保持生成顺序。
 */
function captureScore(position: Position, move: Move): number {
  const victim = pieceAt(position.board, move.to);
  if (victim === null) return 0;
  const attacker = pieceAt(position.board, move.from);
  // 起点必是棋子（着法都来自 generateLegalMoves）；取 0 只会让排序退化成纯按被吃子估值。
  const attackerValue = attacker === null ? 0 : PIECE_VALUES[attacker.type];
  return PIECE_VALUES[victim.type] * 10 - attackerValue;
}

function orderMoves(position: Position, moves: readonly Move[]): Move[] {
  const keyed = moves.map((move) => ({ move, score: captureScore(position, move) }));
  keyed.sort((left, right) => right.score - left.score);
  return keyed.map((entry) => entry.move);
}

/**
 * 前置条件：局面有合法着法。没有着法时给不出「最佳的一着」，
 * 返回空值只会把调用方的错误推到页面上，所以当场抛错。
 */
export function search(position: Position, limits: SearchLimits): SearchResult {
  const started = limits.now();
  const legal = generateLegalMoves(position);
  const first = legal[0];
  if (first === undefined) throw new Error('search: position has no legal move');

  const context: SearchContext = {
    now: limits.now,
    deadline: started + limits.budgetMs,
    nodes: 0,
    aborted: false,
  };

  let order = orderMoves(position, legal);
  let move = first;
  let depth = 0;
  for (let target = 1; target <= limits.maxDepth; target += 1) {
    // 上一层已经用光预算就不再开新层：开了也只能搜到半层，半层不能拿来定着法。
    if (context.now() >= context.deadline) break;
    const completed = searchRoot(context, position, target, order);
    if (completed === null) break;
    move = completed.move;
    depth = target;
    // 下一层先搜本层的最佳着法：好着法越早出现，alpha-beta 剪得越狠。
    order = [completed.move, ...order.filter((candidate) => !sameMove(candidate, completed.move))];
  }

  return { move, depth, nodes: context.nodes, elapsedMs: context.now() - started };
}

function searchRoot(
  context: SearchContext,
  position: Position,
  depth: number,
  order: readonly Move[],
): RootResult | null {
  let alpha = -Infinity;
  let best: RootResult | null = null;
  for (const move of order) {
    const score = -negamax(context, applyMove(position, move), depth - 1, -Infinity, -alpha, 1);
    // 这一层搜到一半超时：整层作废。半层的分数是拿半棵树比出来的，用它定着法会走臭棋。
    if (context.aborted) return null;
    if (best === null || score > best.score) best = { move, score };
    if (score > alpha) alpha = score;
  }
  return best;
}

function negamax(
  context: SearchContext,
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
): number {
  context.nodes += 1;
  // 每个节点展开前看一次表：超时就把这一层整体作废，绝不在半层上返回着法。
  if (context.now() >= context.deadline) {
    context.aborted = true;
    return 0;
  }
  // 叶节点直接进静态搜索：省一遍全部着法生成，也省一遍无着法判定。
  if (depth === 0) return quiescence(context, position, alpha, beta, 0);

  const moves = generateLegalMoves(position);
  if (moves.length === 0) {
    // 中国象棋里困毙也判负，所以「没有着法可走」一律是负分；减去 ply 让同分杀早兑现。
    return -(MATE - ply);
  }
  let best = -Infinity;
  let window = alpha;
  for (const move of orderMoves(position, moves)) {
    const score = -negamax(context, applyMove(position, move), depth - 1, -beta, -window, ply + 1);
    if (context.aborted) return 0;
    if (score > best) best = score;
    if (score > window) window = score;
    if (window >= beta) break;
  }
  return best;
}

/** 叶节点的吃子搜索：站住不动也是一种选择，站得住就以它为下限，只看吃子着法。 */
function quiescence(
  context: SearchContext,
  position: Position,
  alpha: number,
  beta: number,
  qply: number,
): number {
  context.nodes += 1;
  if (context.now() >= context.deadline) {
    context.aborted = true;
    return 0;
  }
  const standPat = evaluate(position);
  if (qply >= QUIESCENCE_MAX_PLY || standPat >= beta) return standPat;

  let best = standPat;
  let window = Math.max(alpha, standPat);
  const captures = generateLegalMoves(position).filter(
    (move) => pieceAt(position.board, move.to) !== null,
  );
  for (const move of orderMoves(position, captures)) {
    const score = -quiescence(context, applyMove(position, move), -beta, -window, qply + 1);
    if (context.aborted) return 0;
    if (score > best) best = score;
    if (score > window) window = score;
    if (window >= beta) break;
  }
  return best;
}
