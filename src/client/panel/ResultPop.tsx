// 结局提示：终局时把结果放大到棋盘中央停 2 秒，再缩回面板状态行原处。
//
// 为什么要这一段：终局最该被看见的一句话是「谁赢了」，而它原先只在面板里，
// 棋盘大、面板窄，赢了的人往往还在盯棋盘。放大会把视线拉回来；
// 停 2 秒再缩回原处，是为了交还位置——提示消失后，同一句话仍在原处可查。

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { GameResult } from '../../shared/index.ts';
import { resultLabel } from './result-text.ts';

/** 放大停留时长：短了看不清，长了挡着复盘。 */
const HOLD_MS = 3000;
/** 缩回去的时长：够看出「它飞去了状态行」，又不拖沓。 */
const FLY_MS = 420;

interface Flight {
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
}

/** 系统开了「减少动态效果」就只停不飞：位移对前庭敏感的人不友好。 */
function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

export function ResultPop({ result }: { result: GameResult | null }): ReactElement | null {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [gone, setGone] = useState(true);
  // 落在棋盘中央，而不是视口中央：宽屏右侧有面板，视口中心会压在棋盘边上。
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // 一局结束就重来一遍：result 换对象即视为新终局。
  useEffect(() => {
    if (result === null) {
      setGone(true);
      setFlight(null);
      return;
    }
    setGone(false);
    setFlight(null);
    setPlace(boardCenter());

    const reduced = prefersReducedMotion();
    const toFly = window.setTimeout(() => {
      if (reduced) {
        setGone(true);
        return;
      }
      setFlight(measureFlight(popRef.current));
    }, HOLD_MS);
    const toClear = window.setTimeout(() => setGone(true), HOLD_MS + FLY_MS);
    return () => {
      window.clearTimeout(toFly);
      window.clearTimeout(toClear);
    };
  }, [result]);

  if (result === null || gone) return null;

  return (
    <div
      ref={popRef}
      className={`result-pop${flight === null ? '' : ' is-flying'}`}
      style={{
        ...(place === null ? {} : { left: place.left, top: place.top }),
        ...(flight === null
          ? {}
          : {
              transform: `translate(-50%, -50%) translate(${String(flight.dx)}px, ${String(flight.dy)}px) scale(${String(flight.scale)})`,
              opacity: 0,
            }),
      }}
      // 状态行已经用 role="status" 播报过同一句话，这里再播一次会让读屏重复。
      aria-hidden="true"
    >
      {resultLabel(result)}
    </div>
  );
}

/** 棋盘矩形的中心；量不到就退回视口中心（页面刚挂载时可能还没有棋盘）。 */
function boardCenter(): { left: number; top: number } | null {
  const board = document.querySelector('.board');
  if (board === null) return null;
  const box = board.getBoundingClientRect();
  if (box.width === 0) return null;
  return { left: box.left + box.width / 2, top: box.top + box.height / 2 };
}

/**
 * 量出「从棋盘中央缩到状态行」的位移与缩放。
 * 量不到目标（状态行不在页上、或面板收起）就返回 null：原地淡出，不做假动画。
 */
function measureFlight(pop: HTMLElement | null): Flight | null {
  if (pop === null) return null;
  const line = document.querySelector('.status-line');
  if (line === null) return null;
  const from = pop.getBoundingClientRect();
  const to = line.getBoundingClientRect();
  if (from.height === 0 || to.height === 0) return null;
  // 状态行里还有圆点与内边距，按文字高度缩会偏小；取行高的一档作为落点字号。
  const scale = Math.min(1, (to.height * 0.8) / from.height);
  return {
    dx: to.left + to.width / 2 - (from.left + from.width / 2),
    dy: to.top + to.height / 2 - (from.top + from.height / 2),
    scale,
  };
}
