// 联机页：大厅（建房 / 加入）与房间（棋盘 + 面板）。

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameResult, ResultType } from '../../shared/index.ts';
import { generateLegalMoves, kingSquareOf, parseFen, pieceAt } from '../../shared/index.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { createOnlineState, onlineReducer } from '../online/session.ts';
import { OnlineSocket, loadStored } from '../online/socket.ts';

const RESULT_REASON: Readonly<Record<ResultType, string>> = {
  checkmate: '将死',
  stalemate: '困毙',
  perpetual: '长将',
  repetition: '三次重复',
  natural: '60 回合无吃子',
};

function resultText(result: GameResult): string {
  const winner = result.winner === null ? '和棋' : `${result.winner === 'red' ? '红方' : '黑方'}胜`;
  return `${winner} · ${RESULT_REASON[result.type]}`;
}

export function OnlinePage() {
  const [state, dispatch] = useReducer(onlineReducer, undefined, createOnlineState);
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const socketRef = useRef<OnlineSocket | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);

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
  const position = useMemo(() => (snapshot === null ? null : parseFen(snapshot.fen)), [snapshot?.fen]);

  useEffect(() => {
    setSelected(null);
  }, [snapshot?.seq]);

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
      ? resultText(snapshot.result)
      : `轮到${snapshot.turn === 'red' ? '红方' : '黑方'}`;

  return (
    <div className="page page-play online-room">
      <main className="board-stage">
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={{ kind: 'play', side: state.color ?? 'red' }}
              size={size}
              position={position ?? parseFen(snapshot.fen)}
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
          <p className="online-color">
            你是{state.color === 'red' ? '红方' : '黑方'}
          </p>
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
