import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Mission } from '../src/client/missions/types.ts';
import { validateMission, verifyMission } from '../src/client/missions/schema.ts';
import {
  findMatingMoves,
  hasMateIn,
  hasMateInOneThreat,
} from '../src/client/missions/mate.ts';
import {
  createMissionSession,
  missionReducer,
} from '../src/client/missions/session.ts';
import {
  INITIAL_FEN,
  applyMove,
  generateLegalMoves,
  parseFen,
  playMove,
} from '../src/shared/index.ts';

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../content/missions/index.json', import.meta.url)), 'utf8'),
) as unknown;
if (!Array.isArray(raw)) throw new Error('对弈题必须是数组');
const missions: Mission[] = raw.map((item, index) => validateMission(item, index));

test('8 道对弈题，每道都通过自证', () => {
  assert.equal(missions.length, 8);
  for (const mission of missions) verifyMission(mission);
});

test('每课至少关联一道题', () => {
  const lessons = new Set(missions.map((mission) => mission.lesson));
  assert.equal(lessons.size, 8);
});

test('一步杀：找杀题都能找到将死着', () => {
  const findMates = missions.filter((mission) => mission.type === 'find-mate');
  assert.ok(findMates.length >= 3);
  for (const mission of findMates) {
    assert.ok(findMatingMoves(parseFen(mission.fen)).length > 0, mission.id);
  }
});

test('攻杀题：两步杀对所有应着都成立', () => {
  const attack = missions.find((mission) => mission.type === 'attack' && mission.plies === 2);
  if (attack === undefined) throw new Error('缺少两步杀题');
  const position = parseFen(attack.fen);
  assert.equal(hasMateIn(position, 1), false);
  assert.equal(hasMateIn(position, 2), true);
  // 逐个应着回算：存在某一着，使对手所有应着后都还有一步杀。
  for (const move of generateLegalMoves(position)) {
    const after = applyMove(position, move);
    if (hasMateIn(position, 2) && generateLegalMoves(after).length === 0) continue;
    let allLose = true;
    for (const reply of generateLegalMoves(after)) {
      if (findMatingMoves(applyMove(after, reply)).length === 0) {
        allLose = false;
        break;
      }
    }
    if (allLose) return;
  }
  throw new Error('没有找到强制杀的第一着');
});

test('防守题：开局确有对手一着杀，且存在化解', () => {
  for (const mission of missions.filter((item) => item.type === 'defense')) {
    const position = parseFen(mission.fen);
    assert.equal(hasMateInOneThreat(position, position.turn), true, mission.id);
  }
});

test('对手正在被将时没有「一着杀」', () => {
  const position = parseFen('3k5/9/9/9/9/3R5/9/9/9/4K4 b - - 0 1');
  assert.equal(hasMateInOneThreat(position, 'red'), false);
});

test('初始局面没有两步杀', () => {
  assert.equal(hasMateIn(parseFen(INITIAL_FEN), 2), false);
});

test('找杀会话：走对即通过', () => {
  const mission = missions[0];
  if (mission === undefined) throw new Error('缺少题目');
  const mate = findMatingMoves(parseFen(mission.fen))[0];
  if (mate === undefined) throw new Error('没有将死着');
  let session = createMissionSession(mission);
  session = missionReducer(session, { type: 'select', square: mate.from });
  session = missionReducer(session, { type: 'tap', square: mate.to });
  assert.equal(session.status, 'success');
});

test('找杀会话：走错判失败，重试复位', () => {
  const mission = missions.find((item) => item.type === 'find-mate');
  if (mission === undefined) throw new Error('缺少找杀题');
  const position = parseFen(mission.fen);
  const mating = new Set(findMatingMoves(position).map((move) => `${move.from}-${move.to}`));
  const wrong = generateLegalMoves(position).find(
    (move) => !mating.has(`${move.from}-${move.to}`),
  );
  if (wrong === undefined) throw new Error('没有非杀着法');
  let session = createMissionSession(mission);
  session = missionReducer(session, { type: 'select', square: wrong.from });
  session = missionReducer(session, { type: 'tap', square: wrong.to });
  assert.equal(session.status, 'failed');
  session = missionReducer(session, { type: 'retry' });
  assert.equal(session.status, 'playing');
  assert.equal(session.attempts, 1);
  assert.equal(session.game.position.board.join(','), parseFen(mission.fen).board.join(','));
});

test('攻杀会话：走完两步杀，引擎应着后仍能杀', () => {
  const mission = missions.find((item) => item.type === 'attack' && item.plies === 2);
  if (mission === undefined) throw new Error('缺少两步杀题');
  const position = parseFen(mission.fen);
  // 找出第一着：走完后对手所有应着都还有一步杀。
  const first = generateLegalMoves(position).find((move) => {
    const after = applyMove(position, move);
    const replies = generateLegalMoves(after);
    return replies.length > 0 && replies.every((reply) => findMatingMoves(applyMove(after, reply)).length > 0);
  });
  if (first === undefined) throw new Error('没有强制杀第一着');
  let session = createMissionSession(mission);
  session = missionReducer(session, { type: 'select', square: first.from });
  session = missionReducer(session, { type: 'tap', square: first.to });
  assert.equal(session.status, 'playing');
  assert.equal(session.game.position.turn, session.player);
  const mate = findMatingMoves(session.game.position)[0];
  if (mate === undefined) throw new Error('第二着没有将死');
  session = missionReducer(session, { type: 'select', square: mate.from });
  session = missionReducer(session, { type: 'tap', square: mate.to });
  assert.equal(session.status, 'success');
});

test('防守会话：化解威胁即通过', () => {
  const mission = missions.find((item) => item.type === 'defense');
  if (mission === undefined) throw new Error('缺少防守题');
  const position = parseFen(mission.fen);
  const defense = generateLegalMoves(position).find((move) => {
    const after = applyMove(position, move);
    return !hasMateInOneThreat(after, position.turn);
  });
  if (defense === undefined) throw new Error('没有化解着法');
  let session = createMissionSession(mission);
  session = missionReducer(session, { type: 'select', square: defense.from });
  session = missionReducer(session, { type: 'tap', square: defense.to });
  assert.equal(session.status, 'success');
});

test('防守会话：走错会被对手将死', () => {
  const mission = missions.find((item) => item.type === 'defense');
  if (mission === undefined) throw new Error('缺少防守题');
  const position = parseFen(mission.fen);
  const bad = generateLegalMoves(position).find((move) => {
    const after = applyMove(position, move);
    return hasMateInOneThreat(after, position.turn);
  });
  if (bad === undefined) throw new Error('没有会输的着法');
  let session = createMissionSession(mission);
  session = missionReducer(session, { type: 'select', square: bad.from });
  session = missionReducer(session, { type: 'tap', square: bad.to });
  assert.equal(session.status, 'failed');
});

test('错两次给提示，三次给答案并演示正确着法', () => {
  const mission = missions.find((item) => item.type === 'find-mate');
  if (mission === undefined) throw new Error('缺少找杀题');
  const position = parseFen(mission.fen);
  const mating = new Set(findMatingMoves(position).map((move) => `${move.from}-${move.to}`));
  const wrong = generateLegalMoves(position).find(
    (move) => !mating.has(`${move.from}-${move.to}`),
  );
  if (wrong === undefined) throw new Error('没有非杀着法');

  let session = createMissionSession(mission);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    session = missionReducer(session, { type: 'select', square: wrong.from });
    session = missionReducer(session, { type: 'tap', square: wrong.to });
    assert.equal(session.status, 'failed');
    assert.equal(session.failures, attempt);
    if (attempt < 3) {
      assert.equal(session.answerText, null);
      session = missionReducer(session, { type: 'retry' });
    }
  }
  assert.notEqual(session.answerText, null);
  assert.equal(session.game.history.length, 1);
  assert.equal(session.game.status, 'checkmate');
});

test('playMove 在题目局面上可走，说明 FEN 与行棋方一致', () => {
  for (const mission of missions) {
    const position = parseFen(mission.fen);
    const move = generateLegalMoves(position)[0];
    if (move === undefined) throw new Error(`${mission.id} 没有合法着法`);
    const played = playMove(position, [], move);
    assert.equal(played.history.length, 1);
  }
});
