import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 测量棋盘舞台的可用尺寸；布局变化只重算尺寸，不重挂载组件。
 *
 * 每次渲染都重新看一眼元素：舞台可能在条件分支里才出现（联机页先渲染大厅、建房后才渲染棋盘），
 * 只在挂载时挂一次 ResizeObserver，那些页面的尺寸就永远停在 0——棋盘缩成 2×2（踩过）。
 */
export function useStageSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      // 元素还没出现：把尺寸归零，等它出现时下面这一支会重新量。
      setSize((previous) => (previous.width === 0 && previous.height === 0 ? previous : { width: 0, height: 0 }));
      return;
    }
    const update = (): void => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      setSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  });

  return size;
}
