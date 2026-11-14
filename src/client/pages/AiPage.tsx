// 人机页：难度与阵营控件、棋盘、思考锁与终局存谱。
// 会话放在模块级持有者里：切页回来对局仍在（F4-1），关页即丢；未完成的人机局不落盘。
// 发起请求只有一条规则（未终局 && 轮到 AI && !thinking），玩家走子后、AI 执红开局、
// 切页回来重挂载三个入口都走它。

import { useEffect, useReducer, useRef, useState } from 'react';
import type { AiLevel, Color, Move } from '../../shared/index.ts';
import { remainingOf, toFen } from '../../shared/index.ts';
import { createAiEngine } from '../ai/engine.ts';
import type { AiEngine } from '../ai/engine.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { checkSquareOf, createSession, sessionReducer } from '../game/session.ts';
import type { GameSession } from '../game/session.ts';
import { GamePanel } from '../panel/GamePanel.tsx';
import { saveRecord } from '../storage/records.ts';

const LEVEL_LABEL: Readonly<Record<AiLevel, string>> = { easy: '入门', normal: '普通', hard: '高手' };

const LEVEL_ORDER: readonly AiLevel[] = ['easy', 'normal', 'hard'];

const SIDE_LABEL: Readonly<Record<Color, string>> = { red: '执红', black: '执黑' };

const AI_ERROR = 'AI 出错，请点新局重开';

/** 人机局不落盘，会话只能活在模块里：页面卸载不丢，切页回来接着下。 */
let currentSession: GameSession | null = null;

/** 用例之间清场：模块级持有者在同一进程里跨用例存活，不清理就会带上上一局。 */
export function resetAiSession(): void {
  currentSession = null;
}

export function AiPage() {
  const [level, setLevel] = useState<AiLevel>('normal');
  const [side, setSide] = useState<Color>('red');
  const [session, dispatch] = useReducer(
    sessionReducer,
    undefined,
    () => currentSession ?? createSession(),
  );
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const engineRef = useRef<AiEngine | null>(null);
  const levelRef = useRef(level);
  // 已经为哪个局面发过请求：同一局面只发一次，AI 报错后不自动重试。
  const requestedRef = useRef<string | null>(null);
  // 换局代数：新局与换阵营各加一，旧局面迟到的回子凭它认出来并丢掉。
  const gameRef = useRef(0);
  const savedRef = useRef('');
  const over = session.result !== null;

  // 每次 dispatch 后把会话写回模块级持有者。
  useEffect(() => {
    currentSession = session;
  }, [session]);

  // 换难度只影响下一着：在飞的那一着已经带着旧档位出门了。
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  // Worker 随页面挂载创建，卸载即结束线程；会话留下，线程不留。
  // requestedRef 必须跟着线程一起清：StrictMode 在 dev 下会跑「setup → cleanup → setup」，
  // 不清的话第二趟会被「已发过」拦住，而第一趟那笔请求已随 dispose 丢掉——页面就永远停在「AI 思考中…」。
  useEffect(() => {
    const engine = createAiEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
      requestedRef.current = null;
    };
  }, []);

  // 每秒推一次时钟：人机局与本地同规则，每人 10 分钟包干，终局停表。
  useEffect(() => {
    if (over) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: 'tick', now: current });
    }, 1000);
    return () => clearInterval(timer);
  }, [dispatch, over]);

  // 终局存棋谱：与本地对局同一个函数、同一份库；未完成局不写。
  // 键带换局代数：新局从同一个起始局面开局时，不会因为「同样走了几步、同样认输」被当成存过。
  // 跨挂载（切页回来）代数会归零，那一层靠 saveRecord 的 dedupe 拦。
  useEffect(() => {
    const result = session.result;
    if (result === null) return;
    const stamp = Date.now();
    const key = `${String(gameRef.current)}:${session.startFen}:${String(session.history.length)}:${result.type}:${String(result.winner)}`;
    if (savedRef.current === key) return;
    savedRef.current = key;
    saveRecord(
      {
        id: null,
        startFen: session.startFen,
        moves: session.history.map((entry) => entry.move),
        result,
        redMs: remainingOf(session.clock, 'red', stamp),
        blackMs: remainingOf(session.clock, 'black', stamp),
        savedAt: stamp,
      },
      undefined,
      { dedupe: true },
    );
  }, [session]);

  // 发起请求的唯一规则：未终局 && 轮到 AI && !thinking ⇒ 发一着。
  useEffect(() => {
    if (session.result !== null) return;
    if (session.position.turn === side) return;
    if (thinking) return;
    const engine = engineRef.current;
    if (engine === null) return;
    const fen = toFen(session.position);
    const key = `${String(gameRef.current)}:${String(session.history.length)}:${fen}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    const ticket = gameRef.current;
    setThinking(true);

    const apply = (move: Move): void => {
      // 换局了：上一局的回子不许落到新局面。
      if (gameRef.current !== ticket) return;
      setThinking(false);
      dispatch({ type: 'play', move, now: Date.now() });
    };
    const fail = (): void => {
      if (gameRef.current !== ticket) return;
      setThinking(false);
      setNotice(AI_ERROR);
    };

    try {
      engine.request(fen, levelRef.current).then((reply) => apply(reply.move), fail);
    } catch {
      // 引擎同一时刻只准一笔在飞：真撞上就放回可操作态，不让异常掀掉整页。
      fail();
    }
  }, [dispatch, session, side, thinking]);

  const newGame = (): void => {
    // 在飞的一着丢弃：它的回子是给上一局算的，落到新局面上比报错更难查。
    engineRef.current?.cancel();
    gameRef.current += 1;
    setThinking(false);
    setNotice(null);
    dispatch({ type: 'reset' });
  };

  // 换阵营等同重开一局。
  const changeSide = (next: Color): void => {
    if (next === side) return;
    setSide(next);
    newGame();
  };

  // 认输只接受当前行棋方（clock.md §2）：AI 回合点它不动，免得替 AI 认输。
  const resign = (): void => {
    if (session.result !== null || session.position.turn !== side) return;
    dispatch({ type: 'resign', now: Date.now() });
  };

  const canPlay = !over && session.position.turn === side && !thinking;
  const size = boardSize(stage.width, stage.height);

  return (
    <div className="page page-play page-ai" data-panel={panelOpen ? 'open' : 'closed'}>
      <main className="board-stage">
        <div className="ai-controls">
          <div className="mission-actions" role="radiogroup" aria-label="难度">
            <span className="drill-hint" style={{ alignSelf: 'center' }}>
              难度
            </span>
            {LEVEL_ORDER.map((item) => (
              <label className={`option${item === level ? ' is-chosen' : ''}`} key={item}>
                <input
                  type="radio"
                  name="ai-level"
                  value={item}
                  checked={item === level}
                  onChange={() => setLevel(item)}
                />
                {LEVEL_LABEL[item]}
              </label>
            ))}
          </div>
          <div className="mission-actions" role="radiogroup" aria-label="阵营">
            <span className="drill-hint" style={{ alignSelf: 'center' }}>
              阵营
            </span>
            {(['red', 'black'] as const).map((item) => (
              <label className={`option${item === side ? ' is-chosen' : ''}`} key={item}>
                <input
                  type="radio"
                  name="ai-side"
                  value={item}
                  checked={item === side}
                  onChange={() => changeSide(item)}
                />
                {SIDE_LABEL[item]}
              </label>
            ))}
          </div>
          {thinking ? (
            <p className="drill-hint" aria-live="polite">
              AI 思考中…
            </p>
          ) : null}
          {notice === null ? null : (
            <p className="drill-hint" role="alert">
              {notice}
            </p>
          )}
        </div>
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={{ kind: 'play', side }}
              size={size}
              position={session.position}
              // 执黑时把盘翻转：自己的子在下，跟对面摆棋一样。
              orientation={side}
              selection={{ selected: session.selected, targets: session.targets }}
              lastMove={session.lastMove}
              checkSquare={checkSquareOf(session)}
              // 思考中与 AI 回合不传回调：棋盘整块只读，点击不产生任何着法。
              onSelect={
                canPlay
                  ? (square) => dispatch({ type: 'select', square, now: Date.now() })
                  : undefined
              }
              onTap={
                canPlay ? (square) => dispatch({ type: 'tap', square, now: Date.now() }) : undefined
              }
            />
          </div>
        </div>
      </main>
      <GamePanel
        session={session}
        open={panelOpen}
        now={now}
        modeLabel={`人机 · ${LEVEL_LABEL[level]}`}
        resignDisabled={session.result !== null || session.position.turn !== side}
        onToggle={() => setPanelOpen((open) => !open)}
        onReset={newGame}
        onResign={resign}
      />
    </div>
  );
}
