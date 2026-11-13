import test from 'node:test';
import assert from 'node:assert/strict';
import type { Position } from '../src/shared/index.ts';
import { generateMoves, isSquareAttacked, parseFen } from '../src/shared/index.ts';

const at = (x: number, y: number): number => y * 9 + x;

/** 用例局面一律用 FEN 直接摆；行数写错先炸在构造处。 */
function position(rows: readonly string[], turn: 'w' | 'b' = 'w'): Position {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return parseFen(`${rows.join('/')} ${turn} - - 0 1`);
}

function targetsFrom(pos: Position, from: number): number[] {
  return generateMoves(pos)
    .filter((move) => move.from === from)
    .map((move) => move.to);
}

function expectTargets(pos: Position, from: number, expected: readonly number[]): void {
  assert.deepEqual(targetsFrom(pos, from).sort((a, b) => a - b), [...expected].sort((a, b) => a - b));
}

test('车四方向滑行到棋盘边', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4R4', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 5));
  assert.equal(targets.length, 17);
  assert.ok(targets.includes(at(4, 0)));
  assert.ok(targets.includes(at(4, 9)));
  assert.ok(targets.includes(at(0, 5)));
  assert.ok(targets.includes(at(8, 5)));
});

test('车遇子即停，可吃敌子', () => {
  const pos = position(['3k5', '9', '9', '4p4', '9', '4R4', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 5));
  assert.equal(targets.length, 14);
  assert.ok(targets.includes(at(4, 3)), '敌子所在格可吃');
  assert.ok(!targets.includes(at(4, 2)), '不能越过第一个子');
  assert.ok(!targets.includes(at(4, 1)));
});

test('车不能落在己方棋子格，也不能穿过去', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4R4', '4P4', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 5));
  assert.ok(!targets.includes(at(4, 6)));
  assert.ok(!targets.includes(at(4, 7)));
  assert.equal(targets.length, 13);
});

test('炮不吃子时滑行到第一个棋子之前', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4C4', '9', '9', '9', '3K5']);
  assert.equal(targetsFrom(pos, at(4, 5)).length, 17);
});

test('炮不吃子不能隔子', () => {
  const pos = position(['3k5', '4r4', '9', '9', '9', '4C4', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 5));
  assert.ok(targets.includes(at(4, 2)), '炮架之前的空格可走');
  assert.ok(!targets.includes(at(4, 1)), '无炮架吃不了子，也走不到子后');
  assert.ok(!targets.includes(at(4, 0)));
});

test('炮吃子必须恰好隔一个炮架', () => {
  const pos = position(['3k5', '4r4', '9', '4p4', '9', '4C4', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 5));
  assert.ok(targets.includes(at(4, 1)), '隔一子可以吃');
  assert.ok(targets.includes(at(4, 4)), '炮架之前仍可走');
  assert.ok(!targets.includes(at(4, 3)), '炮架格自身不能落');
  assert.ok(!targets.includes(at(4, 2)), '炮架之后只有第一个子可吃');
  assert.ok(!targets.includes(at(4, 0)));
});

test('炮的炮架可以是任意颜色', () => {
  const redScreen = position(['3k5', '4r4', '9', '4P4', '9', '4C4', '9', '9', '9', '3K5']);
  assert.ok(targetsFrom(redScreen, at(4, 5)).includes(at(4, 1)));
});

test('马八面威风，无阻挡时八个落点', () => {
  const pos = position(['3k5', '9', '9', '9', '4N4', '9', '9', '9', '9', '3K5']);
  assert.equal(targetsFrom(pos, at(4, 4)).length, 8);
});

test('蹩马腿：横向位移为 2 时腿在 (x+dx/2, y)', () => {
  const pos = position(['3k5', '9', '9', '9', '4NP3', '9', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 4));
  assert.equal(targets.length, 6);
  assert.ok(!targets.includes(at(6, 5)));
  assert.ok(!targets.includes(at(6, 3)));
  assert.ok(targets.includes(at(2, 5)));
  assert.ok(targets.includes(at(2, 3)));
});

test('蹩马腿：纵向位移为 2 时腿在 (x, y+dy/2)', () => {
  const pos = position(['3k5', '9', '9', '9', '4N4', '4P4', '9', '9', '9', '3K5']);
  const targets = targetsFrom(pos, at(4, 4));
  assert.equal(targets.length, 6);
  assert.ok(!targets.includes(at(5, 6)));
  assert.ok(!targets.includes(at(3, 6)));
  assert.ok(targets.includes(at(6, 5)));
  assert.ok(targets.includes(at(2, 5)));
});

test('塞象眼', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '9', '9', '4B4', '3P5', '5K3']);
  const targets = targetsFrom(pos, at(4, 7));
  assert.ok(!targets.includes(at(2, 9)), '象眼被塞住的方向不通');
  assert.ok(targets.includes(at(6, 9)));
  assert.ok(targets.includes(at(2, 5)));
  assert.ok(targets.includes(at(6, 5)));
  assert.equal(targets.length, 3);
});

test('象不得过河（红方）', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4B4', '9', '9', '9', '5K3']);
  expectTargets(pos, at(4, 5), [at(2, 7), at(6, 7)]);
});

test('象不得过河（黑方）', () => {
  const pos = position(['3k5', '9', '9', '9', '4b4', '9', '9', '9', '9', '5K3'], 'b');
  expectTargets(pos, at(4, 4), [at(2, 2), at(6, 2)]);
});

test('仕只能在九宫内斜走一格', () => {
  const center = position(['3k5', '9', '9', '9', '9', '9', '9', '9', '4A4', '4K4']);
  assert.equal(targetsFrom(center, at(4, 8)).length, 4);
  const corner = position(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '3A1K3']);
  expectTargets(corner, at(3, 9), [at(4, 8)]);
});

test('帅只能在九宫内走一步', () => {
  const center = position(['3k5', '9', '9', '9', '9', '9', '9', '9', '4K4', '9']);
  expectTargets(center, at(4, 8), [at(3, 8), at(5, 8), at(4, 7), at(4, 9)]);
  const corner = position(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '3K5']);
  expectTargets(corner, at(3, 9), [at(3, 8), at(4, 9)]);
});

test('将只能在九宫内走一步', () => {
  const pos = position(['4k4', '9', '9', '9', '9', '9', '9', '9', '9', '3K5'], 'b');
  expectTargets(pos, at(4, 0), [at(3, 0), at(5, 0), at(4, 1)]);
});

test('兵未过河只能向前一步', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '9', '4P4', '9', '9', '4K4']);
  expectTargets(pos, at(4, 6), [at(4, 5)]);
});

test('兵过河后可以左右走', () => {
  const pos = position(['3k5', '9', '9', '9', '4P4', '9', '9', '9', '9', '4K4']);
  expectTargets(pos, at(4, 4), [at(4, 3), at(3, 4), at(5, 4)]);
});

test('兵在边线过河后只有一侧可走', () => {
  const pos = position(['3k5', '9', '9', '9', 'P8', '9', '9', '9', '9', '4K4']);
  expectTargets(pos, at(0, 4), [at(0, 3), at(1, 4)]);
});

test('卒未过河只能向前一步', () => {
  const pos = position(['3k5', '9', '9', '4p4', '9', '9', '9', '9', '9', '4K4'], 'b');
  expectTargets(pos, at(4, 3), [at(4, 4)]);
});

test('卒过河后可以左右走', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4p4', '9', '9', '9', '4K4'], 'b');
  expectTargets(pos, at(4, 5), [at(4, 6), at(3, 5), at(5, 5)]);
});

test('兵卒永不后退', () => {
  const red = position(['3k5', '9', '9', '9', '4P4', '9', '9', '9', '9', '4K4']);
  assert.ok(!targetsFrom(red, at(4, 4)).includes(at(4, 5)));
  const black = position(['3k5', '9', '9', '9', '9', '4p4', '9', '9', '9', '4K4'], 'b');
  assert.ok(!targetsFrom(black, at(4, 5)).includes(at(4, 4)));
});

test('走法生成只看行棋方的棋子', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4R4', '9', '9', '9', '4K4']);
  const froms = new Set(generateMoves(pos).map((move) => move.from));
  assert.ok(!froms.has(at(3, 0)), '黑将不该在红方回合出招');
  assert.ok(froms.has(at(4, 5)));
});

test('isSquareAttacked：车沿线攻击', () => {
  const pos = position(['3k5', '9', '9', '9', '9', '4R4', '9', '9', '9', '4K4']);
  assert.ok(isSquareAttacked(pos, at(4, 0), 'red'));
  assert.ok(isSquareAttacked(pos, at(4, 9), 'red'));
  assert.ok(isSquareAttacked(pos, at(0, 5), 'red'));
  assert.ok(!isSquareAttacked(pos, at(3, 0), 'red'));
});

test('isSquareAttacked：将帅攻击同列无遮挡的任何格', () => {
  const pos = position(['4k4', '9', '9', '9', '9', '9', '9', '9', '9', '4K4']);
  assert.ok(isSquareAttacked(pos, at(4, 9), 'black'));
  assert.ok(isSquareAttacked(pos, at(4, 0), 'red'));
  assert.ok(isSquareAttacked(pos, at(4, 5), 'red'), '中间无子时列上任何格都被将帅攻击');
});

test('isSquareAttacked：炮的隔子攻击', () => {
  const pos = position(['3k5', '4r4', '9', '4p4', '9', '4C4', '9', '9', '9', '3K5']);
  assert.ok(isSquareAttacked(pos, at(4, 1), 'red'));
  assert.ok(!isSquareAttacked(pos, at(4, 3), 'red'), '炮架本身不是被攻击格');
  assert.ok(!isSquareAttacked(pos, at(4, 0), 'red'), '隔两子也不行');
});
