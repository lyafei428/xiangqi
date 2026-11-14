import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFen } from '../src/shared/index.ts';

// 内容里所有 FEN 都得是「规则上可能存在」的局面。
// 起因：课程与对弈题里出现过三辆车——引擎能算，但棋盘上多出来的那辆永远走不到，
// 学规则的人会照着记错。以后写题面先过这道闸。

const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));

const LIMIT: Record<string, number> = {
  K: 1, A: 2, B: 2, N: 2, R: 2, C: 2, P: 5,
  k: 1, a: 2, b: 2, n: 2, r: 2, c: 2, p: 5,
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function looksLikeFen(value: string): boolean {
  return /^[rnbakcpRNBAKCP1-9/]+ [a-z] /.test(value) && value.includes('/');
}

function collect(value: unknown, where: string, hits: { where: string; fen: string }[]): void {
  if (typeof value === 'string') {
    if (looksLikeFen(value)) hits.push({ where, fen: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, `${where}[${index}]`, hits));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collect(item, `${where}.${key}`, hits);
  }
}

const hits: { where: string; fen: string }[] = [];
for (const file of walk(CONTENT_DIR)) {
  collect(JSON.parse(readFileSync(file, 'utf8')) as unknown, file.slice(CONTENT_DIR.length), hits);
}

test('内容里的 FEN 都能被解析', () => {
  assert.ok(hits.length > 0, '没找到任何 FEN——扫描逻辑坏了');
  for (const { where, fen } of hits) {
    assert.doesNotThrow(() => parseFen(fen), `${where} 的 FEN 解析失败：${fen}`);
  }
});

test('内容里的局面不超过每方棋子存量', () => {
  for (const { where, fen } of hits) {
    const board = fen.split(' ')[0] ?? '';
    const counts = new Map<string, number>();
    for (const char of board) {
      if (/[1-9/]/.test(char)) continue;
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
    for (const [char, count] of counts) {
      const limit = LIMIT[char];
      assert.ok(limit !== undefined, `${where} 出现未知棋子 ${char}：${fen}`);
      assert.ok(
        count <= limit,
        `${where} 的 ${char} 有 ${count} 枚，超过上限 ${limit}：${fen}`,
      );
    }
  }
});

test('内容里的局面双方各有一个将帅', () => {
  for (const { where, fen } of hits) {
    const board = fen.split(' ')[0] ?? '';
    assert.equal((board.match(/K/g) ?? []).length, 1, `${where} 的红帅不是一枚：${fen}`);
    assert.equal((board.match(/k/g) ?? []).length, 1, `${where} 的黑将不是一枚：${fen}`);
  }
});
