// 对局面板：行棋方、状态播报、着法记录、新局。
// 面板只保留完成本地对局必需的控件，不加装饰性元素。

import { useEffect, useRef } from 'react';
import type { Color, GameResult } from '../../shared/index.ts';
import type { GameSession } from '../game/session.ts';

export interface GamePanelProps {
  readonly session: GameSession;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onReset: () => void;
}

function colorName(color: Color): string {
  return color === 'red' ? '红方' : '黑方';
}

function winnerName(winner: Color | null): string {
  // 和棋类判罚 winner 为 null；胜负类判罚引擎一定给胜方。
  return winner === null ? '双方' : colorName(winner);
}

function resultText(result: GameResult): string {
  switch (result.type) {
    case 'checkmate':
      return `${winnerName(result.winner)}胜 · 将死`;
    case 'stalemate':
      return `${winnerName(result.winner)}胜 · 困毙`;
    case 'perpetual':
      return `${winnerName(result.winner)}胜 · 长将判负`;
    case 'repetition':
      return '和棋 · 三次重复局面';
    case 'natural':
      return '和棋 · 60 回合无吃子';
  }
}

function statusText(session: GameSession): string {
  if (session.result !== null) return resultText(session.result);
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
  const { session, open, onToggle, onReset } = props;
  const movesRef = useRef<HTMLDivElement | null>(null);
  const rounds = toRounds(session.notations);

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
