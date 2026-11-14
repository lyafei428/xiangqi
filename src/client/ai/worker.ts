// Worker 入口：收请求 → 调 chooseMove → 回结果。只搬数据，规则与难度表都在 src/shared/。
// 这里不兜异常：协议只有「成对的一问一答」一种形状，兜住异常等于把故障咽掉；
// 让它抛，页面侧收到线程 error 事件后转成 rejected promise，用户才有提示可看。

import { chooseMove, parseFen } from '../../shared/index.ts';
import type { AiRequest, AiResponse } from './protocol.ts';

/**
 * 只声明 Worker 全局里真正用到的两项。不引 webworker 类型库：它与 tsconfig 的 DOM 库同名全局冲突，
 * 而这里要的只是「收一条消息、回一条消息」。
 */
interface AiWorkerScope {
  onmessage: ((event: { readonly data: AiRequest }) => void) | null;
  postMessage(message: AiResponse): void;
}

const scope = self as unknown as AiWorkerScope;

scope.onmessage = (event) => {
  const request = event.data;
  const reply = chooseMove(parseFen(request.fen), {
    level: request.level,
    history: request.history,
    startFen: request.startFen,
  });
  scope.postMessage({ id: request.id, reply });
};
