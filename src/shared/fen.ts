// FEN 读写。非法输入一律抛错，不返回兜底局面——坏局面越早暴露越便宜。

import type { Board, Color, Piece, PieceType, Position } from './types.ts';
import { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, indexOf } from './board.ts';

export const INITIAL_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const SIDE_LETTERS: Readonly<Record<Color, string>> = { red: 'w', black: 'b' };

const TYPE_LETTERS: Readonly<Record<string, PieceType>> = {
  K: 'K',
  A: 'A',
  B: 'B',
  N: 'N',
  R: 'R',
  C: 'C',
  P: 'P',
};

function splitFields(fen: string): string[] {
  return fen.trim().split(/\s+/);
}

function readSide(field: string | undefined): Color {
  if (field === 'w' || field === 'r') return 'red';
  if (field === 'b') return 'black';
  throw new Error(`Invalid FEN: unknown side to move "${field ?? ''}"`);
}

function boardFen(board: Board): string {
  const rows: string[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[indexOf(x, y)] ?? null;
      if (piece === null) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += piece.color === 'red' ? piece.type : piece.type.toLowerCase();
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

export function parseFen(fen: string): Position {
  const fields = splitFields(fen);
  const layout = fields[0];
  if (layout === undefined || layout.length === 0) {
    throw new Error('Invalid FEN: missing board field');
  }
  const rows = layout.split('/');
  if (rows.length !== BOARD_HEIGHT) {
    throw new Error(`Invalid FEN: expected ${BOARD_HEIGHT} rows, got ${rows.length}`);
  }

  const board: (Piece | null)[] = emptyBoard().slice();
  const kings: Record<Color, number> = { red: 0, black: 0 };

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    const row = rows[y];
    if (row === undefined) throw new Error(`Invalid FEN: row ${y} is missing`);
    let x = 0;
    let prevWasDigit = false;
    for (const char of row) {
      const digit = char.charCodeAt(0) - 48;
      if (digit >= 0 && digit <= 9) {
        // '0' 是空转一列、连写数字会被累加成别的列数（"18" 读成 9 列），两者都不是合法 FEN，
        // 却都会静默通过，与「非法输入一律抛错」的契约相反。
        if (digit === 0) {
          throw new Error(`Invalid FEN: '0' is not a valid empty-run length in row ${y}`);
        }
        if (prevWasDigit) {
          throw new Error(`Invalid FEN: consecutive digits "${row}" in row ${y}`);
        }
        prevWasDigit = true;
        x += digit;
        if (x > BOARD_WIDTH) {
          throw new Error(`Invalid FEN: row ${y} is wider than ${BOARD_WIDTH} columns`);
        }
        continue;
      }
      prevWasDigit = false;
      const type = TYPE_LETTERS[char.toUpperCase()];
      if (type === undefined) {
        throw new Error(`Invalid FEN: unknown piece character "${char}" in row ${y}`);
      }
      if (x >= BOARD_WIDTH) {
        throw new Error(`Invalid FEN: row ${y} is wider than ${BOARD_WIDTH} columns`);
      }
      const color: Color = char === char.toUpperCase() ? 'red' : 'black';
      board[indexOf(x, y)] = { color, type };
      if (type === 'K') kings[color] += 1;
      x += 1;
    }
    if (x !== BOARD_WIDTH) {
      throw new Error(`Invalid FEN: row ${y} has ${x} columns, expected ${BOARD_WIDTH}`);
    }
  }

  for (const color of ['red', 'black'] as const) {
    if (kings[color] === 0) throw new Error(`Invalid FEN: ${color} has no king`);
    if (kings[color] > 1) throw new Error(`Invalid FEN: ${color} has ${kings[color]} kings`);
  }

  return { board, turn: readSide(fields[1]) };
}

export function toFen(pos: Position): string {
  // 吃子计数与回合数由调用方的 history 负责，这里补固定占位以保证 4 个计数字段完整。
  return `${boardFen(pos.board)} ${SIDE_LETTERS[pos.turn]} - - 0 1`;
}

/** 重复检测用的局面键：棋盘 + 行棋方，不含计数位。 */
export function positionKey(pos: Position): string {
  return `${boardFen(pos.board)} ${SIDE_LETTERS[pos.turn]}`;
}

/** 把历史里的完整 FEN 归一成与 positionKey 同一形态，'r' 一并折成 'w'。 */
export function fenKey(fen: string): string {
  const fields = splitFields(fen);
  const layout = fields[0];
  if (layout === undefined || layout.length === 0) {
    throw new Error('Invalid FEN: missing board field');
  }
  return `${layout} ${SIDE_LETTERS[readSide(fields[1])]}`;
}

export function turnOfFen(fen: string): Color {
  return readSide(splitFields(fen)[1]);
}

export const initialPosition: Position = parseFen(INITIAL_FEN);
