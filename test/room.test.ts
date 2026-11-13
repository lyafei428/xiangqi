import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  joinRoom,
  applyRoomMove,
  setConnected,
  snapshotOf,
} from '../src/server/room.ts';
import { INITIAL_FEN, generateLegalMoves, parseFen } from '../src/shared/index.ts';
import { Rooms } from '../src/server/rooms.ts';

const MATE_IN_ONE = '4k4/9/9/9/9/R8/3R1R3/9/9/3K5 w - - 0 1';

function legal(index = 0) {
  const move = generateLegalMoves(parseFen(INITIAL_FEN))[index];
  if (move === undefined) throw new Error('没有合法着法');
  return move;
}

test('建房：红方持 token，等待第二人', () => {
  const room = createRoom('ABC234', 'red-token');
  const snapshot = snapshotOf(room);
  assert.equal(snapshot.players, 1);
  assert.equal(snapshot.red, true);
  assert.equal(snapshot.black, false);
  assert.equal(snapshot.turn, 'red');
  assert.equal(snapshot.seq, 0);
});

test('加入：第二人执黑；第三人被拒', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.color, 'black');
  assert.equal(snapshotOf(joined.room).players, 2);
  assert.deepEqual(joinRoom(joined.room, 'third-token'), { ok: false, reason: 'room-full' });
});

test('重连：token 找回颜色，座位仍在', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const offline = setConnected(joined.room, 'red-token', false);
  assert.equal(snapshotOf(offline).red, false);
  const reconnected = joinRoom(offline, 'red-token');
  assert.equal(reconnected.ok, true);
  if (!reconnected.ok) return;
  assert.equal(reconnected.color, 'red');
  assert.equal(snapshotOf(reconnected.room).red, true);
  assert.equal(snapshotOf(reconnected.room).players, 2);
});

test('落子：轮次、序号与非法着法都拒', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const move = legal();

  const wrongTurn = applyRoomMove(joined.room, 'black-token', move, 0);
  assert.equal(wrongTurn.ok, false);
  if (!wrongTurn.ok) assert.equal(wrongTurn.reason, 'not-your-turn');

  const stale = applyRoomMove(joined.room, 'red-token', move, 3);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, 'stale-seq');

  const illegal = applyRoomMove(joined.room, 'red-token', { from: 0, to: 1 }, 0);
  assert.equal(illegal.ok, false);
  if (!illegal.ok) assert.equal(illegal.reason, 'illegal-move');

  const unknown = applyRoomMove(joined.room, 'nobody', move, 0);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.reason, 'not-in-room');
});

test('落子：成功后序号与行棋方推进，快照带记谱', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const move = legal();
  const played = applyRoomMove(joined.room, 'red-token', move, 0);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  const snapshot = snapshotOf(played.room);
  assert.equal(snapshot.seq, 1);
  assert.equal(snapshot.turn, 'black');
  assert.equal(snapshot.moves.length, 1);
  assert.deepEqual(snapshot.lastMove, move);
  assert.equal(played.room.history.length, 1);
});

test('将死：结果与状态写入快照，之后不能再走', () => {
  const room = createRoom('MATE01', 'red-token', MATE_IN_ONE);
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const played = applyRoomMove(joined.room, 'red-token', { from: 45, to: 49 }, 0);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  const snapshot = snapshotOf(played.room);
  assert.equal(snapshot.result?.type, 'checkmate');
  assert.equal(snapshot.result?.winner, 'red');
  assert.equal(snapshot.status, 'checkmate');
  const after = applyRoomMove(played.room, 'black-token', { from: 4, to: 3 }, 1);
  assert.equal(after.ok, false);
  if (!after.ok) assert.equal(after.reason, 'game-over');
});

test('离线回收：两人都离线超过窗口才回收，重连清掉空闲计时', () => {
  const rooms = new Rooms();
  const created = rooms.create();
  const code = created.room.code;
  const now = 1_000_000;

  rooms.setConnected(code, created.token, false, now);
  assert.equal(rooms.sweep(now + 60_000, 30 * 60_000), 0);
  assert.notEqual(rooms.get(code), undefined);

  const rejoined = rooms.join(code, created.token);
  assert.equal(rejoined.ok, true);
  assert.equal(rooms.sweep(now + 60 * 60_000, 30 * 60_000), 0);

  rooms.setConnected(code, created.token, false, now);
  assert.equal(rooms.sweep(now + 30 * 60_000, 30 * 60_000), 1);
  assert.equal(rooms.get(code), undefined);
});

test('两人中一人在线时不回收', () => {
  const rooms = new Rooms();
  const created = rooms.create();
  const joined = rooms.join(created.room.code, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const now = 1_000_000;
  rooms.setConnected(created.room.code, created.token, false, now);
  assert.equal(rooms.sweep(now + 60 * 60_000, 30 * 60_000), 0);
});

