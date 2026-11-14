// 棋谱库内容加载：单文件十几 KB，随主包一次进入，不额外发请求
// （课程按课切包是因为 22 课体积大；这里不值得为一个文件多一次往返）。
// 发布前的 test/study.test.ts 全量验过；运行时不再逐条丢弃：内容坏了就是发布流程破了，
// 应当当场看见，而不是让列表悄悄少一条（少了的那条没人会去追）。

import type { StudyPhase, StudyRecord } from '../../shared/study.ts';
import { parseStudyRecord } from '../../shared/study.ts';

const KEY = '../../../content/games/index.json';
const modules = import.meta.glob<{ default: unknown }>('../../../content/games/index.json', {
  eager: true,
});
const module = modules[KEY];
if (module === undefined) throw new Error(`找不到棋谱库内容：${KEY}`);
if (!Array.isArray(module.default)) throw new Error('棋谱库内容必须是数组');

const parsed: StudyRecord[] = [];
const seen = new Set<string>();
for (const [index, raw] of module.default.entries()) {
  const record = parseStudyRecord(raw);
  if (record === null) throw new Error(`棋谱库第 ${index + 1} 条解析失败：内容校验没过`);
  if (seen.has(record.id)) throw new Error(`棋谱库 id 重复：${record.id}`);
  seen.add(record.id);
  parsed.push(record);
}

export const studyRecords: readonly StudyRecord[] = parsed;

export type StudyFilter = StudyPhase | 'all';

export function studyRecordsOf(filter: StudyFilter): readonly StudyRecord[] {
  return filter === 'all' ? studyRecords : studyRecords.filter((record) => record.phase === filter);
}
