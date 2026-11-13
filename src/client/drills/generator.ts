// 四类判定题的生成器。题目与答案都由引擎现算，种子固定时输出完全确定。

import type { Move, Position } from '../../shared/index.ts';
import {
  INITIAL_FEN,
  applyMove,
  generateLegalMoves,
  generateMoves,
  isInCheck,
  parseFen,
  pieceAt,
  pieceName,
  statusOf,
  toChineseNotation,
  toFen,
} from '../../shared/index.ts';

export type DrillKind = 'move-pattern' | 'legality' | 'position' | 'notation';

export interface DrillConfig {
  readonly kinds: readonly DrillKind[];
  readonly plies: { readonly min: number; readonly max: number };
  readonly attempts: { readonly hint: number; readonly reveal: number };
}

export interface DrillOption {
  readonly id: string;
  readonly label: string;
}

export interface DrillTargetAnswer {
  readonly kind: 'targets';
  readonly targets: readonly number[];
}

export interface DrillChoiceAnswer {
  readonly kind: 'choice';
  readonly optionId: string;
}

export type DrillAnswer = DrillTargetAnswer | DrillChoiceAnswer;

export interface Drill {
  readonly kind: DrillKind;
  readonly variant: string;
  readonly seed: number;
  readonly fen: string;
  readonly question: string;
  readonly options: readonly DrillOption[];
  readonly answer: DrillAnswer;
  readonly hint: string;
  readonly explanation: string;
  readonly highlight: Move | null;
  readonly markedSquare: number | null;
}

/** mulberry32：小、快、可复现。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('generateDrill: 空列表无法取元素');
  return item;
}

function shuffle<T>(rand: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    const current = copy[index];
    const other = copy[swap];
    if (current === undefined || other === undefined) continue;
    copy[index] = other;
    copy[swap] = current;
  }
  return copy;
}

function sideName(color: 'red' | 'black'): string {
  return color === 'red' ? '红方' : '黑方';
}

function randomPosition(rand: () => number, min: number, max: number): Position {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let position = parseFen(INITIAL_FEN);
    const plies = min + Math.floor(rand() * (max - min + 1));
    for (let ply = 0; ply < plies; ply += 1) {
      const moves = generateLegalMoves(position);
      if (moves.length === 0) break;
      position = applyMove(position, pick(rand, moves));
    }
    const status = statusOf(position);
    if (status !== 'checkmate' && status !== 'stalemate') return position;
  }
  throw new Error('generateDrill: 无法生成非终局局面');
}

function movePattern(rand: () => number, seed: number, position: Position, fen: string): Drill {
  const groups = new Map<number, Move[]>();
  for (const move of generateLegalMoves(position)) {
    const group = groups.get(move.from);
    if (group === undefined) groups.set(move.from, [move]);
    else group.push(move);
  }
  const all = [...groups.values()];
  if (all.length === 0) throw new Error('generateDrill: 走法题没有可走的子');
  const rich = all.filter((group) => group.length >= 2);
  const group = pick(rand, rich.length > 0 ? rich : all);
  const first = group[0];
  if (first === undefined) throw new Error('generateDrill: 走法题空分组');
  const piece = pieceAt(position.board, first.from);
  if (piece === null) throw new Error('generateDrill: 走法题起点无子');
  const targets = group.map((move) => move.to).sort((a, b) => a - b);
  return {
    kind: 'move-pattern',
    variant: 'targets',
    seed,
    fen,
    question: `${sideName(position.turn)}走棋：把「${pieceName(piece.color, piece.type)}」能走到的格子都点出来。`,
    options: [],
    answer: { kind: 'targets', targets },
    hint: '先按这枚棋子的走法数一数，再看有没有子挡路。',
    explanation: `这枚子有 ${targets.length} 个合法落点。`,
    highlight: null,
    markedSquare: first.from,
  };
}

function legality(rand: () => number, seed: number, position: Position, fen: string): Drill {
  const legal = generateLegalMoves(position);
  if (legal.length === 0) throw new Error('generateDrill: 合法性题没有合法着法');
  const legalKeys = new Set(legal.map((move) => `${move.from}-${move.to}`));
  const useLegal = rand() < 0.5;
  let move: Move;
  if (useLegal) {
    move = pick(rand, legal);
  } else {
    const candidates: Move[] = [];
    for (let from = 0; from < 90; from += 1) {
      const piece = pieceAt(position.board, from);
      if (piece === null || piece.color !== position.turn) continue;
      for (let to = 0; to < 90; to += 1) {
        if (to === from) continue;
        if (!legalKeys.has(`${from}-${to}`)) candidates.push({ from, to });
      }
    }
    if (candidates.length === 0) throw new Error('generateDrill: 合法性题没有非法着法');
    move = pick(rand, candidates);
  }
  const answerLegal = legalKeys.has(`${move.from}-${move.to}`);
  return {
    kind: 'legality',
    variant: 'legal',
    seed,
    fen,
    question: `这步棋「${toChineseNotation(position, move)}」合法吗？`,
    options: [
      { id: 'legal', label: '合法' },
      { id: 'illegal', label: '不合法' },
    ],
    answer: { kind: 'choice', optionId: answerLegal ? 'legal' : 'illegal' },
    hint: '走完这一步后，先看自己的将帅会不会被将。',
    explanation: answerLegal ? '这一步走完自己的将帅安全，合法。' : '这一步会送将或不符合走法，非法。',
    highlight: move,
    markedSquare: null,
  };
}

function positionDrill(rand: () => number, seed: number, position: Position, fen: string): Drill {
  const color = rand() < 0.5 ? 'red' : 'black';
  const checked = isInCheck(position, color);
  return {
    kind: 'position',
    variant: color === 'red' ? 'red-check' : 'black-check',
    seed,
    fen,
    question: `${sideName(color)}被将军了吗？`,
    options: [
      { id: 'yes', label: '被将军' },
      { id: 'no', label: '没被将军' },
    ],
    answer: { kind: 'choice', optionId: checked ? 'yes' : 'no' },
    hint: '找到这一方的将帅，看有没有对方的子能走到它所在的格子。',
    explanation: checked ? `${sideName(color)}的将帅正被攻击。` : `${sideName(color)}的将帅没有被攻击。`,
    highlight: null,
    markedSquare: null,
  };
}

function notation(rand: () => number, seed: number, position: Position, fen: string): Drill {
  const legal = generateLegalMoves(position);
  if (legal.length === 0) throw new Error('generateDrill: 记谱题没有合法着法');
  // 逐着尝试，挑第一个能凑够 3 个不同干扰记谱的合法着法。
  for (const move of shuffle(rand, legal)) {
    const correct = toChineseNotation(position, move);
    const seen = new Set<string>([correct]);
    const pool: string[] = [];
    for (const candidate of generateMoves(position)) {
      if (candidate.from === move.from && candidate.to === move.to) continue;
      let label: string;
      try {
        label = toChineseNotation(position, candidate);
      } catch {
        continue;
      }
      if (!seen.has(label)) {
        seen.add(label);
        pool.push(label);
      }
    }
    if (pool.length < 3) continue;
    const labels = shuffle(rand, [correct, ...shuffle(rand, pool).slice(0, 3)]);
    const options = labels.map((label, index) => ({ id: `opt-${index}`, label }));
    const answer = options.find((option) => option.label === correct);
    if (answer === undefined) throw new Error('generateDrill: 记谱题答案丢失');
    return {
      kind: 'notation',
      variant: 'notation',
      seed,
      fen,
      question: '这步棋怎么记？',
      options,
      answer: { kind: 'choice', optionId: answer.id },
      hint: '先看棋子、起点纵线，再看是平、进还是退。',
      explanation: `正确记谱是「${correct}」。`,
      highlight: move,
      markedSquare: null,
    };
  }
  throw new Error('generateDrill: 记谱题干扰项不足');
}

export function generateDrill(kind: DrillKind, seed: number, config: DrillConfig): Drill {
  const rand = mulberry32(seed);
  const position = randomPosition(rand, config.plies.min, config.plies.max);
  const fen = toFen(position);
  switch (kind) {
    case 'move-pattern':
      return movePattern(rand, seed, position, fen);
    case 'legality':
      return legality(rand, seed, position, fen);
    case 'position':
      return positionDrill(rand, seed, position, fen);
    case 'notation':
      return notation(rand, seed, position, fen);
  }
}
