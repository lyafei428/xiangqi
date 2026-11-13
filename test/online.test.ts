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

    // 第三人进满房：拒绝。
    const third = new Client(server.port);
    clients.push(third);
    await third.open();
    third.send({ type: 'join', room });
    const full = await third.next((message) => message.type === 'error');
    if (full.type !== 'error') throw new Error('没有报错');
    assert.equal(full.code, 'room-full');
  } finally {
    for (const client of clients) client.close();
    await server.close();
  }
});
