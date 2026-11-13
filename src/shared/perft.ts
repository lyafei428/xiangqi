// 合法着法定点统计，用来给整个引擎当回归基准。

import type { Position } from './types.ts';
import { applyMove } from './moves.ts';
import { generateLegalMoves } from './rules.ts';

export function perft(pos: Position, depth: number): number {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new RangeError(`perft: depth must be a non-negative integer, got ${depth}`);
  }
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of generateLegalMoves(pos)) {
    nodes += perft(applyMove(pos, move), depth - 1);
  }
  return nodes;
}
