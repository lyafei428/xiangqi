// 记谱输入的解析一侧：归一化、命中、零命中，以及生成侧「同一局面记谱两两不同」这条不变量。
// 生成侧（`test/notation.test.ts`）与解析侧分两份文件：用例失败时一眼看得出是哪一侧坏了。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_FEN,
  generateLegalMoves,
  indexOf,
  initialPosition,
  parseChineseNotation,
  parseFen,
  toChineseNotation,
} from '../src/shared/index.ts';
import type { Position } from '../src/shared/index.ts';

const at = (x: number, y: number): number => y * 9 + x;

function position(rows: readonly string[], turn: 'w' | 'b' = 'w'): Position {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return parseFen(`${rows.join('/')} ${turn} - - 0 1`);
}

const blackToMove = parseFen(INITIAL_FEN.replace(' w ', ' b '));

test('红方「炮二平五」解析到炮二平五', () => {
  assert.deepEqual(parseChineseNotation(initialPosition, '炮二平五'), {
    from: at(7, 7),
    to: at(4, 7),
  });
});

test('黑方阿拉伯与汉字两种数字形态都命中', () => {
  const expected = { from: at(7, 2), to: at(4, 2) };
  assert.deepEqual(parseChineseNotation(blackToMove, '炮8平5'), expected);
  assert.deepEqual(parseChineseNotation(blackToMove, '炮八平五'), expected);
});

test('红方敲阿拉伯数字「炮2平5」也命中', () => {
  assert.deepEqual(parseChineseNotation(initialPosition, '炮2平5'), {
    from: at(7, 7),
    to: at(4, 7),
  });
});

test('全角数字与半角等价', () => {
  assert.deepEqual(parseChineseNotation(initialPosition, '炮２平５'), {
    from: at(7, 7),
    to: at(4, 7),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '炮８平５'), {
    from: at(7, 2),
    to: at(4, 2),
  });
});

test('繁体棋子字归一：俥車傌馬砲帥將', () => {
  assert.deepEqual(parseChineseNotation(initialPosition, '俥一进一'), {
    from: at(8, 9),
    to: at(8, 8),
  });
  assert.deepEqual(parseChineseNotation(initialPosition, '帥五进一'), {
    from: at(4, 9),
    to: at(4, 8),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '車9进1'), {
    from: at(8, 0),
    to: at(8, 1),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '將5进1'), {
    from: at(4, 0),
    to: at(4, 1),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '馬2进3'), {
    from: at(1, 0),
    to: at(2, 2),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '砲8平5'), {
    from: at(7, 2),
    to: at(4, 2),
  });
});

test('「進」异体字归一为「进」', () => {
  assert.deepEqual(parseChineseNotation(initialPosition, '俥一進一'), {
    from: at(8, 9),
    to: at(8, 8),
  });
  assert.deepEqual(parseChineseNotation(blackToMove, '馬2進3'), {
    from: at(1, 0),
    to: at(2, 2),
  });
});

test('空白与句读只是分隔符，删掉后照常命中', () => {
  const expected = { from: at(7, 7), to: at(4, 7) };
  assert.deepEqual(parseChineseNotation(initialPosition, '炮 二 平 五'), expected);
  assert.deepEqual(parseChineseNotation(initialPosition, '炮二、平五'), expected);
  assert.deepEqual(parseChineseNotation(initialPosition, '炮二，平五'), expected);
  assert.deepEqual(parseChineseNotation(initialPosition, '炮二。平五'), expected);
  assert.deepEqual(parseChineseNotation(initialPosition, '炮二,平五'), expected);
  assert.deepEqual(parseChineseNotation(initialPosition, '　炮二平五　'), expected);
});

test('零命中返回 null', () => {
  assert.equal(parseChineseNotation(initialPosition, '炮二平九'), null);
  // 文法看得懂但走不通，与写法看不懂走同一条零命中路径。
  assert.equal(parseChineseNotation(initialPosition, '炮二进八'), null);
  assert.equal(parseChineseNotation(initialPosition, '马五进四'), null);
  assert.equal(parseChineseNotation(initialPosition, '这不是记谱'), null);
});

test('空输入返回 null', () => {
  assert.equal(parseChineseNotation(initialPosition, ''), null);
  assert.equal(parseChineseNotation(initialPosition, '   '), null);
  assert.equal(parseChineseNotation(initialPosition, '　　'), null);
  // 只有分隔符的输入归一后同样是空串：空输入不是一条着法。
  assert.equal(parseChineseNotation(initialPosition, '、，。'), null);
});

function assertUniqueNotations(pos: Position): void {
  const moves = generateLegalMoves(pos);
  assert.ok(moves.length > 0, '局面必须有合法着法');
  const notations = moves.map((move) => toChineseNotation(pos, move));
  assert.equal(new Set(notations).size, notations.length, '同一局面下全部合法着法的记谱必须两两不同');
}

test('初始局面下全部合法着法的记谱两两不同', () => {
  assertUniqueNotations(initialPosition);
  assertUniqueNotations(blackToMove);
});

test('拥挤局面下全部合法着法的记谱两两不同', () => {
  // 同纵线三个兵：前/中/后消歧。
  assertUniqueNotations(position(['3k5', '9', '9', 'P8', 'P8', '9', 'P8', '9', '9', '4K4']));
  // 同纵线四个兵：消歧改成序号。
  assertUniqueNotations(position(['3k5', '9', 'P8', 'P8', 'P8', '9', 'P8', '9', '9', '4K4']));
  // 同纵线两个车：前/后。
  assertUniqueNotations(position(['3k5', '9', '9', '9', '9', '8R', '9', '9', '9', '4K3R']));
  // 黑方同纵线两个车：前后按黑方视角。
  assertUniqueNotations(position(['3k5', '9', '9', '9', '8r', '9', '9', '9', '9', '4K3r'], 'b'));
});

function assertRoundTrip(pos: Position): void {
  for (const move of generateLegalMoves(pos)) {
    const written = toChineseNotation(pos, move);
    assert.deepEqual(parseChineseNotation(pos, written), move, `记谱「${written}」应解析回同一着法`);
  }
}

test('生成侧写出的每一步都能解析回同一着法', () => {
  assertRoundTrip(initialPosition);
  assertRoundTrip(blackToMove);
  assertRoundTrip(position(['3k5', '9', 'P8', 'P8', 'P8', '9', 'P8', '9', '9', '4K4']));
});
