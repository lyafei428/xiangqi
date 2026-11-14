// 每步胜率的界面侧：开关（共享 store）与逐着期望分的增量缓存。
// 开关沿用 useMoveTrail 的定式：面板、联机页、回放页要读到同一个值，
// 设置浮层改一下，三个页面同时跟着变。

import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { GameResult, HistoryEntry, Position } from '../../shared/index.ts';
import { parseFen, redExpectation } from '../../shared/index.ts';
import { readEval, writeEval } from '../storage/prefs.ts';

let enabled = readEval();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setEvalEnabled(next: boolean): void {
  enabled = next;
  writeEval(next);
  emit();
}

export function evalEnabled(): boolean {
  return enabled;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEvalEnabled(): boolean {
  return useSyncExternalStore(subscribe, evalEnabled, evalEnabled);
}

interface EvalCache {
  readonly fens: string[];
  readonly values: number[];
}

/**
 * 追加式缓存：一格 = 一次 parseFen + 一次 evaluate。
 * 整段重算会让每走一着做 N 次 parseFen，与「走子到画面 < 16ms」相冲。
 * 共有的已算前缀才复用；新局、联机再来一局会让着法数从 0 长回原值，前缀一对不上就重算那一格。
 */
function appendEvals(cache: EvalCache, history: readonly HistoryEntry[]): readonly number[] {
  let shared = 0;
  while (
    shared < cache.fens.length &&
    shared < history.length &&
    cache.fens[shared] === history[shared]?.fen
  ) {
    shared += 1;
  }
  if (cache.fens.length > shared) {
    cache.fens.length = shared;
    cache.values.length = shared;
  }
  for (let index = shared; index < history.length; index += 1) {
    const fen = history[index]?.fen;
    if (fen === undefined) break;
    cache.fens.push(fen);
    cache.values.push(redExpectation(parseFen(fen)));
  }
  return cache.values;
}

/**
 * 每一着之后的红方期望分，与 `history` 逐格对齐。
 *
 * `result` 只作用在末格：只有终局那一着的结果是已知的，其余格必须按局面算——
 * 否则终局后整列记谱都会贴到 100% / 0%。认输与超时不产生新着法，
 * 末格从「按局面算」改成「按结果」就发生在这一次重算里。
 */
export function useMoveEvals(
  history: readonly HistoryEntry[],
  result: GameResult | null,
): readonly number[] {
  const cache = useRef<EvalCache>({ fens: [], values: [] });
  return useMemo(() => {
    const values = appendEvals(cache.current, history);
    if (result === null || values.length === 0) return values;
    const last = history[history.length - 1];
    if (last === undefined) return values;
    return [...values.slice(0, -1), redExpectation(parseFen(last.fen), result)];
  }, [history, result]);
}

/**
 * 条上的数字：当前局面的红方期望分。
 * 与末格同一份计算（同一局面 + 同一结果），两处读到的数一定一致。
 * 没有局面时是 null（联机大厅），调用方据此不渲染条。
 */
export function useEvalPoint(position: Position | null, result: GameResult | null): number | null {
  return useMemo(
    () => (position === null ? null : redExpectation(position, result)),
    [position, result],
  );
}
