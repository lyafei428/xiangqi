// 棋盘的静态层：底图与标记。交互与棋子留在 Board。

import type { Move, Position } from '../../shared/index.ts';
import { pieceAt } from '../../shared/index.ts';
import { BOARD_COLS, BOARD_ROWS, GRID, ORIGIN_X, ORIGIN_Y, VIEW_HEIGHT, VIEW_WIDTH, pointOf } from './geometry.ts';
import type { Point } from './geometry.ts';

export type BoardMarkKind = 'select' | 'correct' | 'wrong';

export interface BoardMark {
  readonly square: number;
  readonly kind: BoardMarkKind;
}

/** 兵与炮的摆位标记：炮两点在 y=2/7，兵卒在 y=3/6。 */
const MARKER_SQUARES: readonly number[] = [
  2 * 9 + 1,
  2 * 9 + 7,
  7 * 9 + 1,
  7 * 9 + 7,
  3 * 9 + 0,
  3 * 9 + 2,
  3 * 9 + 4,
  3 * 9 + 6,
  3 * 9 + 8,
  6 * 9 + 0,
  6 * 9 + 2,
  6 * 9 + 4,
  6 * 9 + 6,
  6 * 9 + 8,
];

/** 兵炮位十字记号：内折角两端，边线上的点只画内侧。 */
function markerPath(center: Point, col: number): string {
  const gap = 12;
  const length = 14;
  const sides = col === 0 ? [1] : col === BOARD_COLS - 1 ? [-1] : [-1, 1];
  const segments: string[] = [];
  for (const sx of sides) {
    for (const sy of [-1, 1]) {
      const x = center.x + sx * gap;
      const yInner = center.y + sy * gap;
      const yOuter = center.y + sy * (gap + length);
      const xOuter = center.x + sx * (gap + length);
      segments.push(`M ${x} ${yOuter} L ${x} ${yInner} L ${xOuter} ${yInner}`);
    }
  }
  return segments.join(' ');
}

export function BoardBackground() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="board-bg" />
      {Array.from({ length: BOARD_ROWS }, (_, row) => {
        const y = ORIGIN_Y + row * GRID;
        return (
          <line
            key={`h${row}`}
            x1={ORIGIN_X}
            y1={y}
            x2={ORIGIN_X + (BOARD_COLS - 1) * GRID}
            y2={y}
            className="board-line"
          />
        );
      })}
      {Array.from({ length: BOARD_COLS }, (_, col) => {
        const x = ORIGIN_X + col * GRID;
        if (col === 0 || col === BOARD_COLS - 1) {
          return (
            <line
              key={`v${col}`}
              x1={x}
              y1={ORIGIN_Y}
              x2={x}
              y2={ORIGIN_Y + (BOARD_ROWS - 1) * GRID}
              className="board-line"
            />
          );
        }
        return (
          <g key={`v${col}`}>
            <line x1={x} y1={ORIGIN_Y} x2={x} y2={ORIGIN_Y + 4 * GRID} className="board-line" />
            <line x1={x} y1={ORIGIN_Y + 5 * GRID} x2={x} y2={ORIGIN_Y + 9 * GRID} className="board-line" />
          </g>
        );
      })}
      <line x1={350} y1={50} x2={550} y2={250} className="board-line" />
      <line x1={550} y1={50} x2={350} y2={250} className="board-line" />
      <line x1={350} y1={750} x2={550} y2={950} className="board-line" />
      <line x1={550} y1={750} x2={350} y2={950} className="board-line" />
      {MARKER_SQUARES.map((square) => (
        <path key={`m${square}`} d={markerPath(pointOf(square), square % BOARD_COLS)} className="marker" />
      ))}
      <text x={250} y={500} textAnchor="middle" dominantBaseline="central" className="river-text">
        楚河
      </text>
      <text x={650} y={500} textAnchor="middle" dominantBaseline="central" className="river-text">
        汉界
      </text>
    </g>
  );
}

export interface BoardHintsProps {
  readonly position: Position;
  readonly lastMove: Move | null;
  readonly targets: readonly number[];
}

/** 棋子下方的提示：上一着、可落点与可吃子环。 */
export function BoardHints({ position, lastMove, targets }: BoardHintsProps) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {lastMove === null
        ? null
        : [lastMove.from, lastMove.to].map((square) => {
            const point = pointOf(square);
            return (
              <rect
                key={`last${square}`}
                x={point.x - 38}
                y={point.y - 38}
                width={76}
                height={76}
                rx={10}
                className="last-move"
              />
            );
          })}
      {targets.map((square) => {
        const point = pointOf(square);
        return pieceAt(position.board, square) === null ? (
          <circle key={`t${square}`} cx={point.x} cy={point.y} r={13} className="target-dot" />
        ) : (
          <circle key={`t${square}`} cx={point.x} cy={point.y} r={47} className="target-capture" />
        );
      })}
    </g>
  );
}

export interface BoardHighlightsProps {
  readonly selected: number | null;
  readonly checkSquare: number | null;
  readonly marks: readonly BoardMark[];
  readonly cursor: number | null;
  readonly keyboardMode: boolean;
}

/** 棋子之上的高亮：选中、将军、练习标记与键盘光标。 */
export function BoardHighlights({ selected, checkSquare, marks, cursor, keyboardMode }: BoardHighlightsProps) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {marks.map((mark) => {
        const point = pointOf(mark.square);
        return (
          <circle
            key={`mark${mark.square}-${mark.kind}`}
            cx={point.x}
            cy={point.y}
            r={47}
            className={`board-mark board-mark-${mark.kind}`}
          />
        );
      })}
      {selected === null ? null : (
        <circle cx={pointOf(selected).x} cy={pointOf(selected).y} r={46} className="piece-selected" />
      )}
      {checkSquare === null ? null : (
        <circle cx={pointOf(checkSquare).x} cy={pointOf(checkSquare).y} r={47} className="piece-check" />
      )}
      {keyboardMode && cursor !== null ? (
        <rect
          x={pointOf(cursor).x - 46}
          y={pointOf(cursor).y - 46}
          width={92}
          height={92}
          rx={10}
          className="keyboard-cursor"
        />
      ) : null}
    </g>
  );
}
