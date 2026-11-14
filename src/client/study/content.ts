// 棋谱库内容加载：单文件十几 KB，随主包一次进入，不额外发请求
// （课程按课切包是因为 22 课体积大；这里不值得为一个文件多一次往返）。
// 发布前的 test/study.test.ts 全量验过；运行时仍逐条过滤，一条坏的只丢它自己。

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
for (const raw of module.default) {
  const record = parseStudyRecord(raw);
  if (record === null || seen.has(record.id)) continue;
  seen.add(record.id);
  parsed.push(record);
}

export const studyRecords: readonly StudyRecord[] = parsed;

export type StudyFilter = StudyPhase | 'all';

export function studyRecordsOf(filter: StudyFilter): readonly StudyRecord[] {
  return filter === 'all' ? studyRecords : studyRecords.filter((record) => record.phase === filter);
}
