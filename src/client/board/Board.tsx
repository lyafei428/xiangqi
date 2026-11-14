// SVG 棋盘：交互、棋子与拖拽。几何与静态层在 geometry / layers。
// 三种模式共用一个组件：play 对弈、demo 只读演示、drill 练习作答。

import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import type { Color, Move, Piece, Position } from '../../shared/index.ts';
import { pieceAt, pieceName, xOf, yOf } from '../../shared/index.ts';
import type { BoardSize, Point } from './geometry.ts';
import {
  BOARD_COLS,
  BOARD_ROWS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  clientToViewPoint,
  mirrorSquare,
  pointOf,
  squareAtClientPoint,
} from './geometry.ts';
import type { BoardMark } from './layers.tsx';
import { BoardBackground, BoardHighlights, BoardHints } from './layers.tsx';

const COLOR_NAME: Readonly<Record<Color, string>> = { red: '红方', black: '黑方' };

const ARROW_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const DRAG_THRESHOLD = 6;

export type BoardMode =
  | { readonly kind: 'play'; readonly side: Color | 'both' }
  | { readonly kind: 'demo' }
  | { readonly kind: 'drill'; readonly side: Color };

export interface BoardProps {
  readonly mode: BoardMode;
  readonly size: BoardSize;
  readonly position: Position;
  /** 从哪一方的视角摆棋：执黑时整盘翻转，自己的子在下。默认红方。 */
  readonly orientation?: Color;
  readonly selection?: { readonly selected: number | null; readonly targets: readonly number[] };
  readonly lastMove?: Move | null;
  readonly checkSquare?: number | null;
  readonly marks?: readonly BoardMark[];
  readonly onSelect?: (square: number) => void;
  readonly onTap?: (square: number) => void;
}

interface PressInfo {
  readonly from: number;
  readonly canMove: boolean;
  readonly wasSelected: boolean;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
}

interface DragInfo {
  readonly from: number;
  readonly point: Point;
}

function isMovable(piece: Piece, turn: Color, movable: Color | 'both'): boolean {
  if (piece.color !== turn) return false;
  return movable === 'both' || piece.color === movable;
}

function neighborSquare(square: number, dx: number, dy: number): number {
  const x = Math.min(BOARD_COLS - 1, Math.max(0, (square % BOARD_COLS) + dx));
  const y = Math.min(BOARD_ROWS - 1, Math.max(0, Math.floor(square / BOARD_COLS) + dy));
  return y * BOARD_COLS + x;
}

export function Board(props: BoardProps) {
  const { mode, size, position, lastMove = null, checkSquare = null, marks = [] } = props;
  const selection = props.selection ?? { selected: null, targets: [] };
  const selected = selection.selected;
  const targets = selection.targets;
  const flipped = props.orientation === 'black';
  /** 逻辑格号 → 显示格号。翻转只改显示，着法与记录都还用逻辑格号。 */
  const view = (square: number): number => (flipped ? mirrorSquare(square) : square);
  const movable = mode.kind === 'play' ? mode.side : mode.kind === 'drill' ? mode.side : null;
  const interactive = movable !== null && props.onTap !== undefined;
  const { onSelect, onTap } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const pressRef = useRef<PressInfo | null>(null);
  const keyboardModeRef = useRef(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [drag, setDrag] = useState<DragInfo | null>(null);

  // 键盘走完一着后焦点留在原交叉点会丢，交给目标交叉点上的棋子接住。
  useEffect(() => {
    if (mode.kind !== 'play' || lastMove === null || !keyboardModeRef.current) return;
    const group = svgRef.current?.querySelector<SVGGElement>(`[data-square="${lastMove.to}"]`);
    group?.focus();
  }, [mode.kind, lastMove]);

  const handleBoardFocus = (event: FocusEvent<SVGSVGElement>): void => {
    const target = event.target;
    const viaKeyboard = target instanceof Element && target.matches(':focus-visible');
    keyboardModeRef.current = viaKeyboard;
    setKeyboardMode(viaKeyboard);
  };

  const handleBoardBlur = (event: FocusEvent<SVGSVGElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    keyboardModeRef.current = false;
    setKeyboardMode(false);
  };

  const handlePieceKeyDown = (event: KeyboardEvent<SVGGElement>, square: number): void => {
    if (!interactive) return;
    const current = cursor ?? square;
    const delta = ARROW_DELTAS[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      setCursor(neighborSquare(current, delta[0], delta[1]));
      keyboardModeRef.current = true;
      setKeyboardMode(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTap?.(current);
      return;
    }
    if (event.key === 'Escape' && mode.kind === 'play' && selected !== null) {
      event.preventDefault();
      onTap?.(selected);
    }
  };

  const squareFromPointer = (event: PointerEvent<SVGSVGElement>): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const display = squareAtClientPoint(event.clientX, event.clientY, rect);
    // 翻转时屏幕上的格号是镜像的，退回逻辑格号再交给着法与会话。
    return display === null ? null : view(display);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (!interactive) return;
    const square = squareFromPointer(event);
    if (square === null) return;

    if (mode.kind === 'drill') {
      onTap?.(square);
      return;
    }

    const piece = pieceAt(position.board, square);
    const canMove = piece !== null && isMovable(piece, position.turn, movable ?? 'both');
    pressRef.current = {
      from: square,
      canMove,
      wasSelected: selected === square,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (canMove) onSelect?.(square);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    if (mode.kind !== 'play') return;
    const press = pressRef.current;
    if (press === null || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (distance < DRAG_THRESHOLD) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setDrag({ from: press.from, point: clientToViewPoint(event.clientX, event.clientY, rect) });
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>): void => {
    const press = pressRef.current;
    pressRef.current = null;
    setDrag(null);
    if (press === null || press.pointerId !== event.pointerId) return;
    const square = squareFromPointer(event);
    // 拖出棋盘不算落子，保留当前选中。
    if (square === null) return;
    if (square === press.from) {
      // 按下时才选中的，抬起这一下不再当第二次点击；按下前已选中的才算取消。
      if (press.canMove && !press.wasSelected) return;
      onTap?.(square);
      return;
    }
    onTap?.(square);
  };

  const handlePointerCancel = (): void => {
    pressRef.current = null;
    setDrag(null);
  };

  const dragPiece = drag === null ? null : pieceAt(position.board, drag.from);

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={size.width}
      height={size.height}
      role="group"
      aria-label="中国象棋棋盘"
      // 全程 none，不跟着拖动状态切：手势进行中改 touch-action 会让浏览器直接
      // 取消这个 pointer（pointercancel），拖到一半就断，落子永远发生不了。
      style={{ touchAction: interactive ? 'none' : 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onFocus={handleBoardFocus}
      onBlur={handleBoardBlur}
    >
      <BoardBackground />
      <BoardHints position={position} lastMove={lastMove} targets={targets} flipped={flipped} />

      {position.board.map((piece, square) => {
        if (piece === null) return null;
        const point = pointOf(view(square));
        const focusable =
          interactive && (movable === 'both' || piece.color === movable);
        return (
          <g
            key={square}
            data-square={square}
            transform={`translate(${point.x} ${point.y})`}
            className={`piece piece-${piece.color}`}
            role="img"
            aria-label={`${COLOR_NAME[piece.color]}${pieceName(piece.color, piece.type)}，第 ${xOf(square) + 1} 列第 ${yOf(square) + 1} 行`}
            tabIndex={focusable ? 0 : undefined}
            onFocus={() => setCursor(square)}
            onKeyDown={(event) => handlePieceKeyDown(event, square)}
          >
            <circle r={42} className="piece-disc" />
            <text className="piece-text" textAnchor="middle" dominantBaseline="central">
              {pieceName(piece.color, piece.type)}
            </text>
          </g>
        );
      })}

      <BoardHighlights
        selected={selected}
        checkSquare={checkSquare}
        marks={marks}
        cursor={cursor}
        keyboardMode={keyboardMode}
        flipped={flipped}
      />

      {drag !== null && dragPiece !== null ? (
        <g
          transform={`translate(${drag.point.x} ${drag.point.y})`}
          className={`piece piece-${dragPiece.color} drag-ghost`}
          pointerEvents="none"
          aria-hidden="true"
        >
          <circle r={42} className="piece-disc" />
          <text className="piece-text" textAnchor="middle" dominantBaseline="central">
            {pieceName(dragPiece.color, dragPiece.type)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
