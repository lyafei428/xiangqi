// 把联机快照的着法列表还原成一份 `HistoryEntry[]`。
// 为什么需要：音效靠 `HistoryEntry` 的 `captured` / `gaveCheck` 判定，
// 而服务端只发 `moveLog`（坐标）与 `startFen`——重放一遍才能拿到同样的字段。
// 纯函数：从起始局面起，逐着重放，不改入参。

import { parseFen, playMove } from '../../shared/index.ts';
import type { HistoryEntry, Move } from '../../shared/index.ts';

/**
 * 重放失败（快照与起始局面不自洽）时返回空记录：
 * 声音是附加反馈，不是业务结果——棋盘用的是 `snapshot.fen`，不依赖这里；
 * 为一段音效把整页打崩，比没声音糟得多。
 */
export function replayHistory(startFen: string, moves: readonly Move[]): readonly HistoryEntry[] {
  try {
    let position = parseFen(startFen);
    let history: readonly HistoryEntry[] = [];
    for (const move of moves) {
      const played = playMove(position, history, move);
      position = played.position;
      history = played.history;
    }
    return history;
  } catch {
    return [];
  }
}
