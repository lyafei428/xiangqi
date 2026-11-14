// 把「棋局变了」翻译成「响哪一声」。
// 只读两个观测点：着法数变了就响一着，结果从无到有就响终局——
// 不监听点击：AI 走子、联机收快照走的都是同一条路，一处判断全覆盖。
//
// 注意：**每份 session 都要自己挂一次**。对弈页的 session 在 App，人机页的在 AiPage，
// 联机页的在 OnlinePage——只在 App 挂过一次，其余两页就永远没有声音（踩过）。

import { useEffect, useRef } from 'react';
import type { HistoryEntry, GameResult } from '../../shared/index.ts';
import { classify, createSoundPlayer } from './sound.ts';
import type { SoundPlayer } from './sound.ts';

/**
 * 音效只认这两样：着法记录与结果。
 * 写成结构类型而不是直接收 `GameSession`——联机页的快照不是 session，
 * 用 `replayHistory` 还原出同样的形状就能共用这一处判断。
 */
export interface SoundSource {
  readonly history: readonly HistoryEntry[];
  readonly result: GameResult | null;
}

export function useGameSound(source: SoundSource | null, enabled: boolean): void {
  const playerRef = useRef<SoundPlayer | null>(null);
  // 基线取挂载时的着法数：从存档恢复的对局一上来就有历史，从 0 起算会漏掉第一着。
  const lastMovesRef = useRef<number>(source?.history.length ?? 0);
  const lastResultRef = useRef<GameResult | null>(source?.result ?? null);

  // 播放器是个薄壳（真正的 AudioContext 是模块级单例），所以卸载时不需要收尾：
  // 关掉上下文会让 StrictMode 的第二次挂载拿不到可用的音频，这正是「都不响」的根因。
  useEffect(() => {
    playerRef.current = createSoundPlayer();
  }, []);

  useEffect(() => {
    const moves = source?.history.length ?? 0;
    const result = source?.result ?? null;
    const previousMoves = lastMovesRef.current;
    const previousResult = lastResultRef.current;
    lastMovesRef.current = moves;
    lastResultRef.current = result;

    if (!enabled) return;
    const player = playerRef.current;
    if (player === null) return;

    // 终局：结果从无到有（将死、认输、超时、判和都走这里）。
    if (result !== null && previousResult === null) {
      player.play('end');
      return;
    }

    // 新局或回退：着法清零、着法变少都不响——那不是「走了一着」。
    if (moves !== previousMoves + 1) return;
    const entry = source?.history[moves - 1];
    if (entry === undefined) return;
    player.play(classify(entry, null));
  }, [source, enabled]);
}
