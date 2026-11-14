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
  judgeGame,
  parseFen,
  pieceAt,
  playMove,
  recordMove,
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
  const reply = chooseMove(position, { level: 'easy', now: frozenClock, history: [], startFen: INITIAL_FEN });
  assert.ok(isLegal(position, reply.move), `着法 ${reply.move.from}->${reply.move.to} 不合法`);
  assert.ok(reply.depth >= 1, `至少跑完一层，实际 ${reply.depth}`);
  assert.ok(reply.nodes > 0, `节点数应为正，实际 ${reply.nodes}`);
  assert.ok(reply.elapsedMs >= 0, `耗时读数应为非负，实际 ${reply.elapsedMs}`);
});

test('不传 now 也能用：默认时钟下同样回一着合法着法', () => {
  const position = parseFen(INITIAL_FEN);
  // 只验「能回一着合法着法」；不约束 depth——真实时钟下深度取决于机器。
  const reply = chooseMove(position, { level: 'easy', history: [], startFen: INITIAL_FEN });
  assert.ok(isLegal(position, reply.move), `着法 ${reply.move.from}->${reply.move.to} 不合法`);
  assert.ok(reply.elapsedMs >= 0);
});

test('一步杀必找到：宽预算 + 伪造时钟', () => {
  const position = parseFen(MATE_IN_ONE_FEN);
  const reply = chooseMove(position, { level: 'easy', now: frozenClock, history: [], startFen: MATE_IN_ONE_FEN });
  assert.deepEqual(reply.move, { from: at(0, 5), to: at(0, 0) }, '应走一步杀，而不是白吃那只车');
  const after = applyMove(position, reply.move);
  assert.equal(statusOf(after), 'checkmate');
  assert.equal(generateLegalMoves(after).length, 0, '走完对方无着法');
});

test('白送大车必吃：不吃亏子力', () => {
  const raceFen = '3k5/9/9/9/4r4/9/9/9/4R4/4K4 w - - 0 1';
  const position = parseFen(raceFen);
  const reply = chooseMove(position, { level: 'easy', now: frozenClock, history: [], startFen: raceFen });
  assert.deepEqual(reply.move, { from: at(4, 8), to: at(4, 4) }, '无保护的车必须吃掉');
  const after = applyMove(position, reply.move);
  assert.deepEqual(pieceAt(after.board, at(4, 4)), { color: 'red', type: 'R' });
});

test('难度表：深度与预算逐档单调，且每档不超自己的时间上限', () => {
  assert.deepEqual(AI_LEVELS.easy, { maxDepth: 2, budgetMs: 200 });
  assert.deepEqual(AI_LEVELS.normal, { maxDepth: 4, budgetMs: 1200 });
  assert.deepEqual(AI_LEVELS.hard, { maxDepth: 6, budgetMs: 3000 });

  const levels = [AI_LEVELS.easy, AI_LEVELS.normal, AI_LEVELS.hard];
  // 需求的上限按档位分：普通档 2 秒，高手档 3 秒（用户裁定的放宽）。
  const ceilingMs = [2_000, 2_000, 3_000];
  for (const [index, level] of levels.entries()) {
    const ceiling = ceilingMs[index] ?? 0;
    assert.ok(level.budgetMs <= ceiling, `第 ${index + 1} 档预算 ${level.budgetMs} 超过了该档上限 ${ceiling}ms`);
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
  const reply = chooseMove(position, { level: 'normal', now: () => (clock += 1), history: [], startFen: INITIAL_FEN });

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
  assert.throws(() => chooseMove(checkmated, { level: 'easy', now: frozenClock, history: [], startFen: MATE_IN_ONE_FEN }), /no legal move/);

  const stalemated = parseFen(STALEMATE_FEN);
  assert.equal(statusOf(stalemated), 'stalemate');
  assert.throws(() => chooseMove(stalemated, { level: 'easy', now: frozenClock, history: [], startFen: STALEMATE_FEN }), /no legal move/);
});

test('评估：开局为 0，出口是行棋方视角', () => {
  const initial = parseFen(INITIAL_FEN);
  assert.equal(evaluate(initial), 0, '对称开局两边分必须相等');

  const redUpARook = parseFen('3k5/9/9/9/9/9/9/9/4R4/4K4 w - - 0 1');
  assert.ok(evaluate(redUpARook) > 0, '红多一车，红走时为正');
  assert.equal(evaluate({ board: redUpARook.board, turn: 'black' }), -evaluate(redUpARook));
});

/**
 * 长将循环的四步：红车在 4 / 3 两列间来回将军，黑将在 (4,0) 与 (3,0) 间躲。
 * 走满两圈后同一局面出现第三次——按规则，每着都将军的红方判负。
 * 注意 startFen 就是循环起点：这条用例同时钉住「起点必须计入重复计数」。
 */
const PERPETUAL_START = '4k4/9/9/9/9/4R4/9/9/9/K8 b - - 0 1';
const PERPETUAL_CYCLE = [
  { from: at(4, 0), to: at(3, 0) },
  { from: at(4, 5), to: at(3, 5) },
  { from: at(3, 0), to: at(4, 0) },
  { from: at(3, 5), to: at(4, 5) },
  { from: at(4, 0), to: at(3, 0) },
  { from: at(4, 5), to: at(3, 5) },
  { from: at(3, 0), to: at(4, 0) },
];
const PERPETUAL_CLOSING = { from: at(3, 5), to: at(4, 5) };

test('AI 不走自成长将的重复线：第三次出现按长将判负计分', () => {
  let state = { position: parseFen(PERPETUAL_START), history: [] as ReturnType<typeof recordMove>[] };
  for (const move of PERPETUAL_CYCLE) state = playMove(state.position, state.history, move);

  // 先把场景钉死：走完那一着，规则确实判红方（AI 自己）长将负。
  const closingEntry = recordMove(state.position, PERPETUAL_CLOSING);
  const verdict = judgeGame(applyMove(state.position, PERPETUAL_CLOSING), [...state.history, closingEntry], PERPETUAL_START);
  assert.deepEqual(verdict, { type: 'perpetual', winner: 'black' }, '这条线必须真的是长将负，否则用例测的是别的东西');

  const reply = chooseMove(state.position, {
    level: 'normal',
    now: frozenClock,
    history: state.history,
    startFen: PERPETUAL_START,
  });
  assert.ok(isLegal(state.position, reply.move), '仍要给出合法着法');
  assert.notDeepEqual(reply.move, PERPETUAL_CLOSING, '不许把自己送进第三次重复（判长将负）');
});

/** 双方都不将军的重复：按三次重复判和，0 分——不能被当成赢棋去追。 */
const QUIET_START = '4k4/9/9/9/9/R8/9/9/9/K8 b - - 0 1';
const QUIET_CYCLE = [
  { from: at(4, 0), to: at(3, 0) },
  { from: at(0, 5), to: at(0, 6) },
  { from: at(3, 0), to: at(4, 0) },
  { from: at(0, 6), to: at(0, 5) },
  { from: at(4, 0), to: at(3, 0) },
  { from: at(0, 5), to: at(0, 6) },
  { from: at(3, 0), to: at(4, 0) },
];
const QUIET_CLOSING = { from: at(0, 6), to: at(0, 5) };

test('非将军的重复线和棋：计 0 分，不被当成赢棋', () => {
  let state = { position: parseFen(QUIET_START), history: [] as ReturnType<typeof recordMove>[] };
  for (const move of QUIET_CYCLE) state = playMove(state.position, state.history, move);

  const closingEntry = recordMove(state.position, QUIET_CLOSING);
  const verdict = judgeGame(applyMove(state.position, QUIET_CLOSING), [...state.history, closingEntry], QUIET_START);
  assert.deepEqual(verdict, { type: 'repetition', winner: null }, '这条线必须真的是重复判和');

  const reply = chooseMove(state.position, {
    level: 'normal',
    now: frozenClock,
    history: state.history,
    startFen: QUIET_START,
  });
  // 红方白多一车：和棋是 0 分，比继续压着强。若把和棋算成赢，AI 会主动往回挪。
  assert.notDeepEqual(reply.move, QUIET_CLOSING, '不该把和棋当成赢棋去追');
});
