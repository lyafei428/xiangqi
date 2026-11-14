// 每步胜率：把静态评估值标定成红方期望分（胜 1、和 0.5、负 0）。
// 只做「局面 → 期望分」这一跳，不跑搜索：每走一着一趟浅层搜索在实时对局里是可感延迟，
// 而搜索给出的「几步内必胜」也不是这一栏要显示的东西——这里只给一条走势。

import type { GameResult, Position } from '../types.ts';
import { evaluate } from './evaluate.ts';

/**
 * 标定常数：分差 400 分 → 91%，一车 900 分 → 99%，一兵 100 分 → 64%。
 * 「差一子约九成」与象棋残局的常识量级一致；标定只此一处，调档也只改这里。
 */
export const EVAL_SCALE = 400;

/**
 * 红方期望分（0..1）。
 *
 * `evaluate` 的出口是行棋方视角，先按 `turn` 换回红方视角再标定——
 * 红黑两列、四个页面读的是同一个口径，不会因为「谁在走」变成两份判断。
 *
 * `result` 非空表示这一刻已经终局，按结果收敛：红胜 1、黑胜 0、和棋 0.5。
 * 结果必须由调用方给：和棋来自三次重复 / 自然限着 / 协议和棋，认输与超时也不是棋盘状态，
 * 一个 `Position` 推不出这些。除终局那一着外一律传 null，否则整列都会贴到一端。
 */
export function redExpectation(position: Position, result: GameResult | null = null): number {
  if (result !== null) {
    if (result.winner === null) return 0.5;
    return result.winner === 'red' ? 1 : 0;
  }
  const score = position.turn === 'red' ? evaluate(position) : -evaluate(position);
  return 1 / (1 + 10 ** (-score / EVAL_SCALE));
}
