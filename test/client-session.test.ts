import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FEN, indexOf } from '../src/shared/index.ts';
import type { GameSession } from '../src/client/game/session.ts';
import { checkSquareOf, createSession, sessionReducer } from '../src/client/game/session.ts';

const at = (x: number, y: number): number => indexOf(x, y);

function tap(session: GameSession, square: number): GameSession {
  return sessionReducer(session, { type: 'tap', square });
}

function play(session: GameSession, from: number, to: number): GameSession {
  return tap(tap(session, from), to);
}

test('新局：初始局面、红先、无结果', () => {
  const session = createSession();
  assert.equal(session.startFen, INITIAL_FEN);
  assert.equal(session.position.turn, 'red');
  assert.equal(session.status, 'playing');
  assert.equal(session.result, null);
  assert.deepEqual(session.notations, []);
  assert.equal(session.selected, null);
});

test('点己方棋子选中，并列出合法落点', () => {
  const session = tap(createSession(), at(1, 7));
  assert.equal(session.selected, at(1, 7));
  assert.ok(session.targets.includes(at(1, 6)), '炮可以向前走');
  assert.ok(session.targets.includes(at(0, 7)), '炮可以平移');
  assert.ok(!session.targets.includes(at(1, 2)), '没有炮架不能吃子');
  assert.ok(!session.targets.includes(at(1, 1)), '不能越过对方棋子');
});

test('点落点走子：换边、记谱、清空选中', () => {
  const session = play(createSession(), at(1, 7), at(1, 6));
  assert.equal(session.position.turn, 'black');
  assert.equal(session.notations.length, 1);
  assert.equal(session.notations[0], '炮八进一');
  assert.deepEqual(session.lastMove, { from: at(1, 7), to: at(1, 6) });
  assert.equal(session.selected, null);
  assert.deepEqual(session.targets, []);
  assert.equal(session.history.length, 1);
});

test('点不可落点取消选中，棋局不动', () => {
  const selected = tap(createSession(), at(1, 7));
  const canceled = tap(selected, at(4, 4));
  assert.equal(canceled.selected, null);
  assert.deepEqual(canceled.targets, []);
  assert.equal(canceled.position.turn, 'red');
  assert.equal(canceled.history.length, 0);
});

test('点对方棋子不选中', () => {
  const session = tap(createSession(), at(0, 3));
  assert.equal(session.selected, null);
});

test('select 动作只选中，不来回切换', () => {
  const selected = sessionReducer(createSession(), { type: 'select', square: at(1, 7) });
  assert.equal(selected.selected, at(1, 7));
  const again = sessionReducer(selected, { type: 'select', square: at(1, 7) });
  assert.equal(again.selected, at(1, 7));
});

test('黑方走子用黑方记谱', () => {
  const afterRed = play(createSession(), at(1, 7), at(1, 6));
  const afterBlack = play(afterRed, at(1, 2), at(1, 3));
  assert.equal(afterBlack.position.turn, 'red');
  assert.equal(afterBlack.notations[1], '炮2进1');
});

test('三次重复局面判和，终局后点击不改变状态', () => {
  let session = createSession();
  const loop: readonly (readonly [number, number])[] = [
    [at(1, 7), at(1, 6)],
    [at(1, 2), at(1, 3)],
    [at(1, 6), at(1, 7)],
    [at(1, 3), at(1, 2)],
    [at(1, 7), at(1, 6)],
    [at(1, 2), at(1, 3)],
    [at(1, 6), at(1, 7)],
    [at(1, 3), at(1, 2)],
  ];
  for (const [from, to] of loop) session = play(session, from, to);

  assert.equal(session.history.length, 8);
  assert.deepEqual(session.result, { type: 'repetition', winner: null });
  const locked = tap(session, at(1, 7));
  assert.equal(locked, session, '终局后不应产生新状态');
});

test('新局复位：结果、记谱、选中全部清空', () => {
  const played = play(createSession(), at(1, 7), at(1, 6));
  const session = sessionReducer(played, { type: 'reset' });
  assert.equal(session.result, null);
  assert.deepEqual(session.notations, []);
  assert.equal(session.selected, null);
  assert.equal(session.position.turn, 'red');
});

test('将军时标出被将方的将帅，平静局面不标', () => {
  const checked = createSession('4k4/9/9/9/9/9/9/9/9/3KR4 b - - 0 1');
  assert.equal(checked.status, 'check');
  assert.equal(checkSquareOf(checked), at(4, 0));
  assert.equal(checkSquareOf(createSession()), null);
});

test('自定义起始局面在复位后保留', () => {
  const fen = '4k4/9/9/9/9/9/9/4P4/9/4K4 w - - 0 1';
  const session = createSession(fen);
  assert.equal(session.startFen, fen);
  const reset = sessionReducer(session, { type: 'reset' });
  assert.equal(reset.startFen, fen);
});

test('新局带 10 分钟时钟，红方在走', () => {
  const session = createSession(INITIAL_FEN, 1_000);
  assert.equal(session.clock.redMs, 600_000);
  assert.equal(session.clock.blackMs, 600_000);
  assert.equal(session.clock.running, 'red');
  assert.equal(session.clock.since, 1_000);
});

test('走子后时钟切给黑方', () => {
  const base = createSession(INITIAL_FEN, 0);
  const picked = sessionReducer(base, { type: 'tap', square: at(1, 7), now: 2_000 });
  const moved = sessionReducer(picked, { type: 'tap', square: at(1, 6), now: 2_000 });
  assert.equal(moved.clock.running, 'black');
  assert.equal(moved.clock.since, 2_000);
  assert.equal(moved.clock.redMs, 598_000);
});

test('tick 未归零不改状态；归零判超时给对方', () => {
  const session = createSession(INITIAL_FEN, 0);
  const early = sessionReducer(session, { type: 'tick', now: 1_000 });
  assert.equal(early.result, null);

  const late = sessionReducer(session, { type: 'tick', now: 600_000 });
  assert.deepEqual(late.result, { type: 'timeout', winner: 'black' });
  assert.equal(late.clock.running, null);
  assert.equal(late.clock.redMs, 0);
});

test('认输：行棋方认输，判对方胜并锁盘', () => {
  const session = sessionReducer(createSession(), { type: 'resign' });
  assert.deepEqual(session.result, { type: 'resign', winner: 'black' });
  assert.equal(session.clock.running, null);
  const locked = sessionReducer(session, { type: 'resign' });
  assert.equal(locked, session);
});

test('走子与认输的时间由动作带入，结果可复现', () => {
  const base = createSession(INITIAL_FEN, 1_000);
  const picked = sessionReducer(base, { type: 'tap', square: at(1, 7), now: 6_000 });
  const moved = sessionReducer(picked, { type: 'tap', square: at(1, 6), now: 6_000 });
  assert.equal(moved.clock.since, 6_000);
  assert.equal(moved.clock.redMs, 595_000);
  assert.equal(moved.clock.running, 'black');

  const resigned = sessionReducer(base, { type: 'resign', now: 7_000 });
  assert.deepEqual(resigned.result, { type: 'resign', winner: 'black' });
  assert.equal(resigned.clock.redMs, 594_000);
});

test('旗落后不再接受着法：点自己棋子直接判超时', () => {
  const base = createSession(INITIAL_FEN, 0);
  const late = sessionReducer(base, { type: 'tap', square: at(1, 7), now: 600_000 });
  assert.deepEqual(late.result, { type: 'timeout', winner: 'black' });
  assert.equal(late.history.length, 0);
  assert.equal(late.clock.running, null);
});

test('新局重置时钟与结果', () => {
  const over = sessionReducer(createSession(), { type: 'resign' });
  const fresh = sessionReducer(over, { type: 'reset' });
  assert.equal(fresh.result, null);
  assert.equal(fresh.clock.running, 'red');
  assert.equal(fresh.clock.redMs, 600_000);
});

