// 棋谱记录的格式、校验与任意步重放。

import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FEN, indexOf, parseFen, playMove, toChineseNotation } from '../src/shared/index.ts';
import type { Position } from '../src/shared/index.ts';
import {
  isReplayable,
  notationsOf,
  parseRecord,
  positionAt,
  recordText,
} from '../src/shared/record.ts';
import type { GameRecord } from '../src/shared/record.ts';

const at = (x: number, y: number): number => indexOf(x, y);

/** 红炮八进一、黑炮2进1、红炮八退一、黑炮2退1 —— 与本地集成用例同一组着法。 */
const MOVES = [
  { from: at(1, 7), to: at(1, 6) },
  { from: at(1, 2), to: at(1, 3) },
  { from: at(1, 6), to: at(1, 7) },
  { from: at(1, 3), to: at(1, 2) },
] as const;

function record(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 1_700_000_000_000,
    startFen: INITIAL_FEN,
    moves: MOVES,
    result: { type: 'repetition', winner: null },
    redMs: 590_000,
    blackMs: 585_000,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function after(moves: number): Position {
  let position = parseFen(INITIAL_FEN);
  let history: ReturnType<typeof playMove>['history'] = [];
  for (let index = 0; index < moves; index += 1) {
    const move = MOVES[index];
    if (move === undefined) break;
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }
  return position;
}

test('记录往返：文本解析回同一条记录', () => {
  const original = record();
  const parsed = parseRecord(recordText(original));
  assert.deepEqual(parsed, original);
});

test('任意步重放：step 夹到区间内，局面与逐步 playMove 一致', () => {
  const sample = record();
  assert.deepEqual(positionAt(sample, 0), parseFen(INITIAL_FEN));
  for (let step = 0; step <= MOVES.length; step += 1) {
    assert.deepEqual(positionAt(sample, step), after(step));
  }
  assert.deepEqual(positionAt(sample, 99), after(MOVES.length));
  assert.deepEqual(positionAt(sample, -5), parseFen(INITIAL_FEN));
});

test('记谱与本地会话一致', () => {
  const parsed = record();
  let position = parseFen(INITIAL_FEN);
  const expected: string[] = [];
  let history: ReturnType<typeof playMove>['history'] = [];
  for (const move of parsed.moves) {
    expected.push(toChineseNotation(position, move));
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }
  assert.deepEqual(notationsOf(parsed), expected);
  assert.deepEqual(notationsOf(parsed), ['炮八进一', '炮2进1', '炮八退一', '炮2退1']);
});

test('结构校验：坏 JSON 与缺字段一律 null', () => {
  assert.equal(parseRecord(''), null);
  assert.equal(parseRecord('{oops'), null);
  assert.equal(parseRecord('[]'), null);
  assert.equal(parseRecord('{"startFen":"' + INITIAL_FEN + '"}'), null);
  const base = JSON.parse(recordText(record())) as Record<string, unknown>;
  for (const key of ['startFen', 'moves', 'result', 'redMs', 'blackMs', 'savedAt']) {
    const clone = { ...base };
    delete clone[key];
    assert.equal(parseRecord(JSON.stringify(clone)), null, `缺 ${key} 应拒`);
  }
});

test('结构校验：坐标、着法数、时钟与结果取值', () => {
  const base = record();
  const asJson = (overrides: Record<string, unknown>): string =>
    JSON.stringify({ ...(JSON.parse(recordText(base)) as Record<string, unknown>), ...overrides });

  assert.equal(parseRecord(asJson({ moves: [{ from: 0, to: 90 }] })), null);
  assert.equal(parseRecord(asJson({ moves: [{ from: 5, to: 5 }] })), null);
  assert.equal(parseRecord(asJson({ moves: [{ from: 1.5, to: 2 }] })), null);
  assert.equal(parseRecord(asJson({ moves: 'nope' })), null);
  assert.equal(parseRecord(asJson({ moves: new Array(1001).fill({ from: 0, to: 1 }) })), null);
  assert.equal(parseRecord(asJson({ startFen: 'not-a-fen' })), null);
  assert.equal(parseRecord(asJson({ redMs: -1 })), null);
  assert.equal(parseRecord(asJson({ blackMs: 600_001 })), null);
  assert.equal(parseRecord(asJson({ savedAt: 0 })), null);
  assert.equal(parseRecord(asJson({ savedAt: 1.2 })), null);
  assert.equal(parseRecord(asJson({ result: { type: 'zzz', winner: null } })), null);
  assert.equal(parseRecord(asJson({ result: { type: 'resign', winner: 'green' } })), null);
  assert.equal(parseRecord(asJson({ id: 0 })), null);
  assert.equal(parseRecord(asJson({ id: null }))?.id, null);
});

test('走法非法（坐标合法）的记录不能回放', () => {
  const broken = record({ moves: [{ from: at(0, 9), to: at(0, 8) + 1 }] });
  assert.equal(isReplayable(broken), false);
  assert.throws(() => positionAt(broken, 1));
  assert.equal(isReplayable(record()), true);
});
