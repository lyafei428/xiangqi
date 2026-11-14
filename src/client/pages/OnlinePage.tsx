// 联机页：大厅（建房 / 加入）与房间（棋盘 + 面板）。

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Color, GameResult, ResultType } from '../../shared/index.ts';
import {
  formatClock,
  generateLegalMoves,
  kingSquareOf,
  parseFen,
  pieceAt,
} from '../../shared/index.ts';
import type { Snapshot } from '../../shared/protocol.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { createOnlineState, onlineReducer } from '../online/session.ts';
import { OnlineSocket, loadStored } from '../online/socket.ts';
import { resultLabel } from '../panel/result-text.ts';
import { saveRecord } from '../storage/records.ts';

/** 以收到快照的时刻为锚做本地投影；归零仍由服务端裁决。 */
function projectedMs(
  snapshot: Snapshot,
  color: Color,
  receivedAt: number,
  now: number,
  active: boolean,
): number {
  const base = color === 'red' ? snapshot.clock.redMs : snapshot.clock.blackMs;
  if (!active || snapshot.clock.running !== color) return Math.max(0, base);
  return Math.max(0, base - Math.max(0, now - receivedAt));
}

export function OnlinePage() {
  const [state, dispatch] = useReducer(onlineReducer, undefined, createOnlineState);
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<OnlineSocket | null>(null);
  const receivedAtRef = useRef(Date.now());
  const savedKeyRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = new OnlineSocket({ onEvent: (event) => dispatch(event) });
    socketRef.current = socket;
    const stored = loadStored();
    if (stored !== null) {
      dispatch({ type: 'connecting' });
      socket.connect({ room: stored.room, token: stored.token });
    }
    return () => socket.dispose();
  }, []);

  const snapshot = state.snapshot;
  const spectating = state.role === 'spectator';
  const position = useMemo(() => (snapshot === null ? null : parseFen(snapshot.fen)), [snapshot?.fen]);

  // 只跟服务端生成的快照走：presence 会新建快照对象，但时钟引用不变，不能因它重置锚点。
  useEffect(() => {
    receivedAtRef.current = Date.now();
  }, [snapshot?.clock]);

  useEffect(() => {
    setSelected(null);
  }, [snapshot?.seq]);

  // 终局存棋谱：只有棋手存（观战者不参与对局，也没有 token）。
  // 挂载期用 savedKeyRef 挡重复；跨挂载（切页、刷新重连）靠 saveRecord 的 dedupe：
  // 同一局内容不变，而组件会被重建，挂载期标记拦不住第二次。
  useEffect(() => {
    if (snapshot === null || snapshot.result === null || state.color === null) return;
    const key = `${snapshot.room}:${String(snapshot.seq)}`;
    if (savedKeyRef.current === key) return;
    savedKeyRef.current = key;
    saveRecord(
      {
        id: null,
        startFen: snapshot.startFen,
        moves: snapshot.moveLog,
        result: snapshot.result,
        redMs: snapshot.clock.redMs,
        blackMs: snapshot.clock.blackMs,
        savedAt: Date.now(),
      },
      undefined,
      { dedupe: true },
    );
  }, [snapshot, state.color]);

  const targets = useMemo(() => {
    if (position === null || selected === null) return [];
    return generateLegalMoves(position)
      .filter((move) => move.from === selected)
      .map((move) => move.to);
  }, [position, selected]);

  const bothOnline = snapshot !== null && snapshot.red && snapshot.black;
  const canPlay =
    state.phase === 'playing' &&
    state.color !== null &&
    snapshot !== null &&
    snapshot.result === null &&
    snapshot.turn === state.color &&
    bothOnline;

  const checkSquare = useMemo(() => {
    if (position === null || snapshot === null) return null;
    if (snapshot.status !== 'check' && snapshot.status !== 'checkmate') return null;
    try {
      return kingSquareOf(position.board, position.turn);
    } catch {
      return null;
    }
  }, [position, snapshot?.status, snapshot?.turn]);

  const selectSquare = (square: number): void => {
    if (!canPlay || position === null || state.color === null) return;
    const piece = pieceAt(position.board, square);
    if (piece?.color === state.color) setSelected(square);
  };

  const tapSquare = (square: number): void => {
    if (!canPlay || position === null || snapshot === null || selected === null) return;
    if (square === selected) {
      setSelected(null);
      return;
    }
    if (targets.includes(square)) {
      socketRef.current?.send({ type: 'move', from: selected, to: square, seq: snapshot.seq });
      setSelected(null);
      return;
    }
    const piece = pieceAt(position.board, square);
    setSelected(piece?.color === state.color ? square : null);
  };

  const createRoom = (): void => {
    dispatch({ type: 'connecting' });
    socketRef.current?.connect({});
  };

  const joinRoom = (): void => {
    const room = code.trim().toUpperCase();
    if (room.length !== 6) return;
    dispatch({ type: 'connecting' });
    socketRef.current?.connect({ room });
  };

  const leaveRoom = (): void => {
    socketRef.current?.leave();
    setSelected(null);
  };

  const resign = (): void => {
    socketRef.current?.send({ type: 'resign' });
  };

  const offerDraw = (): void => {
    socketRef.current?.send({ type: 'offer-draw' });
  };

  const answerDraw = (accept: boolean): void => {
    socketRef.current?.send({ type: 'draw-response', accept });
  };

  if (snapshot === null) {
    const busy = state.phase === 'connecting';
    return (
      <div className="page page-online-lobby">
        <div className="online-card">
          <h1 className="page-title">联机对战</h1>
          <p className="page-subtitle">建房拿到房间码，或输入对方的房间码加入。一房两人，红先。</p>
          <button type="button" className="btn primary" onClick={createRoom} disabled={busy}>
            {busy ? '连接中…' : '创建房间'}
          </button>
          <div className="online-join">
            <input
              className="online-code-input"
              value={code}
              maxLength={6}
              placeholder="房间码"
              aria-label="房间码"
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^0-9A-Z]/g, '')
                    .slice(0, 6),
                )
              }
            />
            <button
              type="button"
              className="btn"
              onClick={joinRoom}
              disabled={busy || code.trim().length !== 6}
            >
              加入
            </button>
          </div>
          {state.notice !== null ? (
            <p className="online-error" role="status">
              {state.notice}
            </p>
          ) : null}
          {state.error === null ? null : (
            <p className="online-error" role="alert">
              {state.error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const size = boardSize(stage.width, stage.height);
  const statusText =
    snapshot.result !== null
      ? resultLabel(snapshot.result)
      : `轮到${snapshot.turn === 'red' ? '红方' : '黑方'}`;
  // 观战者无座位颜色：面板换成观战身份。
  const identityText = spectating
    ? `观战中 · ${snapshot.spectators} 人观战`
    : `你是${state.color === 'red' ? '红方' : '黑方'}`;
  const receivedAt = receivedAtRef.current;
  // 未坐满不算开局：服务端不扣时，客户端也不投影，否则等对手时会看到自己掉秒。
  const started = snapshot.players >= 2;
  const redMs = projectedMs(snapshot, 'red', receivedAt, now, started);
  const blackMs = projectedMs(snapshot, 'black', receivedAt, now, started);
  const over = snapshot.result !== null;
  const myTurn = state.color !== null && snapshot.turn === state.color;
  const incomingOffer =
    snapshot.drawOffer !== null && state.color !== null && snapshot.drawOffer !== state.color;
  const myOffer = snapshot.drawOffer !== null && snapshot.drawOffer === state.color;
  const canOffer =
    !over && state.color !== null && snapshot.drawOffer === null && snapshot.drawBlocked !== state.color;

  return (
    <div className="page page-play online-room">
      <main className="board-stage">
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={spectating ? { kind: 'demo' } : { kind: 'play', side: state.color ?? 'red' }}
              size={size}
              position={position ?? parseFen(snapshot.fen)}
              // 执黑的一方看到的棋盘要翻过来：自己的子在下。观战保持红方视角。
              orientation={spectating ? undefined : (state.color ?? 'red')}
              selection={{ selected, targets }}
              lastMove={snapshot.lastMove}
              checkSquare={checkSquare}
              onSelect={canPlay ? selectSquare : undefined}
              onTap={canPlay ? tapSquare : undefined}
            />
          </div>
        </div>
      </main>
      <aside className="panel online-panel">
        <div className="panel-head">
          <h2 className="panel-title">联机对战</h2>
          <span className="panel-mode">房间 {snapshot.room}</span>
        </div>
        <div className="panel-body">
          {state.phase === 'reconnecting' ? (
            <p className="online-banner" role="status">
              连接断开，正在重连…
            </p>
          ) : null}
          {state.notice !== null && state.phase !== 'reconnecting' ? (
            <p className="online-banner" role="status">
              {state.notice}
            </p>
          ) : null}
          {state.error === null ? null : (
            <p className="online-banner" role="alert">
              {state.error}
            </p>
          )}
          <p className="online-color">{identityText}</p>
          <p className={`status-line${snapshot.result === null ? '' : ' is-result'}`}>
            <span
              className={`turn-dot ${
                snapshot.result !== null
                  ? 'turn-over'
                  : snapshot.turn === 'red'
                    ? 'turn-red'
                    : 'turn-black'
              }`}
            />
            {statusText}
          </p>
          <p className="online-presence">
            红方{snapshot.red ? '在线' : '离线'} · 黑方{snapshot.black ? '在线' : '离线'}
          </p>
          <div className="clock-row" aria-label="双方用时">
            <span className={`clock clock-red${redMs < 60_000 ? ' is-low' : ''}`}>
              红 {formatClock(redMs)}
            </span>
            <span className={`clock clock-black${blackMs < 60_000 ? ' is-low' : ''}`}>
              黑 {formatClock(blackMs)}
            </span>
            {spectating ? null : (
              <>
                <button type="button" className="resign" onClick={resign} disabled={over || !myTurn}>
                  认输
                </button>
                <button type="button" className="resign" onClick={offerDraw} disabled={!canOffer}>
                  提议和棋
                </button>
              </>
            )}
          </div>
          {incomingOffer ? (
            <p className="online-banner" role="status">
              对方提议和棋
              <button type="button" className="btn small" onClick={() => answerDraw(true)}>
                接受
              </button>
              <button type="button" className="btn small" onClick={() => answerDraw(false)}>
                拒绝
              </button>
            </p>
          ) : null}
          {myOffer ? <p className="online-banner">已提议和棋，等待对方答复</p> : null}
          {snapshot.players < 2 ? (
            <p className="online-waiting">
              把房间码发给对手：<strong>{snapshot.room}</strong>
            </p>
          ) : null}
          <div className="moves">
            {snapshot.moves.length === 0 ? (
              <p className="moves-empty">尚未走子</p>
            ) : (
              <ol className="moves-list">
                {snapshot.moves.map((move, index) => (
                  <li className="online-move" key={`${index}-${move}`}>
                    {index + 1}. {move}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <button type="button" className="new-game" onClick={leaveRoom}>
            离开房间
          </button>
        </div>
      </aside>
    </div>
  );
}
