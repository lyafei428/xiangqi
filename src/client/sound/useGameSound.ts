// 把「棋局变了」翻译成「响哪一声」。
// 只读 session 的两个观测点：着法数变了就响一着，结果从无到有就响终局——
// 不监听点击：AI 走子、联机收快照走的都是同一条路，一处判断全覆盖。

import { useEffect, useRef } from 'react';
import type { GameSession } from '../game/session.ts';
import { classify, createSoundPlayer } from './sound.ts';
import type { SoundPlayer } from './sound.ts';

export function useGameSound(session: GameSession, enabled: boolean): void {
  const playerRef = useRef<SoundPlayer | null>(null);
  const lastMovesRef = useRef(0);
  const lastResultRef = useRef<GameSession['result']>(null);

  // 播放器是个薄壳（真正的 AudioContext 是模块级单例），所以卸载时不需要收尾：
  // 关掉上下文会让 StrictMode 的第二次挂载拿不到可用的音频，这正是「都不响」的根因。
  useEffect(() => {
    playerRef.current = createSoundPlayer();
  }, []);

  useEffect(() => {
    const moves = session.history.length;
    const previousMoves = lastMovesRef.current;
    const previousResult = lastResultRef.current;
    lastMovesRef.current = moves;
    lastResultRef.current = session.result;

    if (!enabled) return;
    const player = playerRef.current;
    if (player === null) return;

    // 终局：结果从无到有（将死、认输、超时、判和都走这里）。
    if (session.result !== null && previousResult === null) {
      player.play('end');
      return;
    }

    // 新局或回退：着法清零、着法变少都不响——那不是「走了一着」。
    if (moves !== previousMoves + 1) return;
    const entry = session.history[moves - 1];
    if (entry === undefined) return;
    player.play(classify(entry, null));
  }, [session, enabled]);
}
