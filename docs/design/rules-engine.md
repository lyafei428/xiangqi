# 规则引擎规格（M0 契约）

引擎是纯函数、零依赖、前后端共用。本文件是 M0 的实现契约：实现与测试都按此判定。

## 1. 坐标系

棋盘 9 列 × 10 行。

```text
x = 0..8   列，从左到右（红方视角）
y = 0..9   行，y=0 是黑方底线（上），y=9 是红方底线（下）
index = y * 9 + x
```

- 红方在下方（y=9），向 y 减小方向前进。
- 黑方在上方（y=0），向 y 增大方向前进。
- 红方九宫：`x ∈ [3,5]` 且 `y ∈ [7,9]`。
- 黑方九宫：`x ∈ [3,5]` 且 `y ∈ [0,2]`。
- 河界：红方半场 `y ∈ [5,9]`，黑方半场 `y ∈ [0,4]`。**红兵 y ≤ 4 即已过河；黑卒 y ≥ 5 即已过河。**

## 2. 类型

```ts
export type Color = 'red' | 'black';
export type PieceType = 'K' | 'A' | 'B' | 'N' | 'R' | 'C' | 'P';
export interface Piece { readonly color: Color; readonly type: PieceType }
export type Board = readonly (Piece | null)[];        // 长度 90
export interface Position { readonly board: Board; readonly turn: Color }
export interface Move { readonly from: number; readonly to: number }

export interface HistoryEntry {
  readonly move: Move;
  readonly fen: string;        // 走完这着后的完整局面 FEN（含行棋方），用于重复检测
  readonly gaveCheck: boolean; // 这着是否将军
  readonly captured: boolean;  // 这着是否吃子
}

export type ResultType =
  | 'checkmate'    // 将死：被将方负
  | 'stalemate'    // 困毙：无着法方负（中国象棋判负，不是和棋）
  | 'perpetual'    // 长将：长将方负
  | 'repetition'   // 三次重复：和
  | 'natural';     // 连续 60 回合无吃子：和

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

export interface GameResult { readonly type: ResultType; readonly winner: Color | null }
```

`winner` 为 `null` 表示和棋；`checkmate` / `stalemate` / `perpetual` 的 `winner` 是**获胜方**（困毙时是让对手无着法的一方）。

## 3. FEN

采用通行的中国象棋 FEN。初始局面：

```text
rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
```

- 第 1 字段：棋盘，从上（黑方底线）到下（红方底线），每行从左到右；数字表示连续空位数。
- 第 2 字段：行棋方，`w` = 红，`b` = 黑；读入时同时接受 `r` 表示红。
- 其余字段（吃子计数、回合数）读入时可省略，写出时补 `- - 0 1`。
- 字母含义：`K` 帅/将，`A` 仕/士，`B` 相/象，`N` 马，`R` 车，`C` 炮，`P` 兵/卒。大写红、小写黑。
- `parseFen` 遇到非法输入（行数不对、列数不对、未知字符、缺将帅、出现第二个同色将帅）**抛错**，不返回兜底局面。

## 4. 走法生成

### 4.1 逐棋子规则

| 棋子 | 走法 | 约束 |
|---|---|---|
| `R` 车 | 四方向直线滑行，遇第一个棋子停止；若是敌子可吃 | — |
| `C` 炮 | 不吃子时同车（滑行至第一个棋子前）；吃子时必须恰好隔一个棋子（炮架），吃的是炮架后的第一个棋子 | 炮架可以是任何颜色 |
| `N` 马 | `(±1,±2)` 或 `(±2,±1)` 共 8 点 | 蹩马腿：`|dx|=2` 时马腿在 `(x+dx/2, y)`；`|dy|=2` 时马腿在 `(x, y+dy/2)`。马腿有子则该方向不通 |
| `B` 相/象 | `(±2,±2)` 共 4 点 | 塞象眼：中点 `(x+dx/2, y+dy/2)` 有子则该方向不通；不得过河（红 `y≥5`，黑 `y≤4`） |
| `A` 仕/士 | `(±1,±1)` 共 4 点 | 落点必须在己方九宫内 |
| `K` 帅/将 | `(±1,0)` 或 `(0,±1)` | 落点必须在己方九宫内 |
| `P` 兵/卒 | 向前 1 格；过河后增加左右各 1 格 | 永不后退；红向前 `y-1`，黑向前 `y+1` |

- 任何棋子都不能落在己方棋子所在格。
- 走法生成不判断"走后自己是否被将"——那是合法着法过滤（§5）。

### 4.2 将帅照面（飞将）

两个将帅位于同一列（`x` 相同）且中间无任何棋子时，该局面非法。

实现口径：`isSquareAttacked(pos, sq, byColor)` 中，`byColor` 的将帅除了正常一步走法外，还攻击**同一列上中间无子的任何格**。这样"走后照面"自然被判为"己方被将"，由合法着法过滤统一挡掉，不需要单独写一条规则。

### 4.3 攻击判定

```ts
isSquareAttacked(pos: Position, sq: number, by: Color): boolean
```

`by` 方任一棋子按 §4.1 能走到 `sq` 即为真（不检查该走法会不会让 `by` 自己的将帅被将）。将帅额外按 §4.2 计算。

## 5. 合法着法与将军

```ts
generateMoves(pos): Move[]        // 伪合法；界面高亮用 generateLegalMoves
generateLegalMoves(pos): Move[]   // 过滤掉走后己方被将的着法
isLegal(pos, move): boolean
isInCheck(pos, color): boolean    // 该色将帅是否被攻击
kingSquareOf(board, color): number // 将帅所在交叉点；没有将帅抛错
applyMove(pos, move): Position    // 不校验合法性，调用方负责
playMove(pos, history, move): { position: Position; history: HistoryEntry[] } // 校验合法性，非法抛错，追加一条 HistoryEntry
recordMove(before, move): HistoryEntry // 只记一着、不返回新局面；同样校验合法性
```

合法着法 = 伪合法着法中，走完后 `isInCheck(己方) === false` 的那些。飞将由 §4.2 覆盖，无需单独分支。

`applyMove` 只搬子；`playMove` 在它之上做合法性校验并追加 `HistoryEntry`，界面与服务端都走 `playMove`。`recordMove` 供只需要历史条目的调用方使用，避免为了拿一条记录而重复搬家。

## 6. 终局判定

```ts
statusOf(pos): GameStatus
```

| 情形 | 判定 |
|---|---|
| `isInCheck(turn)` 且合法着法为空 | `checkmate`，`turn` 方负 |
| 未被将 且合法着法为空 | `stalemate`（困毙），**`turn` 方负** |
| 被将且有合法着法 | `check` |
| 其余 | `playing` |

困毙判负是中国象棋与国际象棋的关键差异，必须单独用例覆盖。

### 6.1 长将与三次重复

一局棋维护 `history: HistoryEntry[]`。每走一着追加一条。

**局面键** = 棋盘 + 行棋方（不含计数位）。

**重复检测**：计数范围 = **起始局面**（`startFen`，即 `history` 第一着之前的局面）加上 `history` 中每一着之后的局面；同一局面键累计出现第 3 次时判罚。

起始局面必须计入：它真实存在过，漏掉它会让「双方各自挪回原位」这类循环晚一整圈才判和，而那正是三次重复规则最常被用到的场合。因此 `repetitionResult` 与 `judgeGame` 的 `startFen` 是**必填参数**——不给默认值，调用方必须决定"这局从哪里开始"。

```ts
repetitionResult(position: Position, history: readonly HistoryEntry[], startFen: string): GameResult | null
judgeGame(position: Position, history: readonly HistoryEntry[], startFen: string): GameResult | null
```

**长将判定**：取该局面第二次出现与第三次出现之间的着法段（一个完整循环圈）。统计每一方在该段内自己走的着法里"将军"的着数：

- 恰有一方在该段内**每着都将军**，另一方不是 → 该方负，`type: 'perpetual'`。
- 否则 → 和，`type: 'repetition'`。

这覆盖真实对局中的绝大多数长将情形。长捉、一将一闲不在 v1 范围（见需求文档 §4）。

### 6.2 自然限着

`history` 中自上一次吃子起的着数（半回合数）达到 **120**（即 60 回合）时判和，`type: 'natural'`。

```ts
naturalLimitResult(history: readonly HistoryEntry[]): GameResult | null
```

### 6.3 判定顺序

每次走子后依次检查：① 将死 → ② 困毙 → ③ 长将/重复 → ④ 自然限着。前面命中即终止。

## 7. 记谱

红方用中文数字一至九，从**红方右侧**数起；黑方用阿拉伯数字 1 至 9，从**黑方右侧**数起。

按本坐标系：

```text
红方第 n 路（一…九） → x = 9 - n     红一 = x8，红九 = x0
黑方第 n 路（1…9）    → x = n - 1     黑1 = x0，黑9 = x8
```

格式：`棋子 + 起始纵线 + 方向 + 目数`

- `平`：第三段为目标纵线。例：`炮二平五`。
- `进` / `退`：车、炮、兵、帅用**移动的行数**；马、相/象、仕/士用**目标纵线**。
- 红方 `进` = `y` 减小，黑方 `进` = `y` 增大。

同纵线同色同兵种的多个棋子，用 `前` / `后` 代替起始纵线（靠近对方者为 `前`）：

- 两个：`前车进一`、`后炮平五`。
- 三个（仅兵可能出现）：`前` / `中` / `后`。
- 三个以上：由前到后依次用中文数字（红 `一二三四五`，黑 `1 2 3 4 5`）。

```ts
toChineseNotation(pos: Position, move: Move): string
pieceName(color: Color, type: PieceType): string   // 界面用字：帅/将、仕/士、相/象、兵/卒
```

`pos` 必须是**走这一着之前的局面**。记谱只在显示层使用，棋谱存储一律用坐标序列。

## 8. Perft 基准

```ts
perft(pos: Position, depth: number): number
```

从初始局面出发的公开基准（多来源一致，已核实）：

| depth | nodes |
|---|---|
| 0 | 1 |
| 1 | 44 |
| 2 | 1920 |
| 3 | 79666 |
| 4 | 3290240 |
| 5 | 133312995（调试用，不进日常测试） |

perft 统计**合法着法**（走后己方不被将），与 `generateLegalMoves` 语义一致。

## 9. 文件划分

| 文件 | 内容 |
|---|---|
| `src/shared/types.ts` | §2 的全部类型 |
| `src/shared/board.ts` | 坐标换算（`indexOf` / `xOf` / `yOf`）、`pieceAt`、九宫/河界判断、`emptyBoard`、`positionsEqual` |
| `src/shared/fen.ts` | `INITIAL_FEN` / `parseFen` / `toFen` / `initialPosition` |
| `src/shared/moves.ts` | 走法生成、`isSquareAttacked` |
| `src/shared/rules.ts` | 合法着法、将军、终局、重复与长将、自然限着 |
| `src/shared/notation.ts` | `toChineseNotation`、纵线换算 |
| `src/shared/perft.ts` | `perft` |
| `src/shared/index.ts` | 对外导出 |

## 10. 测试要求

| 测试文件 | 必须覆盖 |
|---|---|
| `test/fen.test.ts` | 初始局面往返一致；非法 FEN 抛错；数字与连续空位解析 |
| `test/moves.test.ts` | 七种棋子走法各有用例；蹩马腿两个方向；塞象眼；象不得过河；炮不吃子不能隔、吃子必须隔；兵过河前后；九宫限制 |
| `test/rules.test.ts` | 将死；**困毙判负**；飞将（走开后照面非法）；被将时必须应将；合法着法过滤 |
| `test/rules-repetition.test.ts` | 三次重复判和；一方每着都将军时长将判负 |
| `test/notation.test.ts` | 红黑双方纵线换算；平/进/退；马与相用目标纵线；前后消歧 |
| `test/perft.test.ts` | depth 0–4 与基准逐位一致 |

判定型用例一律用 FEN 直接构造局面，不靠走一串着法摆出来——摆法本身出错会让测试失去意义。
