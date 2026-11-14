// 棋谱库：随包发布的只读棋谱。纯类型与纯校验，零依赖。
// 与 GameRecord 的区别只在用途：这里没有时钟与存盘字段，多了类别、来源与关键步说明。

import type { GameResult, Move, Position, ResultType } from './types.ts';
import { parseFen } from './fen.ts';
import { playMove } from './rules.ts';

export type StudyPhase = 'opening' | 'middlegame' | 'ending' | 'endgame';

export interface StudyNote {
  /** 显示时机：走完 step 着后显示。允许 0（开局前）到 moves.length（终局后）。 */
  readonly step: number;
  readonly text: string;
}

export interface StudyRecord {
  readonly id: string;
  readonly title: string;
  readonly phase: StudyPhase;
  /** '自编' 或古谱名（《…》）。分类自证按来源与局面判别，见内容测试。 */
  readonly source: string;
  readonly startFen: string;
  readonly moves: readonly Move[];
  readonly result: GameResult | null;
  readonly notes: readonly StudyNote[];
}

const PHASES: readonly StudyPhase[] = ['opening', 'middlegame', 'ending', 'endgame'];

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

const MAX_MOVES = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
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

function asNote(value: unknown, total: number): StudyNote | null {
  if (!isObject(value)) return null;
  const step = value['step'];
  const text = value['text'];
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > total) return null;
  if (!isString(text)) return null;
  return { step, text };
}

/**
 * 校验一条棋谱库记录。结构、局面与逐着走法一起验：内容随包发布，
 * 走不通的条目在发布前就被内容自证拦下，运行时再兜一次仍然只丢这一条。
 */
export function parseStudyRecord(value: unknown): StudyRecord | null {
  if (!isObject(value)) return null;

  const id = value['id'];
  const title = value['title'];
  const phase = value['phase'];
  const source = value['source'];
  const startFen = value['startFen'];
  if (!isString(id) || !isString(title) || !isString(source) || !isString(startFen)) return null;
  if (typeof phase !== 'string' || !PHASES.includes(phase as StudyPhase)) return null;

  let start: Position;
  try {
    start = parseFen(startFen);
  } catch {
    return null;
  }

  const movesRaw = value['moves'];
  if (!Array.isArray(movesRaw) || movesRaw.length > MAX_MOVES) return null;
  const moves: Move[] = [];
  for (const item of movesRaw) {
    const move = asMove(item);
    if (move === null) return null;
    moves.push(move);
  }

  // 逐着重放：一条棋谱只要有一着走不通就整条作废，不能带着坏着法进库。
  let position = start;
  let history = [] as ReturnType<typeof playMove>['history'];
  for (const move of moves) {
    try {
      const played = playMove(position, history, move);
      position = played.position;
      history = played.history;
    } catch {
      return null;
    }
  }

  const result = asResult(value['result']);
  if (result === undefined) return null;

  const notesRaw = value['notes'];
  if (!Array.isArray(notesRaw)) return null;
  const notes: StudyNote[] = [];
  // 回放只看当前步的第一条说明：两条落在同一步，后一条永远不会露脸。宁可不收这条记录，
  // 也不让内容静默地少一半。
  const steps = new Set<number>();
  for (const item of notesRaw) {
    const note = asNote(item, moves.length);
    if (note === null) return null;
    if (steps.has(note.step)) return null;
    steps.add(note.step);
    notes.push(note);
  }

  return { id, title, phase: phase as StudyPhase, source, startFen, moves, result, notes };
}
