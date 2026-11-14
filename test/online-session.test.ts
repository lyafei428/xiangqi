import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineState, onlineReducer } from '../src/client/online/session.ts';
import type { Snapshot } from '../src/shared/protocol.ts';

// 建房失败时用户看到什么：大厅里断开必须留下原因。
// 起因：静态托管上没有 /ws，点「创建房间」后按钮从「连接中…」弹回「创建房间」，
// 界面一个字都不说，看着就像按钮坏了。

const SNAPSHOT: Snapshot = {
  room: 'ABC123',
  startFen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1',
  fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1',
  seq: 0,
  turn: 'red',
  status: 'playing',
  result: null,
  lastMove: null,
  moves: [],
  moveLog: [],
  red: true,
  black: false,
  players: 1,
  spectators: 0,
  clock: { redMs: 600000, blackMs: 600000, running: null, since: 0 },
  drawOffer: null,
  drawBlocked: null,
};

test('还没进房间就断开：回大厅并说明连不上房间服务', () => {
  const state = onlineReducer(createOnlineState(), { type: 'connecting' });
  const after = onlineReducer(state, { type: 'disconnected' });

  assert.equal(after.phase, 'lobby');
  assert.ok(after.notice !== null);
  assert.ok(after.notice.includes('连不上房间服务'), `实际提示：${String(after.notice)}`);
});

test('进过房间再断开：留在重连态，提示走重连文案', () => {
  const joined = onlineReducer(onlineReducer(createOnlineState(), { type: 'connecting' }), {
    type: 'joined',
    room: 'ABC123',
    token: 'token-1',
    role: 'player',
    color: 'red',
    snapshot: SNAPSHOT,
  });

  const after = onlineReducer(joined, { type: 'disconnected' });
  assert.equal(after.phase, 'reconnecting');
  assert.equal(after.notice, '连接断开，正在重连…');
});
