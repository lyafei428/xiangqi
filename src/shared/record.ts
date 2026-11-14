// 棋谱记录：把整局固化成可长期保存的数据。纯函数，浏览器与 Node 共用。
// 只存起始局面 + 着法：逐步 FEN 是第二份真相，与着法早晚会不一致。

import type { GameResult, Move, Position, ResultType } from './types.ts';
import { parseFen } from './fen.ts';
import { toChineseNotation } from './notation.ts';
import { playMove } from './rules.ts';

export interface GameRecord {
  /** 存盘毫秒时间戳；撞号时 +1 直到唯一。未完成的 current 记录没有 id。 */
  readonly id: number | null;
  readonly startFen: string;
  readonly moves: readonly Move[];
  readonly result: GameResult | null;
  /** 存盘时刻双方剩余毫秒。 */
  readonly redMs: number;
  readonly blackMs: number;
  readonly savedAt: number;
}

const RESULT_TYPES: readonly ResultType[] = [
  'checkmate',
  'stalemate',
  'perpetual',
  'repetition',
  'natural',
  'timeout',
  'resign',
  'agreement',
];

/** 与 F1.4 的每方 10 分钟包干一致：超过它的剩余只可能是被改过的文件。 */
const MAX_CLOCK_MS = 900_000;
const MAX_MOVES = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSquare(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 89;
}

function asMove(value: unknown): Move | null {
  if (!isObject(value)) return null;
  const { from, to } = value;
  if (!isSquare(from) || !isSquare(to) || from === to) return null;
  return { from, to };
}

function asResult(value: unknown): GameResult | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  const { type, winner } = value;
  if (typeof type !== 'string' || !RESULT_TYPES.includes(type as ResultType)) return undefined;
  if (winner !== null && winner !== 'red' && winner !== 'black') return undefined;
  return { type: type as ResultType, winner };
}

function isClockMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_CLOCK_MS;
}

/**
 * 从起始局面重放前 step 着；step 夹到 [0, moves.length]。
 * 非法着法抛错：被改坏的记录不能静默回放成别的局面。
 * 棋谱库与本地存局共用这一份，两路的夹取与抛错口径才不会分家。
 */
export function positionAtMoves(
  startFen: string,
  moves: readonly Move[],
  step: number,
): Position {
  const total = moves.length;
  const target = Math.max(0, Math.min(total, Math.trunc(step)));
  let position = parseFen(startFen);
  let history = [] as ReturnType<typeof playMove>['history'];
  for (let index = 0; index < target; index += 1) {
    const move = moves[index];
    if (move === undefined) break;
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }
  return position;
}

/** 重放前 step 着；契约同 positionAtMoves。 */
export function positionAt(record: GameRecord, step: number): Position {
  return positionAtMoves(record.startFen, record.moves, step);
}

/** 全量重放一次：结构合法不等于能走完，导入与回放都要过这一关。 */
export function isReplayable(record: GameRecord): boolean {
  try {
    positionAt(record, record.moves.length);
    return true;
  } catch {
    return false;
  }
}

export function parseRecord(text: string): GameRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;

  const startFen = raw['startFen'];
  if (typeof startFen !== 'string') return null;
  try {
    parseFen(startFen);
  } catch {
    return null;
  }

  const movesRaw = raw['moves'];
  if (!Array.isArray(movesRaw) || movesRaw.length > MAX_MOVES) return null;
  const moves: Move[] = [];
  for (const item of movesRaw) {
    const move = asMove(item);
    if (move === null) return null;
    moves.push(move);
  }

  const result = asResult(raw['result']);
  if (result === undefined) return null;

  const { redMs, blackMs, savedAt } = raw;
  if (!isClockMs(redMs) || !isClockMs(blackMs)) return null;
  if (typeof savedAt !== 'number' || !Number.isInteger(savedAt) || savedAt <= 0) return null;

  const idRaw = raw['id'];
  const id = idRaw === undefined || idRaw === null ? null : idRaw;
  if (id !== null && (typeof id !== 'number' || !Number.isInteger(id) || id <= 0)) return null;

  return { id, startFen, moves, result, redMs, blackMs, savedAt };
}

/** 逐着中文记谱：与回放同源，不另存一份。 */
/** 一处可重放的着法序列：本地存局与内容棋谱都满足这个形状。 */
export interface RecordedGame {
  readonly startFen: string;
  readonly moves: readonly Move[];
}

export function notationsOf(record: RecordedGame): string[] {
  let position = parseFen(record.startFen);
  let history = [] as ReturnType<typeof playMove>['history'];
  const notations: string[] = [];
  for (const move of record.moves) {
    notations.push(toChineseNotation(position, move));
    const played = playMove(position, history, move);
    position = played.position;
    history = played.history;
  }
  return notations;
}

export function recordText(record: GameRecord): string {
  return JSON.stringify(record, null, 2);
}
