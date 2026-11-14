# 棋谱回放与存局

对局结束后把整局固化成一条记录，可逐步回放、导出与导入；本地对局关页重开后接着下。

Closest precedent: `docs/design/modules/online.md` — 联机快照已经带着着法（`moveLog`）、`result` 与起始局面，本模块只把它们固化成可长期保存的记录，不改对局流程。差异：快照只送当前局面，回放要的是「第 N 步」的任意局面，因此记录保存着法并在回放时重算。

Survey evidence: 已核对以下文档与代码：

- `docs/requirements/xiangqi.md` F1.6；`docs/design/modules/local-play.md`（会话字段、动作、集成设计）。
- `docs/design/modules/app-shell.md`（路由、导航、文件表）；`docs/design/modules/online.md`（快照字段）；`docs/design/modules/clock.md`（剩余与锚点）。
- `src/client/board/Board.tsx`（`demo` 只读模式）；`src/client/game/session.ts`（`createSession`）；`src/shared/clock.ts`（`ClockState` 字段）。

未发现与既有设计冲突。

## 1. 记录格式

`src/shared/record.ts`，纯函数，能进浏览器也能进 Node：

```ts
interface GameRecord {
  readonly id: number | null; // 记录 id：存盘毫秒时间戳（撞号时 +1 直到唯一）；未完成的 current 为 null
  readonly startFen: string;
  readonly moves: readonly { readonly from: number; readonly to: number }[];
  readonly result: GameResult | null;
  readonly redMs: number;     // 存盘时刻双方剩余
  readonly blackMs: number;
  readonly savedAt: number;   // 存盘时刻（毫秒时间戳）
}

positionAt(record, step): Position   // 重放前 step 着；step 夹到 [0, moves.length]；非法着法抛错；内部委托 positionAtMoves(startFen, moves, step)
isReplayable(record): boolean        // 全量重放一次，能走完 true
parseRecord(text): GameRecord | null // 结构校验失败返回 null
recordText(record): string           // JSON 文本，缩进 2
```

- 只存起始局面 + 着法，不存每步 FEN：逐步 FEN 与着法是两份真相，早晚不一致。
- `parseRecord` 的校验：`version` 不谈（记录里不写版本字段，跨版本由 `parseRecord` 按字段判定）；`startFen` 可解析；每个坐标是 0..89 的整数且 `from !== to`；着法数 ≤ 1000；`redMs` / `blackMs` 在 `[0, 600000]`；`savedAt` 为正整数；`result` 为 null，或 `type` 属于既有结果取值集合、`winner` 为 `red` / `black` / null。任一不过返回 null。
- 导入、回放都要过两道：`parseRecord` 管结构，`isReplayable` 管走法——坐标合法但走法非法的文件不能进库，也不能让回放页崩。
- `positionAt` 走 `playMove`，非法着法直接抛错；调用方（导入、回放）必须接住。

## 2. 存储

`src/client/storage/records.ts`，只有它碰 `localStorage`：

- `xiangqi.records.v1`：已存棋谱数组。最多 50 条，超出按 `savedAt` 丢最旧。
- `xiangqi.current.v1`：单条未完成的本地对局，字段与 `GameRecord` 相同（`id` 与 `result` 为 null）。
- 读写都包 try/catch：`setItem` 抛错（隐私模式配额）时本次写入放弃并返回 false，页面照常走；读到损坏 JSON 视为空表。
- 这两条兜底的来源：`test/records-storage.test.ts` 的「写入失败不抛给页面」用例把 `localStorage.setItem` 换成抛错的 stub 复现，命令 `node --test test/records-storage.test.ts`；损坏 JSON 由同文件「坏 JSON 视为空表」用例写入 `{oops` 复现。两处都不影响业务流程，只影响「这一条没存上」。
- 联机局不写 `current`（续局只服务本地），终局时由棋手客户端向 `records` 追加一条。

## 3. 续局

- 恢复入口：`src/shared/clock.ts` 增 `clockFrom(redMs, blackMs, running, now): ClockState`（按存的剩余原样建时钟，锚点取 `now`）；`src/client/game/session.ts` 增 `restoreSession(startFen, moves, clock): GameSession`——用 `playMove` 从头重放 `moves`，再挂上该时钟。恢复失败（重放抛错）返回 null，由调用方丢弃。
- 本地每走一步写 `current`；终局时把 `current` 转成棋谱追加进 `records`，并删掉 `current`。
- 启动时 `App` 读一次 `current`：`parseRecord` 通过且 `isReplayable` 为真，则 `restoreSession` 接回局面、记谱与双方剩余；时钟以恢复时刻为锚，关页期间不扣时——关页后浏览器没有计时器，恢复只能按「暂停」处理，重开接上残余时间，与 F1.6「重开后局面与时钟接上」一致。
- 恢复失败（结构坏、走法非法）→ 丢弃 `current` 开新局，不阻塞启动，也不弹错误；复现：把 `xiangqi.current.v1` 写成 `{"id":null,"startFen":"bad","moves":[],"result":null,"redMs":0,"blackMs":0,"savedAt":0}` 后重挂 `App`，用例断言棋盘回到初始局面且该 key 被移除。

## 4. 页面

路由 `#/replay`（列表）与 `#/replay/<id>`（回放），导航第五项「棋谱」。

页面顶部是两个分栏：**我的棋谱**（本地存局，左列列表 + 右侧回放，表头吸在列表顶部）与**棋谱库**（随包内容，按开局 / 中局 / 终局 / 残局筛选，选中即在同一页内回放）。两个分栏共用同一套回放器与记谱列表，操作手感一致。

- 列表：存盘时间、结果文案、步数；每行可进回放、可删除。空库显示「还没有棋谱」。
- 回放：棋盘用 `Board` 的 `demo` 模式（只读）；控制「首 / 上一步 / 下一步 / 末」、一条 `range` 滑条；右侧记谱每行可点，点了跳到该步之后。
- 回放页对以下两种输入给同一个可见结果「这条棋谱无法回放」并给「删除」按钮：`isReplayable` 为假、`positionAt` 抛错。结构就解析不了的条目在存储层就被 `listRecords` 丢掉，不会出现在列表里，也就不进入这两个入口。
- 地址里的 id 在库中不存在（删除后回退、旧地址）→ 左侧列表照常显示，右侧提示「棋谱不存在」；不改写地址，避免用户不解自己为何被弹回列表。
- 导入：`input[type=file]` 读文本 → `parseRecord` → `isReplayable`；两道都过才入库并跳到该条，任一道不过提示「文件不是有效的棋谱」。
- 导出：回放页「导出」按钮，用 Blob 下载 `xiangqi-<savedAt>.json`，内容即 `recordText`。
- 同毫秒存两条：入库时 `id = savedAt`，若已存在则 `id += 1` 直到唯一（`saveRecord` 内处理，`savedAt` 保留真实时间）。
- 自动存局去重（仅联机）：`saveRecord` 的 `dedupe` 选项按「起始局面 + 逐着坐标 + 结果」判定同一局，已存在就不再写第二条。联机终局靠它拦重——切页与刷新都会重建组件，页面里的一次性标记拦不住第二次。本地局不用它：`App` 的单次挂载由 `savedRef` 拦住，终局后 `current` 已清且 `loadCurrent` 拒绝已结束的记录，刷新不会重存；不去重才能让两盘内容相同的本地对局各留一条。

## 5. 文件划分

新增：

| 文件 | 职责 |
|---|---|
| `src/shared/record.ts` | 记录格式、结构校验、逐步重放、可回放判定。纯函数。 |
| `src/client/storage/records.ts` | `localStorage`：棋谱库与未完成对局。 |
| `src/client/pages/ReplayPage.tsx` | 列表、回放、导入、导出。 |
| `test/record.test.ts` | 记录往返、校验边界、任意步重放。 |
| `test/records-storage.test.ts` | 读写、上限淘汰、坏 JSON、写入失败、续局记录。 |
| `test/integration/replay.test.tsx` | F1-5：列表、回放、导入导出、坏记录。 |
| `test/integration/local-play.test.tsx` | 续局一段（既有文件）。 |

改既有件：

- `src/shared/clock.ts`：`clockFrom`。
- `src/client/game/session.ts`：`restoreSession`。
- `src/client/shell/routes.ts`：两条回放路由。
- `src/client/App.tsx`：导航第五项与启动恢复。
- `src/client/pages/OnlinePage.tsx`：终局存棋谱。
- `src/client/app.css`：列表与回放样式。
- `src/shared/protocol.ts` 与 `src/server/room.ts`：快照补 `startFen` 与 `moveLog`。

页面与路由的职责清单在 `docs/design/modules/app-shell.md` §4，本表不重复。

现有件检查：

- `Board` 的 `demo` 模式：existing — `src/client/board/Board.tsx` 的 `BoardMode` 已有 `… { readonly kind: 'demo' }`，回放直接复用。
- `createSession`：existing — `src/client/game/session.ts`，续局在其基础上加 `restoreSession`，不改它的默认行为。
- `INITIAL_FEN` / `parseFen` / `playMove`：existing — `src/shared/`。
- `GameRecord`、`positionAt`、`isReplayable`、`parseRecord`、`recordText`、`clockFrom`、`restoreSession`、`ReplayPage`、「棋谱」「还没有棋谱」「这条棋谱无法回放」「棋谱不存在」「文件不是有效的棋谱」：none found——项目内无同名函数与同句文案。
- 命名：`GameRecord` 与既有的 `HistoryEntry` 不同层级（前者整局、后者单着），不合并。

文件分档：本批改动文件均未跨 500 行档，无 300+ 行单函数；`ReplayPage.tsx` 按「列表」「回放」两个内部区块切分，各自不承担对方的状态。

本批验收命令（只跑改动面）：`node --test test/record.test.ts test/records-storage.test.ts`；`npx vitest run test/integration/replay.test.tsx test/integration/local-play.test.tsx`。

## 6. 验收对照

| 需求 | 落点 | 验证 |
|---|---|---|
| F1.6 回放可走到任意一步 | `positionAt` + 回放页 | `test/record.test.ts` 逐步对比；`test/integration/replay.test.tsx` 拖到末步 |
| F1.6 导出与导入 JSON | `recordText` / `parseRecord` / `isReplayable` | 往返单测；导入集成：坏文件、非法走法文件都给「文件不是有效的棋谱」，好文件能回放 |
| F1.6 关页重开后接着下 | `records.ts` 的 `current` + `restoreSession` | 集成：写 `current` → 重挂 `App` → 局面、记谱与双方剩余与存盘前一致 |
| F1.6 联机也能存 | 联机页终局钩子 + 快照 `startFen` / `moveLog` | 集成：收到终局快照后列表多一条，能完整回放 |

## 7. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事；本批新增 F1-5 一行，F1-1 / F1-3 不破坏。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-5 | 对弈 → 走子 → 终局 → 棋谱页 → 回放 → 导入导出 → 重开续局 | 列表出现该局；回放可停在任意一步；导出的文件重新导入后能完整回放；关页重开棋盘与时钟接上 | 打开页面 → 对弈 / 棋谱 | F1.6 |

实现：`test/integration/replay.test.tsx`（列表、回放、导入导出、坏记录与不存在 id）；续局在 `test/integration/local-play.test.tsx` 增一段（jsdom 直接操作 `localStorage` 后重挂 `App`）。


「我的棋谱」列表的表头（标题 + `导入`）吸在列表顶部：`.replay-head` 是 `position: sticky` + 页面底色 + 一条分隔线。棋谱攒多以后往下拉，表头不跟着走——这是「列表能滚动，但入口不动」的固定做法。

每步胜率：回放页的记谱每格带一个红方视角的百分比，滑条与记谱之间一行三段（红 x% / 概率条 / 黑 y%）；逐着局面用 `src/client/online/history.ts` 的 `replayHistory(record.startFen, record.moves)` 还原，取值与标定见 `docs/design/modules/ai.md` §9。
