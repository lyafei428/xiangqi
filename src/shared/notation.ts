// 中文记谱：生成与反向解析。棋谱存储一律用坐标序列。

import type { Color, Move, Piece, PieceType, Position } from './types.ts';
import { BOARD_HEIGHT, indexOf, pieceAt, xOf, yOf } from './board.ts';
import { generateLegalMoves } from './rules.ts';

const RED_NUMERALS: readonly string[] = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLACK_NUMERALS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// 记谱用常见字：棋谱是拿来读和抄的，重字会让人卡住。
const PIECE_NAMES: Readonly<Record<Color, Readonly<Record<PieceType, string>>>> = {
  red: { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' },
  black: { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' },
};

// 棋盘上按传统实体棋的写法：红方俥傌炮，黑方車馬砲，将帅也带各自的名字。
const PIECE_GLYPHS: Readonly<Record<Color, Readonly<Record<PieceType, string>>>> = {
  red: { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵' },
  black: { K: '將', A: '士', B: '象', N: '馬', R: '車', C: '砲', P: '卒' },
};

/** 棋子摆在棋盘上的字：传统写法，红黑一眼分得开。 */
export function pieceName(color: Color, type: PieceType): string {
  return PIECE_GLYPHS[color][type];
}

// 车、炮、兵、帅记移动行数，马、相、仕记目标纵线。记反了整盘棋谱就读不出来。
const AMOUNT_IS_TARGET_FILE: Readonly<Record<PieceType, boolean>> = {
  K: false,
  A: true,
  B: true,
  N: true,
  R: false,
  C: false,
  P: false,
};

/** 红方第 n 路在 x = 9 - n，黑方第 n 路在 x = n - 1。 */
export function fileNumberOf(color: Color, x: number): number {
  return color === 'red' ? 9 - x : x + 1;
}

export function columnOfFile(color: Color, file: number): number {
  return color === 'red' ? 9 - file : file - 1;
}

function numeralOf(color: Color, n: number): string {
  const table = color === 'red' ? RED_NUMERALS : BLACK_NUMERALS;
  const numeral = table[n - 1];
  if (numeral === undefined) throw new RangeError(`记谱：${color} 序号 ${n} 超出 1..9`);
  return numeral;
}

function fileLabel(color: Color, x: number): string {
  return numeralOf(color, fileNumberOf(color, x));
}

/** 同纵线同色同兵种多于一个时返回 前/中/后 或序号，否则返回 undefined。 */
function ordinalOf(pos: Position, from: number, piece: Piece): string | undefined {
  const x = xOf(from);
  const peers: number[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    const index = indexOf(x, y);
    const other = pieceAt(pos.board, index);
    if (other !== null && other.color === piece.color && other.type === piece.type) {
      peers.push(index);
    }
  }
  if (peers.length <= 1) return undefined;

  // 靠近对方者为前：红方 y 小的是前，黑方 y 大的是前。
  peers.sort((a, b) => (piece.color === 'red' ? yOf(a) - yOf(b) : yOf(b) - yOf(a)));
  const rank = peers.indexOf(from);
  if (peers.length === 2) return rank === 0 ? '前' : '后';
  if (peers.length === 3) return rank === 0 ? '前' : rank === 1 ? '中' : '后';
  return numeralOf(piece.color, rank + 1);
}

/** 记谱首段：无歧义时是 棋子 + 纵线（炮二），有歧义时序号在棋子之前（前车）。 */
function pieceHead(pos: Position, from: number, piece: Piece): string {
  const name = PIECE_NAMES[piece.color][piece.type];
  const ordinal = ordinalOf(pos, from, piece);
  if (ordinal === undefined) return `${name}${fileLabel(piece.color, xOf(from))}`;
  return `${ordinal}${name}`;
}

export function toChineseNotation(pos: Position, move: Move): string {
  const piece = pieceAt(pos.board, move.from);
  if (piece === null) throw new Error(`记谱：起点 ${move.from} 没有棋子`);

  const head = pieceHead(pos, move.from, piece);
  const fromY = yOf(move.from);
  const toY = yOf(move.to);
  const toX = xOf(move.to);

  if (toY === fromY) return `${head}平${fileLabel(piece.color, toX)}`;

  const forward = piece.color === 'red' ? -1 : 1;
  const verb = (toY - fromY) * forward > 0 ? '进' : '退';
  const amount = AMOUNT_IS_TARGET_FILE[piece.type]
    ? fileLabel(piece.color, toX)
    : numeralOf(piece.color, Math.abs(toY - fromY));
  return `${head}${verb}${amount}`;
}

// 用户手上的记谱不止一种写法：繁体棋子字、异体动词都在这里换成记谱用字。
// 只做字符级替换——这一步不判合法性，走不走得通由合法着法清单回答。
const NOTATION_EQUIVALENTS: Readonly<Record<string, string>> = {
  俥: '车',
  車: '车',
  傌: '马',
  馬: '马',
  砲: '炮',
  帥: '帅',
  將: '将',
  進: '进',
};

// 记谱的数字形态：红方汉字、黑方阿拉伯。输入统一到行棋方的形态，
// 于是红方敲「炮2平5」、黑方敲「炮八平五」都能命中。
const CHINESE_DIGITS = '〇一二三四五六七八九';
const FULLWIDTH_DIGITS = '０１２３４５６７８９';

/** 全角或半角阿拉伯数字 → 0..9；不是数字返回 null。 */
function asciiDigitOf(char: string): number | null {
  const code = char.charCodeAt(0);
  if (code >= 0x30 && code <= 0x39) return code - 0x30;
  const fullwidth = FULLWIDTH_DIGITS.indexOf(char);
  return fullwidth >= 0 ? fullwidth : null;
}

/** 把用户输入按当前行棋方的书写形态归一；只做字符级替换，不判合法性。 */
export function normalizeNotation(color: Color, text: string): string {
  let result = '';
  for (const raw of text) {
    // 空白与句读只是分隔符，删掉不影响语义。
    if (raw === '、' || raw === '，' || raw === ',' || raw === '。' || raw.trim() === '') continue;
    const char = NOTATION_EQUIVALENTS[raw] ?? raw;
    const digit = asciiDigitOf(char);
    if (digit !== null) {
      result += color === 'red' ? CHINESE_DIGITS.charAt(digit) : String(digit);
      continue;
    }
    const chinese = CHINESE_DIGITS.indexOf(char);
    if (chinese >= 0) {
      result += color === 'black' ? String(chinese) : char;
      continue;
    }
    result += char;
  }
  return result;
}

/** 比对全部合法着法的记谱，命中返回该着法；零命中或不止一条返回 null。 */
export function parseChineseNotation(position: Position, text: string): Move | null {
  const wanted = normalizeNotation(position.turn, text);
  if (wanted === '') return null;
  let hit: Move | null = null;
  for (const move of generateLegalMoves(position)) {
    const written = normalizeNotation(position.turn, toChineseNotation(position, move));
    if (written !== wanted) continue;
    // 生成侧已用前/中/后与序号消歧；真撞上说明不变量破了，宁可不走也不替用户挑一条。
    if (hit !== null) return null;
    hit = move;
  }
  return hit;
}
