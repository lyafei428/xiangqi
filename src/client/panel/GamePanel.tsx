// 对局面板：行棋方、状态播报、着法记录、新局。
// 面板只保留完成本地对局必需的控件，不加装饰性元素。

import { useEffect, useRef, useState } from 'react';
import type { Color, GameResult, Move } from '../../shared/index.ts';
import { formatClock, remainingOf } from '../../shared/index.ts';
import type { GameSession } from '../game/session.ts';
import { NotationInput } from './NotationInput.tsx';
import { resultLabel } from './result-text.ts';

export interface GamePanelProps {
  readonly session: GameSession;
  readonly open: boolean;
  readonly now: number;
  /** 模式标签：人机页传实际档位（「人机 · 普通」），对弈页沿用默认的本地双人。 */
  readonly modeLabel?: string;
  /** 认输需额外置灰时传 true（人机页：AI 回合玩家不能认输）。默认 false。 */
  readonly resignDisabled?: boolean;
  /** 记谱输入通道：不传时不渲染输入框（组件级用例没有页面可回调）。 */
  readonly onPlay?: (move: Move) => void;
  /** 记谱输入置灰：终局、人机页 AI 回合由页面判定后传入。默认 false。 */
  readonly notationDisabled?: boolean;
  /** 面板收起时按 `/`：先请页面展开，再由输入框接住焦点。 */
  readonly onRequestExpand?: () => void;
  readonly onToggle: () => void;
  readonly onReset: () => void;
  readonly onResign: () => void;
}

function colorName(color: Color): string {
  return color === 'red' ? '红方' : '黑方';
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'number',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
]);

/** 焦点已经在文本输入件里时不抢 `/`：用户在记谱框里敲 `/` 不该被打断。 */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  if (target.tagName !== 'INPUT') return false;
  return TEXT_INPUT_TYPES.has((target as HTMLInputElement).type);
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
  const {
    session,
    open,
    now,
    modeLabel = '本地双人',
    resignDisabled = false,
    onPlay,
    notationDisabled = false,
    onRequestExpand,
    onToggle,
    onReset,
    onResign,
  } = props;
  const movesRef = useRef<HTMLDivElement | null>(null);
  const rounds = toRounds(session.notations);
  const redMs = remainingOf(session.clock, 'red', now);
  const blackMs = remainingOf(session.clock, 'black', now);
  const over = session.result !== null;
  const notationOff = over || notationDisabled;
  // `/` 之后要交焦点的次数：收起态先等页面把面板展开，再递增这个计数。
  const [notationFocus, setNotationFocus] = useState(0);
  const [focusAfterExpand, setFocusAfterExpand] = useState(false);

  useEffect(() => {
    const element = movesRef.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  }, [session.notations.length]);

  useEffect(() => {
    if (!focusAfterExpand || !open) return;
    setFocusAfterExpand(false);
    setNotationFocus((value) => value + 1);
  }, [focusAfterExpand, open]);

  // 页面级 `/`：输入框在面板里，快捷键归面板管；面板收起时先请页面展开。
  useEffect(() => {
    if (onPlay === undefined) return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (notationOff || isTextField(event.target)) return;
      if (!open) {
        if (onRequestExpand === undefined) return;
        event.preventDefault();
        setFocusAfterExpand(true);
        onRequestExpand();
        return;
      }
      event.preventDefault();
      setNotationFocus((value) => value + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notationOff, onPlay, onRequestExpand, open]);

  return (
    <aside className="panel" aria-label="对局面板">
      <div className="panel-head">
        <h1 className="panel-title">中国象棋</h1>
        <span className="panel-mode">{modeLabel}</span>
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
          <button
            type="button"
            className="resign"
            onClick={onResign}
            disabled={over || resignDisabled}
          >
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

        {onPlay === undefined ? null : (
          <NotationInput
            position={session.position}
            disabled={notationOff}
            focusSignal={notationFocus}
            onPlay={onPlay}
          />
        )}

        <button type="button" className="new-game" onClick={onReset}>
          新局
        </button>
      </div>
    </aside>
  );
}
