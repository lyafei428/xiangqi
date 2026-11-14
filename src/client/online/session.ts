// 联机页状态：连接阶段、房间、颜色、权威快照。纯 reducer。

import type { Color } from '../../shared/index.ts';
import type { PlayerRole, RejectReason, Snapshot } from '../../shared/protocol.ts';

export type OnlinePhase =
  | 'idle'
  | 'lobby'
  | 'connecting'
  | 'waiting'
  | 'playing'
  | 'spectating'
  | 'reconnecting'
  | 'error';

export interface OnlineState {
  readonly phase: OnlinePhase;
  readonly room: string | null;
  readonly role: PlayerRole | null;
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
      /** 服务端为每连接定角色：观战者无座位颜色（null）。 */
      readonly role: PlayerRole;
      readonly color: Color | null;
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
  'not-over': '对局还没结束',
};

export function createOnlineState(): OnlineState {
  return {
    phase: 'lobby',
    room: null,
    role: null,
    color: null,
    token: null,
    snapshot: null,
    error: null,
    notice: null,
  };
}

/** 观战者不看座位数：两名棋手都在，但舞台仍是只读的 spectating。 */
function roomPhase(snapshot: Snapshot, role: PlayerRole | null): OnlinePhase {
  if (role === 'spectator') return 'spectating';
  return snapshot.players >= 2 ? 'playing' : 'waiting';
}

export function onlineReducer(state: OnlineState, event: OnlineEvent): OnlineState {
  switch (event.type) {
    case 'lobby':
      return { ...state, phase: 'lobby', error: null, notice: null };
    case 'connecting':
      return { ...state, phase: 'connecting', error: null, notice: null };
    case 'joined': {
      return {
        ...state,
        phase: roomPhase(event.snapshot, event.role),
        room: event.room,
        token: event.token,
        role: event.role,
        color: event.color,
        snapshot: event.snapshot,
        error: null,
        notice: null,
      };
    }
    case 'state':
      return {
        ...state,
        phase: roomPhase(event.snapshot, state.role),
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
        phase: roomPhase(event.snapshot, state.role),
        snapshot: event.snapshot,
        notice:
          state.role === 'spectator' && event.reason === 'not-in-room'
            ? '你正在观战，不能走棋'
            : REJECT_TEXT[event.reason],
      };
    case 'error':
      return { ...state, phase: 'error', error: event.message };
    case 'disconnected':
      return {
        ...state,
        phase: state.room === null ? 'lobby' : 'reconnecting',
        // 还没进房间就断开 = 服务本身没起来（静态托管上没有 /ws）。
        // 以前这里回大厅且不留话，用户只看到按钮从「连接中…」弹回「创建房间」，
        // 以为按钮坏了；现在把原因写出来，重试仍在后台跑。
        notice:
          state.room === null ? '连不上房间服务，正在重试。联机需要一个运行中的服务端进程。' : '连接断开，正在重连…',
      };
    case 'left':
      return createOnlineState();
  }
}
