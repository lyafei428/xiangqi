// 走子音效的判定：从真实着法记录里取「吃子 / 将军」这两个标记，不自己再比一遍局面。
// 用真实局面跑出 HistoryEntry，而不是手搓一个假对象——假对象能过，真链路未必。

import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FEN, indexOf, parseFen } from '../src/shared/index.ts';
import { playMove } from '../src/shared/rules.ts';
import { classify } from '../src/client/sound/sound.ts';
import type { HistoryEntry } from '../src/shared/types.ts';

const at = (x: number, y: number): number => indexOf(x, y);

/** 走一着，拿它写下的那条着法记录。 */
function entryAfter(fen: string, from: number, to: number): HistoryEntry {
  const position = parseFen(fen);
  const played = playMove(position, [], { from, to });
  const last = played.history.at(-1);
  if (last === undefined) throw new Error('没写下着法记录');
  return last;
}

test('普通落子响「落子」', () => {
  const entry = entryAfter(INITIAL_FEN, at(1, 7), at(1, 6));
  assert.equal(entry.captured, false);
  assert.equal(classify(entry, null), 'move');
});

test('吃子响「吃子」', () => {
  // 黑车在 (4,4)，红车正对 (4,8)，红车吃过去
  const fen = '3k5/9/9/9/4r4/9/9/9/4R4/4K4 w - - 0 1';
  const entry = entryAfter(fen, at(4, 8), at(4, 4));
  assert.equal(entry.captured, true);
  assert.equal(classify(entry, null), 'capture');
});

test('将军响「将军」', () => {
  // 红车平到黑将那一线，中间无子：将军
  const entry = entryAfter('4k4/9/9/9/9/9/3R5/9/9/4K4 w - - 0 1', at(3, 6), at(4, 6));
  assert.equal(entry.gaveCheck, true);
  assert.equal(classify(entry, null), 'check');
});

test('终局压过一切', () => {
  const entry = entryAfter(INITIAL_FEN, at(1, 7), at(1, 6));
  assert.equal(classify(entry, { type: 'resign', winner: 'black' }), 'end');
  assert.equal(classify(entry, { type: 'repetition', winner: null }), 'end');
});

test('将死那一着只算终局，不叠将军', () => {
  // 红车 72→75 直接绝杀：这一着同时「给出将军」且「结果从无到有」，
  // 只能响一次终局音——判定层把它归到终局。
  const position = parseFen('3k5/9/9/9/9/9/9/9/R8/4K4 w - - 0 1');
  const played = playMove(position, [], { from: 72, to: 75 });
  const entry = played.history.at(-1);
  if (entry === undefined) throw new Error('没写下着法记录');
  assert.equal(entry.gaveCheck, true);
  assert.equal(classify(entry, { type: 'checkmate', winner: 'red' }), 'end');
});
