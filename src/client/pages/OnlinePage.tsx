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
import { OnlineSocket, loadStored, saveStored } from '../online/socket.ts';
import { useMoveTrailEnabled } from '../board/useMoveTrail.ts';
import { resultLabel, resultTone } from '../panel/result-text.ts';
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
  // 着法区在手机上默认收起：常驻条之外的东西一律进抽屉，别压在棋盘上。
  const [panelOpen, setPanelOpen] = useState(false);
  // 走子轨迹：默认开，设置里可关。
  const trail = useMoveTrailEnabled();
  // 上次待过的房间：大厅里给一条「回到上次的房间」，不用重新建房。
  const [storedRoom, setStoredRoom] = useState<string | null>(() => loadStored()?.room ?? null);
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

  // 自动回房失败（房间已被回收）：清掉记忆，把码填进输入框，让人手动重试。
  useEffect(() => {
    if (state.error === null || state.snapshot !== null) return;
    const stored = loadStored();
    if (stored === null) return;
    setCode(stored.room);
    saveStored(null);
  }, [state.error, state.snapshot]);

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
        <div className="online-cards">
          <section className="online-card">
            <h1 className="online-card-title">联机对战</h1>
            <p className="page-subtitle">一房两人，红先。建房后把房间码发给对手。</p>
            <button type="button" className="btn primary" onClick={createRoom} disabled={busy}>
              {busy ? '连接中…' : '创建房间'}
            </button>
            {storedRoom === null ? null : (
              <p className="online-room-line">
                上次的房间 <strong>{storedRoom}</strong>
                <span className="online-room-hint">点「加入」可直接回去</span>
              </p>
            )}
          </section>

          <section className="online-card">
            <h2 className="online-card-title">加入房间</h2>
            <p className="page-subtitle">输入对方给的六位房间码。</p>
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
          </section>
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
              trail={trail}
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
        {/* 常驻条：身份、状态、计时与认输/求和/和棋提议。
            手机上这些必须一直在——放进可收起的抽屉里就会浮在棋盘上把棋盘挡住。 */}
        <div className="panel-focus">
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
          <p className={`online-color${state.color === null ? '' : ` is-${state.color}`}`}>{identityText}</p>
          <p className={`status-line${snapshot.result === null ? '' : ` is-result is-${resultTone(snapshot.result)}`}`}>
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
            <span className="presence-red">红方</span>
            <span className={snapshot.red ? 'presence-on' : 'presence-off'}>
              {snapshot.red ? '在线' : '离线'}
            </span>
            <span className="presence-sep">·</span>
            <span className="presence-black">黑方</span>
            <span className={snapshot.black ? 'presence-on' : 'presence-off'}>
              {snapshot.black ? '在线' : '离线'}
            </span>
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
          {/* 房间码常驻：手机档面板标题是隐藏的，只在这条分支里显示的话，
              对手一进来房间号就没了（用户报的「手机端没有显示房间号」）。 */}
          <p className="online-room-line">
            房间 <strong>{snapshot.room}</strong>
            <span className="online-room-hint">
              {snapshot.players < 2 ? '把房间码发给对手' : '对手已加入'}
            </span>
          </p>
          <div className="panel-actions">
            <button
              type="button"
              className="panel-toggle"
              aria-expanded={panelOpen}
              aria-controls="online-panel-body"
              onClick={() => setPanelOpen((previous) => !previous)}
            >
              着法
            </button>
            {/* 新局常驻：一局打完后不该还要猜按钮藏在哪；对局中置灰而不是隐藏，
                这样「结束就能重开」这件事一直是看得见的。观战者没有座位，不显示。 */}
            {spectating ? null : (
              <button
                type="button"
                className="new-game"
                onClick={() => socketRef.current?.rematch()}
                disabled={!over}
                title={over ? undefined : '对局还没结束'}
              >
                新局
              </button>
            )}
            <button type="button" className="new-game" onClick={leaveRoom}>
              离开房间
            </button>
          </div>
        </div>
        <div className="panel-body" id="online-panel-body" hidden={!panelOpen}>
          <div className="panel-body-head">
            <span className="panel-body-title">着法记录</span>
            <button type="button" className="panel-close" onClick={() => setPanelOpen(false)}>
              收起着法
            </button>
          </div>
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
        </div>
      </aside>
    </div>
  );
}
