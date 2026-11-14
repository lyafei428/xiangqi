// 棋盘坐标系、命中换算与尺寸计算。
// 所有值都在 SVG 的 viewBox 坐标系里算完，CSS 像素只在边界处换算一次。

export const VIEW_WIDTH = 900;
export const VIEW_HEIGHT = 1000;
export const BOARD_COLS = 9;
export const BOARD_ROWS = 10;
export const GRID = 100;
export const ORIGIN_X = 50;
export const ORIGIN_Y = 50;
export const HIT_RADIUS = 45;
export const MIN_GRID_WIDTH = 40;
export const MIN_BOARD_WIDTH = MIN_GRID_WIDTH * BOARD_COLS;
export const MAX_BOARD_HEIGHT = 720;
export const BOARD_ASPECT = VIEW_HEIGHT / VIEW_WIDTH;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardSize {
  readonly width: number;
  readonly height: number;
}

/** 交叉点下标 → viewBox 坐标，落点是交叉点中心。 */
export function pointOf(square: number): Point {
  if (!Number.isInteger(square) || square < 0 || square >= BOARD_COLS * BOARD_ROWS) {
    throw new RangeError(`pointOf: 交叉点 ${square} 越界`);
  }
  return {
    x: ORIGIN_X + (square % BOARD_COLS) * GRID,
    y: ORIGIN_Y + Math.floor(square / BOARD_COLS) * GRID,
  };
}

/**
 * 执黑时棋盘翻转 180 度：逻辑坐标不变，只换显示。
 * 行列同时取反，(列, 行) → (8 - 列, 9 - 行)，正好就是 89 - square。
 */
export function mirrorSquare(square: number): number {
  if (!Number.isInteger(square) || square < 0 || square >= BOARD_COLS * BOARD_ROWS) {
    throw new RangeError(`mirrorSquare: 交叉点 ${square} 越界`);
  }
  return BOARD_COLS * BOARD_ROWS - 1 - square;
}

/**
 * viewBox 坐标 → 交叉点下标。
 * 先找最近交叉点，再量距离：棋盘外缘留白处点下去不该落到边线上。
 */
export function squareAtViewPoint(x: number, y: number): number | null {
  const col = Math.round((x - ORIGIN_X) / GRID);
  const row = Math.round((y - ORIGIN_Y) / GRID);
  if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return null;
  const center = pointOf(row * BOARD_COLS + col);
  const dx = x - center.x;
  const dy = y - center.y;
  if (dx * dx + dy * dy > HIT_RADIUS * HIT_RADIUS) return null;
  return row * BOARD_COLS + col;
}

/** 客户端像素坐标 → viewBox 坐标。缩放比每次都从当前 rect 现算，不缓存。 */
export function clientToViewPoint(clientX: number, clientY: number, rect: RectLike): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: Number.NaN, y: Number.NaN };
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  };
}

export function squareAtClientPoint(clientX: number, clientY: number, rect: RectLike): number | null {
  const point = clientToViewPoint(clientX, clientY, rect);
  if (Number.isNaN(point.x) || Number.isNaN(point.y)) return null;
  return squareAtViewPoint(point.x, point.y);
}

/**
 * 可用区域 → 棋盘像素尺寸。
 * 保持 9:10；高度不超过上限；**宽度永远不超过可用宽**。
 *
 * 40px 格宽（MIN_GRID_WIDTH）是理想值，不是硬下限：把它当下限用过一次，
 * 360px 的手机可用宽只有 344，棋盘被撑到 360 直接超出屏幕右边八像素——
 * 棋盘看不全比格子小 2px 严重得多，对弈时你连自己的两翼都看不到。
 * 现在的口径：先按高度收，再被可用宽夹住；手机上多数情况仍落在 39–40px。
 */
export function boardSize(
  areaWidth: number,
  areaHeight: number,
  maxHeight: number = MAX_BOARD_HEIGHT,
): BoardSize {
  const heightLimit = Math.max(0, Math.min(areaHeight, maxHeight));
  const width = Math.max(0, Math.min(areaWidth, heightLimit * (VIEW_WIDTH / VIEW_HEIGHT)));
  return { width, height: width * (VIEW_HEIGHT / VIEW_WIDTH) };
}
