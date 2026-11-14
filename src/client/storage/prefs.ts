// 界面偏好：着法区展开过没有、配色跟哪一档。
// 语义：着法区第一次进来收起（只显示棋盘与常驻条），用户点开一次就记住，
// 之后无论切页回来还是重开浏览器都保持展开；用户主动收起则记住收起。
// 配色：auto 跟系统，light / dark 是用户明确选的；读不出来一律 auto。
// 存储不可用（隐私模式、配额满）时一律按缺省处理，不把异常抛给页面。

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PANEL_KEY = 'xiangqi.panel-open.v1';
const THEME_KEY = 'xiangqi.theme.v1';
const SOUND_KEY = 'xiangqi.sound.v1';

/** 配色偏好：auto 跟系统，其余两档是用户明确选的。 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

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

/** 配色偏好。读不出来一律按 auto：跟系统走，不会让用户看到一个他没选过的配色。 */
export function readTheme(store: KeyValueStore | null = defaultStore()): ThemeChoice {
  if (store === null) return 'auto';
  try {
    const value = store.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeTheme(choice: ThemeChoice, store: KeyValueStore | null = defaultStore()): void {
  if (store === null) return;
  try {
    store.setItem(THEME_KEY, choice);
  } catch {
    // 同上：存不下只影响下次进来，不影响这一局。
  }
}

/** 走子音效是否开。缺省开：有声音的对局才像在落子；读不出来也按开处理。 */
export function readSound(store: KeyValueStore | null = defaultStore()): boolean {
  if (store === null) return true;
  try {
    return store.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeSound(on: boolean, store: KeyValueStore | null = defaultStore()): void {
  if (store === null) return;
  try {
    store.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    // 存不下只影响下次进来，不影响这一局。
  }
}

/**
 * 把配色落到 <html data-theme>：CSS 只认这一个属性，不需要两套选择器各写一份令牌。
 * auto 时按系统偏好解析成 light / dark，并跟着系统变化重算。
 */
export function applyTheme(choice: ThemeChoice, media: MediaQueryList | null = prefersLight()): 'light' | 'dark' {
  const resolved: 'light' | 'dark' =
    choice === 'auto' ? (media?.matches === true ? 'light' : 'dark') : choice;
  const root = globalThis.document?.documentElement;
  if (root !== undefined) root.dataset.theme = resolved;
  return resolved;
}

function prefersLight(): MediaQueryList | null {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: light)') ?? null;
  } catch {
    return null;
  }
}
