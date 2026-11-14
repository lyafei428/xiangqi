import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom,
  joinRoom,
  applyRoomMove,
  applyTimeout,
  offerDrawRoom,
  rematchRoom,
  resignRoom,
  respondDrawRoom,
  setConnected,
  snapshotOf,
  MAX_SPECTATORS,
  removeSpectator,
} from '../src/server/room.ts';
import { INITIAL_FEN, generateLegalMoves, indexOf, parseFen } from '../src/shared/index.ts';
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
  assert.equal(snapshot.spectators, 0);
  assert.equal(snapshot.red, true);
  assert.equal(snapshot.black, false);
  assert.equal(snapshot.turn, 'red');
  assert.equal(snapshot.seq, 0);
});

test('加入：第二人执黑；两席已满时第三人转观战', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.role, 'player');
  assert.equal(joined.color, 'black');
  assert.equal(snapshotOf(joined.room).players, 2);

  const watching = joinRoom(joined.room, 'third-token');
  assert.equal(watching.ok, true);
  if (!watching.ok) return;
  assert.equal(watching.role, 'spectator');
  assert.equal(watching.color, null);
  const snapshot = snapshotOf(watching.room);
  assert.equal(snapshot.players, 2);
  assert.equal(snapshot.spectators, 1);

  // 观战者的 token 不映射座位：带同一个 token 再来仍是观战，只是又占一条连接。
  const retry = joinRoom(watching.room, 'third-token');
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(retry.role, 'spectator');
  assert.equal(retry.color, null);
  assert.equal(snapshotOf(retry.room).spectators, 2);
  assert.equal(snapshotOf(retry.room).players, 2);
});

test('观战上限：八人在线后第九人 spectators-full，退出一人才能再进', () => {
  const room = createRoom('ABC234', 'red-token');
  const seated = joinRoom(room, 'black-token');
  if (!seated.ok) throw new Error(seated.reason);

  let current = seated.room;
  for (let index = 0; index < MAX_SPECTATORS; index += 1) {
    const joined = joinRoom(current, `watcher-${String(index)}`);
    assert.equal(joined.ok, true);
    if (!joined.ok) return;
    assert.equal(joined.role, 'spectator');
    current = joined.room;
  }
  assert.equal(snapshotOf(current).spectators, MAX_SPECTATORS);
  assert.deepEqual(joinRoom(current, 'watcher-over'), { ok: false, reason: 'spectators-full' });

  // 观战离开只腾观战位：满房又有一个名额。
  const freed = removeSpectator(current);
  assert.equal(snapshotOf(freed).spectators, MAX_SPECTATORS - 1);
  const again = joinRoom(freed, 'watcher-over');
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.role, 'spectator');
  // 计数到底不减到负数。
  assert.equal(snapshotOf(removeSpectator(createRoom('ABC234', 'red-token'))).spectators, 0);
});

test('观战不写在线位：观战者走子 / 认输 / 求和 / 应答一律 not-in-room', () => {
  const room = createRoom('ABC234', 'red-token');
  const seated = joinRoom(room, 'black-token');
  if (!seated.ok) throw new Error(seated.reason);
  const watched = joinRoom(seated.room, 'watcher-token');
  if (!watched.ok) throw new Error(watched.reason);

  const played = applyRoomMove(watched.room, 'watcher-token', legal(), 0);
  assert.equal(played.ok, false);
  if (!played.ok) assert.equal(played.reason, 'not-in-room');

  const resigned = resignRoom(watched.room, 'watcher-token');
  assert.equal(resigned.ok, false);
  if (!resigned.ok) assert.equal(resigned.reason, 'not-in-room');

  const offered = offerDrawRoom(watched.room, 'watcher-token');
  assert.equal(offered.ok, false);
  if (!offered.ok) assert.equal(offered.reason, 'not-in-room');

  const answered = respondDrawRoom(watched.room, 'watcher-token', true);
  assert.equal(answered.ok, false);
  if (!answered.ok) assert.equal(answered.reason, 'not-in-room');

  // 房间没被观战者改动：座位、在线位、序号、和棋状态都是原样。
  const snapshot = snapshotOf(watched.room);
  assert.equal(snapshot.players, 2);
  assert.equal(snapshot.red, true);
  assert.equal(snapshot.black, true);
  assert.equal(snapshot.spectators, 1);
  assert.equal(snapshot.seq, 0);
  assert.equal(snapshot.drawOffer, null);
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

test('回收：两名棋手断开后观战仍在、房间不回收；观战清零才按 30 分钟回收', () => {
  const rooms = new Rooms();
  const created = rooms.create();
  const code = created.room.code;
  const now = 1_000_000;

  const seated = rooms.join(code, 'black-token');
  if (!seated.ok) throw new Error(seated.reason);
  const watched = rooms.join(code, 'watcher-token');
  if (!watched.ok) throw new Error(watched.reason);
  assert.equal(watched.role, 'spectator');

  // 两名棋手都断开：观战还在，房间留住。
  rooms.setConnected(code, created.token, false, now);
  rooms.setConnected(code, 'black-token', false, now);
  assert.equal(rooms.sweep(now + 60 * 60_000, 30 * 60_000), 0);
  const kept = rooms.get(code);
  assert.notEqual(kept, undefined);
  assert.equal(kept?.spectators, 1);
  assert.equal(kept?.red?.connected, false);
  assert.equal(kept?.black?.connected, false);

  // 观战者离开、计数归零，下一轮扫才回收。
  rooms.removeSpectator(code);
  assert.equal(rooms.get(code)?.spectators, 0);
  assert.equal(rooms.sweep(now + 60 * 60_000, 30 * 60_000), 1);
  assert.equal(rooms.get(code), undefined);
});



test('落子成功扣时并切边', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 900_000, 0);
  const joined = joinRoom(room, 'black-token', 0);
  if (!joined.ok) throw new Error(joined.reason);
  const move = legal();
  const played = applyRoomMove(joined.room, 'red-token', move, 0, 10_000);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  assert.equal(played.room.clock.running, 'black');
  assert.equal(played.room.clock.redMs, 890_000);
  assert.equal(played.room.clock.since, 10_000);
});

test('超时：在走方归零判负，停表后不再重复判', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 1_000, 0);
  const seated = joinRoom(room, 'black-token', 0);
  if (!seated.ok) throw new Error(seated.reason);
  assert.equal(applyTimeout(seated.room, 999), null);
  const timedOut = applyTimeout(seated.room, 1_000);
  assert.notEqual(timedOut, null);
  if (timedOut === null) return;
  assert.deepEqual(timedOut.result, { type: 'timeout', winner: 'black' });
  assert.equal(timedOut.clock.running, null);
  assert.equal(applyTimeout(timedOut, 5_000), null);

  const rooms = new Rooms();
  const created = rooms.create();
  assert.deepEqual(rooms.timeouts(Date.now()), []);
  assert.notEqual(created, undefined);
});

test('认输：只接受当前行棋方', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);

  const wrong = resignRoom(joined.room, 'black-token');
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.reason, 'not-your-turn');

  const done = resignRoom(joined.room, 'red-token');
  assert.equal(done.ok, true);
  if (!done.ok) return;
  assert.deepEqual(done.room.result, { type: 'resign', winner: 'black' });
  assert.equal(done.room.clock.running, null);
});

test('求和：提议、接受判和；拒绝后对方走一着才能再提议', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);

  const offered = offerDrawRoom(joined.room, 'red-token');
  assert.equal(offered.ok, true);
  if (!offered.ok) return;
  assert.equal(offered.room.drawOffer, 'red');

  // 已有待答提议时再提议：拒。
  const second = offerDrawRoom(offered.room, 'black-token');
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, 'draw-pending');

  // 提议方自己应答：拒。
  const selfAnswer = respondDrawRoom(offered.room, 'red-token', true);
  assert.equal(selfAnswer.ok, false);
  if (!selfAnswer.ok) assert.equal(selfAnswer.reason, 'no-draw-offer');

  // 对方拒绝：记下被拒方，提议作废。
  const declined = respondDrawRoom(offered.room, 'black-token', false);
  assert.equal(declined.ok, true);
  if (!declined.ok) return;
  assert.equal(declined.room.drawOffer, null);
  assert.equal(declined.room.drawBlocked, 'red');

  // 被拒方在对方走子前再提议：拒。
  const blocked = offerDrawRoom(declined.room, 'red-token');
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, 'draw-blocked');

  // 被拒方自己走子不解封。
  const redMove = legal();
  const afterRed = applyRoomMove(declined.room, 'red-token', redMove, 0);
  if (!afterRed.ok) throw new Error(afterRed.reason);
  assert.equal(afterRed.room.drawBlocked, 'red');

  // 对方走一着后解封。
  const reply = generateLegalMoves(afterRed.room.position)[0];
  if (reply === undefined) throw new Error('黑方没有合法着法');
  const afterBlack = applyRoomMove(afterRed.room, 'black-token', reply, 1);
  if (!afterBlack.ok) throw new Error(afterBlack.reason);
  assert.equal(afterBlack.room.drawBlocked, null);
  const reoffer = offerDrawRoom(afterBlack.room, 'red-token');
  assert.equal(reoffer.ok, true);
});

test('求和：接受后判和并停表', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const offered = offerDrawRoom(joined.room, 'black-token');
  if (!offered.ok) throw new Error(offered.reason);
  const accepted = respondDrawRoom(offered.room, 'red-token', true);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.deepEqual(accepted.room.result, { type: 'agreement', winner: null });
  assert.equal(accepted.room.clock.running, null);
  assert.equal(accepted.room.drawOffer, null);
});

test('走子清空待答提议', () => {
  const room = createRoom('ABC234', 'red-token');
  const joined = joinRoom(room, 'black-token');
  if (!joined.ok) throw new Error(joined.reason);
  const offered = offerDrawRoom(joined.room, 'red-token');
  if (!offered.ok) throw new Error(offered.reason);
  const played = applyRoomMove(offered.room, 'red-token', legal(), 0);
  if (!played.ok) throw new Error(played.reason);
  assert.equal(played.room.drawOffer, null);
});

test('单人房间不判超时；第二人就座后才开锚扣时', () => {
  const rooms = new Rooms();
  const created = rooms.create(INITIAL_FEN, 1_000, 0);
  const code = created.room.code;

  // 一个人等对手：分钟数不折进对局时间，也不判超时。
  assert.deepEqual(rooms.timeouts(5_000), []);

  const joined = rooms.join(code, 'black-token', 5_000);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(joined.room.clock.since, 5_000);
  assert.equal(joined.room.clock.redMs, 1_000);

  assert.deepEqual(rooms.timeouts(5_900), []);
  const expired = rooms.timeouts(6_000);
  assert.equal(expired.length, 1);
  assert.equal(expired[0]?.result?.type, 'timeout');
  assert.equal(expired[0]?.result?.winner, 'black');
});

test('快照里的剩余是快照时刻的值，不是切边时的旧值', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 900_000, 0);
  const joined = joinRoom(room, 'black-token', 0);
  if (!joined.ok) throw new Error(joined.reason);
  const played = applyRoomMove(joined.room, 'red-token', legal(), 0, 0);
  if (!played.ok) throw new Error(played.reason);

  // 黑方思考 100 秒后取快照：blackMs 应是 800000，而不是切边时的 900000。
  const snapshot = snapshotOf(played.room, 100_000);
  assert.equal(snapshot.clock.blackMs, 900_000 - 100_000);
  assert.equal(snapshot.clock.redMs, 900_000);
  assert.equal(snapshot.clock.running, 'black');
  assert.equal(snapshot.clock.since, 100_000);
});

test('两人未坐满时不接受落子', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 900_000, 0);
  const outcome = applyRoomMove(room, 'red-token', legal(), 0, 1_000);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.reason, 'not-in-room');
});


test('再来一局：终局后同房间重开，座位与时钟重置', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 900_000, 0);
  const joined = joinRoom(room, 'blue-token', 0);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const played = applyRoomMove(joined.room, 'red-token', { from: indexOf(1, 7), to: indexOf(1, 6) }, 0, 5_000);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  const resigned = resignRoom(played.room, 'blue-token', 6_000);
  assert.equal(resigned.ok, true);
  if (!resigned.ok) return;
  assert.notEqual(resigned.room.result, null);

  const again = rematchRoom(resigned.room, 'red-token', 10_000);
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.room.result, null, '结果清空');
  assert.equal(again.room.moves.length, 0, '着法清空');
  assert.equal(again.room.seq, 0, '序号归零');
  assert.equal(again.room.clock.redMs, 900_000, '时钟重置');
  assert.equal(again.room.clock.blackMs, 900_000);
  assert.equal(again.room.red?.token, 'red-token', '座位不变');
  assert.equal(again.room.black?.token, 'blue-token');
});

test('再来一局：对局中拒绝，观战者拒绝', () => {
  const room = createRoom('ABC234', 'red-token', INITIAL_FEN, 900_000, 0);
  const joined = joinRoom(room, 'blue-token', 0);
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  // 还没打完：不能单方面重开
  const early = rematchRoom(joined.room, 'red-token', 1_000);
  assert.equal(early.ok, false);
  if (!early.ok) assert.equal(early.reason, 'not-over');

  // 观战者没有座位
  const spectator = rematchRoom(joined.room, 'watcher-token', 1_000);
  assert.equal(spectator.ok, false);
  if (!spectator.ok) assert.equal(spectator.reason, 'not-in-room');
});
