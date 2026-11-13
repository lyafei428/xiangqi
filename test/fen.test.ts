import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_FEN,
  fenKey,
  indexOf,
  initialPosition,
  parseFen,
  pieceAt,
  positionKey,
  positionsEqual,
  toFen,
  turnOfFen,
} from '../src/shared/index.ts';

const INITIAL_LAYOUT = INITIAL_FEN.split(' ')[0] ?? '';

/** 行数/列数走样时先在这里炸，别让坏 FEN 悄悄进用例。 */
function fen(rows: readonly string[], turn: 'w' | 'b' = 'w'): string {
  assert.equal(rows.length, 10, 'FEN 必须正好 10 行');
  return `${rows.join('/')} ${turn} - - 0 1`;
}

test('初始局面 FEN 往返一致', () => {
  assert.equal(toFen(initialPosition), INITIAL_FEN);
});

test('initialPosition 与 parseFen 得到同一局面', () => {
  assert.ok(positionsEqual(initialPosition, parseFen(INITIAL_FEN)));
  assert.equal(initialPosition.turn, 'red');
  assert.equal(initialPosition.board.length, 90);
});

test('初始局面关键落位正确', () => {
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(0, 0)), {
    color: 'black',
    type: 'R',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(4, 0)), {
    color: 'black',
    type: 'K',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(1, 2)), {
    color: 'black',
    type: 'C',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(0, 3)), {
    color: 'black',
    type: 'P',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(0, 6)), {
    color: 'red',
    type: 'P',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(4, 9)), {
    color: 'red',
    type: 'K',
  });
  assert.deepEqual(pieceAt(initialPosition.board, indexOf(8, 9)), {
    color: 'red',
    type: 'R',
  });
  assert.equal(pieceAt(initialPosition.board, indexOf(4, 5)), null);
});

test('行棋方接受 r 表示红', () => {
  const pos = parseFen(INITIAL_FEN.replace(' w ', ' r '));
  assert.equal(pos.turn, 'red');
  assert.equal(toFen(pos), INITIAL_FEN);
});

test('省略计数位仍可解析', () => {
  const pos = parseFen(`${INITIAL_LAYOUT} b`);
  assert.equal(pos.turn, 'black');
  assert.equal(pos.board.length, 90);
});

test('数字表示连续空位', () => {
  const sparse = fen(['4k4', '9', '9', '9', '4P4', '9', '9', '9', '9', '4K4']);
  const pos = parseFen(sparse);
  assert.deepEqual(pieceAt(pos.board, indexOf(4, 4)), { color: 'red', type: 'P' });
  assert.equal(pieceAt(pos.board, indexOf(3, 4)), null);
  assert.equal(pieceAt(pos.board, indexOf(5, 4)), null);
  assert.equal(toFen(pos), sparse);
});

test('toFen 写出四个计数字段', () => {
  const fields = toFen(initialPosition).split(' ');
  assert.equal(fields.length, 6);
  assert.deepEqual(fields.slice(2), ['-', '-', '0', '1']);
});

test('行数不对抛错', () => {
  assert.throws(() => parseFen('9/9/9/9/9/9/9/9/4K4 w - - 0 1'));
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '4K4', '9'])));
});

test('列数不对抛错', () => {
  assert.throws(() => parseFen(fen(['3k4', '9', '9', '9', '9', '9', '9', '9', '9', '4K4'])));
  assert.throws(() => parseFen(fen(['3k6', '9', '9', '9', '9', '9', '9', '9', '9', '4K4'])));
});

test('未知字符抛错', () => {
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '4X4'])));
});

test('非法数字抛错', () => {
  // '0' 等于空转一列，'18' 会被累加成 9 列——两者都不是合法 FEN，必须抛错而不是静默通过。
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '40K4'])));
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '18K4'])));
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '09K4'])));
});

test('缺将帅抛错', () => {
  assert.throws(() => parseFen(fen(['9', '9', '9', '9', '9', '9', '9', '9', '9', '4K4'])));
  assert.throws(() => parseFen(fen(['3k5', '9', '9', '9', '9', '9', '9', '9', '9', '9'])));
});

test('出现第二个同色将帅抛错', () => {
  assert.throws(() => parseFen(fen(['3k5', '4K4', '9', '9', '9', '9', '9', '9', '9', '4K4'])));
  assert.throws(() => parseFen(fen(['4k4', '4k4', '9', '9', '9', '9', '9', '9', '9', '4K4'])));
});

test('行棋方非法抛错', () => {
  assert.throws(() => parseFen(`${INITIAL_LAYOUT} x - - 0 1`));
  assert.throws(() => parseFen(INITIAL_LAYOUT));
});

test('positionKey 不含计数位', () => {
  assert.equal(positionKey(initialPosition), `${INITIAL_LAYOUT} w`);
  assert.equal(positionKey(initialPosition), fenKey(INITIAL_FEN));
});

test('fenKey 把 r 归一成 w', () => {
  assert.equal(fenKey(INITIAL_FEN.replace(' w ', ' r ')), positionKey(initialPosition));
});

test('turnOfFen 读出行棋方', () => {
  assert.equal(turnOfFen(INITIAL_FEN), 'red');
  assert.equal(turnOfFen(`${INITIAL_LAYOUT} b - - 0 1`), 'black');
});
