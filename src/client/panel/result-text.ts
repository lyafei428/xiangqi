// 结局文案：面板、联机页、棋谱页共用一套，新增结局只改这里。

import type { Color, GameResult, ResultType } from '../../shared/index.ts';

const REASON: Readonly<Record<ResultType, string>> = {
  checkmate: '将死',
  stalemate: '困毙',
  perpetual: '长将判负',
  repetition: '三次重复局面',
  natural: '60 回合无吃子',
  timeout: '超时',
  resign: '认输',
  agreement: '双方同意',
};

function sideName(color: Color): string {
  return color === 'red' ? '红方' : '黑方';
}

export function resultLabel(result: GameResult): string {
  // 和棋类判罚 winner 为 null；胜负类判罚引擎一定给胜方。
  const head = result.winner === null ? '和棋' : `${sideName(result.winner)}胜`;
  return `${head} · ${REASON[result.type]}`;
}
