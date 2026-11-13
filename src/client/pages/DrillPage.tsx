// 练习页：四类判定题，作答、判分、提示与答案。

import { useMemo, useReducer, useRef, useState } from 'react';
import { parseFen } from '../../shared/index.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import type { BoardMark } from '../board/layers.tsx';
import { useStageSize } from '../board/useStageSize.ts';
import { drillConfig } from '../learn/content.ts';
import type { DrillKind } from '../drills/generator.ts';
import { generateDrill } from '../drills/generator.ts';
import { answerText, createDrillSession, drillReducer } from '../drills/session.ts';
import type { Route } from '../shell/routes.ts';
import { routeHash } from '../shell/routes.ts';

const KIND_LABEL: Readonly<Record<DrillKind, string>> = {
  'move-pattern': '走法题',
  legality: '合法性题',
  position: '局面题',
  notation: '记谱题',
};

export interface DrillPageProps {
  readonly route: Extract<Route, { name: 'drill' }>;
}

export function DrillPage({ route }: DrillPageProps) {
  const [fallbackSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const seed = route.seed ?? fallbackSeed;
  const kinds = drillConfig.kinds;
  const kind: DrillKind = route.kind ?? kinds[seed % kinds.length] ?? 'legality';
  const drill = useMemo(() => generateDrill(kind, seed, drillConfig), [kind, seed]);
  const [state, dispatch] = useReducer(drillReducer, drill, (initial) =>
    createDrillSession(initial, drillConfig.attempts),
  );
  const position = useMemo(() => parseFen(drill.fen), [drill.fen]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height);
  const revealed = state.status === 'revealed';
  const finished = state.status !== 'answering';

  const targetAnswer = drill.answer.kind === 'targets' ? drill.answer : null;
  const marks: BoardMark[] = [];
  if (targetAnswer !== null) {
    if (state.status === 'answering') {
      for (const square of state.selected) marks.push({ square, kind: 'select' });
    } else {
      for (const square of targetAnswer.targets) marks.push({ square, kind: 'correct' });
      for (const square of state.selected) {
        if (!targetAnswer.targets.includes(square)) marks.push({ square, kind: 'wrong' });
      }
    }
  }

  const correctOptionId = drill.answer.kind === 'choice' ? drill.answer.optionId : null;

  const feedback =
    state.status === 'correct'
      ? `答对了。${drill.explanation}`
      : revealed
        ? `${answerText(state)} ${drill.explanation}`
        : state.hintShown
          ? `提示：${drill.hint}`
          : state.wrongAttempts > 0
            ? '再试一次。'
            : '';

  const next = (): void => {
    const nextSeed = (seed + 1 + Math.floor(Math.random() * 100_000)) % 1_000_000_000;
    window.location.hash = routeHash({ name: 'drill', seed: nextSeed, kind });
  };

  const canSubmit = state.status === 'answering' && (targetAnswer === null ? state.choice !== null : state.selected.length > 0);

  return (
    <div className="page page-drill">
      <main className="board-stage drill-board">
        <div className="board-fit" ref={stageRef}>
          <div className="board-slot">
            <Board
              mode={{ kind: 'drill', side: position.turn }}
              size={size}
              position={position}
              selection={
                drill.markedSquare === null
                  ? undefined
                  : { selected: drill.markedSquare, targets: [] }
              }
              lastMove={drill.highlight}
              marks={marks}
              onTap={
                targetAnswer === null
                  ? undefined
                  : (square) => dispatch({ type: 'toggle', square })
              }
            />
          </div>
        </div>
      </main>

      <section className="drill-panel" aria-label="练习">
        <h1 className="drill-title">练习 · {KIND_LABEL[kind]}</h1>
        <a className="mission-entry" href="#/missions">
          对弈题 · 杀法练习 →
        </a>
        <p className="drill-question">{drill.question}</p>

        {targetAnswer === null ? (
          <div className="drill-options">
            {drill.options.map((option) => {
              const className =
                correctOptionId === option.id && (state.status === 'correct' || revealed)
                  ? 'option is-correct'
                  : state.choice === option.id && revealed && correctOptionId !== option.id
                    ? 'option is-wrong'
                    : state.choice === option.id
                      ? 'option is-chosen'
                      : 'option';
              return (
                <button
                  key={option.id}
                  type="button"
                  className={className}
                  disabled={finished}
                  onClick={() => dispatch({ type: 'choose', optionId: option.id })}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="drill-hint">在棋盘上点选这枚子能走到的格子，选好后提交。</p>
        )}

        {finished ? null : (
          <button
            type="button"
            className="btn primary"
            disabled={!canSubmit}
            onClick={() => dispatch({ type: 'submit' })}
          >
            提交
          </button>
        )}

        <p className="drill-feedback" role="status" aria-live="polite">
          {feedback}
        </p>

        {finished ? (
          <button type="button" className="btn primary" onClick={next}>
            下一题
          </button>
        ) : null}
      </section>
    </div>
  );
}
