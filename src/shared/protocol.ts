// 联机协议：客户端只发坐标与意图，服务端回权威快照。纯类型与校验，不碰 DOM / Node API。

import type { ClockState } from './clock.ts';
import type { Color, GameResult, GameStatus, Move } from './types.ts';

export interface Snapshot {
  readonly room: string;
  /** 本局起始局面：回放与存谱要用，不能从当前局面反推。 */
  readonly startFen: string;
  readonly fen: string;
  readonly seq: number;
  readonly turn: Color;
  readonly status: GameStatus;
  readonly result: GameResult | null;
  readonly lastMove: Move | null;
  readonly moves: readonly string[];
  /** 逐着坐标，与 `moves` 逐着对齐；回放与存谱用。 */
  readonly moveLog: readonly Move[];
  readonly red: boolean;
  readonly black: boolean;
  readonly players: number;
  readonly clock: ClockState;
  readonly drawOffer: Color | null;
  readonly drawBlocked: Color | null;
}

export type ClientMessage =
  | { readonly type: 'join'; readonly room?: string; readonly token?: string }
  | { readonly type: 'move'; readonly from: number; readonly to: number; readonly seq: number }
  | { readonly type: 'resign' }
  | { readonly type: 'offer-draw' }
  | { readonly type: 'draw-response'; readonly accept: boolean }
  | { readonly type: 'leave' }
  | { readonly type: 'ping' };

export type ServerMessage =
  | {
      readonly type: 'joined';
      readonly room: string;
      readonly token: string;
      readonly color: Color;
      readonly snapshot: Snapshot;
    }
  | { readonly type: 'state'; readonly snapshot: Snapshot }
  | { readonly type: 'rejected'; readonly reason: RejectReason; readonly snapshot: Snapshot }
  | { readonly type: 'presence'; readonly red: boolean; readonly black: boolean }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly type: 'pong' };

export type RejectReason =
  | 'not-in-room'
  | 'not-your-turn'
  | 'game-over'
  | 'stale-seq'
  | 'illegal-move'
  | 'draw-blocked'
  | 'draw-pending'
  | 'no-draw-offer';

export type ErrorCode = 'room-full' | 'room-not-found' | 'bad-message';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSquare(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 89;
}

/** 服务端入口用：把收到的 JSON 收窄成 ClientMessage。 */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'join':
      return (
        (value.room === undefined || typeof value.room === 'string') &&
        (value.token === undefined || typeof value.token === 'string')
      );
    case 'move':
      return (
        isSquare(value.from) &&
        isSquare(value.to) &&
        value.from !== value.to &&
        typeof value.seq === 'number' &&
        Number.isInteger(value.seq) &&
        value.seq >= 0
      );
    case 'draw-response':
      return typeof value.accept === 'boolean';
    case 'resign':
    case 'offer-draw':
    case 'leave':
    case 'ping':
      return true;
    default:
      return false;
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}
