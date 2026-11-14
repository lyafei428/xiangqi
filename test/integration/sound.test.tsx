// @vitest-environment jsdom
// F5-6 集成行：从对弈页真走一着与一次认输，数「响了几次」。
// 断言只取业务可观察结果（响几声、开关是否记住），不查合成参数。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/client/App.tsx';

// jsdom 没有 ResizeObserver，与其它页面用例同一套桩。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/** 记录每一次振荡器起振：一个音一个振荡器，数它就是数「响了几声」。 */
class FakeAudioContext {
  static starts = 0;
  state = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator(): OscillatorNode {
    const fake = {
      type: 'sine',
      frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => fake,
      start: () => {
        FakeAudioContext.starts += 1;
      },
      stop: () => undefined,
    };
    return fake as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    const fake = {
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => fake,
    };
    return fake as unknown as GainNode;
  }

  createBuffer(channels: number, length: number, rate: number): AudioBuffer {
    return { length, sampleRate: rate, numberOfChannels: channels } as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    const fake = {
      buffer: null,
      connect: () => fake,
      start: () => undefined,
    };
    return fake as unknown as AudioBufferSourceNode;
  }
}

/** 在记谱框里走一着。 */
function playMove(notation: string): void {
  const input = screen.getByLabelText('记谱输入');
  fireEvent.change(input, { target: { value: notation } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('F5-6 走子音效：走子与认输各响一次', () => {
  beforeEach(() => {
    (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    FakeAudioContext.starts = 0;
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
  });

  it('走一着响一声，认输响三声（终局三音）；关掉后不再响', () => {
    render(<App />);
    // 开局先按「开始」：表不走也不影响发声，但按钮与状态行要先到位。
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    playMove('炮二平五');
    expect(FakeAudioContext.starts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: '认输' }));
    expect(FakeAudioContext.starts).toBe(4);
  });

  it('关掉音效再走子不响，重开页面仍是关', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    // 设置浮层里的「音效开」按一下变成关
    fireEvent.click(screen.getByText('设置'));
    fireEvent.click(screen.getByRole('button', { name: /音效开/ }));

    playMove('炮二平五');
    expect(FakeAudioContext.starts).toBe(0);
    expect(window.localStorage.getItem('xiangqi.sound.v1')).toBe('0');

    cleanup();
    render(<App />);
    // 重开页面：开关读回来仍是关
    fireEvent.click(screen.getByText('设置'));
    expect(screen.getByRole('button', { name: /音效关/ })).toBeTruthy();
  });
});
