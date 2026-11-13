// 本地双人对局状态机。纯函数：不改入参，返回新状态。
// 规则判定一律交给 shared 引擎，这里只负责选子、记账和终局后的锁盘。

import type {
  Color,
  GameResult,
  GameStatus,
  HistoryEntry,
  Move,
  Position,
} from '../../shared/index.ts';
import {
  CLOCK_MS,
  INITIAL_FEN,
  createClock,
  generateLegalMoves,
  isLegal,
  judgeGame,
  kingSquareOf,
  parseFen,
  pieceAt,
  playMove,
  statusOf,
  stopClock,
  switchClock,
  timeoutColor,
  toChineseNotation,
} from '../../shared/index.ts';
import type { ClockState } from '../../shared/index.ts';

function opposite(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

export interface GameSession {
  readonly startFen: string;
  readonly position: Position;
  readonly history: readonly HistoryEntry[];
  /** 与 history 逐着对齐的中文记谱，只用于显示。 */
  readonly notations: readonly string[];
  readonly lastMove: Move | null;
  readonly result: GameResult | null;
  readonly status: GameStatus;
  readonly selected: number | null;
  readonly targets: readonly number[];
  readonly clock: ClockState;
}

export type GameAction =
  | { readonly type: 'select'; readonly square: number; readonly now?: number }
  | { readonly type: 'tap'; readonly square: number; readonly now?: number }
  | { readonly type: 'play'; readonly move: Move; readonly now?: number }
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'resign'; readonly now?: number }
  | { readonly type: 'reset'; readonly startFen?: string };

export function createSession(startFen: string = INITIAL_FEN, now = Date.now()): GameSession {
  const position = parseFen(startFen);
  return {
    startFen,
    position,
    history: [],
    notations: [],
    lastMove: null,
    result: null,
    status: statusOf(position),
    selected: null,
    targets: [],
    clock: createClock(now, CLOCK_MS),
  };
}
/**
 * 续局：按着法重放出局面与记谱，再挂上存下来的时钟。
 * 记录被改坏（解析失败或走法非法）返回 null，由调用方丢弃并开新局。
 */
export function restoreSession(
  startFen: string,
  moves: readonly Move[],
  clock: ClockState,
): GameSession | null {
  try {
    let position = parseFen(startFen);
    let history: readonly HistoryEntry[] = [];
    const notations: string[] = [];
    let lastMove: Move | null = null;
    for (const move of moves) {
      notations.push(toChineseNotation(position, move));
      const played = playMove(position, history, move);
      position = played.position;
      history = played.history;
      lastMove = move;
    }
    const result = judgeGame(position, history, startFen);
    return {
      startFen,
      position,
      history,
      notations,
      lastMove,
      result,
      status: statusOf(position),
      selected: null,
      targets: [],
      // 重放出来已经是终局时停表，避免续局页面继续走秒。
      clock: result === null ? clock : { ...clock, running: null },
    };
  } catch {
    return null;
  }
}

function targetsFrom(position: Position, from: number): number[] {
  return generateLegalMoves(position)
    .filter((move) => move.from === from)
    .map((move) => move.to);
}

/** 旗落即终局：走子与选子入口先过这一关，超时后不再接受任何动作。 */
function timedOutState(state: GameSession, now: number): GameSession | null {
  if (state.result !== null) return null;
  const timedOut = timeoutColor(state.clock, now);
  if (timedOut === null) return null;
  return {
    ...state,
    result: { type: 'timeout', winner: opposite(timedOut) },
    clock: stopClock(state.clock, now),
    selected: null,
    targets: [],
  };
}

/** 指针按下时只选中、不切换：拖动要从按下就开始算，抬起才决定走不走。 */
function selectSquare(state: GameSession, square: number, now: number): GameSession {
  const expired = timedOutState(state, now);
  if (expired !== null) return expired;
  const piece = pieceAt(state.position.board, square);
  if (piece === null || piece.color !== state.position.turn) return state;
  if (state.selected === square) return state;
  return { ...state, selected: square, targets: targetsFrom(state.position, square) };
}

function playTurn(state: GameSession, move: Move, now: number): GameSession {
  const notation = toChineseNotation(state.position, move);
  // 非法着法由 playMove 抛错：history 是重复与自然限着的输入，不能混进假着法。
  const { position, history } = playMove(state.position, state.history, move);
  const played = switchClock(state.clock, now);
  const result = judgeGame(position, history, state.startFen);
  return {
    ...state,
    position,
    history,
    notations: [...state.notations, notation],
    lastMove: move,
    result,
    status: statusOf(position),
    selected: null,
    targets: [],
    clock: result === null ? played : stopClock(played, now),
  };
}

function tapSquare(state: GameSession, square: number, now: number): GameSession {
  const expired = timedOutState(state, now);
  if (expired !== null) return expired;
  if (state.result !== null) return state;
  if (state.selected !== null && state.targets.includes(square)) {
    return playTurn(state, { from: state.selected, to: square }, now);
  }
  const piece = pieceAt(state.position.board, square);
  if (piece !== null && piece.color === state.position.turn) {
    // 再点已选中的子取消；点另一枚己方子改选。
    return state.selected === square
      ? { ...state, selected: null, targets: [] }
      : { ...state, selected: square, targets: targetsFrom(state.position, square) };
  }
  // 点不可落点只取消选中，不弹错误提示。
  return state.selected === null ? state : { ...state, selected: null, targets: [] };
}

export function sessionReducer(state: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case 'select':
      return selectSquare(state, action.square, action.now ?? Date.now());
    case 'tap':
      return tapSquare(state, action.square, action.now ?? Date.now());
    case 'play': {
      const now = action.now ?? Date.now();
      const expired = timedOutState(state, now);
      if (expired !== null) return expired;
      if (state.result !== null) return state;
      // 非法着法原样退回而不是抛错：这道闸的意义就是让上游（人机页）的引擎着法
      // 在 reducer 里被挡下，而不是把 playMove 的抛错变成整页崩掉。
      if (!isLegal(state.position, action.move)) return state;
      return playTurn(state, action.move, now);
    }
    case 'tick': {
      const expired = timedOutState(state, action.now);
      return expired ?? state;
    }
    case 'resign': {
      if (state.result !== null) return state;
      const now = action.now ?? Date.now();
      const loser = state.position.turn;
      return {
        ...state,
        result: { type: 'resign', winner: opposite(loser) },
        clock: stopClock(state.clock, now),
        selected: null,
        targets: [],
      };
    }
    case 'reset':
      // 无参时回到本局起始局面，而不是固定初始局面：练习与残局批次会从自定义 FEN 开局。
      return createSession(action.startFen ?? state.startFen);
  }
}

/** 将军与将死时标出被将方的将帅；困毙没有将军线，不标。 */
export function checkSquareOf(session: GameSession): number | null {
  if (session.status !== 'check' && session.status !== 'checkmate') return null;
  return kingSquareOf(session.position.board, session.position.turn);
}
