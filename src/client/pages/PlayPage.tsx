// 对弈页：M1 的棋盘 + 面板，装进页面壳。每秒推一次时钟并重渲染。

import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { checkSquareOf } from '../game/session.ts';
import type { GameAction, GameSession } from '../game/session.ts';
import { GamePanel } from '../panel/GamePanel.tsx';

export interface PlayPageProps {
  readonly session: GameSession;
  readonly dispatch: Dispatch<GameAction>;
}

export function PlayPage({ session, dispatch }: PlayPageProps) {
  const [panelOpen, setPanelOpen] = useState(true);
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
        onRequestExpand={() => setPanelOpen(true)}
        onToggle={() => setPanelOpen((open) => !open)}
        onReset={() => dispatch({ type: 'reset' })}
        onResign={() => dispatch({ type: 'resign', now: Date.now() })}
      />
    </div>
  );
}
