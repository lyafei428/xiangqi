// @vitest-environment jsdom
// 集成用例 F3-1：练习页作答判分；错三次给答案。
// 题目由固定种子生成，测试用同一生成器回算答案。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';
import { generateDrill } from '../../src/client/drills/generator.ts';
import { drillConfig } from '../../src/client/learn/content.ts';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(cleanup);

function goto(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
}

function drillAtSeed(seed: number) {
  const drill = generateDrill('legality', seed, drillConfig);
  const answer = drill.answer;
  if (answer.kind !== 'choice') throw new Error('合法性题必须是选择题');
  const correct = drill.options.find((option) => option.id === answer.optionId);
  const wrong = drill.options.find((option) => option.id !== answer.optionId);
  if (correct === undefined || wrong === undefined) throw new Error('选项缺失');
  return { correct: correct.label, wrong: wrong.label };
}

describe('F3-1 判定题作答与判分', () => {
  beforeEach(() => {
    goto('#/drill?seed=7&kind=legality');
  });

  it('答对显示判分', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '练习 · 合法性题' });
    const { correct } = drillAtSeed(7);
    fireEvent.click(screen.getByRole('button', { name: correct }));
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(screen.getByRole('status').textContent).toContain('答对了');
  });

  it('错三次给出答案', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '练习 · 合法性题' });
    const { wrong } = drillAtSeed(7);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: wrong }));
      fireEvent.click(screen.getByRole('button', { name: '提交' }));
    }
    expect(screen.getByRole('status').textContent).toContain('正确答案');
  });
});
