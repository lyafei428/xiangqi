// 人机对战的页面侧封装：一条 Worker、同一时刻一笔在飞请求、迟到应答按 id 丢掉。
// 页面只在挂载时 createAiEngine()，之后借 request(fen, level, history, startFen) 拿回子，交给 session.play 写回会话。
// 注入形状照 src/client/online/socket.ts 的 WebSocketImpl：用例传假 Worker，不必真起线程。

import type { AiLevel, AiReply, HistoryEntry } from '../../shared/index.ts';
import type { AiRequest, AiResponse } from './protocol.ts';
import { createInlineWorker } from './inline-worker.ts';

/** 应答事件只取 data。不用 DOM 的 MessageEvent，假 Worker 才不必扮成浏览器。 */
export interface AiMessageEvent {
  readonly data: AiResponse;
}

/** 崩溃事件只取可读文案；Worker 入口加载失败时不一定带 message。 */
export interface AiErrorEvent {
  readonly message?: string;
}

/** 封装真正用到的那几样 Worker 能力。真 Worker 与用例里的假 Worker 都满足它。 */
export interface AiWorkerLike {
  postMessage(message: AiRequest): void;
  addEventListener(type: 'message', listener: (event: AiMessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: AiErrorEvent) => void): void;
  terminate(): void;
}

export type AiWorkerFactory = () => AiWorkerLike;

export interface AiEngine {
  /**
   * 发一着请求。同一时刻只允许一笔在飞：第二笔当场抛错，由页面那条输入闸门（未终局 && 轮到 AI
   * && !thinking）负责拦住。排队不行——旧局面的回子落进新局面比报错更难查。
   */
  request(fen: string, level: AiLevel, history: readonly HistoryEntry[], startFen: string): Promise<AiReply>;
  /** 丢弃在飞结果：迟到的应答按 id 比对后直接丢，调用方既不会 resolve 也不会 reject。 */
  cancel(): void;
  /** 结束线程。之后 request 一律 rejected；重复调用无害。 */
  dispose(): void;
}

interface ActiveRequest {
  readonly id: number;
  readonly resolve: (reply: AiReply) => void;
  readonly reject: (error: unknown) => void;
}

const DISPOSED = 'createAiEngine: engine disposed';
const IN_FLIGHT = 'createAiEngine: a request is already in flight';
const CRASH_FALLBACK = 'AI worker crashed';

function createBrowserWorker(): AiWorkerLike {
  // 单文件版（file:// 打开）：浏览器不给 file:// 页面建 Worker，改在主线程跑同一套协议。
  // 这个分支只在 standalone 构建里被 define 成 '1'，正常构建里是死代码。
  if (import.meta.env.VITE_STANDALONE === '1') {
    return createInlineWorker();
  }
  // Vite 原生支持这种写法：worker.ts 单独打成一包，主包不含它。
  // 返回值按 AiWorkerLike 收：真 Worker 若哪天不长这个样子，这里先红。
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
}

export function createAiEngine(factory: AiWorkerFactory = createBrowserWorker): AiEngine {
  let nextId = 1;
  let active: ActiveRequest | null = null;
  let disposed = false;
  // null = 手上没有活着的线程（还没建起来，或刚崩掉）：下一次 request 重开一条。
  // 崩溃后不自愈的话，新局会永远停在「AI 思考中…」，界面上的错误提示与「新局」按钮都成了摆设。
  let worker: AiWorkerLike | null = null;

  function open(): AiWorkerLike {
    const next = factory();
    next.addEventListener('message', (event) => {
      const response = event.data;
      // 过期 id（cancel 之后迟到的、上一局留下的）直接丢：不 resolve 也不 reject。
      if (active === null || response.id !== active.id) return;
      const settled = active;
      active = null;
      settled.resolve(response.reply);
    });
    next.addEventListener('error', (event) => {
      // 只认当前这条线程：被换掉的旧线程就算迟到，也不许打掉新请求。
      if (worker !== next) {
        next.terminate();
        return;
      }
      const failed = active;
      active = null;
      worker = null;
      // 出错后的线程状态不可知（入口加载失败就此死掉，未捕获异常也可能留下半死的线程）：
      // 当场结束它，下一着由 request 重开。这是本封装唯一承认的故障通道，不进协议。
      next.terminate();
      failed?.reject(new Error(event.message ?? CRASH_FALLBACK));
    });
    return next;
  }

  try {
    worker = open();
  } catch {
    // 挂载期线程起不来不拖垮页面：故障留到第一次 request，用同一条 rejected 通道交出。
  }

  return {
    request(fen, level, history, startFen) {
      if (disposed) return Promise.reject(new Error(DISPOSED));
      if (active !== null) throw new Error(IN_FLIGHT);

      let live = worker;
      if (live === null) {
        try {
          live = open();
        } catch (error) {
          // 线程起不来（构造即抛、入口路径错）同样是「按不成」，走同一条 rejected 通道。
          return Promise.reject(error);
        }
        worker = live;
      }

      const id = nextId;
      nextId += 1;
      // 执行器同步跑完，所以 postMessage 之前 active 已经挂上：假 Worker 同步回子也不会漏接。
      const promise = new Promise<AiReply>((resolve, reject) => {
        active = { id, resolve, reject };
      });
      try {
        live.postMessage({ id, fen, level, history, startFen });
      } catch (error) {
        // 送不出去的请求当场抛：留着 active 会让引擎永远以为自己有一笔在飞。
        active = null;
        throw error;
      }
      return promise;
    },

    cancel() {
      // 换局（新局、换阵营）：不只要丢结果，还要停计算——Worker 是单线程，
      // 留着它跑完再收下一笔，新局的第一着会被旧计算阻塞（1800 + 1200 超过需求 2 秒）。
      // 不 reject：页面主动换局不是错误，reject 会让「AI 出错」误报。
      active = null;
      worker?.terminate();
      worker = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      active = null; // 在飞的一笔就此丢弃，不再回填
      worker?.terminate();
      worker = null;
    },
  };
}
