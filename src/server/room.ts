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
  INITIAL_FEN,
  judgeGame,
  parseFen,
  playMove,
  statusOf,
  toChineseNotation,
  toFen,
} from '../shared/index.ts';
import type { RejectReason, Snapshot } from '../shared/protocol.ts';

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
  readonly idleSince: number | null;
}

export type JoinOutcome =
  | { readonly ok: true; readonly room: RoomState; readonly color: Color }
  | { readonly ok: false; readonly reason: 'room-full' };

export type MoveOutcome =
  | { readonly ok: true; readonly room: RoomState }
  | { readonly ok: false; readonly reason: RejectReason };

export function createRoom(code: string, token: string, startFen = INITIAL_FEN): RoomState {
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
    idleSince: null,
  };
}

/** 带 token 且匹配 → 重连；否则坐到空位上（先红后黑）。 */
export function joinRoom(room: RoomState, token: string): JoinOutcome {
  if (room.red?.token === token) {
    return {
      ok: true,
      room: { ...room, red: { ...room.red, connected: true }, idleSince: null },
      color: 'red',
    };
  }
  if (room.black?.token === token) {
    return {
      ok: true,
      room: { ...room, black: { ...room.black, connected: true }, idleSince: null },
      color: 'black',
    };
  }
  if (room.red === null) {
    return {
      ok: true,
      room: { ...room, red: { token, color: 'red', connected: true }, idleSince: null },
      color: 'red',
    };
  }
  if (room.black === null) {
    return {
      ok: true,
      room: { ...room, black: { token, color: 'black', connected: true }, idleSince: null },
      color: 'black',
    };
  }
  return { ok: false, reason: 'room-full' };
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
): MoveOutcome {
  const player = room.red?.token === token ? room.red : room.black?.token === token ? room.black : null;
  if (player === null) return { ok: false, reason: 'not-in-room' };
  if (room.result !== null) return { ok: false, reason: 'game-over' };
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
  return {
    ok: true,
    room: {
      ...room,
      position: played.position,
      history,
      result: judgeGame(played.position, history, room.startFen),
      status: statusOf(played.position),
      seq: room.seq + 1,
      lastMove: move,
      moves: [...room.moves, notation],
    },
  };
}

export function snapshotOf(room: RoomState): Snapshot {
  return {
    room: room.code,
    fen: toFen(room.position),
    seq: room.seq,
    turn: room.position.turn,
    status: room.status,
    result: room.result,
    lastMove: room.lastMove,
    moves: [...room.moves],
    red: room.red?.connected ?? false,
    black: room.black?.connected ?? false,
    players: (room.red === null ? 0 : 1) + (room.black === null ? 0 : 1),
  };
}
