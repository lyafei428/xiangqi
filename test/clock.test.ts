import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOCK_MS,
  createClock,
  formatClock,
  remainingOf,
  stopClock,
  switchClock,
  timeoutColor,
} from '../src/shared/index.ts';

test('开新局：双方 10 分钟，红方在走，锚点为 now', () => {
  const clock = createClock(1000);
  assert.equal(clock.redMs, CLOCK_MS);
  assert.equal(clock.blackMs, CLOCK_MS);
  assert.equal(clock.running, 'red');
  assert.equal(clock.since, 1000);
  assert.equal(CLOCK_MS, 600_000);
});

test('剩余时间：只在走方扣时，另一方原样', () => {
  const clock = createClock(0);
  assert.equal(remainingOf(clock, 'red', 5_000), 595_000);
  assert.equal(remainingOf(clock, 'black', 5_000), 600_000);
});

test('切边：扣掉在走方用时，换边并更新锚点', () => {
  const clock = createClock(0);
  const next = switchClock(clock, 1_000);
  assert.equal(next.redMs, 599_000);
  assert.equal(next.blackMs, 600_000);
  assert.equal(next.running, 'black');
  assert.equal(next.since, 1_000);
  assert.equal(remainingOf(next, 'black', 1_500), 599_500);
});

test('归零：在走方剩余为 0 时判超时，换边后不再判', () => {
  const clock = createClock(0);
  assert.equal(timeoutColor(clock, 599_999), null);
  assert.equal(timeoutColor(clock, 600_000), 'red');

  const switched = switchClock(clock, 600_000);
  assert.equal(timeoutColor(switched, 700_000), null);
  assert.equal(remainingOf(switched, 'black', 700_000), 500_000);
});

test('停表：扣时后 running 为 null，之后不再走也不再判超时', () => {
  const clock = createClock(0);
  const stopped = stopClock(clock, 2_000);
  assert.equal(stopped.running, null);
  assert.equal(stopped.redMs, 598_000);
  assert.equal(remainingOf(stopped, 'red', 60_000), 598_000);
  assert.equal(timeoutColor(stopped, 999_999), null);
});

test('显示：mm:ss，不足一秒进一', () => {
  assert.equal(formatClock(600_000), '10:00');
  assert.equal(formatClock(61_000), '01:01');
  assert.equal(formatClock(900), '00:01');
  assert.equal(formatClock(0), '00:00');
});
