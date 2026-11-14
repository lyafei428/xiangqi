// Worker 封装层用例：请求发出、应答回填、过期 id 丢弃、cancel 后不再回填、崩溃转 rejected。
// 假 Worker 照 OnlineSocket 注入 WebSocketImpl 的先例：不起线程，用例只驱动消息时序。

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiEngine } from '../src/client/ai/engine.ts';
import type { AiErrorEvent, AiMessageEvent } from '../src/client/ai/engine.ts';
import type { AiRequest, AiResponse } from '../src/client/ai/protocol.ts';
import { INITIAL_FEN, isLegal, parseFen } from '../src/shared/index.ts';
import type { AiReply } from '../src/shared/index.ts';

/** 一着回子的样本；断言只比对这个对象本身，不碰搜索。 */
const REPLY: AiReply = { move: { from: 76, to: 67 }, depth: 2, nodes: 120, elapsedMs: 7 };

/** 让已排队的微任务跑完，用来断言「此刻 promise 还没落地」。 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** 假 Worker：记下发出的请求，由用例决定何时回子或崩掉。 */
class FakeWorker {
  readonly posted: AiRequest[] = [];
  terminated = false;
  private readonly messageListeners: Array<(event: AiMessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: AiErrorEvent) => void> = [];

  postMessage(message: AiRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  // 两类监听器分开存；重载签名与 AiWorkerLike 逐个对齐，收窄那两行只是把并集收回各自的窄类型。
  addEventListener(type: 'message', listener: (event: AiMessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: AiErrorEvent) => void): void;
  addEventListener(
    type: 'message' | 'error',
    listener: ((event: AiMessageEvent) => void) | ((event: AiErrorEvent) => void),
  ): void {
    if (type === 'message') this.messageListeners.push(listener as (event: AiMessageEvent) => void);
    else this.errorListeners.push(listener as (event: AiErrorEvent) => void);
  }

  answer(id: number, reply: AiReply): void {
    for (const listener of this.messageListeners) listener({ data: { id, reply } });
  }

  crash(message: string): void {
    for (const listener of this.errorListeners) listener({ message });
  }
}

/** 取出第 n 笔发出去的请求；缺了就是封装没发，直接让用例红在具体点上。 */
function sentAt(worker: FakeWorker, index: number): AiRequest {
  const request = worker.posted[index];
  assert.ok(request, `第 ${index + 1} 笔请求没发出去`);
  return request;
}

test('请求发出：postMessage 带上 id / fen / level', () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  void engine.request(INITIAL_FEN, 'hard', [], INITIAL_FEN);

  assert.equal(worker.posted.length, 1);
  const sent = sentAt(worker, 0);
  assert.equal(sent.fen, INITIAL_FEN);
  assert.equal(sent.level, 'hard');
  assert.equal(typeof sent.id, 'number');
});

test('应答回填：同 id 的应答落地成 request 的返回值', async () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  const promise = engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  const sent = sentAt(worker, 0);
  worker.answer(sent.id, REPLY);

  assert.deepEqual(await promise, REPLY);
});

test('过期 id 丢弃：号对不上的应答不落地，本笔仍按自己的号回子', async () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  const promise = engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN);
  const sent = sentAt(worker, 0);
  let outcome: AiReply | null = null;
  void promise.then((reply) => {
    outcome = reply;
  });

  worker.answer(sent.id + 99, REPLY);
  await flush();
  assert.equal(outcome, null, '过期 id 的应答不该回填');

  const expected: AiReply = { ...REPLY, depth: 1 };
  worker.answer(sent.id, expected);
  assert.deepEqual(await promise, expected);
});

test('cancel 后不再回填：迟到应答既不 resolve 也不 reject，之后仍可发下一着', async () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  const dropped = engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  const first = sentAt(worker, 0);
  let outcome: 'resolved' | 'rejected' | null = null;
  void dropped.then(
    () => {
      outcome = 'resolved';
    },
    () => {
      outcome = 'rejected';
    },
  );

  engine.cancel();
  worker.answer(first.id, REPLY);
  await flush();
  assert.equal(outcome, null, 'cancel 之后到达的应答必须被丢掉');

  const next = engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN);
  const second = sentAt(worker, 1);
  assert.notEqual(second.id, first.id, '每笔请求要拿新号，才分得清谁过期');
  assert.equal(second.level, 'easy');
  worker.answer(second.id, REPLY);
  assert.deepEqual(await next, REPLY);
});

test('Worker 报错转 rejected：不进协议，崩掉的线程当场结束', async () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  const promise = engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  worker.crash('模块加载失败');

  await assert.rejects(promise, /模块加载失败/);
  assert.equal(worker.terminated, true, '崩掉的线程要结束，别留一条半死的线程在页面上');
});

test('同一时刻只允许一笔在飞：第二笔当场抛错，不排队', () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  void engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  assert.throws(() => engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN), /already in flight/);
  assert.equal(worker.posted.length, 1, '被拦下的请求不许发出去');
});

test('崩溃后重开线程：下一着新建 Worker 并正常回子', async () => {
  const workers: FakeWorker[] = [];
  const engine = createAiEngine(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });

  const first = engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  const [crashed] = workers;
  assert.ok(crashed);
  crashed.crash('boom');
  await assert.rejects(first, /boom/);

  const second = engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN);
  assert.equal(workers.length, 2, '死掉的线程不会再回子，必须换一条');
  const fresh = workers[1];
  assert.ok(fresh);
  const sent = sentAt(fresh, 0);
  fresh.answer(sent.id, REPLY);
  assert.deepEqual(await second, REPLY);
});

test('dispose：结束后线程，在飞的一笔作废，之后请求一律 rejected', async () => {
  const worker = new FakeWorker();
  const engine = createAiEngine(() => worker);

  const inFlight = engine.request(INITIAL_FEN, 'normal', [], INITIAL_FEN);
  let outcome: 'resolved' | 'rejected' | null = null;
  void inFlight.then(
    () => {
      outcome = 'resolved';
    },
    () => {
      outcome = 'rejected';
    },
  );

  engine.dispose();
  assert.equal(worker.terminated, true);
  engine.dispose(); // 重复 dispose 无害

  worker.answer(sentAt(worker, 0).id, REPLY);
  await flush();
  assert.equal(outcome, null, '卸载时作废的在飞请求不该回填');

  await assert.rejects(engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN), /disposed/);
});

test('Worker 入口：收请求 → chooseMove → 回一条同 id 的合法着法', async () => {
  // worker.ts 在载入时读全局 self：这里先摆一个假的进 globalThis，再动态载入，跑完还原。
  const posted: AiResponse[] = [];
  const scope = {
    onmessage: null as ((event: { readonly data: AiRequest }) => void) | null,
    postMessage: (response: AiResponse): void => {
      posted.push(response);
    },
  };
  const hadSelf = Reflect.has(globalThis, 'self');
  const previousSelf: unknown = Reflect.get(globalThis, 'self');
  Reflect.set(globalThis, 'self', scope);

  try {
    await import('../src/client/ai/worker.ts');
    assert.ok(scope.onmessage, 'worker.ts 载入时必须挂上消息入口');
    scope.onmessage({ data: { id: 42, fen: INITIAL_FEN, level: 'easy', history: [], startFen: INITIAL_FEN } });
  } finally {
    if (hadSelf) Reflect.set(globalThis, 'self', previousSelf);
    else Reflect.deleteProperty(globalThis, 'self');
  }

  assert.equal(posted.length, 1, '一问一答：一次请求只回一条');
  const [response] = posted;
  assert.ok(response);
  assert.equal(response.id, 42, '应答的 id 要原样带回，页面才分得清是哪一笔');
  assert.ok(
    isLegal(parseFen(INITIAL_FEN), response.reply.move),
    `回子 ${response.reply.move.from}->${response.reply.move.to} 不合法`,
  );
});

test('cancel 会停掉旧计算：下一次请求落到新线程上', async () => {
  const made: FakeWorker[] = [];
  const engine = createAiEngine(() => {
    const worker = new FakeWorker();
    made.push(worker);
    return worker;
  });

  void engine.request(INITIAL_FEN, 'hard', [], INITIAL_FEN);
  const first = made[0];
  assert.ok(first, '第一笔请求要落在第一条线程上');

  engine.cancel();
  assert.equal(first.terminated, true, '换局要把旧线程结束掉，不能让它继续占着单线程');

  const next = engine.request(INITIAL_FEN, 'easy', [], INITIAL_FEN);
  const second = made[1];
  assert.ok(second, 'cancel 之后要重开一条线程，而不是排在旧计算后面');
  assert.equal(second.posted.length, 1);
  const request = second.posted[0];
  assert.equal(request?.level, 'easy');
  if (request !== undefined) second.answer(request.id, REPLY);
  assert.deepEqual(await next, REPLY);
});
