// 界面偏好：目前只有一条——着法区展开过没有。
// 语义：第一次进来收起（只显示棋盘与常驻条），用户点开一次就记住，
// 之后无论切页回来还是重开浏览器都保持展开；用户主动收起则记住收起。
// 存储不可用（隐私模式、配额满）时一律按「未展开」处理，不把异常抛给页面。

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PANEL_KEY = 'xiangqi.panel-open.v1';

/** 隐私模式下连访问 localStorage 本身都会抛，所以整段包起来。 */
function defaultStore(): KeyValueStore | null {
  try {
    const store = (globalThis as { localStorage?: KeyValueStore }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

/** 着法区是否展开。缺省与任何读不出来的情况都按收起。 */
export function readPanelOpen(store: KeyValueStore | null = defaultStore()): boolean {
  if (store === null) return false;
  try {
    return store.getItem(PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

export function writePanelOpen(open: boolean, store: KeyValueStore | null = defaultStore()): void {
  if (store === null) return;
  try {
    store.setItem(PANEL_KEY, open ? '1' : '0');
  } catch {
    // 存不下就算了：下一次进来按第一次处理，功能本身不受影响。
  }
}
