// 单道对弈题：棋盘上走子，引擎判定目标。

import { useReducer, useRef } from 'react';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { checkSquareOf } from '../game/session.ts';
import { findMission, missions } from '../missions/content.ts';
import { createMissionSession, missionReducer } from '../missions/session.ts';
import type { Mission, MissionType } from '../missions/types.ts';

const TYPE_LABEL: Readonly<Record<MissionType, string>> = {
  'find-mate': '找杀',
  attack: '攻杀',
  defense: '防守',
};

function MissionRunner({ mission }: { readonly mission: Mission }) {
  const [state, dispatch] = useReducer(missionReducer, mission, (initial) =>
    createMissionSession(initial),
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height);
  const over = state.status !== 'playing';
  const index = missions.findIndex((item) => item.id === mission.id);
  const next = missions[(index + 1) % missions.length];

  return (
    <div className="page page-drill page-mission">
      <main className="board-stage drill-board">
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={{ kind: 'play', side: state.player }}
              size={size}
              position={state.game.position}
              selection={{ selected: state.game.selected, targets: state.game.targets }}
              lastMove={state.game.lastMove}
              checkSquare={checkSquareOf(state.game)}
              onSelect={over ? undefined : (square) => dispatch({ type: 'select', square })}
              onTap={over ? undefined : (square) => dispatch({ type: 'tap', square })}
            />
          </div>
        </div>
      </main>

      <section className="drill-panel" aria-label="对弈题">
        <h1 className="drill-title">
          对弈题 · {TYPE_LABEL[mission.type]}
        </h1>
        <p className="drill-question">{mission.title}</p>
        <p className="drill-hint">{state.message}</p>
        <p className="mission-attempts">第 {state.attempts + 1} 次尝试</p>

        {state.answerText !== null ? (
          <p className="mission-hint">{state.answerText}</p>
        ) : state.failures >= 2 ? (
          <p className="mission-hint">提示：{mission.hint}</p>
        ) : null}

        <p className="drill-feedback" role="status" aria-live="polite">
          {state.status === 'success' ? '过关。' : state.status === 'failed' ? '未达成。' : ''}
        </p>

        <div className="mission-actions">
          {over ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => dispatch({ type: 'retry' })}
            >
              重试
            </button>
          ) : null}
          {state.status === 'success' && next !== undefined ? (
            <a className="btn" href={`#/mission/${next.id}`}>
              下一题
            </a>
          ) : null}
          <a className="btn" href="#/missions">
            回题目列表
          </a>
        </div>
      </section>
    </div>
  );
}

export interface MissionPageProps {
  readonly id: string;
}

export function MissionPage({ id }: MissionPageProps) {
  const mission = findMission(id);
  if (mission === undefined) {
    return (
      <div className="page page-mission">
        <p role="alert">找不到这道题。</p>
        <a className="back-link" href="#/missions">
          ← 对弈题
        </a>
      </div>
    );
  }
  return <MissionRunner key={mission.id} mission={mission} />;
}
