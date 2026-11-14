// @vitest-environment jsdom
// 集成用例 F4-2：导航点「规则」进规则页，八条判罚与 v1 范围声明可见，再点「对弈」回得去。

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

beforeEach(() => {
  window.location.hash = '#/play';
});

function clickNav(label: string): void {
  fireEvent.click(screen.getByRole('link', { name: label }));
}

/** 需求 §4 的八行，按表内顺序：[情形, 判罚]。 */
const PENALTIES: readonly (readonly [string, string])[] = [
  ['将死（被将且无合法着法）', '被将方负'],
  ['困毙（未被将但无合法着法）', '无着法方负'],
  ['长将（同一方在重复循环中每着都将军）', '长将方负'],
  ['三次重复局面', '和'],
  ['连续 60 回合（120 着）无吃子', '和'],
  ['超时（一方时钟归零）', '归零方负'],
  ['认输', '认输方负'],
  ['一方提议和棋、对方接受', '和'],
];

describe('F4-2 规则页', () => {
  it('点导航「规则」进页面，八条判罚与范围声明可见；再点「对弈」回得去', async () => {
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('红方走棋');

    clickNav('规则');
    await screen.findByRole('heading', { name: '规则' });

    // 八行判罚逐条可见：每一行的可见文字就是「情形 + 判罚」。
    const rows = Array.from(screen.getByRole('table').querySelectorAll('tbody tr')).map(
      (row) => row.textContent ?? '',
    );
    expect(rows).toEqual(PENALTIES.map(([title, penalty]) => `${title}${penalty}`));

    expect(
      screen.getByText('长捉、一将一闲等复杂判罚不在 v1 范围内，按上表简化处理。'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: '不在 v1 范围内' })).toBeTruthy();

    clickNav('对弈');
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('红方走棋');
    expect(screen.queryByRole('heading', { name: '规则' })).toBeNull();
  });
});
