// WebSocket 服务：消息分发、广播、心跳。房间状态机在 room.ts。

import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, PlayerRole, ServerMessage } from '../shared/protocol.ts';
import { parseClientMessage } from '../shared/protocol.ts';
import type { RoomState } from './room.ts';
import { MAX_SPECTATORS, snapshotOf } from './room.ts';
import { Rooms, newToken } from './rooms.ts';

interface Conn {
  readonly ws: WebSocket;
  room?: string;
  token?: string;
  role?: PlayerRole;
  alive: boolean;
  missed: number;
}

export interface OnlineServerOptions {
  readonly port?: number;
  readonly host?: string;
  readonly heartbeatMs?: number;
}

export interface OnlineServer {
  readonly httpServer: Server;
  readonly wss: WebSocketServer;
  readonly rooms: Rooms;
  readonly port: number;
  close(): Promise<void>;
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

export async function createOnlineServer(options: OnlineServerOptions = {}): Promise<OnlineServer> {
  const host = options.host ?? '127.0.0.1';
  const httpServer = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('xiangqi online');
  });
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const rooms = new Rooms();
  const byRoom = new Map<string, Set<Conn>>();
  const all = new Set<Conn>();

  const roomConns = (code: string): Set<Conn> => {
    const existing = byRoom.get(code);
    if (existing !== undefined) return existing;
    const created = new Set<Conn>();
    byRoom.set(code, created);
    return created;
  };

  const broadcast = (code: string, message: ServerMessage): void => {
    for (const conn of roomConns(code)) send(conn.ws, message);
  };

  /** 空 Set 不留：房间按码回收后 byRoom 的条目也要跟着消失，否则跑得越久条目越多。 */
  const dropEmptyRoom = (code: string): void => {
    const set = byRoom.get(code);
    if (set !== undefined && set.size === 0) byRoom.delete(code);
  };

  const broadcastPresence = (room: RoomState): void => {
    broadcast(room.code, {
      type: 'presence',
      red: room.red?.connected ?? false,
      black: room.black?.connected ?? false,
    });
  };

  const leave = (conn: Conn): void => {
    const code = conn.room;
    if (code === undefined) return;
    const { token, role } = conn;
    roomConns(code).delete(conn);
    conn.room = undefined;
    conn.token = undefined;
    conn.role = undefined;
    if (role === 'spectator') {
      // 观战只减计数、腾出观战位，不碰两位棋手的在线位；观众走了房内也要看到新快照。
      const next = rooms.removeSpectator(code);
      if (next !== undefined) broadcast(code, { type: 'state', snapshot: snapshotOf(next) });
    } else if (token !== undefined) {
      const next = rooms.setConnected(code, token, false);
      if (next !== undefined) broadcastPresence(next);
    }
    dropEmptyRoom(code);
  };

  const join = (conn: Conn, message: Extract<ClientMessage, { type: 'join' }>): void => {
    if (conn.room !== undefined) leave(conn);
    if (message.room === undefined) {
      const created = rooms.create(undefined, undefined, Date.now(), message.matchable === true);
      conn.room = created.room.code;
      conn.token = created.token;
      conn.role = 'player';
      roomConns(created.room.code).add(conn);
      send(conn.ws, {
        type: 'joined',
        room: created.room.code,
        token: created.token,
        role: 'player',
        color: 'red',
        snapshot: snapshotOf(created.room),
      });
      return;
    }

    const existing = rooms.get(message.room);
    if (existing === undefined) {
      send(conn.ws, { type: 'error', code: 'room-not-found', message: '房间不存在' });
      return;
    }
    const token = message.token ?? newToken();
    const outcome = rooms.join(message.room, token);
    if (!outcome.ok) {
      send(conn.ws, {
        type: 'error',
        code: outcome.reason,
        message: `观战人数已满（最多 ${MAX_SPECTATORS} 人）`,
      });
      return;
    }
    conn.room = message.room;
    conn.token = token;
    conn.role = outcome.role;
    roomConns(message.room).add(conn);
    send(conn.ws, {
      type: 'joined',
      room: message.room,
      token,
      role: outcome.role,
      color: outcome.color,
      snapshot: snapshotOf(outcome.room),
    });
    // 第二人就座或观战进出都换了快照（players / spectators 变了），房内全连接都要刷新。
    broadcast(message.room, { type: 'state', snapshot: snapshotOf(outcome.room) });
    // presence 只报棋手在线位：观战进出不改变它。
    if (outcome.role === 'player') broadcastPresence(outcome.room);
  };

  const handle = (conn: Conn, message: ClientMessage): void => {
    switch (message.type) {
      case 'ping':
        send(conn.ws, { type: 'pong' });
        return;
      case 'join':
        join(conn, message);
        return;
      case 'quick-match': {
        // 先看有没有人在等：有就坐进那间房当黑方，没有就自己建一间可被匹配的房。
        // 两条路都走 join，建房 / 就座 / 广播只有一份实现。
        const waiting = rooms.findOpenMatchable();
        if (waiting === undefined) {
          join(conn, { type: 'join', matchable: true });
        } else {
          join(conn, { type: 'join', room: waiting.code, matchable: false });
        }
        return;
      }
      case 'leave':
        leave(conn);
        conn.ws.close();
        return;
      case 'move': {
        if (conn.room === undefined || conn.token === undefined) {
          send(conn.ws, { type: 'error', code: 'bad-message', message: '先加入房间' });
          return;
        }
        // 先结清已归零的钟，再看待发的着法：旗落了就不该再走上一步。
        for (const expired of rooms.timeouts()) {
          broadcast(expired.code, { type: 'state', snapshot: snapshotOf(expired) });
        }
        const outcome = rooms.move(conn.room, conn.token, { from: message.from, to: message.to }, message.seq);
        if (!outcome.ok) {
          const current = rooms.get(conn.room);
          if (current !== undefined) {
            send(conn.ws, {
              type: 'rejected',
              reason: outcome.reason,
              snapshot: snapshotOf(current),
            });
          }
          return;
        }
        broadcast(conn.room, { type: 'state', snapshot: snapshotOf(outcome.room) });
        broadcastPresence(outcome.room);
        return;
      }
      case 'rematch': {
        if (conn.room === undefined || conn.token === undefined) {
          send(conn.ws, { type: 'error', code: 'bad-message', message: '先加入房间' });
          return;
        }
        const outcome = rooms.rematch(conn.room, conn.token);
        if (!outcome.ok) {
          const current = rooms.get(conn.room);
          if (current !== undefined) {
            send(conn.ws, { type: 'rejected', reason: outcome.reason, snapshot: snapshotOf(current) });
          }
          return;
        }
        broadcast(conn.room, { type: 'state', snapshot: snapshotOf(outcome.room) });
        return;
      }
      case 'resign':
      case 'offer-draw':
      case 'draw-response': {
        if (conn.room === undefined || conn.token === undefined) {
          send(conn.ws, { type: 'error', code: 'bad-message', message: '先加入房间' });
          return;
        }
        // 与落子同一条前置：旗落了就不该再认输或谈和。
        for (const expired of rooms.timeouts()) {
          broadcast(expired.code, { type: 'state', snapshot: snapshotOf(expired) });
        }
        const outcome =
          message.type === 'resign'
            ? rooms.resign(conn.room, conn.token)
            : message.type === 'offer-draw'
              ? rooms.offerDraw(conn.room, conn.token)
              : rooms.respondDraw(conn.room, conn.token, message.accept);
        if (!outcome.ok) {
          const current = rooms.get(conn.room);
          if (current !== undefined) {
            send(conn.ws, {
              type: 'rejected',
              reason: outcome.reason,
              snapshot: snapshotOf(current),
            });
          }
          return;
        }
        broadcast(conn.room, { type: 'state', snapshot: snapshotOf(outcome.room) });
        return;
      }
    }
  };

  wss.on('connection', (ws) => {
    const conn: Conn = { ws, alive: true, missed: 0 };
    all.add(conn);
    ws.on('pong', () => {
      conn.alive = true;
    });
    ws.on('message', (data) => {
      const message = parseClientMessage(String(data));
      if (message === null) {
        send(ws, { type: 'error', code: 'bad-message', message: '无法解析的消息' });
        return;
      }
      try {
        handle(conn, message);
      } catch {
        // 服务端 bug：断开这条连接，让客户端走已有的重连路径；不新增协议错误码。
        conn.ws.close();
      }
    });
    ws.on('close', () => {
      leave(conn);
      all.delete(conn);
    });
    ws.on('error', () => {
      leave(conn);
      all.delete(conn);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(options.port ?? 8787, host, resolve));
  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  const heartbeat = setInterval(() => {
    for (const conn of all) {
      if (!conn.alive) {
        conn.missed += 1;
        if (conn.missed >= 2) {
          conn.ws.terminate();
          continue;
        }
      } else {
        conn.missed = 0;
      }
      conn.alive = false;
      conn.ws.ping();
    }
  }, options.heartbeatMs ?? 30_000);
  heartbeat.unref();

  const sweep = setInterval(() => rooms.sweep(), 60_000);
  sweep.unref();

  // 服务端是时钟的唯一裁决：每秒扫一次，归零就广播终局。
  const clocks = setInterval(() => {
    for (const room of rooms.timeouts()) {
      broadcast(room.code, { type: 'state', snapshot: snapshotOf(room) });
    }
  }, 1_000);
  clocks.unref();

  const close = async (): Promise<void> => {
    clearInterval(heartbeat);
    clearInterval(sweep);
    clearInterval(clocks);
    for (const conn of all) conn.ws.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { httpServer, wss, rooms, port, close };
}
