// @vitest-environment jsdom
// 八种结局的可见文案与模式标签。App 没有残局入口，胜负结局在组件层直接构造会话断言。

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GameResult } from '../src/shared/index.ts';
import type { GameSession } from '../src/client/game/session.ts';
import { createSession, sessionReducer } from '../src/client/game/session.ts';
import { GamePanel } from '../src/client/panel/GamePanel.tsx';
import { resultTone } from '../src/client/panel/result-text.ts';

afterEach(cleanup);

function sessionWith(result: GameResult): GameSession {
  return { ...createSession(), result };
}

function statusTextOf(result: GameResult): string {
  const view = render(
    <GamePanel
      session={sessionWith(result)}
      open
      now={Date.now()}
      onToggle={() => {}}
      onReset={() => {}}
      onStart={() => {}}
      onResign={() => {}}
    />,
  );
  // 取面板顶部状态行：面板里可能还有记谱提示行（同样是 role="status"），
  // getByRole 单匹配会在那里抛错。
  const text = view.container.querySelector('.status-line')?.textContent ?? '';
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

  it('超时显示胜方与「超时」', () => {
    expect(statusTextOf({ type: 'timeout', winner: 'black' })).toContain('黑方胜 · 超时');
  });

  it('认输显示胜方与「认输」', () => {
    expect(statusTextOf({ type: 'resign', winner: 'red' })).toContain('红方胜 · 认输');
  });

  it('双方同意显示和棋', () => {
    expect(statusTextOf({ type: 'agreement', winner: null })).toContain('和棋 · 双方同意');
  });
});

describe('结果着色', () => {
  it('胜方决定颜色归属：红胜红字、黑胜黑字、和棋留蓝', () => {
    expect(resultTone({ type: 'checkmate', winner: 'red' })).toBe('red');
    expect(resultTone({ type: 'checkmate', winner: 'black' })).toBe('black');
    // 和棋没有胜方，走 draw 这一档（样式里保留蓝色强调）。
    expect(resultTone({ type: 'repetition', winner: null })).toBe('draw');
  });
});

describe('模式标签', () => {
  function renderPanel(modeLabel?: string): void {
    render(
      <GamePanel
        session={sessionReducer(createSession(), { type: 'start', now: Date.now() })}
        open
        now={Date.now()}
        modeLabel={modeLabel}
        onToggle={() => {}}
        onReset={() => {}}
        onStart={() => {}}
        onResign={() => {}}
      />,
    );
  }

  it('不传时仍是「本地双人」', () => {
    renderPanel();
    expect(screen.getByText('本地双人')).toBeTruthy();
  });

  it('人机页的档位按 prop 渲染', () => {
    renderPanel('人机 · 高手');
    expect(screen.getByText('人机 · 高手')).toBeTruthy();
    expect(screen.queryByText('本地双人')).toBeNull();
  });

  it('resignDisabled 置灰认输按钮，默认不置灰', () => {
    // 开局先按「开始」才走表，认输按钮也是开始后才在。
    const started = sessionReducer(createSession(), { type: 'start', now: Date.now() });
    render(
      <GamePanel
        session={started}
        open
        now={Date.now()}
        onToggle={() => {}}
        onReset={() => {}}
        onStart={() => {}}
        onResign={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: '认输' })).not.toHaveProperty('disabled', true);
    cleanup();
    render(
      <GamePanel
        session={started}
        open
        now={Date.now()}
        resignDisabled
        onToggle={() => {}}
        onReset={() => {}}
        onStart={() => {}}
        onResign={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: '认输' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
