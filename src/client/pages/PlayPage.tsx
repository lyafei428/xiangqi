// 对弈页：M1 的棋盘 + 面板，装进页面壳。每秒推一次时钟并重渲染。

import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { checkSquareOf } from '../game/session.ts';
import type { GameAction, GameSession } from '../game/session.ts';
import { GamePanel } from '../panel/GamePanel.tsx';
import { useMoveTrailEnabled } from '../board/useMoveTrail.ts';
import { readPanelOpen, writePanelOpen } from '../storage/prefs.ts';

export interface PlayPageProps {
  readonly session: GameSession;
  readonly dispatch: Dispatch<GameAction>;
}

export function PlayPage({ session, dispatch }: PlayPageProps) {
  // 进对局页是专注态：着法区收起，只留着法开关与常驻条（F1.10）。
  // 第一次进来收起（专注态）；用户展开过就记住，切页回来继续展开。
  const [panelOpen, setPanelOpen] = useState(readPanelOpen);
  // 走子轨迹：默认开，设置里可关。
  const trail = useMoveTrailEnabled();
  const [now, setNow] = useState(() => Date.now());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height);
  const over = session.result !== null;

  useEffect(() => {
    if (over) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: 'tick', now: current });
    }, 1000);
    return () => clearInterval(timer);
  }, [dispatch, over]);

  return (
    <div className="page page-play" data-panel={panelOpen ? 'open' : 'closed'}>
      <main className="board-stage">
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={{ kind: 'play', side: 'both' }}
              size={size}
              position={session.position}
              selection={{ selected: session.selected, targets: session.targets }}
              lastMove={session.lastMove}
              trail={trail}
              checkSquare={checkSquareOf(session)}
              onSelect={over ? undefined : (square) => dispatch({ type: 'select', square, now: Date.now() })}
              onTap={over ? undefined : (square) => dispatch({ type: 'tap', square, now: Date.now() })}
            />
          </div>
        </div>
      </main>
      <GamePanel
        session={session}
        open={panelOpen}
        now={now}
        notationDisabled={over}
        onPlay={(move) => dispatch({ type: 'play', move, now: Date.now() })}
        onRequestExpand={() => {
          setPanelOpen(true);
          writePanelOpen(true);
        }}
        onToggle={() =>
          setPanelOpen((open) => {
            writePanelOpen(!open);
            return !open;
          })
        }
        onReset={() => dispatch({ type: 'reset' })}
        onStart={() => dispatch({ type: 'start', now: Date.now() })}
        onResign={() => dispatch({ type: 'resign', now: Date.now() })}
      />
    </div>
  );
}
