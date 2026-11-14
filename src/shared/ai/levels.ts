// 三档难度的搜索深度与单步预算。
// 预算比需求上限留 500ms 余量给 Worker 传输与机型差异——手机上超预算的那一档
// 会被浏览器调度，落子看着像卡住。

export type AiLevel = 'easy' | 'normal' | 'hard';

export interface AiLevelConfig {
  /** 迭代加深的上限层数。 */
  readonly maxDepth: number;
  /** 单步思考预算（毫秒）。搜索在每个节点展开前读注入的时钟，读超了就停。 */
  readonly budgetMs: number;
}

export const AI_LEVELS: Readonly<Record<AiLevel, AiLevelConfig>> = {
  // 每档比上一版多 1 秒（用户要的「机器反应速度加 1 秒」）：
  // 多出的时间几乎都花在迭代加深的更深一层上，等于每档都更强了些。
  easy: { maxDepth: 2, budgetMs: 1200 },
  normal: { maxDepth: 4, budgetMs: 2200 },
  hard: { maxDepth: 8, budgetMs: 4000 },
};
