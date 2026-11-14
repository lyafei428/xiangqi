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

interface Voice {
  readonly from: number;
  readonly to: number;
  readonly ms: number;
  readonly wave: OscillatorType;
  readonly gain: number;
  readonly delayMs: number;
}

const VOICES: Readonly<Record<SoundKind, readonly Voice[]>> = {
  // 落子：短促的「嗒」。gain 比其余三音高一档——用户反馈落子声偏小，
  // 而落子是每局听得最多的一下，宁可它压过别的。
  move: [{ from: 660, to: 440, ms: 60, wave: 'triangle', gain: 0.26, delayMs: 0 }],
  // 吃子：更低更重；方波比三角硬，听感像「啪」。
  capture: [{ from: 240, to: 180, ms: 110, wave: 'square', gain: 0.16, delayMs: 0 }],
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

/**
 * 全局单例：整页一个 AudioContext，不随组件卸载关闭。
 *
 * 踩过的坑：原先在组件 effect 里创建、卸载时 `close()`。StrictMode 下挂在 mount→unmount→mount
 * 之间就把它关掉了，接下来那次 `play()` 只能在**手势之外**新建一个，浏览器直接判 `suspended`——
 * 表面看「代码跑了、振荡器也建了」，实际一点声音都没有。
 */
let context: AudioContext | null = null;
let priming = false;

function audioCtor(): typeof AudioContext | null {
  const scope = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (context !== null) return context;
  const Ctor = audioCtor();
  if (Ctor === null) return null;
  try {
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
}

/**
 * 在手势里把音频上下文点着：resume() 之外再播一个静音样本。
 * 只 resume 不给节点，Safari 与部分 Chromium 会保持 suspended——「建了不响」就是这么来的。
 */
function prime(): void {
  const audio = ensureContext();
  if (audio === null) return;
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  if (priming) return;
  priming = true;
  try {
    const buffer = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start(0);
  } catch {
    // 点不着就算了，下一次手势还会再试。
  } finally {
    priming = false;
  }
}

/** 每一次真实手势都试一次，直到上下文真的跑起来——一次性监听会让一次失败变成永久哑。 */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
let listenersBound = false;

function bindUnlock(): void {
  if (listenersBound) return;
  listenersBound = true;
  for (const name of GESTURES) {
    globalThis.addEventListener?.(name, prime, { passive: true });
  }
}

export interface SoundPlayer {
  play(kind: SoundKind): void;
}

export function createSoundPlayer(): SoundPlayer {
  bindUnlock();
  return {
    play(kind: SoundKind): void {
      const audio = ensureContext();
      if (audio === null) return;
      if (audio.state === 'suspended') {
        // 已经有过手势就点火；还没有就等下一次手势（prime 会再点一次）。
        void audio.resume().catch(() => undefined);
      }
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
  };
}

/** 当前音频上下文是否真的在跑；给界面一个可观察的读数（不是业务结果，只是诊断）。 */
export function soundContextState(): string {
  if (context === null) return 'none';
  return context.state;
}
