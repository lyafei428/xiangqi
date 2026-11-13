import test from 'node:test';
import assert from 'node:assert/strict';
import type { Position } from '../src/shared/index.ts';
import {
  applyMove,
  generateLegalMoves,
  initialPosition,
  isInCheck,
  isLegal,
  judgeGame,
  parseFen,
  statusOf,
  toFen,
} from '../src/shared/index.ts';

const at = (x: number, y: number): number => y * 9 + x;

/** 判定型用例一律用 FEN 直接摆局面，不靠走一串着法摆出来。 */
function position(rows: readonly string[], turn: 'w' | 'b' = 'w'): Position {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return parseFen(`${rows.join('/')} ${turn} - - 0 1`);
}

const MATE = position(['R2k5', '9', '9', '9', '9', '3R5', '9', '9', '9', '4K4'], 'b');

const STALEMATE = position(['4k4', 'R8', '9', '9', '9', '3R1R3', '9', '9', '9', '3K5'], 'b');

test('将死：被将且无合法着法', () => {
  assert.equal(isInCheck(MATE, 'black'), true);
  assert.equal(generateLegalMoves(MATE).length, 0);
  assert.equal(statusOf(MATE), 'checkmate');
  assert.deepEqual(judgeGame(MATE, [], toFen(MATE)), { type: 'checkmate', winner: 'red' });
});

test('困毙判负：未被将且无合法着法，无着法方负', () => {
  assert.equal(isInCheck(STALEMATE, 'black'), false, '困毙与将死的唯一区别就是没被将');
  assert.equal(generateLegalMoves(STALEMATE).length, 0);
  assert.equal(statusOf(STALEMATE), 'stalemate');
  assert.deepEqual(judgeGame(STALEMATE, [], toFen(STALEMATE)), { type: 'stalemate', winner: 'red' });
});

test('飞将：将帅照面的局面本身就是被将', () => {
  const faceOff = position(['4k4', '9', '9', '9', '9', '9', '9', '9', '9', '4K4']);
  assert.equal(isInCheck(faceOff, 'red'), true);
  assert.equal(isInCheck(faceOff, 'black'), true);
});

test('飞将：走开后照面的着法非法', () => {
  const pos = position(['4k4', '9', '9', '9', '4P4', '9', '9', '9', '9', '4K4']);
  assert.equal(isInCheck(pos, 'red'), false, '隔着兵时还没照面');
  assert.equal(isLegal(pos, { from: at(4, 4), to: at(3, 4) }), false);
  assert.equal(isLegal(pos, { from: at(4, 4), to: at(5, 4) }), false);
  assert.equal(isLegal(pos, { from: at(4, 4), to: at(4, 3) }), true, '留在同列挡着就合法');
});

test('被将时必须应将', () => {
  const pos = position(['3k5', '9', '9', '9', '9', 'R3r4', '9', '9', '9', '4K4']);
  assert.equal(isInCheck(pos, 'red'), true);
  assert.equal(statusOf(pos), 'check');
  assert.equal(generateLegalMoves(pos).length, 2);
  assert.equal(isLegal(pos, { from: at(0, 5), to: at(4, 5) }), true, '吃将子解将');
  assert.equal(isLegal(pos, { from: at(4, 9), to: at(5, 9) }), true, '闪开将线');
  assert.equal(isLegal(pos, { from: at(0, 5), to: at(0, 4) }), false, '不接口将就是非法着');
  assert.equal(isLegal(pos, { from: at(4, 9), to: at(4, 8) }), false, '还在将线上');
});

test('合法着法过滤：所有合法着法走完都不被将', () => {
  const pos = position(['3k5', '9', '9', '9', '9', 'R3r4', '9', '9', '9', '4K4']);
  for (const move of generateLegalMoves(pos)) {
    assert.equal(
      isInCheck(applyMove(pos, move), 'red'),
      false,
      `走完 ${move.from}->${move.to} 仍被将`,
    );
  }
});

test('合法着法过滤：开局 44 个合法着法全部安全', () => {
  const legal = generateLegalMoves(initialPosition);
  assert.equal(legal.length, 44);
  for (const move of legal) {
    assert.equal(isInCheck(applyMove(initialPosition, move), 'red'), false);
  }
});

test('isLegal 拒绝规则上不成立的着法', () => {
  assert.equal(isLegal(initialPosition, { from: at(0, 0), to: at(0, 1) }), false, '不是行棋方的子');
  assert.equal(isLegal(initialPosition, { from: at(0, 9), to: at(0, 6) }), false, '不能落在己方兵上');
  assert.equal(isLegal(initialPosition, { from: at(0, 9), to: at(0, 5) }), false, '车不能越过己方兵');
  assert.equal(isLegal(initialPosition, { from: at(4, 5), to: at(4, 4) }), false, '空起点');
  assert.equal(isLegal(initialPosition, { from: at(0, 9), to: at(0, 8) }), true);
});

test('statusOf 对开局与被将局面分别给出 playing / check', () => {
  assert.equal(statusOf(initialPosition), 'playing');
  assert.deepEqual(judgeGame(initialPosition, [], toFen(initialPosition)), null);
});
