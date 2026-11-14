// 单文件版（直接用 file:// 打开）里替掉真 Worker 的「同协议、主线程」实现。
//
// 为什么需要：file:// 页面的 origin 是 null，浏览器拒绝构造 Worker（Chrome 直接抛
// 「Script at ... cannot be accessed from origin 'null'」），人机对战会整块失效。
// 这里把 worker.ts 的收/回两条线原样搬到主线程：协议形状不变，engine 只换工厂函数。
//
// 代价：高手档思考期间界面会卡住（它本来就是四秒预算）。单文件版接受这个代价——
// 换一个「AI 完全不能用」更糟。

import { chooseMove, parseFen } from '../../shared/index.ts';
import type { AiWorkerLike } from './engine.ts';
import type { AiRequest, AiResponse } from './protocol.ts';

/** 与 engine.ts 的 AiMessageEvent 同形；这里只用到 data。 */
type MessageEvent = { readonly data: AiResponse };

export function createInlineWorker(): AiWorkerLike {
  const listeners: ((event: MessageEvent) => void)[] = [];
  let disposed = false;

  return {
    postMessage(request: AiRequest): void {
      if (disposed) return;
      // 用微任务错开：engine 在 postMessage 返回之后才把 active 挂上，
      // 当场同步回调会被当成「过期 id」丢掉，AI 永远不出招。
      queueMicrotask(() => {
        if (disposed) return;
        // 与 worker.ts 一样不兜异常：算不出来就让它抛，页面侧转成 rejected 提示。
        const reply = chooseMove(parseFen(request.fen), {
          level: request.level,
          history: request.history,
          startFen: request.startFen,
        });
        for (const listener of listeners) listener({ data: { id: request.id, reply } });
      });
    },
    addEventListener(type: 'message' | 'error', listener: (event: never) => void): void {
      if (type === 'message') listeners.push(listener as (event: MessageEvent) => void);
      // 主线程里没有「线程崩了」这个通道：异常直接抛给调用栈，不伪造 error 事件。
    },
    terminate(): void {
      disposed = true;
      listeners.length = 0;
    },
  };
}
