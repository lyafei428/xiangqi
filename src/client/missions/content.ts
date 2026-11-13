// 对弈题加载：一次全量读入，逐题做结构校验与自证。

import type { Mission } from './types.ts';
import { validateMission, verifyMission } from './schema.ts';

const KEY = '../../../content/missions/index.json';
const modules = import.meta.glob<{ default: unknown }>(
  '../../../content/missions/index.json',
  { eager: true },
);
const module = modules[KEY];
if (module === undefined) throw new Error(`找不到对弈题：${KEY}`);
if (!Array.isArray(module.default)) throw new Error('对弈题必须是数组');

export const missions: readonly Mission[] = module.default.map((raw, index) => {
  const mission = validateMission(raw, index);
  verifyMission(mission);
  return mission;
});

export const missionsByLesson: ReadonlyMap<string, Mission> = new Map(
  missions.map((mission) => [mission.lesson, mission]),
);

export function findMission(id: string): Mission | undefined {
  return missions.find((mission) => mission.id === id);
}
