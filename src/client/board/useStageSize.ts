import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** 测量棋盘舞台的可用尺寸；布局变化只重算尺寸，不重挂载组件。 */
export function useStageSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const update = (): void => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
