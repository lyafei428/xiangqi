// 练习会话：作答、判分、提示与揭晓。纯函数，界面只负责画。

import type { Drill } from './generator.ts';

export interface DrillSession {
  readonly drill: Drill;
  readonly selected: readonly number[];
  readonly choice: string | null;
  readonly wrongAttempts: number;
  readonly status: 'answering' | 'correct' | 'revealed';
  readonly hintShown: boolean;
  readonly hintAfter: number;
  readonly revealAfter: number;
}

export type DrillAction =
  | { readonly type: 'toggle'; readonly square: number }
  | { readonly type: 'choose'; readonly optionId: string }
  | { readonly type: 'submit' }
  | { readonly type: 'next'; readonly drill: Drill };

export interface AttemptThresholds {
  readonly hint: number;
  readonly reveal: number;
}

export function createDrillSession(drill: Drill, thresholds: AttemptThresholds): DrillSession {
  return {
    drill,
    selected: [],
    choice: null,
    wrongAttempts: 0,
    status: 'answering',
    hintShown: false,
    hintAfter: thresholds.hint,
    revealAfter: thresholds.reveal,
  };
}

function sameTargets(selected: readonly number[], targets: readonly number[]): boolean {
  if (selected.length !== targets.length) return false;
  const left = [...selected].sort((a, b) => a - b);
  const right = [...targets].sort((a, b) => a - b);
  return left.every((value, index) => value === right[index]);
}

function isCorrect(session: DrillSession): boolean {
  const { answer } = session.drill;
  if (answer.kind === 'targets') return sameTargets(session.selected, answer.targets);
  return session.choice === answer.optionId;
}

export function drillReducer(state: DrillSession, action: DrillAction): DrillSession {
  switch (action.type) {
    case 'toggle': {
      if (state.status !== 'answering') return state;
      const has = state.selected.includes(action.square);
      return {
        ...state,
        selected: has
          ? state.selected.filter((square) => square !== action.square)
          : [...state.selected, action.square],
      };
    }
    case 'choose': {
      if (state.status !== 'answering') return state;
      return { ...state, choice: action.optionId };
    }
    case 'submit': {
      if (state.status !== 'answering') return state;
      if (isCorrect(state)) return { ...state, status: 'correct', hintShown: false };
      const wrongAttempts = state.wrongAttempts + 1;
      if (wrongAttempts >= state.revealAfter) {
        return { ...state, wrongAttempts, status: 'revealed', hintShown: true };
      }
      return { ...state, wrongAttempts, hintShown: wrongAttempts >= state.hintAfter };
    }
    case 'next':
      return createDrillSession(action.drill, { hint: state.hintAfter, reveal: state.revealAfter });
  }
}

/** 揭晓时给界面的一行答案文案。 */
export function answerText(session: DrillSession): string {
  const { answer, options } = session.drill;
  if (answer.kind === 'targets') return `共 ${answer.targets.length} 个落点，已在棋盘上标出。`;
  const option = options.find((candidate) => candidate.id === answer.optionId);
  return option === undefined ? '答案缺失' : `正确答案：${option.label}`;
}
