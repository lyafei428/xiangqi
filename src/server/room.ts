// 房间状态机：建房、加入、重连、落子、快照。纯函数，不碰 socket。

import type {
  Color,
  GameResult,
  GameStatus,
  HistoryEntry,
  Move,
  Position,
} from '../shared/index.ts';
import {
  CLOCK_MS,
  INITIAL_FEN,
  createClock,
  judgeGame,
  parseFen,
  playMove,
  remainingOf,
  statusOf,
  stopClock,
  switchClock,
  timeoutColor,
  toChineseNotation,
  toFen,
} from '../shared/index.ts';
import type { ClockState } from '../shared/index.ts';
import type { RejectReason, Snapshot } from '../shared/protocol.ts';

/** 观战上限：需求 F1.7 的 8 人只算观战连接，不含两名棋手。 */
export const MAX_SPECTATORS = 8;

export interface RoomPlayer {
  readonly token: string;
  readonly color: Color;
  readonly connected: boolean;
}

export interface RoomState {
  readonly code: string;
  readonly startFen: string;
  readonly position: Position;
  readonly history: readonly HistoryEntry[];
  readonly result: GameResult | null;
  readonly status: GameStatus;
  readonly seq: number;
  readonly lastMove: Move | null;
  readonly moves: readonly string[];
  readonly red: RoomPlayer | null;
  readonly black: RoomPlayer | null;
  /** 在线观战连接数：观战占连接不占座位，所以只计数不写座位。 */
  readonly spectators: number;
  readonly idleSince: number | null;
  readonly clock: ClockState;
  /** 每方包干毫秒，开新局时用它重置时钟。 */
  readonly clockMs: number;
  readonly drawOffer: Color | null;
  readonly drawBlocked: Color | null;
}

export type JoinOutcome =
  | { readonly ok: true; readonly room: RoomState; readonly role: 'player'; readonly color: Color }
  | { readonly ok: true; readonly room: RoomState; readonly role: 'spectator'; readonly color: null }
  | { readonly ok: false; readonly reason: 'spectators-full' };

export type MoveOutcome =
  | { readonly ok: true; readonly room: RoomState }
  | { readonly ok: false; readonly reason: RejectReason };

export function createRoom(
  code: string,
  token: string,
  startFen = INITIAL_FEN,
  clockMs = CLOCK_MS,
  now = Date.now(),
): RoomState {
  const position = parseFen(startFen);
  return {
    code,
    startFen,
    position,
    history: [],
    result: null,
    status: statusOf(position),
    seq: 0,
    lastMove: null,
    moves: [],
    red: { token, color: 'red', connected: true },
    black: null,
    spectators: 0,
    idleSince: null,
    clock: createClock(now, clockMs),
    clockMs,
    drawOffer: null,
    drawBlocked: null,
  };
}

/** 带 token 且匹配 → 重连；否则坐到空位上（先红后黑）；两席已满则进观战。 */
export function joinRoom(room: RoomState, token: string, now = Date.now()): JoinOutcome {
  if (room.red?.token === token) {
    return {
      ok: true,
      room: { ...room, red: { ...room.red, connected: true }, idleSince: null },
      role: 'player',
      color: 'red',
    };
  }
  if (room.black?.token === token) {
    return {
      ok: true,
      room: { ...room, black: { ...room.black, connected: true }, idleSince: null },
      role: 'player',
      color: 'black',
    };
  }
  if (room.red === null) {
    return {
      ok: true,
      room: { ...room, red: { token, color: 'red', connected: true }, idleSince: null },
      role: 'player',
      color: 'red',
    };
  }
  if (room.black === null) {
    return {
      ok: true,
      // 第二人就座才开局：等对手期间不扣时，否则单人房间会在对手到来前先超时。
      room: {
        ...room,
        black: { token, color: 'black', connected: true },
        idleSince: null,
        clock: createClock(now, room.clockMs),
      },
      role: 'player',
      color: 'black',
    };
  }
  if (room.spectators >= MAX_SPECTATORS) return { ok: false, reason: 'spectators-full' };
  // 观战者的 token 不进座位：只计数，不写 red / black 的在线位。
  return {
    ok: true,
    room: { ...room, spectators: room.spectators + 1 },
    role: 'spectator',
    color: null,
  };
}

/** 观战者离开或断开：只减计数，腾出观战位。 */
export function removeSpectator(room: RoomState): RoomState {
  if (room.spectators === 0) return room;
  return { ...room, spectators: room.spectators - 1 };
}

export function setConnected(
  room: RoomState,
  token: string,
  connected: boolean,
  now = Date.now(),
): RoomState {
  let next: RoomState;
  if (room.red?.token === token) {
    next = { ...room, red: { ...room.red, connected } };
  } else if (room.black?.token === token) {
    next = { ...room, black: { ...room.black, connected } };
  } else {
    return room;
  }
  if (connected) return { ...next, idleSince: null };
  const bothOffline =
    (next.red === null || !next.red.connected) && (next.black === null || !next.black.connected);
  return { ...next, idleSince: bothOffline ? (room.idleSince ?? now) : null };
}

export function applyRoomMove(
  room: RoomState,
  token: string,
  move: Move,
  seq: number,
  now = Date.now(),
): MoveOutcome {
  const player = room.red?.token === token ? room.red : room.black?.token === token ? room.black : null;
  if (player === null) return { ok: false, reason: 'not-in-room' };
  if (room.result !== null) return { ok: false, reason: 'game-over' };
  // 两人未坐满不算开局：不能让开局面与开钟面错位。
  if (room.red === null || room.black === null) return { ok: false, reason: 'not-in-room' };
  if (room.position.turn !== player.color) return { ok: false, reason: 'not-your-turn' };
  if (seq !== room.seq) return { ok: false, reason: 'stale-seq' };

  let played: ReturnType<typeof playMove>;
  try {
    played = playMove(room.position, [...room.history], move);
  } catch {
    return { ok: false, reason: 'illegal-move' };
  }

  const notation = toChineseNotation(room.position, move);
  const history = [...played.history];
  const result = judgeGame(played.position, history, room.startFen);
  const playedClock = switchClock(room.clock, now);
  return {
    ok: true,
    room: {
      ...room,
      position: played.position,
      history,
      result,
      status: statusOf(played.position),
      seq: room.seq + 1,
      lastMove: move,
      moves: [...room.moves, notation],
      clock: result === null ? playedClock : stopClock(playedClock, now),
      drawOffer: null,
      // 被拒方自己走子不解封；对方走一着才解封。
      drawBlocked: room.drawBlocked === player.color ? room.drawBlocked : null,
    },
  };
}

function seated(room: RoomState, token: string): RoomPlayer | null {
  if (room.red?.token === token) return room.red;
  if (room.black?.token === token) return room.black;
  return null;
}

/** 认输：只接受当前行棋方。 */
export function resignRoom(room: RoomState, token: string, now = Date.now()): MoveOutcome {
  const player = seated(room, token);
  if (player === null) return { ok: false, reason: 'not-in-room' };
  if (room.result !== null) return { ok: false, reason: 'game-over' };
  if (room.position.turn !== player.color) return { ok: false, reason: 'not-your-turn' };
  return {
    ok: true,
    room: {
      ...room,
      result: { type: 'resign', winner: player.color === 'red' ? 'black' : 'red' },
      clock: stopClock(room.clock, now),
      drawOffer: null,
    },
  };
}

/** 提议和棋：任一棋手，仅受 drawBlocked 与待答提议限制。 */
export function offerDrawRoom(room: RoomState, token: string): MoveOutcome {
  const player = seated(room, token);
  if (player === null) return { ok: false, reason: 'not-in-room' };
  if (room.result !== null) return { ok: false, reason: 'game-over' };
  if (room.drawBlocked === player.color) return { ok: false, reason: 'draw-blocked' };
  if (room.drawOffer !== null) return { ok: false, reason: 'draw-pending' };
  return { ok: true, room: { ...room, drawOffer: player.color } };
}

/** 应答和棋：只接受提议的对方。 */
export function respondDrawRoom(
  room: RoomState,
  token: string,
  accept: boolean,
  now = Date.now(),
): MoveOutcome {
  const player = seated(room, token);
  if (player === null) return { ok: false, reason: 'not-in-room' };
  if (room.result !== null) return { ok: false, reason: 'game-over' };
  if (room.drawOffer === null || room.drawOffer === player.color) {
    return { ok: false, reason: 'no-draw-offer' };
  }
  if (!accept) {
    return { ok: true, room: { ...room, drawOffer: null, drawBlocked: room.drawOffer } };
  }
  return {
    ok: true,
    room: {
      ...room,
      result: { type: 'agreement', winner: null },
      clock: stopClock(room.clock, now),
      drawOffer: null,
      drawBlocked: null,
    },
  };
}

/** 超时：在走方归零则判负；否则返回 null。 */
export function applyTimeout(room: RoomState, now = Date.now()): RoomState | null {
  if (room.result !== null) return null;
  // 没坐满不算开局，等对手的分钟数不折进对局时间。
  if (room.red === null || room.black === null) return null;
  const loser = timeoutColor(room.clock, now);
  if (loser === null) return null;
  return {
    ...room,
    result: { type: 'timeout', winner: loser === 'red' ? 'black' : 'red' },
    clock: stopClock(room.clock, now),
    drawOffer: null,
  };
}

export function snapshotOf(room: RoomState, now = Date.now()): Snapshot {
  // 快照里的剩余必须是「快照时刻」的值：客户端以收到时刻为锚扣时，只有当前值才能算对。
  // 原始 RoomState.clock 的 redMs/blackMs 是 since 时刻的值，直接透传会在重连时偏高。
  const clock: ClockState = {
    redMs: remainingOf(room.clock, 'red', now),
    blackMs: remainingOf(room.clock, 'black', now),
    running: room.clock.running,
    since: now,
  };
  return {
    room: room.code,
    startFen: room.startFen,
    fen: toFen(room.position),
    seq: room.seq,
    turn: room.position.turn,
    status: room.status,
    result: room.result,
    lastMove: room.lastMove,
    moves: [...room.moves],
    moveLog: room.history.map((entry) => entry.move),
    red: room.red?.connected ?? false,
    black: room.black?.connected ?? false,
    players: (room.red === null ? 0 : 1) + (room.black === null ? 0 : 1),
    spectators: room.spectators,
    clock,
    drawOffer: room.drawOffer,
    drawBlocked: room.drawBlocked,
  };
}
