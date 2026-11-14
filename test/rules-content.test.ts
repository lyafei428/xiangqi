import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOVE_POINTS, OUT_OF_SCOPE, PENALTY_TABLE } from '../src/client/rules/content.ts';

// 判罚的真相在 docs/requirements/xiangqi.md §4；这里把页面内容与需求档逐行对齐。
// 只改一处不改另一处会红——页面与需求档无法静默漂移。

interface Row {
  readonly title: string;
  readonly penalty: string;
}

const REQUIREMENT = new URL('../docs/requirements/xiangqi.md', import.meta.url);

/** 需求 §4 的判罚表原文：[情形, 判罚]，顺序即表内顺序。 */
function requirementRows(): Row[] {
  const text = readFileSync(REQUIREMENT, 'utf8');
  const start = text.indexOf('## 4. 规则判罚口径');
  assert.ok(start >= 0, '需求档里找不到 §4 规则判罚口径');
  const rest = text.slice(start);
  const end = rest.indexOf('\n## ');
  const section = end < 0 ? rest : rest.slice(0, end);
  const rows: Row[] = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const title = cells[1];
    const penalty = cells[2];
    // 表头「情形 / 判罚」与分隔行 |---|---| 跳过。
    if (title === undefined || penalty === undefined || title === '情形' || /^-+$/.test(title)) continue;
    rows.push({ title, penalty });
  }
  return rows;
}

test('判罚口径与需求 §4 逐行一致（八条，顺序相同）', () => {
  assert.deepEqual(PENALTY_TABLE.rows, requirementRows());
});

test('八条判罚的标题与判罚文案逐条对上原话', () => {
  assert.equal(PENALTY_TABLE.rows.length, 8);
  assert.deepEqual(
    PENALTY_TABLE.rows.map((row) => row.title),
    [
      '将死（被将且无合法着法）',
      '困毙（未被将但无合法着法）',
      '长将（同一方在重复循环中每着都将军）',
      '三次重复局面',
      '连续 60 回合（120 着）无吃子',
      '超时（一方时钟归零）',
      '认输',
      '一方提议和棋、对方接受',
    ],
  );
  assert.deepEqual(
    PENALTY_TABLE.rows.map((row) => row.penalty),
    ['被将方负', '无着法方负', '长将方负', '和', '和', '归零方负', '认输方负', '和'],
  );
});

test('八条标题互不重复', () => {
  const titles = PENALTY_TABLE.rows.map((row) => row.title);
  assert.equal(new Set(titles).size, titles.length, `标题有重复：${titles.join(' / ')}`);
});

test('「不在 v1 范围内」一节写明长捉与一将一闲按上表简化处理', () => {
  assert.equal(OUT_OF_SCOPE.title, '不在 v1 范围内');
  const text = OUT_OF_SCOPE.items.join('\n');
  assert.ok(text.includes('长捉'), '这一节没写长捉');
  assert.ok(text.includes('一将一闲'), '这一节没写一将一闲');
  assert.ok(text.includes('按上表简化处理'), '这一节没写「按上表简化处理」');
});

test('走法要点五条，各自成句', () => {
  assert.equal(MOVE_POINTS.title, '走法要点');
  assert.equal(MOVE_POINTS.items.length, 5);
  const text = MOVE_POINTS.items.join('\n');
  for (const keyword of ['马走日', '象走田', '炮隔子吃', '兵过河可横走', '将帅不出九宫']) {
    assert.ok(text.includes(keyword), `走法要点缺「${keyword}」`);
  }
});
