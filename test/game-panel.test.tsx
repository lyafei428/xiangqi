// @vitest-environment jsdom
// 五种结局的可见文案。App 没有残局入口，胜负结局在组件层直接构造会话断言。

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GameResult } from '../src/shared/index.ts';
import type { GameSession } from '../src/client/game/session.ts';
import { createSession } from '../src/client/game/session.ts';
import { GamePanel } from '../src/client/panel/GamePanel.tsx';

afterEach(cleanup);

function sessionWith(result: GameResult): GameSession {
  return { ...createSession(), result };
}

function statusTextOf(result: GameResult): string {
  const view = render(
    <GamePanel session={sessionWith(result)} open onToggle={() => {}} onReset={() => {}} />,
  );
  const text = screen.getByRole('status').textContent ?? '';
  view.unmount();
  return text;
}

describe('对局结果文案', () => {
  it('将死显示胜方与「将死」', () => {
    expect(statusTextOf({ type: 'checkmate', winner: 'red' })).toContain('红方胜 · 将死');
  });

  it('困毙显示胜方与「困毙」', () => {
    expect(statusTextOf({ type: 'stalemate', winner: 'black' })).toContain('黑方胜 · 困毙');
  });

  it('长将显示胜方与「长将判负」', () => {
    expect(statusTextOf({ type: 'perpetual', winner: 'red' })).toContain('红方胜 · 长将判负');
  });

  it('三次重复显示和棋', () => {
    expect(statusTextOf({ type: 'repetition', winner: null })).toContain('和棋 · 三次重复局面');
  });

  it('自然限着显示和棋', () => {
    expect(statusTextOf({ type: 'natural', winner: null })).toContain('和棋 · 60 回合无吃子');
  });
});
