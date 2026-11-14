// 对坐下棋：两个人在一台机器上面对面，黑方棋子倒转。默认开，设置里可关。

import { useSyncExternalStore } from 'react';
import { readFaceOff, writeFaceOff } from '../storage/prefs.ts';

let enabled = readFaceOff();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setFaceOffEnabled(next: boolean): void {
  enabled = next;
  writeFaceOff(next);
  emit();
}

export function faceOffEnabled(): boolean {
  return enabled;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFaceOffEnabled(): boolean {
  return useSyncExternalStore(subscribe, faceOffEnabled, faceOffEnabled);
}
