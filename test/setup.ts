// 每个用例从空的本地存储开始：棋谱库与未完成局会跨用例残留。

import { beforeEach } from 'vitest';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // 隐私模式下访问 localStorage 会抛；用例里用不到存储时忽略。
  }
});
