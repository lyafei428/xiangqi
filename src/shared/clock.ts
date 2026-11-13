// 包干时钟：每方剩余毫秒 + 在走方 + 计时锚点。纯函数，不碰 DOM / Node API。
// 剩余一律由 now − since 算出，不存第二套累计值。

import type { Color } from './types.ts';

export const CLOCK_MS = 600_000;

export interface ClockState {
  readonly redMs: number;
  readonly blackMs: number;
  readonly running: Color | null;
  /** 计时锚点（毫秒时间戳），只在开新局与切边时更新。 */
  readonly since: number;
}

function other(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

export function createClock(now: number, perSide = CLOCK_MS): ClockState {
  return { redMs: perSide, blackMs: perSide, running: 'red', since: now };
}

/** 按存的剩余建时钟：续局时用，锚点取恢复时刻，关页期间不扣时。 */
export function clockFrom(
  redMs: number,
  blackMs: number,
  running: Color | null,
  now: number,
): ClockState {
  return { redMs: Math.max(0, redMs), blackMs: Math.max(0, blackMs), running, since: now };
}

export function remainingOf(clock: ClockState, color: Color, now: number): number {
  const base = color === 'red' ? clock.redMs : clock.blackMs;
  if (clock.running !== color) return Math.max(0, base);
  return Math.max(0, base - Math.max(0, now - clock.since));
}

/** 扣掉在走方到 now 的用时，换边，锚点置 now。 */
export function switchClock(clock: ClockState, now: number): ClockState {
  const running = clock.running;
  if (running === null) return clock;
  const left = remainingOf(clock, running, now);
  return {
    redMs: running === 'red' ? left : clock.redMs,
    blackMs: running === 'black' ? left : clock.blackMs,
    running: other(running),
    since: now,
  };
}

/** 终局：扣时后停表。 */
export function stopClock(clock: ClockState, now: number): ClockState {
  const running = clock.running;
  if (running === null) return clock;
  const left = remainingOf(clock, running, now);
  return {
    redMs: running === 'red' ? left : clock.redMs,
    blackMs: running === 'black' ? left : clock.blackMs,
    running: null,
    since: now,
  };
}

/** 在走方剩余为 0 时返回该方，否则 null。 */
export function timeoutColor(clock: ClockState, now: number): Color | null {
  const running = clock.running;
  if (running === null) return null;
  return remainingOf(clock, running, now) <= 0 ? running : null;
}

/** 面板显示：mm:ss。 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
