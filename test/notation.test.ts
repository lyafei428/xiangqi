import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnOfFile,
  fileNumberOf,
  initialPosition,
  parseFen,
  toChineseNotation,
} from '../src/shared/index.ts';

const at = (x: number, y: number): number => y * 9 + x;

function position(rows: readonly string[], turn: 'w' | 'b' = 'w') {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return parseFen(`${rows.join('/')} ${turn} - - 0 1`);
}

function notation(
  pos: ReturnType<typeof position>,
  from: readonly [number, number],
  to: readonly [number, number],
): string {
  return toChineseNotation(pos, { from: at(from[0], from[1]), to: at(to[0], to[1]) });
}

test('红方纵线：第 n 路在 x = 9 - n', () => {
  assert.equal(fileNumberOf('red', 8), 1);
  assert.equal(fileNumberOf('red', 0), 9);
  assert.equal(fileNumberOf('red', 4), 5);
});

test('黑方纵线：第 n 路在 x = n - 1', () => {
  assert.equal(fileNumberOf('black', 0), 1);
  assert.equal(fileNumberOf('black', 8), 9);
  assert.equal(fileNumberOf('black', 4), 5);
});

test('纵线换算可逆', () => {
  for (let x = 0; x < 9; x += 1) {
    assert.equal(columnOfFile('red', fileNumberOf('red', x)), x);
    assert.equal(columnOfFile('black', fileNumberOf('black', x)), x);
  }
  assert.equal(columnOfFile('red', 1), 8);
  assert.equal(columnOfFile('black', 1), 0);
});

test('红方起步着法记谱', () => {
  const pos = initialPosition;
  assert.equal(notation(pos, [7, 7], [4, 7]), '炮二平五');
  assert.equal(notation(pos, [1, 9], [2, 7]), '马八进七');
  assert.equal(notation(pos, [6, 9], [4, 7]), '相三进五');
  assert.equal(notation(pos, [5, 9], [4, 8]), '仕四进五');
  assert.equal(notation(pos, [8, 9], [8, 8]), '车一进一');
  assert.equal(notation(pos, [2, 6], [2, 5]), '兵七进一');
  assert.equal(notation(pos, [6, 6], [6, 5]), '兵三进一');
  assert.equal(notation(pos, [4, 9], [4, 8]), '帅五进一');
});

test('黑方起步着法记谱', () => {
  const pos = initialPosition;
  assert.equal(notation(pos, [7, 2], [4, 2]), '炮8平5');
  assert.equal(notation(pos, [1, 0], [2, 2]), '马2进3');
  assert.equal(notation(pos, [2, 0], [4, 2]), '象3进5');
  assert.equal(notation(pos, [6, 0], [4, 2]), '象7进5');
  assert.equal(notation(pos, [8, 0], [8, 1]), '车9进1');
  assert.equal(notation(pos, [6, 3], [6, 4]), '卒7进1');
});

test('红方退子', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '8R', '9', '9', '9', '4K4']);
  assert.equal(notation(pos, [8, 5], [8, 7]), '车一退二');
});

test('黑方进子按黑方视角记行数', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '8r', '9', '9', '9', '4K4'], 'b');
  assert.equal(notation(pos, [8, 5], [8, 7]), '车9进2');
});

test('马与相用目标纵线', () => {
  const pos = position(['3k5', '9', '9', '9', '4N4', '9', '9', '9', '9', '4K4']);
  assert.equal(notation(pos, [4, 4], [5, 2]), '马五进四');
  assert.equal(notation(pos, [4, 4], [2, 2]), '马五进七');
  const bishop = position(['3k5', '9', '9', '9', '9', '4B4', '9', '9', '9', '4K4']);
  assert.equal(notation(bishop, [4, 5], [2, 7]), '相五退七');
});

test('同纵线两个车用前后消歧', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '8R', '9', '9', '9', '4K3R']);
  assert.equal(notation(pos, [8, 5], [8, 4]), '前车进一');
  assert.equal(notation(pos, [8, 9], [8, 6]), '后车进三');
});

test('同纵线三个兵用前中后', () => {
  const pos = position(['3k5', '9', '9', 'P8', 'P8', '9', 'P8', '9', '9', '4K4']);
  assert.equal(notation(pos, [0, 3], [1, 3]), '前兵平八');
  assert.equal(notation(pos, [0, 4], [1, 4]), '中兵平八');
  assert.equal(notation(pos, [0, 6], [0, 5]), '后兵进一');
});

test('同纵线四个以上按前到后编号', () => {
  const pos = position(['3k5', '9', 'P8', 'P8', 'P8', '9', 'P8', '9', '9', '4K4']);
  assert.equal(notation(pos, [0, 2], [0, 1]), '一兵进一');
  assert.equal(notation(pos, [0, 3], [1, 3]), '二兵平八');
  assert.equal(notation(pos, [0, 4], [1, 4]), '三兵平八');
  assert.equal(notation(pos, [0, 6], [0, 5]), '四兵进一');
});

test('黑方前后消歧以黑方视角定前后', () => {
  const pos = position(['3k5', '9', '9', '9', '8r', '9', '9', '9', '9', '4K3r'], 'b');
  assert.equal(notation(pos, [8, 9], [7, 9]), '前车平8');
  assert.equal(notation(pos, [8, 4], [8, 5]), '后车进1');
});

test('不同兵种同纵线不算歧义', () => {
  const pos = position(['3k5', '9', '9', '9', 'P8', 'R8', '9', '9', '9', '4K4']);
  assert.equal(notation(pos, [0, 5], [1, 5]), '车九平八');
});

test('记谱对空起点报错', () => {
  const pos = initialPosition;
  assert.throws(() => toChineseNotation(pos, { from: at(4, 5), to: at(4, 4) }));
});
