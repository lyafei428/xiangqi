// 内容加载：索引与练习配置随壳一起进包，课文件按课拆包。
// 所有 JSON 在进入界面前先过 schema 校验。

import type { DrillConfig, DrillKind } from '../drills/generator.ts';
import type { LessonContent, LessonIndex } from './schema.ts';
import { validateLessonContent, validateLessonIndex } from './schema.ts';

const INDEX_KEY = '../../../content/lessons/index.json';
const DRILL_KEY = '../../../content/drills/default.json';

const indexModules = import.meta.glob<{ default: unknown }>(
  '../../../content/lessons/index.json',
  { eager: true },
);
const drillModules = import.meta.glob<{ default: unknown }>(
  '../../../content/drills/default.json',
  { eager: true },
);

const indexModule = indexModules[INDEX_KEY];
if (indexModule === undefined) throw new Error(`找不到课程索引：${INDEX_KEY}`);
export const lessonIndex: LessonIndex = validateLessonIndex(indexModule.default);

const DRILL_KINDS: readonly DrillKind[] = ['move-pattern', 'legality', 'position', 'notation'];

function readDrillConfig(raw: unknown): DrillConfig {
  if (typeof raw !== 'object' || raw === null) throw new Error('练习配置必须是对象');
  const record = raw as Record<string, unknown>;
  const kindsRaw = record.kinds;
  if (!Array.isArray(kindsRaw) || kindsRaw.length === 0) throw new Error('练习配置 kinds 不能为空');
  const kinds = kindsRaw.map((kind) => {
    const found = DRILL_KINDS.find((candidate) => candidate === kind);
    if (found === undefined) throw new Error(`练习配置未知题型：${String(kind)}`);
    return found;
  });
  const plies = record.plies as Record<string, unknown> | undefined;
  const attempts = record.attempts as Record<string, unknown> | undefined;
  if (plies === undefined || attempts === undefined) throw new Error('练习配置缺 plies / attempts');
  const min = plies.min;
  const max = plies.max;
  const hint = attempts.hint;
  const reveal = attempts.reveal;
  if (typeof min !== 'number' || typeof max !== 'number' || min < 0 || max < min) {
    throw new Error('练习配置 plies 非法');
  }
  if (typeof hint !== 'number' || typeof reveal !== 'number' || hint < 1 || reveal < hint) {
    throw new Error('练习配置 attempts 非法');
  }
  return { kinds, plies: { min, max }, attempts: { hint, reveal } };
}

const drillModule = drillModules[DRILL_KEY];
if (drillModule === undefined) throw new Error(`找不到练习配置：${DRILL_KEY}`);
export const drillConfig: DrillConfig = readDrillConfig(drillModule.default);

const lessonLoaders = import.meta.glob<{ default: unknown }>('../../../content/lessons/*.json');

export async function loadLesson(id: string): Promise<LessonContent> {
  const key = `../../../content/lessons/${id}.json`;
  const loader = lessonLoaders[key];
  if (loader === undefined) throw new Error(`找不到课程：${id}`);
  const module = await loader();
  return validateLessonContent(module.default, id);
}
