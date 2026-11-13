// 棋谱库与未完成对局的读写：容量淘汰、撞号、损坏内容与写入失败。

import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FEN } from '../src/shared/index.ts';
import type { GameRecord } from '../src/shared/record.ts';
import {
  clearCurrent,
  deleteRecord,
  findRecord,
  listRecords,
  loadCurrent,
  saveCurrent,
  saveRecord,
} from '../src/client/storage/records.ts';
import type { KeyValueStore } from '../src/client/storage/records.ts';

interface FakeStore extends KeyValueStore {
  readonly data: Map<string, string>;
  failOnWrite: boolean;
}

function fakeStore(): FakeStore {
  const data = new Map<string, string>();
  return {
    data,
    failOnWrite: false,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.failOnWrite) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function record(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: null,
    startFen: INITIAL_FEN,
    moves: [{ from: 10, to: 19 }],
    result: { type: 'resign', winner: 'black' },
    redMs: 600_000,
    blackMs: 600_000,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

test('存一条再读回：id 取 savedAt，按时间倒序', () => {
  const store = fakeStore();
  const first = saveRecord(record({ savedAt: 1_000 }), store);
  const second = saveRecord(record({ savedAt: 2_000 }), store);
  assert.equal(first?.id, 1_000);
  assert.equal(second?.id, 2_000);
  assert.deepEqual(
    listRecords(store).map((item) => item.id),
    [2_000, 1_000],
  );
  assert.equal(findRecord(1_000, store)?.savedAt, 1_000);
  assert.equal(findRecord(999, store), null);
});

test('同一毫秒存两条：id 撞号时 +1', () => {
  const store = fakeStore();
  const one = saveRecord(record({ savedAt: 5_000 }), store);
  const two = saveRecord(record({ savedAt: 5_000 }), store);
  assert.equal(one?.id, 5_000);
  assert.equal(two?.id, 5_001);
  assert.equal(listRecords(store).length, 2);
});

test('超过 50 条丢最旧的', () => {
  const store = fakeStore();
  for (let index = 0; index < 55; index += 1) {
    saveRecord(record({ savedAt: 1_000 + index }), store);
  }
  const list = listRecords(store);
  assert.equal(list.length, 50);
  assert.equal(list[0]?.savedAt, 1_054);
  assert.equal(list.at(-1)?.savedAt, 1_005);
});

test('删除只删指定一条', () => {
  const store = fakeStore();
  saveRecord(record({ savedAt: 1_000 }), store);
  saveRecord(record({ savedAt: 2_000 }), store);
  deleteRecord(1_000, store);
  assert.deepEqual(
    listRecords(store).map((item) => item.id),
    [2_000],
  );
});

test('同一局重复存：dedupe 不再写第二条', () => {
  const store = fakeStore();
  const one = saveRecord(record({ savedAt: 1_000 }), store, { dedupe: true });
  const two = saveRecord(record({ savedAt: 9_000 }), store, { dedupe: true });
  assert.equal(listRecords(store).length, 1);
  assert.equal(two?.id, one?.id);

  // 关掉 dedupe 就允许同一局再存一条（导入用）。
  saveRecord(record({ savedAt: 9_000 }), store);
  assert.equal(listRecords(store).length, 2);
});

test('超上限按 savedAt 丢最旧，不是按写入次序', () => {
  const store = fakeStore();
  for (let index = 0; index < 50; index += 1) {
    saveRecord(record({ savedAt: 10_000 + index }), store);
  }
  // 导入一条比全库都旧的：被丢的应该是它自己，而不是比它新的那条。
  saveRecord(record({ savedAt: 1_000 }), store);
  const list = listRecords(store);
  assert.equal(list.length, 50);
  assert.equal(list.at(-1)?.savedAt, 10_000);
  assert.equal(list.some((item) => item.savedAt === 1_000), false);
});

test('删除返回是否真的写进去了', () => {
  const store = fakeStore();
  saveRecord(record({ savedAt: 1_000 }), store);
  assert.equal(deleteRecord(1_000, store), true);
  store.failOnWrite = true;
  assert.equal(deleteRecord(2_000, store), false);
});

test('坏 JSON 与坏条目视为空表', () => {
  const store = fakeStore();
  store.data.set('xiangqi.records.v1', '{oops');
  assert.deepEqual(listRecords(store), []);
  store.data.set('xiangqi.records.v1', JSON.stringify([{ nope: 1 }, record({ savedAt: 9_000 })]));
  assert.equal(listRecords(store).length, 1);
  store.data.set('xiangqi.records.v1', JSON.stringify([record({ savedAt: 9_000 })]));
  assert.equal(listRecords(store).length, 1);
});

test('写入失败不抛给页面：返回 null 或 false', () => {
  const store = fakeStore();
  store.failOnWrite = true;
  assert.equal(saveRecord(record(), store), null);
  assert.equal(saveCurrent(record({ result: null }), store), false);
  assert.deepEqual(listRecords(store), []);
});

test('未完成局：存取与清除', () => {
  const store = fakeStore();
  const current = record({ result: null, id: null, redMs: 500_000, blackMs: 400_000 });
  assert.equal(saveCurrent(current, store), true);
  assert.deepEqual(loadCurrent(store), current);
  clearCurrent(store);
  assert.equal(loadCurrent(store), null);
});

test('未完成局里存了终局记录时不当续局读', () => {
  const store = fakeStore();
  store.data.set('xiangqi.current.v1', JSON.stringify(record()));
  assert.equal(loadCurrent(store), null);
});

test('没有存储（Node 环境）时全部降级为空', () => {
  assert.deepEqual(listRecords(null), []);
  assert.equal(loadCurrent(null), null);
  assert.equal(saveRecord(record(), null), null);
  assert.equal(saveCurrent(record({ result: null }), null), false);
  deleteRecord(1, null);
  clearCurrent(null);
});
