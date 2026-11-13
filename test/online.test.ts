import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../src/shared/protocol.ts';
import { createOnlineServer } from '../src/server/server.ts';
import { INITIAL_FEN, generateLegalMoves, parseFen, toFen, applyMove } from '../src/shared/index.ts';

class Client {
  readonly ws: WebSocket;
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: { match: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void }[] = [];

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (data) => {
      const message = JSON.parse(String(data)) as ServerMessage;
      const waiter = this.waiters.find((candidate) => candidate.match(message));
      if (waiter !== undefined) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
        return;
      }
      this.queue.push(message);
    });
  }

  open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  /** 丢掉还没消费的旧消息：断言「之后必须再来一条」前先清场，免得旧广播顶包。 */
  drain(): void {
    this.queue.length = 0;
  }

  next(match: (message: ServerMessage) => boolean, timeout = 3000): Promise<ServerMessage> {
    const queued = this.queue.findIndex((message) => match(message));
    if (queued >= 0) {
      const [message] = this.queue.splice(queued, 1);
      if (message !== undefined) return Promise.resolve(message);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter.resolve === wrapped);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error('等待消息超时'));
      }, timeout);
      const wrapped = (message: ServerMessage): void => {
        clearTimeout(timer);
        resolve(message);
      };
      this.waiters.push({ match, resolve: wrapped });
    });
  }

  close(): void {
    this.ws.close();
  }
}

test('两个客户端同房：同步、拒绝非法、断线重连', async () => {
  const server = await createOnlineServer({ port: 0, heartbeatMs: 60_000 });
  const clients: Client[] = [];
  try {
    const red = new Client(server.port);
    clients.push(red);
    await red.open();
    red.send({ type: 'join' });
    const joinedRed = await red.next((message) => message.type === 'joined');
    if (joinedRed.type !== 'joined') throw new Error('建房失败');
    assert.equal(joinedRed.color, 'red');
    const room = joinedRed.room;

    const black = new Client(server.port);
    clients.push(black);
    await black.open();
    black.send({ type: 'join', room });
    const joinedBlack = await black.next((message) => message.type === 'joined');
    if (joinedBlack.type !== 'joined') throw new Error('加入失败');
    assert.equal(joinedBlack.color, 'black');
    assert.equal(joinedBlack.snapshot.players, 2);

    // 第二人进房时，先到者也收到 players 更新的快照。
    const joinedState = await red.next(
      (message) => message.type === 'state' && message.snapshot.players === 2,
    );
    if (joinedState.type !== 'state') throw new Error('先到者没有收到进房快照');

    const move = generateLegalMoves(parseFen(INITIAL_FEN))[0];
    if (move === undefined) throw new Error('没有合法着法');
    red.send({ type: 'move', from: move.from, to: move.to, seq: joinedRed.snapshot.seq });

    const redState = await red.next(
      (message) => message.type === 'state' && message.snapshot.seq === 1,
    );
    const blackState = await black.next(
      (message) => message.type === 'state' && message.snapshot.seq === 1,
    );
    if (redState.type !== 'state' || blackState.type !== 'state') throw new Error('没有广播');
    assert.equal(redState.snapshot.seq, 1);
    assert.deepEqual(redState.snapshot, blackState.snapshot);
    assert.equal(redState.snapshot.turn, 'black');
    assert.equal(redState.snapshot.moves.length, 1);

    // 轮次不对：红方连走被拒，附带当前快照。
    red.send({ type: 'move', from: move.from, to: move.to, seq: 1 });
    const rejected = await red.next((message) => message.type === 'rejected');
    if (rejected.type !== 'rejected') throw new Error('没有拒绝');
    assert.equal(rejected.reason, 'not-your-turn');
    assert.equal(rejected.snapshot.seq, 1);

    // 黑方带旧序号：拒绝。
    const blackMove = generateLegalMoves(parseFen(toFen(applyMove(parseFen(INITIAL_FEN), move))))[0];
    if (blackMove === undefined) throw new Error('黑方没有合法着法');
    black.send({ type: 'move', from: blackMove.from, to: blackMove.to, seq: 0 });
    const stale = await black.next((message) => message.type === 'rejected');
    if (stale.type !== 'rejected') throw new Error('没有拒绝');
    assert.equal(stale.reason, 'stale-seq');

    // 断线：另一方看到离线；带 token 重连拿回红方与快照。
    red.close();
    const presenceOffline = await black.next(
      (message) => message.type === 'presence' && message.red === false,
    );
    assert.equal(presenceOffline.type, 'presence');

    const redAgain = new Client(server.port);
    clients.push(redAgain);
    await redAgain.open();
    redAgain.send({ type: 'join', room, token: joinedRed.token });
    const rejoined = await redAgain.next((message) => message.type === 'joined');
    if (rejoined.type !== 'joined') throw new Error('重连失败');
    assert.equal(rejoined.color, 'red');
    assert.equal(rejoined.snapshot.seq, 1);
    assert.equal(rejoined.snapshot.turn, 'black');
  } finally {
    for (const client of clients) client.close();
    await server.close();
  }
});

test('联机观战：第三端只读同一局面，观战数进出都广播', async () => {
  const server = await createOnlineServer({ port: 0, heartbeatMs: 60_000 });
  const clients: Client[] = [];
  try {
    const red = new Client(server.port);
    clients.push(red);
    await red.open();
    red.send({ type: 'join' });
    const joinedRed = await red.next((message) => message.type === 'joined');
    if (joinedRed.type !== 'joined') throw new Error('建房失败');
    const room = joinedRed.room;

    const black = new Client(server.port);
    clients.push(black);
    await black.open();
    black.send({ type: 'join', room });
    await black.next((message) => message.type === 'joined');
    await red.next((message) => message.type === 'state' && message.snapshot.players === 2);

    // 两席已满：第三端自动转观战，不占座位。
    const watcher = new Client(server.port);
    clients.push(watcher);
    await watcher.open();
    watcher.send({ type: 'join', room });
    const joinedWatcher = await watcher.next((message) => message.type === 'joined');
    if (joinedWatcher.type !== 'joined') throw new Error('观战进房失败');
    assert.equal(joinedWatcher.role, 'spectator');
    assert.equal(joinedWatcher.color, null);
    assert.equal(joinedWatcher.snapshot.players, 2);
    assert.equal(joinedWatcher.snapshot.spectators, 1);

    // 观战进场也广播 state：两席都看到观战数变了。
    const redSeesWatcher = await red.next(
      (message) => message.type === 'state' && message.snapshot.spectators === 1,
    );
    assert.equal(redSeesWatcher.type, 'state');

    // 观战端收到与棋手同一份局面。
    const move = generateLegalMoves(parseFen(INITIAL_FEN))[0];
    if (move === undefined) throw new Error('没有合法着法');
    red.send({ type: 'move', from: move.from, to: move.to, seq: joinedRed.snapshot.seq });
    const watched = await watcher.next(
      (message) => message.type === 'state' && message.snapshot.seq === 1,
    );
    const redState = await red.next(
      (message) => message.type === 'state' && message.snapshot.seq === 1,
    );
    if (watched.type !== 'state' || redState.type !== 'state') throw new Error('没有广播到观战端');
    assert.deepEqual(watched.snapshot, redState.snapshot);

    // 观战者没有座位：走子、认输一律 not-in-room，房间不动。
    watcher.send({ type: 'move', from: move.from, to: move.to, seq: 1 });
    const rejectedMove = await watcher.next((message) => message.type === 'rejected');
    if (rejectedMove.type !== 'rejected') throw new Error('没有拒绝观战者走子');
    assert.equal(rejectedMove.reason, 'not-in-room');
    assert.equal(rejectedMove.snapshot.seq, 1);

    watcher.send({ type: 'resign' });
    const rejectedResign = await watcher.next((message) => message.type === 'rejected');
    if (rejectedResign.type !== 'rejected') throw new Error('没有拒绝观战者认输');
    assert.equal(rejectedResign.reason, 'not-in-room');

    // 棋手断开不结束观战：观战连接仍留在房里，并继续收到 state。
    red.close();
    const presenceOffline = await watcher.next(
      (message) => message.type === 'presence' && message.red === false,
    );
    assert.equal(presenceOffline.type, 'presence');
    const afterRed = parseFen(toFen(applyMove(parseFen(INITIAL_FEN), move)));
    const blackMove = generateLegalMoves(afterRed)[0];
    if (blackMove === undefined) throw new Error('黑方没有合法着法');
    black.send({ type: 'move', from: blackMove.from, to: blackMove.to, seq: 1 });
    const watchedAfterLeave = await watcher.next(
      (message) => message.type === 'state' && message.snapshot.seq === 2,
    );
    assert.equal(watchedAfterLeave.type, 'state');

    // 观战离开：计数归零并广播。
    black.drain();
    watcher.close();
    const blackSeesGone = await black.next(
      (message) =>
        message.type === 'state' && message.snapshot.seq === 2 && message.snapshot.spectators === 0,
    );
    assert.equal(blackSeesGone.type, 'state');

    // 观战者主动 leave 与断线同一条路：减计数并广播。
    black.drain();
    const watcherAgain = new Client(server.port);
    clients.push(watcherAgain);
    await watcherAgain.open();
    watcherAgain.send({ type: 'join', room });
    const joinedAgain = await watcherAgain.next((message) => message.type === 'joined');
    if (joinedAgain.type !== 'joined') throw new Error('观战再进失败');
    assert.equal(joinedAgain.role, 'spectator');
    const blackSeesBack = await black.next(
      (message) =>
        message.type === 'state' && message.snapshot.seq === 2 && message.snapshot.spectators === 1,
    );
    assert.equal(blackSeesBack.type, 'state');
    watcherAgain.send({ type: 'leave' });
    const blackSeesLeave = await black.next(
      (message) => message.type === 'state' && message.snapshot.spectators === 0,
    );
    assert.equal(blackSeesLeave.type, 'state');
  } finally {
    for (const client of clients) client.close();
    await server.close();
  }
});

test('联机认输与求和：协议接线与权威快照', async () => {
  const server = await createOnlineServer({ port: 0, heartbeatMs: 60_000 });
  const clients: Client[] = [];
  try {
    const red = new Client(server.port);
    clients.push(red);
    await red.open();
    red.send({ type: 'join' });
    const joinedRed = await red.next((message) => message.type === 'joined');
    if (joinedRed.type !== 'joined') throw new Error('建房失败');

    const black = new Client(server.port);
    clients.push(black);
    await black.open();
    black.send({ type: 'join', room: joinedRed.room });
    await black.next((message) => message.type === 'joined');
    await red.next((message) => message.type === 'state' && message.snapshot.players === 2);

    // 求和：红方提议，黑方接受 → 双方看到同一判和快照。
    red.send({ type: 'offer-draw' });
    const offered = await black.next(
      (message) => message.type === 'state' && message.snapshot.drawOffer === 'red',
    );
    if (offered.type !== 'state') throw new Error('没有收到提议');

    // 已有待答提议时再提议：rejected。
    black.send({ type: 'offer-draw' });
    const pending = await black.next((message) => message.type === 'rejected');
    if (pending.type !== 'rejected') throw new Error('没有收到拒绝');
    assert.equal(pending.reason, 'draw-pending');

    black.send({ type: 'draw-response', accept: true });
    const drawn = await red.next(
      (message) => message.type === 'state' && message.snapshot.result !== null,
    );
    if (drawn.type !== 'state') throw new Error('没有收到结果');
    assert.deepEqual(drawn.snapshot.result, { type: 'agreement', winner: null });
    assert.equal(drawn.snapshot.clock.running, null);

    // 终局后认输：rejected game-over。
    red.send({ type: 'resign' });
    const over = await red.next((message) => message.type === 'rejected' && message.reason === 'game-over');
    assert.equal(over.type, 'rejected');
  } finally {
    for (const client of clients) client.close();
    await server.close();
  }
});

test('联机认输：行棋方认输判对方胜，非行棋方被拒', async () => {
  const server = await createOnlineServer({ port: 0, heartbeatMs: 60_000 });
  const clients: Client[] = [];
  try {
    const red = new Client(server.port);
    clients.push(red);
    await red.open();
    red.send({ type: 'join' });
    const joinedRed = await red.next((message) => message.type === 'joined');
    if (joinedRed.type !== 'joined') throw new Error('建房失败');

    const black = new Client(server.port);
    clients.push(black);
    await black.open();
    black.send({ type: 'join', room: joinedRed.room });
    await black.next((message) => message.type === 'joined');
    await red.next((message) => message.type === 'state' && message.snapshot.players === 2);

    // 黑方不是行棋方：拒。
    black.send({ type: 'resign' });
    const wrong = await black.next((message) => message.type === 'rejected');
    if (wrong.type !== 'rejected') throw new Error('没有收到拒绝');
    assert.equal(wrong.reason, 'not-your-turn');

    red.send({ type: 'resign' });
    const resigned = await black.next(
      (message) => message.type === 'state' && message.snapshot.result !== null,
    );
    if (resigned.type !== 'state') throw new Error('没有收到结果');
    assert.deepEqual(resigned.snapshot.result, { type: 'resign', winner: 'black' });
  } finally {
    for (const client of clients) client.close();
    await server.close();
  }
});

