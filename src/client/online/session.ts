// 联机页状态：连接阶段、房间、颜色、权威快照。纯 reducer。

import type { Color } from '../../shared/index.ts';
import type { RejectReason, Snapshot } from '../../shared/protocol.ts';

export type OnlinePhase =
  | 'idle'
  | 'lobby'
  | 'connecting'
  | 'waiting'
  | 'playing'
  | 'reconnecting'
  | 'error';

export interface OnlineState {
  readonly phase: OnlinePhase;
  readonly room: string | null;
  readonly color: Color | null;
  readonly token: string | null;
  readonly snapshot: Snapshot | null;
  readonly error: string | null;
  readonly notice: string | null;
}

export type OnlineEvent =
  | { readonly type: 'lobby' }
  | { readonly type: 'connecting' }
  | {
      readonly type: 'joined';
      readonly room: string;
      readonly token: string;
      readonly color: Color;
      readonly snapshot: Snapshot;
    }
  | { readonly type: 'state'; readonly snapshot: Snapshot }
  | { readonly type: 'presence'; readonly red: boolean; readonly black: boolean }
  | { readonly type: 'rejected'; readonly reason: RejectReason; readonly snapshot: Snapshot }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'disconnected' }
  | { readonly type: 'left' };

const REJECT_TEXT: Readonly<Record<RejectReason, string>> = {
  'not-in-room': '你不在这个房间里',
  'not-your-turn': '还没轮到你走',
  'game-over': '对局已经结束',
  'stale-seq': '局面已更新，请重新走',
  'illegal-move': '这一步不合法',
  'draw-blocked': '对方还没走棋，暂时不能再提议和棋',
  'draw-pending': '已有待答的和棋提议',
  'no-draw-offer': '没有待答的和棋提议',
};

export function createOnlineState(): OnlineState {
  return {
    phase: 'lobby',
    room: null,
    color: null,
    token: null,
    snapshot: null,
    error: null,
    notice: null,
  };
}

function roomPhase(snapshot: Snapshot): OnlinePhase {
  return snapshot.players >= 2 ? 'playing' : 'waiting';
}

export function onlineReducer(state: OnlineState, event: OnlineEvent): OnlineState {
  switch (event.type) {
    case 'lobby':
      return { ...state, phase: 'lobby', error: null, notice: null };
    case 'connecting':
      return { ...state, phase: 'connecting', error: null, notice: null };
    case 'joined':
      return {
        ...state,
        phase: roomPhase(event.snapshot),
        room: event.room,
        token: event.token,
        color: event.color,
        snapshot: event.snapshot,
        error: null,
        notice: null,
      };
    case 'state':
      return {
        ...state,
        phase: roomPhase(event.snapshot),
        snapshot: event.snapshot,
        notice: null,
      };
    case 'presence':
      return state.snapshot === null
        ? state
        : {
            ...state,
            snapshot: { ...state.snapshot, red: event.red, black: event.black },
          };
    case 'rejected':
      return {
        ...state,
        phase: roomPhase(event.snapshot),
        snapshot: event.snapshot,
        notice: REJECT_TEXT[event.reason],
      };
    case 'error':
      return { ...state, phase: 'error', error: event.message };
    case 'disconnected':
      return {
        ...state,
        phase: state.room === null ? 'lobby' : 'reconnecting',
        notice: state.room === null ? null : '连接断开，正在重连…',
      };
    case 'left':
      return createOnlineState();
  }
}
