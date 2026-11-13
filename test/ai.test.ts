// 引擎层用例：着法合法性、一步杀、不吃亏子力、难度表、注入时限、破契约抛错、评估符号。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_LEVELS,
  INITIAL_FEN,
  applyMove,
  chooseMove,
  generateLegalMoves,
  indexOf,
  isLegal,
  parseFen,
  pieceAt,
  statusOf,
} from '../src/shared/index.ts';
import { evaluate } from '../src/shared/ai/evaluate.ts';

const at = (x: number, y: number): number => indexOf(x, y);

/** 不走字的时钟：预算永远不到期，搜索跑到本档满深度。考搜索正确性时用它，别让 CI 抖动冒充缺陷。 */
const frozenClock = (): number => 0;

/** 红方一步杀：车 (0,5) 进到 (0,0) 成杀；同一只车还能白吃黑车 (8,5)，杀分必须压过那 900 分。 */
const MATE_IN_ONE_FEN = '4k4/1R7/9/9/9/R7r/9/9/9/3K5 w - - 0 1';

/** 黑方被困毙：将无路、士也动不了，但没被将。中国象棋判困毙方负，与将死同等。 */
const STALEMATE_FEN = '3aka3/4a4/3a1a3/9/9/9/9/9/9/4K4 b - - 0 1';

test('初始局面：给出一着合法着法，并带回搜索读数', () => {
  const position = parseFen(INITIAL_FEN);
  // 搜索读数用伪造时钟：CI 机器一抖就把 200ms 预算耗尽，断言 depth 会变成测机器快慢。
  const reply = chooseMove(position, { level: 'easy', now: frozenClock });
  assert.ok(isLegal(position, reply.move), `着法 ${reply.move.from}->${reply.move.to} 不合法`);
  assert.ok(reply.depth >= 1, `至少跑完一层，实际 ${reply.depth}`);
  assert.ok(reply.nodes > 0, `节点数应为正，实际 ${reply.nodes}`);
  assert.ok(reply.elapsedMs >= 0, `耗时读数应为非负，实际 ${reply.elapsedMs}`);
});

test('不传 now 也能用：默认时钟下同样回一着合法着法', () => {
  const position = parseFen(INITIAL_FEN);
  // 只验「能回一着合法着法」；不约束 depth——真实时钟下深度取决于机器。
  const reply = chooseMove(position, { level: 'easy' });
  assert.ok(isLegal(position, reply.move), `着法 ${reply.move.from}->${reply.move.to} 不合法`);
  assert.ok(reply.elapsedMs >= 0);
});

test('一步杀必找到：宽预算 + 伪造时钟', () => {
  const position = parseFen(MATE_IN_ONE_FEN);
  const reply = chooseMove(position, { level: 'easy', now: frozenClock });
  assert.deepEqual(reply.move, { from: at(0, 5), to: at(0, 0) }, '应走一步杀，而不是白吃那只车');
  const after = applyMove(position, reply.move);
  assert.equal(statusOf(after), 'checkmate');
  assert.equal(generateLegalMoves(after).length, 0, '走完对方无着法');
});

test('白送大车必吃：不吃亏子力', () => {
  const position = parseFen('3k5/9/9/9/4r4/9/9/9/4R4/4K4 w - - 0 1');
  const reply = chooseMove(position, { level: 'easy', now: frozenClock });
  assert.deepEqual(reply.move, { from: at(4, 8), to: at(4, 4) }, '无保护的车必须吃掉');
  const after = applyMove(position, reply.move);
  assert.deepEqual(pieceAt(after.board, at(4, 4)), { color: 'red', type: 'R' });
});

test('难度表：深度与预算逐档单调，且都低于需求的 2 秒', () => {
  assert.deepEqual(AI_LEVELS.easy, { maxDepth: 2, budgetMs: 200 });
  assert.deepEqual(AI_LEVELS.normal, { maxDepth: 4, budgetMs: 1200 });
  assert.deepEqual(AI_LEVELS.hard, { maxDepth: 6, budgetMs: 1800 });

  const levels = [AI_LEVELS.easy, AI_LEVELS.normal, AI_LEVELS.hard];
  for (const [index, level] of levels.entries()) {
    assert.ok(level.budgetMs < 2_000, `第 ${index + 1} 档预算 ${level.budgetMs} 超过了需求上限 2 秒`);
    const previous = levels[index - 1];
    if (previous === undefined) continue;
    assert.ok(level.maxDepth > previous.maxDepth, `第 ${index + 1} 档深度没有变深`);
    assert.ok(level.budgetMs > previous.budgetMs, `第 ${index + 1} 档预算没有变大`);
  }
});

test('伪造时钟：走过预算就停手，不把整档深度跑完', () => {
  // 每读一次表走 1ms：读数确定，能不能守时不取决于本机快慢。
  const budget = AI_LEVELS.normal.budgetMs;
  let clock = 0;
  const position = parseFen(INITIAL_FEN);
  const reply = chooseMove(position, { level: 'normal', now: () => (clock += 1) });

  assert.ok(isLegal(position, reply.move), '停手时给出的仍必须是合法着法');
  assert.ok(reply.depth >= 1, `第一层要在预算内跑完，实际 ${reply.depth}`);
  assert.ok(reply.depth < AI_LEVELS.normal.maxDepth, `预算内跑不完四层，实际 ${reply.depth}`);
  assert.ok(reply.elapsedMs <= budget + 2, `读数 ${reply.elapsedMs}ms 超出预算 ${budget}ms`);
  assert.ok(reply.nodes <= budget + 3, `节点数 ${reply.nodes} 说明搜索没在预算处停手`);
});

test('调用方破契约：无合法着法时抛错，不返回空值', () => {
  const mate = parseFen(MATE_IN_ONE_FEN);
  const checkmated = applyMove(mate, { from: at(0, 5), to: at(0, 0) });
  assert.equal(statusOf(checkmated), 'checkmate');
  assert.throws(() => chooseMove(checkmated, { level: 'easy', now: frozenClock }), /no legal move/);

  const stalemated = parseFen(STALEMATE_FEN);
  assert.equal(statusOf(stalemated), 'stalemate');
  assert.throws(() => chooseMove(stalemated, { level: 'easy', now: frozenClock }), /no legal move/);
});

test('评估：开局为 0，出口是行棋方视角', () => {
  const initial = parseFen(INITIAL_FEN);
  assert.equal(evaluate(initial), 0, '对称开局两边分必须相等');

  const redUpARook = parseFen('3k5/9/9/9/9/9/9/9/4R4/4K4 w - - 0 1');
  assert.ok(evaluate(redUpARook) > 0, '红多一车，红走时为正');
  assert.equal(evaluate({ board: redUpARook.board, turn: 'black' }), -evaluate(redUpARook));
});
