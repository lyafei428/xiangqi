// 三档难度的搜索深度与单步预算。三档预算都低于需求写的 2 秒上限：
// 普通档 1200ms，剩下 800ms 留给机型差异与 Worker 传输。

export type AiLevel = 'easy' | 'normal' | 'hard';

export interface AiLevelConfig {
  /** 迭代加深的上限层数。 */
  readonly maxDepth: number;
  /** 单步思考预算（毫秒）。搜索在每个节点展开前读注入的时钟，读超了就停。 */
  readonly budgetMs: number;
}

export const AI_LEVELS: Readonly<Record<AiLevel, AiLevelConfig>> = {
  easy: { maxDepth: 2, budgetMs: 200 },
  normal: { maxDepth: 4, budgetMs: 1200 },
  hard: { maxDepth: 6, budgetMs: 3000 },
};
