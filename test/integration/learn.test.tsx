// @vitest-environment jsdom
// 集成用例 F2-1：从 App 入口进课程，读到讲解，点下一步让棋盘走出该步。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';

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

describe('F2-1 课程演示可播放', () => {
  beforeEach(() => {
    goto('#/learn');
  });

  it('课程目录进入单课，下一步后棋盘走出该步', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '课程' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /棋盘与棋子/ }));

    await screen.findByRole('heading', { name: '棋盘与棋子' });
    expect(screen.getByText('起始局面')).toBeTruthy();
    expect(screen.getByText('棋盘')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('红车沿竖线直走两步。')).toBeTruthy();

    const labels = Array.from(document.querySelectorAll('.piece')).map((piece) =>
      piece.getAttribute('aria-label'),
    );
    expect(labels).toContain('红方车，第 5 列第 3 行');

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));
    const labelsBack = Array.from(document.querySelectorAll('.piece')).map((piece) =>
      piece.getAttribute('aria-label'),
    );
    expect(labelsBack).toContain('红方车，第 5 列第 5 行');
  });
});
