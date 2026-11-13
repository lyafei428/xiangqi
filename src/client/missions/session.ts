// 对弈题会话：选子、走子、引擎应着、目标判定、提示与答案。

import type { Color, Move, Position } from '../../shared/index.ts';
import { generateLegalMoves, parseFen, toChineseNotation } from '../../shared/index.ts';
import type { GameAction, GameSession } from '../game/session.ts';
import { createSession, sessionReducer } from '../game/session.ts';
import { findDefenseMoves, findForcingMoves, findMatingMoves, hasMateInOneThreat, opposite } from './mate.ts';
import type { Mission } from './types.ts';

export type MissionStatus = 'playing' | 'success' | 'failed';

export interface MissionSession {
  readonly mission: Mission;
  readonly player: Color;
  readonly game: GameSession;
  readonly playerMoves: number;
  readonly status: MissionStatus;
  readonly message: string;
  readonly attempts: number;
  readonly failures: number;
  readonly answerText: string | null;
}

export type MissionAction =
  | GameAction
  | { readonly type: 'retry' };

export function goalText(mission: Mission): string {
  switch (mission.type) {
    case 'find-mate':
      return '走一着，把对方将死。';
    case 'attack':
      return `在你走 ${mission.plies} 着内将死对方，对手会应着。`;
    case 'defense':
      return '对手下一着就能将死你，走出化解的一着。';
  }
}

export function createMissionSession(
  mission: Mission,
  attempts = 0,
  failures = 0,
): MissionSession {
  const game = createSession(mission.fen);
  return {
    mission,
    player: game.position.turn,
    game,
    playerMoves: 0,
    status: 'playing',
    message: goalText(mission),
    attempts,
    failures,
    answerText: null,
  };
}

function sortedReplies(position: Position): Move[] {
  return [...generateLegalMoves(position)].sort((a, b) => a.from - b.from || a.to - b.to);
}

/** 把一着棋直接落进对局状态，绕过「选子」这一下。 */
function applySessionMove(game: GameSession, move: Move): GameSession {
  const selected = sessionReducer(game, { type: 'select', square: move.from });
  return sessionReducer(selected, { type: 'tap', square: move.to });
}

/** 这道题的正确第一着；用于第三次失败时把答案走到棋盘上。 */
export function solutionMove(mission: Mission): Move | undefined {
  const position = parseFen(mission.fen);
  if (mission.type === 'defense') {
    return findDefenseMoves(position, position.turn)[0];
  }
  const mates = findMatingMoves(position);
  if (mates.length > 0) {
    return [...mates].sort((a, b) => a.from - b.from || a.to - b.to)[0];
  }
  return findForcingMoves(position, mission.plies)[0];
}

function lose(
  state: MissionSession,
  game: GameSession,
  playerMoves: number,
  message: string,
): MissionSession {
  const failures = state.failures + 1;
  if (failures >= 3) {
    const solution = solutionMove(state.mission);
    const start = createSession(state.mission.fen);
    const demo = solution === undefined ? start : applySessionMove(start, solution);
    const answerText =
      solution === undefined
        ? '这道题没有找到演示着法。'
        : `正确着法：${toChineseNotation(start.position, solution)}`;
    return {
      ...state,
      game: demo,
      playerMoves,
      failures,
      status: 'failed',
      message: '三次未成，答案已给出。',
      answerText,
    };
  }
  return {
    ...state,
    game,
    playerMoves,
    failures,
    status: 'failed',
    message,
    answerText: state.answerText,
  };
}

export function missionReducer(state: MissionSession, action: MissionAction): MissionSession {
  if (action.type === 'retry') {
    return createMissionSession(state.mission, state.attempts + 1, state.failures);
  }
  if (state.status !== 'playing') return state;

  const before = state.game;
  const next = sessionReducer(before, action);
  if (next === before) return state;
  if (next.history.length === before.history.length) {
    return { ...state, game: next };
  }

  const playerMoves = state.playerMoves + 1;
  const result = next.result;

  if (result?.type === 'checkmate' && result.winner === state.player) {
    return {
      ...state,
      game: next,
      playerMoves,
      status: 'success',
      message: state.mission.type === 'defense' ? '反杀成功。' : '将死，过关。',
      answerText: null,
    };
  }

  if (state.mission.type === 'find-mate') {
    return lose(state, next, playerMoves, '这一步不是将死。');
  }

  if (state.mission.type === 'attack') {
    if (result !== null) {
      return lose(state, next, playerMoves, '局面结束了，但没有将死对方。');
    }
    if (playerMoves >= state.mission.plies) {
      return lose(state, next, playerMoves, '着数用完了，没有将死。');
    }
    const reply = sortedReplies(next.position)[0];
    if (reply === undefined) {
      return lose(state, next, playerMoves, '对手没有应着。');
    }
    const afterReply = applySessionMove(next, reply);
    if (afterReply.result !== null) {
      return lose(state, afterReply, playerMoves, '对手应着后局面结束了。');
    }
    return { ...state, game: afterReply, playerMoves, message: '继续，找下一着。' };
  }

  // defense
  if (!hasMateInOneThreat(next.position, state.player)) {
    return {
      ...state,
      game: next,
      playerMoves,
      status: 'success',
      message: '守住了，过关。',
      answerText: null,
    };
  }
  const mate = findMatingMoves(next.position)[0];
  if (mate === undefined) {
    return lose(state, next, playerMoves, '对手还有杀着。');
  }
  const mated = applySessionMove(next, mate);
  return lose(state, mated, playerMoves, '对手还是将死了。');
}

/** 供界面显示：对手是哪一方。 */
export function opponentOf(session: MissionSession): Color {
  return opposite(session.player);
}
