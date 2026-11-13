// 对弈题的类型、校验与自证。题面是人工构造的局面，答案由判杀器回算。

import type { Color } from '../../shared/index.ts';
import { isInCheck, parseFen } from '../../shared/index.ts';
import type { Mission } from './types.ts';
import {
  findDefenseMoves,
  findMatingMoves,
  hasMateIn,
  hasMateInOneThreat,
} from './mate.ts';

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${where} 必须是非空字符串`);
  }
  return value;
}

const TYPES: readonly Mission['type'][] = ['find-mate', 'attack', 'defense'];

export function validateMission(raw: unknown, index: number): Mission {
  const where = `对弈题[${index}]`;
  const record = asRecord(raw, where);
  const type = asString(record.type, `${where}.type`);
  if (!TYPES.includes(type as Mission['type'])) {
    throw new Error(`${where}.type 未知：${type}`);
  }
  const plies = record.plies;
  if (typeof plies !== 'number' || !Number.isInteger(plies) || plies < 1 || plies > 2) {
    throw new Error(`${where}.plies 必须是 1 或 2`);
  }
  const mission: Mission = {
    id: asString(record.id, `${where}.id`),
    type: type as Mission['type'],
    lesson: asString(record.lesson, `${where}.lesson`),
    title: asString(record.title, `${where}.title`),
    fen: asString(record.fen, `${where}.fen`),
    plies,
    source: asString(record.source, `${where}.source`),
    hint: asString(record.hint, `${where}.hint`),
  };
  try {
    parseFen(mission.fen);
  } catch (error) {
    throw new Error(`${where}.fen 非法：${String(error)}`);
  }
  if (mission.type === 'find-mate' && mission.plies !== 1) {
    throw new Error(`${where} 找杀题 plies 必须为 1`);
  }
  if (mission.type === 'defense' && mission.plies !== 1) {
    throw new Error(`${where} 防守题 plies 必须为 1`);
  }
  return mission;
}

/** 自证：题面必须真的可解；不可解抛错。 */
export function verifyMission(mission: Mission): void {
  const position = parseFen(mission.fen);
  const player: Color = position.turn;
  if (mission.type === 'find-mate') {
    if (findMatingMoves(position).length === 0) {
      throw new Error(`对弈题 ${mission.id} 没有一步杀`);
    }
    return;
  }
  if (mission.type === 'attack') {
    if (!hasMateIn(position, mission.plies)) {
      throw new Error(`对弈题 ${mission.id} 在 ${mission.plies} 着内没有强制杀`);
    }
    return;
  }
  if (!hasMateInOneThreat(position, player)) {
    throw new Error(`对弈题 ${mission.id} 开局并没有「对手一着杀」的威胁`);
  }
  if (isInCheck(position, player)) {
    throw new Error(`对弈题 ${mission.id} 防守题开局不能让玩家处于被将军状态`);
  }
  if (findDefenseMoves(position, player).length === 0) {
    throw new Error(`对弈题 ${mission.id} 没有可化解的着法`);
  }
}
