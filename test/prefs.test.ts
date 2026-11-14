// 界面偏好与配色的失败路径：隐私模式/配额满时存储会抛，界面必须照常工作。
// 这条用例的存在理由：设计档曾写「存储不可用按未展开处理」却没有任何可复现的观察点，
// 评审据此判了「分支无场景」。这里把那个场景钉成可执行的一行。

import test from 'node:test';
import assert from 'node:assert/strict';
import type { KeyValueStore } from '../src/client/storage/prefs.ts';
import { applyTheme, readMoveTrail, readPanelOpen, readSound, readTheme, writeMoveTrail, writePanelOpen, writeSound, writeTheme } from '../src/client/storage/prefs.ts';

/** 隐私模式下的存储：连读都会抛。 */
const throwingStore: KeyValueStore = {
  getItem() {
    throw new Error('SecurityError: 存储被禁用');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { readonly data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

test('存储不可用：读一律退回缺省，写不抛', () => {
  assert.equal(readPanelOpen(throwingStore), false, '着法区按收起处理');
  assert.equal(readTheme(throwingStore), 'auto', '配色按跟随系统处理');
  assert.equal(readSound(throwingStore), true, '音效按开处理');
  assert.equal(readMoveTrail(throwingStore), true, '走子轨迹按开处理');
  assert.doesNotThrow(() => writePanelOpen(true, throwingStore));
  assert.doesNotThrow(() => writeTheme('dark', throwingStore));
  assert.doesNotThrow(() => writeSound(false, throwingStore));
  assert.doesNotThrow(() => writeMoveTrail(false, throwingStore));
});

test('没有存储（隐私模式下连 localStorage 都取不到）同样是缺省', () => {
  assert.equal(readPanelOpen(null), false);
  assert.equal(readTheme(null), 'auto');
  assert.equal(readSound(null), true);
});

test('存过的值读得回来，坏值退回缺省', () => {
  const store = memoryStore({ 'xiangqi.panel-open.v1': '1', 'xiangqi.theme.v1': 'light' });
  assert.equal(readPanelOpen(store), true);
  assert.equal(readTheme(store), 'light');

  const junk = memoryStore({ 'xiangqi.panel-open.v1': 'yes', 'xiangqi.theme.v1': '紫色' });
  assert.equal(readPanelOpen(junk), false);
  assert.equal(readTheme(junk), 'auto');

  const noTrail = memoryStore({ 'xiangqi.trail.v1': '0' });
  assert.equal(readMoveTrail(noTrail), false, '关过就记住');
  writeMoveTrail(true, noTrail);
  assert.equal(readMoveTrail(noTrail), true);

  const muted = memoryStore({ 'xiangqi.sound.v1': '0' });
  assert.equal(readSound(muted), false, '关过就记住');
  writeSound(true, muted);
  assert.equal(readSound(muted), true);
});

test('三档落地：auto 跟系统，明确档位压过系统', () => {
  const light = { matches: true } as unknown as MediaQueryList;
  const dark = { matches: false } as unknown as MediaQueryList;

  assert.equal(applyTheme('auto', light), 'light');
  assert.equal(applyTheme('auto', dark), 'dark');
  // 用户明确选了，就不再听系统。
  assert.equal(applyTheme('dark', light), 'dark');
  assert.equal(applyTheme('light', dark), 'light');
});
