// `replayHistory` 把联机快照的坐标列表还原成 `HistoryEntry`：
// 音效靠 `captured` / `gaveCheck` 判定，服务端只发坐标，所以重放一遍取同样的字段。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FEN, indexOf, parseFen, playMove } from '../src/shared/index.ts';
import type { HistoryEntry } from '../src/shared/index.ts';
import { replayHistory } from '../src/client/online/history.ts';

test('重放出的着法记录与直接走一遍完全相同', () => {
  const start = parseFen(INITIAL_FEN);
  // 炮二平五，马８进７：一着普通、一着应对
  const moves = [
    { from: indexOf(7, 7), to: indexOf(4, 7) },
    { from: indexOf(7, 0), to: indexOf(6, 2) },
  ];

  let position = start;
  let history: readonly HistoryEntry[] = [];
  for (const move of moves) {
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }

  const replayed = replayHistory(INITIAL_FEN, moves);
  assert.equal(replayed.length, 2);
  assert.deepEqual(
    replayed.map((entry) => ({ captured: entry.captured, gaveCheck: entry.gaveCheck, fen: entry.fen })),
    history.map((entry) => ({ captured: entry.captured, gaveCheck: entry.gaveCheck, fen: entry.fen })),
  );
});

test('吃子那一着重放后 captured 为真', () => {
  const fen = '4k4/9/9/9/9/9/9/4p4/4R4/4K4 w - - 0 1';
  // 红车 (4,8) 吃掉 (4,7) 的黑卒
  const replayed = replayHistory(fen, [{ from: indexOf(4, 8), to: indexOf(4, 7) }]);
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0]?.captured, true);
});
