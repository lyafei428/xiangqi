// 音效开关的共享状态：对弈页与人机页各有一份 session，两处都要能读到同一个开关。
// 用 useSyncExternalStore 的最小实现——不引状态管理框架（项目约定）。

import { useSyncExternalStore } from 'react';
import { readSound, writeSound } from '../storage/prefs.ts';

let enabled = readSound();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setSoundEnabled(next: boolean): void {
  enabled = next;
  writeSound(next);
  emit();
}

export function soundEnabled(): boolean {
  return enabled;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 组件侧读开关：开关一变，所有挂了这个 hook 的页面一起重渲染。 */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, soundEnabled, soundEnabled);
}
