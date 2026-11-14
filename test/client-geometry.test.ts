import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HIT_RADIUS,
  MIN_BOARD_WIDTH,
  boardSize,
  clientToViewPoint,
  mirrorSquare,
  pointOf,
  squareAtClientPoint,
  squareAtViewPoint,
} from '../src/client/board/geometry.ts';

test('翻转取镜像：行列同时取反，取两次回原格', () => {
  assert.equal(mirrorSquare(0), 89);
  assert.equal(mirrorSquare(89), 0);
  assert.equal(mirrorSquare(4), 85);
  assert.equal(mirrorSquare(85), 4);
  for (let square = 0; square < 90; square += 1) {
    assert.equal(mirrorSquare(mirrorSquare(square)), square);
  }
});

test('翻转后黑方的底线落在棋盘下方', () => {
  // 黑将开局在 4 号交叉点（左上区域），执黑时应该出现在下半盘。
  assert.ok(pointOf(mirrorSquare(4)).y > 500);
  assert.ok(pointOf(4).y < 500);
});

test('交叉点与 viewBox 坐标一一对应', () => {
  assert.deepEqual(pointOf(0), { x: 50, y: 50 });
  assert.deepEqual(pointOf(4 * 9 + 4), { x: 450, y: 450 });
  assert.deepEqual(pointOf(89), { x: 850, y: 950 });
});

test('最近交叉点在命中半径内才算命中', () => {
  assert.equal(squareAtViewPoint(50, 50), 0);
  assert.equal(squareAtViewPoint(50 + HIT_RADIUS - 1, 50), 0);
  assert.equal(squareAtViewPoint(50 + HIT_RADIUS + 1, 50), null);
  assert.equal(squareAtViewPoint(100, 100), null, '两交叉点正中间离谁都不够近');
  assert.equal(squareAtViewPoint(-10, 50), null, '棋盘外不命中');
  assert.equal(squareAtViewPoint(850, 950), 89);
});

test('客户端像素坐标按当前 rect 缩放后命中', () => {
  const rect = { left: 100, top: 50, width: 450, height: 500 };
  assert.deepEqual(clientToViewPoint(100, 50, rect), { x: 0, y: 0 });
  assert.equal(squareAtClientPoint(125, 75, rect), 0);
  assert.equal(squareAtClientPoint(0, 0, rect), null);
  assert.equal(squareAtClientPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);
});

test('桌面档：高度上限 720，宽度按 9:10', () => {
  assert.deepEqual(boardSize(1440, 900), { width: 648, height: 720 });
});

test('可用区比上限矮时按高度收宽度', () => {
  assert.deepEqual(boardSize(800, 600), { width: 540, height: 600 });
});

test('手机档：格宽不小于 40，容器更窄也不缩棋盘', () => {
  const size = boardSize(320, 334);
  assert.equal(size.width, MIN_BOARD_WIDTH);
  assert.equal(size.width / 9, 40);
  assert.equal(size.height, 400);
});

test('可用宽大于高时以高为准，宽度仍守 40px 下限', () => {
  assert.deepEqual(boardSize(2000, 400), { width: 360, height: 400 });
});
