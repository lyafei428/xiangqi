import test from 'node:test';
import assert from 'node:assert/strict';
import type { HistoryEntry, Position } from '../src/shared/index.ts';
import {
  INITIAL_FEN,
  judgeGame,
  naturalLimitResult,
  parseFen,
  playMove,
  recordMove,
  repetitionResult,
  toFen,
} from '../src/shared/index.ts';

const at = (x: number, y: number): number => y * 9 + x;

type Line = readonly (readonly [number, number])[];

function position(rows: readonly string[], turn: 'w' | 'b' = 'w'): Position {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return parseFen(`${rows.join('/')} ${turn} - - 0 1`);
}

/** 重复判罚离不开真实着法序列，这类用例只能一着一着走。 */
function playLine(start: Position, line: Line): { position: Position; history: HistoryEntry[] } {
  let position = start;
  let history: HistoryEntry[] = [];
  for (const [from, to] of line) {
    const next = playMove(position, history, { from, to });
    position = next.position;
    history = next.history;
  }
  return { position, history };
}

function repeat(cycle: Line, rounds: number): Line {
  const line: (readonly [number, number])[] = [];
  for (let round = 0; round < rounds; round += 1) line.push(...cycle);
  return line;
}

/** 四着一循环：红车、黑车各上下挪一步，双方都不将军。 */
const SHUFFLE_CYCLE: Line = [
  [at(0, 5), at(0, 4)],
  [at(8, 5), at(8, 4)],
  [at(0, 4), at(0, 5)],
  [at(8, 4), at(8, 5)],
];

/** 四着一循环：红车每着都将军，黑将左右躲。 */
const PERPETUAL_CYCLE: Line = [
  [at(4, 0), at(3, 0)],
  [at(4, 5), at(3, 5)],
  [at(3, 0), at(4, 0)],
  [at(3, 5), at(4, 5)],
];

test('三次重复判和：两方都不将军', () => {
  const start = position(['3k5', '9', '9', '9', '9', 'R7r', '9', '9', '9', '4K4']);
  const startFen = toFen(start);

  const once = playLine(start, repeat(SHUFFLE_CYCLE, 1));
  assert.equal(
    repetitionResult(once.position, once.history, startFen),
    null,
    '起始局面算第 1 次，回到一次共 2 次，不判',
  );

  // 起始局面计入后，第二圈走完就是第 3 次——这正是「双方各自挪回原位」的实际情形。
  const twice = playLine(start, repeat(SHUFFLE_CYCLE, 2));
  assert.deepEqual(repetitionResult(twice.position, twice.history, startFen), {
    type: 'repetition',
    winner: null,
  });
  assert.deepEqual(judgeGame(twice.position, twice.history, startFen), {
    type: 'repetition',
    winner: null,
  });
});

test('长将判负：每着都将军的一方负', () => {
  const start = position(['4k4', '9', '9', '9', '9', '4R4', '9', '9', '9', '5K3'], 'b');

  const startFen = toFen(start);

  const once = playLine(start, repeat(PERPETUAL_CYCLE, 1));
  assert.equal(repetitionResult(once.position, once.history, startFen), null);

  const twice = playLine(start, repeat(PERPETUAL_CYCLE, 2));
  assert.deepEqual(repetitionResult(twice.position, twice.history, startFen), {
    type: 'perpetual',
    winner: 'black',
  });
  assert.deepEqual(judgeGame(twice.position, twice.history, startFen), {
    type: 'perpetual',
    winner: 'black',
  });
});

test('长将判定看的是循环段里各自每着是否将军', () => {
  const start = position(['4k4', '9', '9', '9', '9', '4R4', '9', '9', '9', '5K3'], 'b');
  const game = playLine(start, repeat(PERPETUAL_CYCLE, 3));
  const redEntries = game.history.filter((_, index) => index % 2 === 1);
  const blackEntries = game.history.filter((_, index) => index % 2 === 0);
  assert.equal(redEntries.length, 6);
  assert.ok(redEntries.every((entry) => entry.gaveCheck), '红方每着都将军');
  assert.ok(blackEntries.every((entry) => !entry.gaveCheck), '黑方只是躲将，没有将军');
});

test('自然限着：连续 120 着无吃子判和', () => {
  const quiet = (): HistoryEntry => ({
    move: { from: 0, to: 0 },
    fen: INITIAL_FEN,
    gaveCheck: false,
    captured: false,
  });
  assert.equal(naturalLimitResult(Array.from({ length: 119 }, quiet)), null);
  assert.deepEqual(naturalLimitResult(Array.from({ length: 120 }, quiet)), {
    type: 'natural',
    winner: null,
  });
});

test('自然限着的计数从上一次吃子重新起算', () => {
  const quiet = (): HistoryEntry => ({
    move: { from: 0, to: 0 },
    fen: INITIAL_FEN,
    gaveCheck: false,
    captured: false,
  });
  const capture = (): HistoryEntry => ({ ...quiet(), captured: true });

  assert.equal(naturalLimitResult([...Array.from({ length: 119 }, quiet), capture()]), null);
  assert.equal(naturalLimitResult([capture(), ...Array.from({ length: 119 }, quiet)]), null);
});

test('recordMove 记录吃子与将军，FEN 可原样回读', () => {
  const captureStart = position(['3k5', '9', '9', '9', '9', 'R7r', '9', '9', '9', '4K4']);
  const captureEntry = recordMove(captureStart, { from: at(0, 5), to: at(8, 5) });
  assert.equal(captureEntry.captured, true);
  assert.equal(captureEntry.gaveCheck, false);
  assert.equal(toFen(parseFen(captureEntry.fen)), captureEntry.fen);

  const checkStart = position(['3k5', '9', '9', '9', '9', 'R8', '9', '9', '9', '4K4']);
  const checkEntry = recordMove(checkStart, { from: at(0, 5), to: at(3, 5) });
  assert.equal(checkEntry.gaveCheck, true);
  assert.equal(checkEntry.captured, false);
});
