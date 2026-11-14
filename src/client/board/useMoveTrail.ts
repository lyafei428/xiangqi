// 走子轨迹的开关：和音效同一套共享 store——多个页面要读同一个值。

import { useSyncExternalStore } from 'react';
import { readMoveTrail, writeMoveTrail } from '../storage/prefs.ts';

let enabled = readMoveTrail();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setMoveTrailEnabled(next: boolean): void {
  enabled = next;
  writeMoveTrail(next);
  emit();
}

export function moveTrailEnabled(): boolean {
  return enabled;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMoveTrailEnabled(): boolean {
  return useSyncExternalStore(subscribe, moveTrailEnabled, moveTrailEnabled);
}
