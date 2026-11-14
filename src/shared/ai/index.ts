// AI 的对外出口：把难度表翻成搜索参数，裁出回复。
// 前置条件：局面有合法着法（人机页用 result === null 把关），破契约时由 search 抛错。

import type { HistoryEntry, Move, Position } from '../types.ts';
import type { AiLevel, AiLevelConfig } from './levels.ts';
import { AI_LEVELS } from './levels.ts';
import { search } from './search.ts';

export { AI_LEVELS } from './levels.ts';
export type { AiLevel } from './levels.ts';

export interface AiOptions {
  readonly level: AiLevel;
  /** 时间基准：不传就取墙钟（默认值在下方函数里）。单测注入伪造时钟。 */
  readonly now?: () => number;
  /** 对局至今的着法史：缺了它搜索看不见已发生的重复，会自己走进长将判负。 */
  readonly history: readonly HistoryEntry[];
  /** 对局起始局面 FEN：规则档规定必须计入重复计数。 */
  readonly startFen: string;
}

export interface AiReply {
  readonly move: Move;
  /** 实际搜到的完整层数。 */
  readonly depth: number;
  /** 访问的节点数，做性能读数与用例断言。 */
  readonly nodes: number;
  readonly elapsedMs: number;
}

export function chooseMove(position: Position, options: AiOptions): AiReply {
  const level: AiLevelConfig | undefined = AI_LEVELS[options.level];
  // Worker 收到的 level 走结构化克隆，类型只在编译期成立：认不出的档位当场报错，
  // 不拿 undefined.maxDepth 炸出一句无从追查的 TypeError。
  if (level === undefined) throw new Error(`chooseMove: unknown level "${String(options.level)}"`);
  return search(position, {
    maxDepth: level.maxDepth,
    budgetMs: level.budgetMs,
    now: options.now ?? Date.now,
    history: options.history,
    startFen: options.startFen,
  });
}
