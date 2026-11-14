// Worker 的请求 / 应答协议。纯类型：运行时一行代码都不产生，Worker 与页面两侧共用同一份形状。

import type { AiLevel, AiReply, HistoryEntry } from '../../shared/index.ts';

export type AiRequest = {
  readonly id: number;
  readonly fen: string;
  readonly level: AiLevel;
  /**
   * 对局至今的着法史：引擎靠它认长将与重复。
   * 缺了它，搜索看不见已经发生过的局面，会为自己「每着将军、看起来赚」的着法
   * 把循环走下去，走到第三次由规则判自己长将负。
   */
  readonly history: readonly HistoryEntry[];
  /** 对局起始局面 FEN：重复计数要把开局那一次算进去。 */
  readonly startFen: string;
};

export type AiResponse = {
  readonly id: number;
  readonly reply: AiReply;
};
