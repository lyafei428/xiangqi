// 房间注册表：房间码生成、查找、加入与落子的门面。

import { randomBytes, randomInt } from 'node:crypto';
import { INITIAL_FEN, CLOCK_MS } from '../shared/index.ts';
import type { Move } from '../shared/index.ts';
import type { JoinOutcome, MoveOutcome, RoomState } from './room.ts';
import {
  applyRoomMove,
  applyTimeout,
  createRoom,
  joinRoom,
  offerDrawRoom,
  rematchRoom,
  removeSpectator,
  resignRoom,
  respondDrawRoom,
  setConnected,
} from './room.ts';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newToken(): string {
  return randomBytes(16).toString('hex');
}

function newCode(): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

export class Rooms {
  private readonly rooms = new Map<string, RoomState>();

  create(
    startFen = INITIAL_FEN,
    clockMs = CLOCK_MS,
    now = Date.now(),
    matchable = false,
  ): { room: RoomState; token: string } {
    let code = newCode();
    while (this.rooms.has(code)) code = newCode();
    const token = newToken();
    const room = createRoom(code, token, startFen, clockMs, now, matchable);
    this.rooms.set(code, room);
    return { room, token };
  }

  /**
   * 找一间能被随机匹配挑中的房：房主勾了允许、还只有一个座位、且人是在线在等的。
   * 房主掉线的空座房不参与——匹配进去只会对着一个不在的人下棋。
   */
  findOpenMatchable(): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (!room.matchable) continue;
      if (room.red === null || room.black !== null) continue;
      if (!room.red.connected) continue;
      if (room.status !== 'playing') continue;
      return room;
    }
    return undefined;
  }

  get(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  join(code: string, token: string, now = Date.now()): JoinOutcome | { ok: false; reason: 'room-not-found' } {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'room-not-found' };
    const outcome = joinRoom(room, token, now);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  setConnected(code: string, token: string, connected: boolean, now = Date.now()): RoomState | undefined {
    const room = this.rooms.get(code);
    if (room === undefined) return undefined;
    const next = setConnected(room, token, connected, now);
    this.rooms.set(code, next);
    return next;
  }

  /** 观战者离开或断开：减计数；返回房间供调用方广播新快照。 */
  removeSpectator(code: string): RoomState | undefined {
    const room = this.rooms.get(code);
    if (room === undefined) return undefined;
    const next = removeSpectator(room);
    this.rooms.set(code, next);
    return next;
  }

  /** 两人都离线、且无在线观战超过 ttlMs 的房间回收；返回回收数量。 */
  sweep(now = Date.now(), ttlMs = 30 * 60_000): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      // 有观战在线时房间留住：棋手离开不结束观战。
      if (room.spectators > 0) continue;
      if (room.idleSince !== null && now - room.idleSince >= ttlMs) {
        this.rooms.delete(code);
        removed += 1;
      }
    }
    return removed;
  }

  move(code: string, token: string, move: Move, seq: number): MoveOutcome {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'not-in-room' };
    const outcome = applyRoomMove(room, token, move, seq);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  rematch(code: string, token: string, now = Date.now()): MoveOutcome {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'not-in-room' };
    const outcome = rematchRoom(room, token, now);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  resign(code: string, token: string): MoveOutcome {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'not-in-room' };
    const outcome = resignRoom(room, token);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  offerDraw(code: string, token: string): MoveOutcome {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'not-in-room' };
    const outcome = offerDrawRoom(room, token);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  respondDraw(code: string, token: string, accept: boolean): MoveOutcome {
    const room = this.rooms.get(code);
    if (room === undefined) return { ok: false, reason: 'not-in-room' };
    const outcome = respondDrawRoom(room, token, accept);
    if (outcome.ok) this.rooms.set(code, outcome.room);
    return outcome;
  }

  /** 扫一遍房间时钟；返回本轮判超时的房间，由调用方广播。 */
  timeouts(now = Date.now()): RoomState[] {
    const timedOut: RoomState[] = [];
    for (const [code, room] of this.rooms) {
      const next = applyTimeout(room, now);
      if (next !== null) {
        this.rooms.set(code, next);
        timedOut.push(next);
      }
    }
    return timedOut;
  }
}
