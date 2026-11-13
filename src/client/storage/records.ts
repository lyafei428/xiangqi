// 棋谱库与未完成对局：唯一碰 localStorage 的地方。
// 存储不可用（隐私模式、配额满）或内容损坏时一律降级为空表，不把异常抛给页面。

import type { GameRecord } from '../../shared/record.ts';
import { parseRecord } from '../../shared/record.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const RECORDS_KEY = 'xiangqi.records.v1';
const CURRENT_KEY = 'xiangqi.current.v1';

/** 隐私模式下连访问 localStorage 本身都会抛，所以整段包起来。 */
function defaultStore(): KeyValueStore | null {
  try {
    const store = (globalThis as { localStorage?: KeyValueStore }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

function readText(store: KeyValueStore | null, key: string): string | null {
  if (store === null) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeText(store: KeyValueStore | null, key: string, value: string): boolean {
  if (store === null) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeKey(store: KeyValueStore | null, key: string): void {
  if (store === null) return;
  try {
    store.removeItem(key);
  } catch {
    // 删不掉只意味着这条还在，读的时候会再校验一次，不影响主流程。
  }
}

export function listRecords(store: KeyValueStore | null = defaultStore()): GameRecord[] {
  const text = readText(store, RECORDS_KEY);
  if (text === null) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const records: GameRecord[] = [];
  for (const item of raw) {
    const record = parseRecord(JSON.stringify(item));
    if (record !== null && record.result !== null) records.push(record);
  }
  return records.sort((left, right) => right.savedAt - left.savedAt);
}

export function findRecord(
  id: number,
  store: KeyValueStore | null = defaultStore(),
): GameRecord | null {
  return listRecords(store).find((record) => record.id === id) ?? null;
}

export const MAX_RECORDS = 50;

function sameGame(left: GameRecord, right: GameRecord): boolean {
  if (left.startFen !== right.startFen || left.moves.length !== right.moves.length) return false;
  if (left.result?.type !== right.result?.type || left.result?.winner !== right.result?.winner) {
    return false;
  }
  return left.moves.every((move, index) => {
    const other = right.moves[index];
    return other !== undefined && other.from === move.from && other.to === move.to;
  });
}

/**
 * 存一条棋谱：id 缺省时取 savedAt，撞号就 +1 直到唯一；超过上限按 savedAt 丢最旧。
 * `dedupe` 用于自动存局：同一局（起始局面 + 着法 + 结果全同）已经在库里就不再写第二条，
 * 因为「每局只存一次」不能靠组件的挂载期记忆——切页、刷新都会重建组件。
 * 返回落盘后的记录（已存在时返回库里那条）；写入失败返回 null。
 */
export function saveRecord(
  record: GameRecord,
  store: KeyValueStore | null = defaultStore(),
  options: { readonly dedupe?: boolean } = {},
): GameRecord | null {
  const existing = listRecords(store);
  if (options.dedupe === true) {
    const found = existing.find((item) => sameGame(item, record));
    if (found !== undefined) return found;
  }
  const taken = new Set(existing.map((item) => item.id));
  let id = record.id ?? record.savedAt;
  while (taken.has(id)) id += 1;
  const saved: GameRecord = { ...record, id };
  const next = [saved, ...existing]
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(0, MAX_RECORDS);
  return writeText(store, RECORDS_KEY, JSON.stringify(next)) ? saved : null;
}

export function deleteRecord(
  id: number,
  store: KeyValueStore | null = defaultStore(),
): boolean {
  const next = listRecords(store).filter((record) => record.id !== id);
  return writeText(store, RECORDS_KEY, JSON.stringify(next));
}

export function loadCurrent(store: KeyValueStore | null = defaultStore()): GameRecord | null {
  const text = readText(store, CURRENT_KEY);
  if (text === null) return null;
  const record = parseRecord(text);
  return record !== null && record.result === null ? record : null;
}

export function saveCurrent(
  record: GameRecord,
  store: KeyValueStore | null = defaultStore(),
): boolean {
  return writeText(store, CURRENT_KEY, JSON.stringify(record));
}

export function clearCurrent(store: KeyValueStore | null = defaultStore()): void {
  removeKey(store, CURRENT_KEY);
}
