// 棋谱库内容自证：逐条解析、逐着合法、四类计数与分类口径。
// 内容随包发布，坏一条就是用户点开就崩，所以这里全量验，不抽样。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INITIAL_FEN, parseFen, playMove, statusOf } from '../src/shared/index.ts';
import type { Position } from '../src/shared/index.ts';
import { parseStudyRecord } from '../src/shared/study.ts';
import type { StudyPhase, StudyRecord } from '../src/shared/study.ts';

const CONTENT = fileURLToPath(new URL('../content/games/index.json', import.meta.url));
const PHASES: readonly StudyPhase[] = ['opening', 'middlegame', 'ending', 'endgame'];

function rawRecords(): unknown[] {
  const raw: unknown = JSON.parse(readFileSync(CONTENT, 'utf8'));
  assert.ok(Array.isArray(raw), '棋谱库内容必须是数组');
  return raw;
}

function records(): StudyRecord[] {
  const out: StudyRecord[] = [];
  rawRecords().forEach((item, index) => {
    const record = parseStudyRecord(item);
    assert.ok(record !== null, `第 ${index + 1} 条棋谱解析失败`);
    out.push(record);
  });
  return out;
}

/** 从起始局面逐着走完；某一着不合法会在这里抛错。 */
function playAll(record: StudyRecord): Position {
  let position = parseFen(record.startFen);
  let history = [] as ReturnType<typeof playMove>['history'];
  for (const move of record.moves) {
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }
  return position;
}

function pieceCount(position: Position, color: 'red' | 'black'): number {
  let count = 0;
  for (const piece of position.board) {
    if (piece !== null && piece.color === color) count += 1;
  }
  return count;
}

function ofPhase(phase: StudyPhase): StudyRecord[] {
  return records().filter((record) => record.phase === phase);
}

test('棋谱库共 16 条，四类各 4 条', () => {
  const all = records();
  assert.equal(all.length, 16);
  for (const phase of PHASES) {
    assert.equal(ofPhase(phase).length, 4, `${phase} 应为 4 条`);
  }
});

test('id 唯一且非空', () => {
  const ids = records().map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length, 'id 不能重复');
  for (const id of ids) assert.ok(id.trim() !== '', 'id 不能为空');
});

test('每条棋谱的每一着都能走通', () => {
  for (const record of records()) {
    assert.doesNotThrow(() => playAll(record), `${record.id} 有走不通的着法`);
  }
});

test('起始 FEN 可解析，双方各一将帅', () => {
  for (const record of records()) {
    const start = parseFen(record.startFen);
    for (const color of ['red', 'black'] as const) {
      let kings = 0;
      for (const piece of start.board) {
        if (piece !== null && piece.color === color && piece.type === 'K') kings += 1;
      }
      assert.equal(kings, 1, `${record.id} 的 ${color} 将帅不是一枚`);
    }
  }
});

test('notes 的 step 落在 0..着法数，文字非空，且同一条内不重复', () => {
  for (const record of records()) {
    assert.ok(record.notes.length >= 1 && record.notes.length <= 3, `${record.id} 的 notes 应为 1–3 则`);
    // 回放只显示当前 step 的第一条说明：两条落在同一步，后一条永远不会露脸。
    const steps = record.notes.map((note) => note.step);
    assert.equal(new Set(steps).size, steps.length, `${record.id} 有重复 step 的 note`);
    for (const note of record.notes) {
      assert.ok(
        Number.isInteger(note.step) && note.step >= 0 && note.step <= record.moves.length,
        `${record.id} 的 note step ${note.step} 超出 0..${record.moves.length}`,
      );
      assert.ok(note.text.trim() !== '', `${record.id} 有空的 note`);
    }
  }
});

test('开局：初始局面且不超过 16 着', () => {
  for (const record of ofPhase('opening')) {
    assert.equal(record.startFen, INITIAL_FEN, `${record.id} 开局应从初始局面开始`);
    assert.ok(record.moves.length <= 16, `${record.id} 开局超过 16 着`);
  }
});

test('中局：非初始局面、至少 6 着、不以将死收尾', () => {
  for (const record of ofPhase('middlegame')) {
    assert.notEqual(record.startFen, INITIAL_FEN, `${record.id} 中局不应从初始局面开始`);
    assert.ok(record.moves.length >= 6, `${record.id} 中局不足 6 着`);
    assert.notEqual(statusOf(playAll(record)), 'checkmate', `${record.id} 中局不应以将死收尾`);
  }
});

test('终局：自编、将死收尾、起始双方各不少于 4 枚', () => {
  for (const record of ofPhase('ending')) {
    assert.equal(record.source, '自编', `${record.id} 终局来源应为自编`);
    const start = parseFen(record.startFen);
    assert.ok(pieceCount(start, 'red') >= 4, `${record.id} 终局红方少于 4 枚`);
    assert.ok(pieceCount(start, 'black') >= 4, `${record.id} 终局黑方少于 4 枚`);
    assert.equal(statusOf(playAll(record)), 'checkmate', `${record.id} 终局应以将死收尾`);
  }
});

test('残局：来源写明出处、双方各不超过 6 枚、以将死或和棋收尾', () => {
  for (const record of ofPhase('endgame')) {
    // 署名必须可核：要么是古谱名（《…》），要么明写是仿古谱的自编排局。
    assert.ok(
      record.source.startsWith('《') || record.source.includes('仿'),
      `${record.id} 残局来源需写明古谱名或标注为仿作`,
    );
    const start = parseFen(record.startFen);
    assert.ok(pieceCount(start, 'red') <= 6, `${record.id} 残局红方多于 6 枚`);
    assert.ok(pieceCount(start, 'black') <= 6, `${record.id} 残局黑方多于 6 枚`);
    const result = record.result;
    const endsInDraw =
      result !== null &&
      result.winner === null &&
      (result.type === 'repetition' || result.type === 'natural');
    assert.ok(
      statusOf(playAll(record)) === 'checkmate' || endsInDraw,
      `${record.id} 残局应以将死或和棋收尾`,
    );
  }
});

test('解析器拒绝坏记录', () => {
  const valid = rawRecords()[0];
  assert.equal(parseStudyRecord(null), null);
  assert.equal(parseStudyRecord({ ...(valid as Record<string, unknown>), phase: 'unknown' }), null);
  assert.equal(parseStudyRecord({ ...(valid as Record<string, unknown>), moves: [{ from: 0, to: 0 }] }), null);
  assert.equal(
    parseStudyRecord({ ...(valid as Record<string, unknown>), notes: [{ step: 99, text: '越界' }] }),
    null,
  );
  // 同一步两条说明：回放只显示第一条，所以整条记录判坏，不收。
  assert.equal(
    parseStudyRecord({
      ...(valid as Record<string, unknown>),
      notes: [
        { step: 0, text: '开局' },
        { step: 0, text: '又一句' },
      ],
    }),
    null,
  );
});
