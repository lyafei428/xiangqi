// 对局面板：行棋方、状态播报、着法记录、新局。
// 面板只保留完成本地对局必需的控件，不加装饰性元素。

import { useEffect, useRef } from 'react';
import type { Color, GameResult } from '../../shared/index.ts';
import { formatClock, remainingOf } from '../../shared/index.ts';
import type { GameSession } from '../game/session.ts';
import { resultLabel } from './result-text.ts';

export interface GamePanelProps {
  readonly session: GameSession;
  readonly open: boolean;
  readonly now: number;
  readonly onToggle: () => void;
  readonly onReset: () => void;
  readonly onResign: () => void;
}

function colorName(color: Color): string {
  return color === 'red' ? '红方' : '黑方';
}

function statusText(session: GameSession): string {
  if (session.result !== null) return resultLabel(session.result);
  const side = colorName(session.position.turn);
  if (session.status === 'check') return `${side}被将军`;
  // 从自定义起始局面进来时可能一开始就是终局，结果判定还没跑过。
  if (session.status === 'checkmate') return `${side}被将死`;
  if (session.status === 'stalemate') return `${side}无着可走`;
  return `${side}走棋`;
}

interface RoundRow {
  readonly no: number;
  readonly red: string;
  readonly black: string;
}

function toRounds(notations: readonly string[]): RoundRow[] {
  const rounds: RoundRow[] = [];
  for (let index = 0; index < notations.length; index += 2) {
    rounds.push({
      no: index / 2 + 1,
      red: notations[index] ?? '',
      black: notations[index + 1] ?? '',
    });
  }
  return rounds;
}

export function GamePanel(props: GamePanelProps) {
  const { session, open, now, onToggle, onReset, onResign } = props;
  const movesRef = useRef<HTMLDivElement | null>(null);
  const rounds = toRounds(session.notations);
  const redMs = remainingOf(session.clock, 'red', now);
  const blackMs = remainingOf(session.clock, 'black', now);
  const over = session.result !== null;

  useEffect(() => {
    const element = movesRef.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  }, [session.notations.length]);

  return (
    <aside className="panel" aria-label="对局面板">
      <div className="panel-head">
        <h1 className="panel-title">中国象棋</h1>
        <span className="panel-mode">本地双人</span>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-controls="game-panel-body"
          onClick={onToggle}
        >
          {open ? '收起' : '展开'}
        </button>
      </div>
      <div className="panel-body" id="game-panel-body">
        <p
          className={`status-line${session.result === null ? '' : ' is-result'}`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`turn-dot ${session.result === null ? `turn-${session.position.turn}` : 'turn-over'}`}
            aria-hidden="true"
          />
          {statusText(session)}
        </p>

        <div className="clock-row" aria-label="双方用时">
          <span className={`clock clock-red${redMs < 60_000 ? ' is-low' : ''}`}>
            红 {formatClock(redMs)}
          </span>
          <span className={`clock clock-black${blackMs < 60_000 ? ' is-low' : ''}`}>
            黑 {formatClock(blackMs)}
          </span>
          <button type="button" className="resign" onClick={onResign} disabled={over}>
            认输
          </button>
        </div>

        <div className="moves" ref={movesRef} aria-label="着法记录">
          {rounds.length === 0 ? (
            <p className="moves-empty">尚未走子</p>
          ) : (
            <ol className="moves-list">
              {rounds.map((round) => (
                <li className="move-row" key={round.no}>
                  <span className="move-no">{round.no}.</span>
                  <span className="move-red">{round.red}</span>
                  <span className="move-black">{round.black}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <button type="button" className="new-game" onClick={onReset}>
          新局
        </button>
      </div>
    </aside>
  );
}
