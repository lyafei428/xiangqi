// 联机 socket：连接、自动重连、localStorage 存房间与 token、服务端消息转事件。

import type { ClientMessage, ServerMessage } from '../../shared/protocol.ts';
import type { OnlineEvent } from './session.ts';

const STORAGE_KEY = 'xiangqi.online';

export interface StoredSession {
  readonly room: string;
  readonly token: string;
}

export function loadStored(): StoredSession | null {
  try {
    // 先用 localStorage：关掉浏览器再回来还能接着上一间房（用户要的「记住房间」）。
    // 老版本只写 sessionStorage，读的时候也兼容一下，别让正在房里的人升级后掉出去。
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredSession).room === 'string' &&
      typeof (parsed as StoredSession).token === 'string'
    ) {
      return { room: (parsed as StoredSession).room, token: (parsed as StoredSession).token };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStored(session: StoredSession | null): void {
  // 两处都写：localStorage 负责「关浏览器再回来还认得这间房」，
  // sessionStorage 只在本标签页内有效——隐私模式下前者可能被拒，后者兜底。
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      if (session === null) storage.removeItem(STORAGE_KEY);
      else storage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // 存不下只影响下次能不能自动回房，不影响这一局。
    }
  }
}

export interface OnlineSocketOptions {
  readonly onEvent: (event: OnlineEvent) => void;
  readonly WebSocketImpl?: typeof WebSocket;
  readonly url?: string;
}

interface JoinInfo {
  readonly room?: string;
  readonly token?: string;
}

export class OnlineSocket {
  private readonly onEvent: (event: OnlineEvent) => void;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly url: string;
  private ws: WebSocket | null = null;
  private joinInfo: JoinInfo | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private intentional = false;
  private stored: StoredSession | null;

  constructor(options: OnlineSocketOptions) {
    this.onEvent = options.onEvent;
    this.WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
    this.url =
      options.url ??
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    this.stored = loadStored();
  }

  connect(join: JoinInfo): void {
    this.intentional = false;
    this.joinInfo = join;
    // 连接仍在时（例如刚被 spectators-full / room-not-found 拒过）就在这条连接上重发 join：
    // open() 早返回会让大厅永远停在「连接中」，用户只能刷新。连接还在握手时不必重发，
    // 它的 open 回调会拿刚设的 joinInfo 发出去。
    if (this.ws !== null && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'join', ...join }));
      return;
    }
    this.open();
  }

  send(message: ClientMessage): void {
    if (this.ws !== null && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(message));
    }
  }

  leave(): void {
    this.intentional = true;
    this.clearTimer();
    this.send({ type: 'leave' });
    this.stored = null;
    saveStored(null);
    this.ws?.close();
    this.ws = null;
    this.onEvent({ type: 'left' });
  }

  dispose(): void {
    this.intentional = true;
    this.clearTimer();
    this.ws?.close();
    this.ws = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private open(): void {
    if (this.ws !== null) return;
    let ws: WebSocket;
    try {
      ws = new this.WebSocketImpl(this.url);
    } catch {
      this.onEvent({ type: 'error', message: '无法连接服务器' });
      return;
    }
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.attempts = 0;
      const join = this.joinInfo ?? this.stored ?? {};
      ws.send(JSON.stringify({ type: 'join', ...join }));
    });
    ws.addEventListener('message', (event) => {
      this.onMessage(String(event.data));
    });
    ws.addEventListener('close', () => {
      this.ws = null;
      if (this.intentional) return;
      this.onEvent({ type: 'disconnected' });
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    const join = this.joinInfo ?? this.stored;
    if (join === null) return;
    this.clearTimer();
    const delay = Math.min(8000, 1000 * 2 ** this.attempts);
    this.attempts += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.joinInfo = this.stored ?? join;
      this.open();
    }, delay);
  }

  private onMessage(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'joined':
        this.stored = { room: message.room, token: message.token };
        saveStored(this.stored);
        this.joinInfo = { room: message.room, token: message.token };
        this.onEvent({
          type: 'joined',
          room: message.room,
          token: message.token,
          role: message.role,
          color: message.color,
          snapshot: message.snapshot,
        });
        return;
      case 'state':
        this.onEvent({ type: 'state', snapshot: message.snapshot });
        return;
      case 'presence':
        this.onEvent({ type: 'presence', red: message.red, black: message.black });
        return;
      case 'rejected':
        this.onEvent({ type: 'rejected', reason: message.reason, snapshot: message.snapshot });
        return;
      case 'error':
        if (message.code === 'room-not-found') {
          this.stored = null;
          saveStored(null);
        }
        this.onEvent({ type: 'error', message: message.message });
        return;
      case 'pong':
        return;
    }
  }
}
