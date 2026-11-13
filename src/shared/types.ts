// 规则引擎的公共类型。坐标系见 board.ts：index = y * 9 + x。

export type Color = 'red' | 'black';

export type PieceType = 'K' | 'A' | 'B' | 'N' | 'R' | 'C' | 'P';

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** 长度固定 90。readonly 让"纯函数不改入参"这条约定由类型兜住。 */
export type Board = readonly (Piece | null)[];

export interface Position {
  readonly board: Board;
  readonly turn: Color;
}

export interface Move {
  readonly from: number;
  readonly to: number;
}

export interface HistoryEntry {
  readonly move: Move;
  /** 走完这着后的完整局面 FEN（含行棋方）。重复检测按棋盘 + 行棋方比对。 */
  readonly fen: string;
  readonly gaveCheck: boolean;
  readonly captured: boolean;
}

export type ResultType =
  | 'checkmate' // 将死：被将方负
  | 'stalemate' // 困毙：无着法方负（中国象棋判负，不是和棋）
  | 'perpetual' // 长将：长将方负
  | 'repetition' // 三次重复：和
  | 'natural'; // 连续 60 回合无吃子：和

export interface GameResult {
  readonly type: ResultType;
  /** null 表示和棋；其余取值为获胜方。 */
  readonly winner: Color | null;
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';
