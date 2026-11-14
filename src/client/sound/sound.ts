// 走子音效：现场合成，不引音频文件。
// 为什么不放 mp3：需求 F5.2 卡着「请求数 ≤ 6」，四段音频就是四条请求，还要进 service worker 缓存；
// 合成零请求、零体积、离线天然可用。音色朴素是代价，换成录制样本只改这个文件。

import type { GameResult, HistoryEntry } from '../../shared/index.ts';

export type SoundKind = 'move' | 'capture' | 'check' | 'end';

/**
 * 该响哪个：终局压过一切，其次将军，其次吃子，其余落子。
 *
 * 判据不自己算——`HistoryEntry` 里已经记着 `captured` 与 `gaveCheck`（规则层走完那一刻写的），
 * 这里再拿局面比一遍就是第二份真相，两边迟早不同步。
 */
export function classify(entry: HistoryEntry, result: GameResult | null): SoundKind {
  if (result !== null) return 'end';
  if (entry.gaveCheck) return 'check';
  if (entry.captured) return 'capture';
  return 'move';
}

/** 一个音色的最小描述：起点频率、终点频率、时长、波形、音量、相对上一层延后多少毫秒。 */
interface Voice {
  readonly from: number;
  readonly to: number;
  readonly ms: number;
  readonly wave: OscillatorType;
  readonly gain: number;
  readonly delayMs: number;
}

const VOICES: Readonly<Record<SoundKind, readonly Voice[]>> = {
  // 落子：短促的「嗒」。
  move: [{ from: 660, to: 440, ms: 60, wave: 'triangle', gain: 0.12, delayMs: 0 }],
  // 吃子：更低更重；方波比三角硬，听感像「啪」。
  capture: [{ from: 240, to: 180, ms: 110, wave: 'square', gain: 0.1, delayMs: 0 }],
  // 将军：两音上行，第二音压后 100ms。
  check: [
    { from: 660, to: 660, ms: 90, wave: 'sine', gain: 0.12, delayMs: 0 },
    { from: 990, to: 990, ms: 110, wave: 'sine', gain: 0.12, delayMs: 100 },
  ],
  // 终局：三个音同时按下，慢衰减。
  end: [
    { from: 523, to: 523, ms: 400, wave: 'sine', gain: 0.1, delayMs: 0 },
    { from: 659, to: 659, ms: 400, wave: 'sine', gain: 0.08, delayMs: 0 },
    { from: 784, to: 784, ms: 400, wave: 'sine', gain: 0.06, delayMs: 0 },
  ],
};

export interface SoundPlayer {
  play(kind: SoundKind): void;
  dispose(): void;
}

/**
 * 懒建 AudioContext：不在页面加载时创建，避免浏览器把「自动播放」拦在门外。
 * 任何异常都吞掉——声音是可听反馈，不是业务结果，丢了不影响胜负与记录。
 */
export function createSoundPlayer(): SoundPlayer {
  let context: AudioContext | null = null;
  let unlocked = false;

  const ensure = (): AudioContext | null => {
    if (context !== null) return context;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (Ctor === undefined) return null;
    try {
      context = new Ctor();
      return context;
    } catch {
      return null;
    }
  };

  const unlock = (): void => {
    const audio = ensure();
    if (audio === null || unlocked) return;
    // Safari 与 Chrome 的自动播放策略：创建后是 suspended，要一次真实手势才肯出声。
    void audio.resume().catch(() => undefined);
    unlocked = true;
  };
  globalThis.addEventListener?.('pointerdown', unlock, { once: true, passive: true });
  globalThis.addEventListener?.('keydown', unlock, { once: true });

  return {
    play(kind: SoundKind): void {
      const audio = ensure();
      if (audio === null) return;
      if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
      try {
        const start = audio.currentTime;
        for (const voice of VOICES[kind]) {
          const at = start + voice.delayMs / 1000;
          const oscillator = audio.createOscillator();
          const amp = audio.createGain();
          oscillator.type = voice.wave;
          oscillator.frequency.setValueAtTime(voice.from, at);
          if (voice.to !== voice.from) {
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, voice.to), at + voice.ms / 1000);
          }
          // 指数衰减到接近零：线性归零会「啪」一声截断，听起来像爆音。
          amp.gain.setValueAtTime(voice.gain, at);
          amp.gain.exponentialRampToValueAtTime(0.0001, at + voice.ms / 1000);
          oscillator.connect(amp).connect(audio.destination);
          oscillator.start(at);
          oscillator.stop(at + voice.ms / 1000);
        }
      } catch {
        // 放不出来就算了：声音不该把一局棋搞挂。
      }
    },
    dispose(): void {
      globalThis.removeEventListener?.('pointerdown', unlock);
      globalThis.removeEventListener?.('keydown', unlock);
      if (context !== null) void context.close().catch(() => undefined);
      context = null;
    },
  };
}
