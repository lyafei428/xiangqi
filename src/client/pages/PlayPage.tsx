// 对弈页：M1 的棋盘 + 面板，装进页面壳。

import { useRef, useState } from 'react';
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height);
  const over = session.result !== null;

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
              onSelect={over ? undefined : (square) => dispatch({ type: 'select', square })}
              onTap={over ? undefined : (square) => dispatch({ type: 'tap', square })}
            />
          </div>
        </div>
      </main>
      <GamePanel
        session={session}
        open={panelOpen}
        onToggle={() => setPanelOpen((open) => !open)}
        onReset={() => dispatch({ type: 'reset' })}
      />
    </div>
  );
}
