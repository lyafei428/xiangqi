// Worker 的请求 / 应答协议。纯类型：运行时一行代码都不产生，Worker 与页面两侧共用同一份形状。

import type { AiLevel, AiReply } from '../../shared/index.ts';

export type AiRequest = {
  readonly id: number;
  readonly fen: string;
  readonly level: AiLevel;
};

export type AiResponse = {
  readonly id: number;
  readonly reply: AiReply;
};
