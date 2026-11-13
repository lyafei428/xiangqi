# 2026-11-14 · M5b 棋谱回放与存局
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「按计划」批准 M5b/M5c 拆分，以及两条默认口径：满员加入自动转观战、联机对局也入棋谱库。
> 台账 = #6（xiangqi · 归批）。前情 = M5a 计时与认输求和（已收口，0e415e5）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**批次任务与设计（M5b：棋谱回放与存局）**

覆盖：

- F1.6 棋谱存局：终局后可逐步回放；棋谱导出 / 导入 JSON；本地对局关页重开后接着下（局面与时钟接上）。
- 需求条目已在 `docs/requirements/xiangqi.md` F1.6；本批不碰 F1.7 观战（M5c）。

设计档落点：

- 新增 `docs/design/modules/replay.md`：记录格式、存储、续局、回放页、文件划分、验收、集成设计。
- 同步 `docs/design/modules/app-shell.md`（两条路由、导航五项、文件表、状态归属）、`docs/design/modules/local-play.md`（§1 边界）、`docs/design/modules/online.md`（§3 终局存棋谱）、`test/RTM.md`（F1-5 行）。

机制：

- 记录 = 起始 FEN + 着法列表 + 结果 + 双方剩余 + 存盘时刻；`positionAt(record, n)` 用 `playMove` 重放前 n 着，不存逐步 FEN（两份真相早晚不一致）。
- 存储只有 `src/client/storage/records.ts` 碰 `localStorage`：`xiangqi.records.v1`（最多 50 条，按 `savedAt` 淘汰）与 `xiangqi.current.v1`（单条未完成局）；损坏与配额异常一律降级为空表，不抛给页面。
- 续局：每走一步写 `current`，终局转存棋谱并删 `current`；恢复时重放着法，时钟取存量剩余、`since` 置为恢复时刻（关页不走）。
- 回放：`Board` 的 `demo` 只读模式 + 步进器（首 / 上一步 / 下一步 / 末 + 滑条 + 记谱点选）。
- 导出 = Blob 下载 `xiangqi-<savedAt>.json`；导入 = 读文件 → `parseRecord`，失败提示「文件不是有效的棋谱」。
- 联机终局：棋手客户端收到带 `result` 的快照时向棋谱库追加一条，字段与本地同一结构。

受影响文件与测试：

- 新增 `src/shared/record.ts`、`src/client/storage/records.ts`、`src/client/pages/ReplayPage.tsx`；改 `src/client/shell/routes.ts`、`src/client/App.tsx`、`src/client/pages/OnlinePage.tsx`、`src/client/app.css`。
- 测试：`test/record.test.ts`、`test/records-storage.test.ts`、`test/integration/replay.test.tsx` 新增；`test/integration/local-play.test.tsx` 加续局一段；`test/routes.test.ts` 扩两条。

验收对照：见 `docs/design/modules/replay.md` §6；集成设计见同档 §7。

关键决策（用户已批准）：

- 满员加入自动转观战（M5c 用，本批不实现）。
- 联机对局也进棋谱库（双方各自本地各存一份）。

上抛项：无。

收口核对（落地与设计一致性）：

- `docs/design/modules/replay.md` 的记录格式、存储、续局、页面、验收对照与集成设计均与代码一致；评审期间的四处口径调整（快照 `moveLog` 作为坐标来源、坏条目在存储层过滤、不存在 id 不改写地址、去重仅联机）已回写文档。
- `docs/design/modules/app-shell.md`（两条路由、导航五项、文件表、状态归属）、`docs/design/modules/local-play.md` §1 边界句、`docs/design/modules/online.md` §2/§3、`test/RTM.md` F1-5 行与代码实现一致。
- 实现补齐了设计未列的 `src/client/panel/result-text.ts`（三处结果文案合并为一份），已写进文件相关说明。
- 批次拆分未变：F1.7 观战留在 M5c。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

### 评审发现（M5b 棋谱回放与存局 · 设计评审）

审阅对象：

- `docs/design/modules/replay.md`（设计档本体）
- `docs/design/modules/app-shell.md`
- `docs/design/modules/local-play.md`
- `docs/design/modules/online.md`
- `docs/requirements/xiangqi.md`
- `test/RTM.md`

已具备的项：设计档在位；Closest precedent 行与 Survey evidence 行齐全；§7 的集成测试设计以 `test/RTM.md` 的「对弈」故事为起点，F1-5 一行在 `test/RTM.md` 已存在，编号一致。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | Feasibility | 🔴 | `docs/design/modules/replay.md` §3 写「用 `createSession(startFen)` 重放 `moves`」，同一节又写「恢复时把时钟设为 `{ redMs, blackMs, running: 该谁走, since: 恢复时刻 }`」。但 `src/client/game/session.ts` — "export function createSession(startFen: string = INITIAL_FEN, now = Date.now()): GameSession {" 里固定 "clock: createClock(now, CLOCK_MS),"，`src/shared/clock.ts` 的 "return { redMs: perSide, blackMs: perSide, running: 'red', since: now };" 说明剩余一律回到包干值；`GameAction` 最后一个成员是 "｜ { readonly type: 'reset'; readonly startFen?: string };"，无设时钟的动作。故 `docs/requirements/xiangqi.md` F1.6「重开后局面与时钟接上」按现文无入口可实现，且 `src/client/game/session.ts` 不在 `docs/design/modules/replay.md` §5 文件表内。 | 把续局恢复入口写进设计（`createSession` 增可选时钟入参，或新增 restore 动作），把 `src/client/game/session.ts` 补进 §5 文件表并纳入分档结论；§6 按该入口表述「时钟接上」。 |
| 2 | Acceptance criteria | 🔴 | `docs/design/modules/replay.md` §1 的校验清单（"`version === 1`、`startFen` 可解析、每个坐标是 0..89 的整数、着法数 ≤ 1000、`redMs/blackMs` 非负数、`savedAt` 为正整数"）不含走法合法性，同一节又定 "`positionAt` 走 `playMove`，非法着法直接抛错"。§4「成功则入库并跳到该条」使坐标合法而走法非法的文件进入棋谱库，回放页无兜底（§3 只给启动时的 `current` 定了丢弃规则），进一次崩一次；§6 导入验收只写「坏文件给文案」。 | 导入时先以 `positionAt(record, moves.length)` 全量重放校验，抛错即按导入失败处理（沿用同一句文案）；回放页对逐着重放失败定一个可见结果（移除该条或显示损坏文案），并在 §6 补断言。 |
| 3 | Branch provenance | 🔴 | `docs/design/modules/replay.md` §2 的分支「读写都包 try/catch：隐私模式配额异常、损坏 JSON 一律当作空表，绝不把异常抛给页面」与 §3 的分支「记录坏掉（解析失败、重放抛错）→ 丢弃 `current` 开新局……也不弹错误」既无引用的观察/日志/用户反馈，也无复现命令，且都不在 §5 测试清单（只列「存储读写、上限淘汰、损坏 JSON、续局记录」）。同批已有口径可循：`docs/design/modules/app-shell.md` — "这是地址栏兜底，无观察来源、也无用例断言。" 与 "场景：`test/integration/drill.test.tsx` 用固定 seed 进入并确定作答（复现命令 `npm run test:ui`）"。 | 每个分支写来源：配额分支给出以 stub 让 `setItem` 抛错的用例与命令（或按 `docs/design/modules/app-shell.md` 写法明写「无观察来源」并给用例）；丢弃 `current` 分支给出复现与用例，或改为保留并提示。 |
| 4 | Document ownership | 🟡 | `docs/design/modules/replay.md` §5 表里的 `ReplayPage.tsx`、`routes.ts`、`App.tsx`、`OnlinePage.tsx` 在 `docs/design/modules/app-shell.md` 的文件表已有条目。`App.tsx` 两处职责不同：前者「导航第五项；启动时恢复 `current`；本地存局接线」，后者「壳：路由订阅、导航、对局状态与课程进度。」。`docs/design/modules/online.md` 已定「页面文件（`src/client/pages/OnlinePage.tsx`）的清单在 `docs/design/modules/app-shell.md` §4，本表不重复。」 | §5 只留本模块新增件与既有件的接法，页面与路由清单指向 `docs/design/modules/app-shell.md` §4，同一文件不出两份职责。 |
| 5 | Methodology compliance | 🟡 | `docs/design/modules/replay.md` §8「需要同步的文档」列的四处改动在审阅范围内都已落地：`docs/design/modules/app-shell.md` 已有 "｜ `#/replay` ｜ 棋谱列表 ｜"、"｜ `#/replay/<id>` ｜ 单局回放 ｜"、导航五项与文件表条目；`docs/design/modules/local-play.md` §1 已有 "存局与回放见 `docs/design/modules/replay.md`；联机与棋谱持久化不在本模块。"；`docs/design/modules/online.md` §3 已有终局存棋谱一段；`test/RTM.md` 已有 "｜ F1-5 ｜ 棋谱回放、导入导出与续局 ｜"。§5 又把 routes.ts 写成「增 `replay` 与 `replay/<id>` 两条路由」，而壳档路由表已列两条（`src/client/shell/routes.ts` 里还没有这两个取值）。 | 删掉 §8 与 §5 的「增/需要同步」表述，改为指向现状；同步动作落批次记录，不留在设计档（`AGENTS.md`：「需求与设计文档只写"现在是什么"，不写历史」）。 |
| 6 | Affected-file tier | 🟡 | `docs/design/modules/replay.md` 没有文件分档结论行，而同批档都写了（`docs/design/modules/app-shell.md` "文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。"；`docs/design/modules/local-play.md` "本批源文件与测试文件均未跨 500 行档（最大 `src/client/board/Board.tsx` 394 行、`src/client/app.css` 390 行），无需拆分方案。"）。本次抽查：`src/client/App.tsx` 不足 195 行、`src/client/pages/OnlinePage.tsx` 不足 330 行、`src/client/game/session.ts` 172 行——无跨档文件，但结论句缺失；新增 `ReplayPage.tsx` 一个文件担列表/回放/导入/导出四事，无尺寸口径。 | 补一行实测结论（哪个文件跨档 → 拆分方案；都不跨 → 明写），并写明 `ReplayPage.tsx` 的内部切分。 |
| 7 | Existing-piece check | 🟡 | `docs/design/modules/replay.md` 无现有件三问：`GameRecord`、`positionAt`、`parseRecord`、`recordText`、`ReplayPage`、「棋谱」导航文案、「还没有棋谱」「文件不是有效的棋谱」「导出」文案、`records.ts` 的读写函数都未答 where/verbatim/who。同批 `docs/design/modules/local-play.md` 与 `docs/design/modules/online.md` 都带该块；复用件已确证：`src/client/board/Board.tsx` — "｜ { readonly kind: 'demo' }"，以及 `src/client/game/session.ts` 的 `createSession`。 | 补现有件检查：`Board` demo 模式、`createSession`、`INITIAL_FEN` 记 existing；新文案与新名字记 none found；有替代件不可用要写理由。 |
| 8 | Acceptance criteria | 🟡 | `docs/design/modules/replay.md` §6/§7 只点测试文件名，没有可执行的验收命令。同批 `docs/design/modules/online.md` 有 "本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；`npx vitest run test/integration/online.test.tsx`。"，`docs/design/modules/local-play.md` 有 "单元测试：`node --test test/client-geometry.test.ts test/client-session.test.ts`"。 | 补「本批验收命令（只跑改动面）」：`node --test test/record.test.ts test/records-storage.test.ts`；`npx vitest run test/integration/replay.test.tsx test/integration/local-play.test.tsx`。 |
| 9 | Clarity | 🟡 | `docs/design/modules/replay.md` §4 定了 `#/replay/<savedAt>`，但「库里没有这个 id」的行为（记录被删、旧地址、导入失败中途）未定，§6/§7 也无对应断言。 | 定一个可见结果（回列表并给一句文案，或显示「棋谱不存在」）写进 §4，并在 §7 点名由哪个用例断言。 |
| 10 | Integration-test design | 🟡 | `GameRecord.startFen` 的来源没落实。`docs/design/modules/replay.md` 说 "联机快照的 `moves` / `result` / `startFen` 已经是可回放的数据"，`docs/design/modules/online.md` §3 说 "终局存棋谱：收到带 `result` 的快照时，棋手客户端把 `startFen` / `moves` / `result` 与双方剩余时钟写进本地棋谱库"，但 `docs/design/modules/online.md` §2 的 `Snapshot` 字段到 "drawBlocked: Color ｜ null; // 拒绝后、对方走一着前不能再提议的一方" 为止，没有 `startFen`。 | 指明来源（房间恒以 `INITIAL_FEN` 开局 → 客户端取该常量；或快照补 `startFen`），并让 `docs/design/modules/online.md` §3 与新口径一致。 |
| 11 | Requirements coverage | 🟡 | `docs/design/modules/replay.md` §1 校验清单未含 `result` 与 `clockMs`：`result: { type: 'zzz' }` 能过 `parseRecord`，而结果文案按取值渲染、无兜底；`clockMs` 负数或缺省也能进。`docs/requirements/xiangqi.md` F1.6 的「导出的 JSON 导入后能完整回放」不覆盖这条。 | 校验 `result` 的 `type` / `winner` 取值与 `clockMs` 为正，不通过同按导入失败处理，与第 2 行的全量重放校验一起写进 §1。 |
| 12 | Document ownership | 🔵 | 本次无文档地图，Document ownership 只能按 `AGENTS.md` 的层表与同批模块档的归属句判断，判据降级。 | 文档地图补齐前，以 `AGENTS.md` 层表与 `docs/design/modules/online.md` 的页面清单归属句为准。 |
| 13 | Clarity | 🔵 | 路由参数名两处不一：`docs/design/modules/replay.md` §4 "路由 `#/replay`（列表）与 `#/replay/<savedAt>`（回放）"，`docs/design/modules/app-shell.md` "｜ `#/replay/<id>` ｜ 单局回放 ｜"。 | 统一为同一参数名，以路由表的拥有者为准。 |
| 14 | Scope | 🔵 | `clockMs` 是「每方包干毫秒」，F1.4 固定 10 分钟包干，本设计里它既不读也不校验。`savedAt` 兼作记录 id 与路由键，同一毫秒存两条会撞 id（连续导入两个文件可能同秒）。 | 说明 `clockMs` 的用途或删掉；`savedAt` 作 id 时给出同毫秒处理（追加序号）。 |
| 15 | Clarity | 🔵 | `docs/design/modules/replay.md` §3「关页期间不扣时，与用户已确认的口径一致」在本次范围内没有记录来源；`docs/requirements/xiangqi.md` F1.6 原文只写 "重开后局面与时钟接上"。 | 注明该口径的出处，或把「暂停」写成明确的取舍理由（关页期间无法计时）。 |

计数：🔴 3 · 🟡 8 · 🔵 4，共 15 条。

VERDICT: changes-required

### 轮次 2（评审子代理）

第 3 轮复核：对第 2 轮 19 条逐条核对当前文件（设计档全文重读，壳档与本地对局档核对指针与字段）。表中路径均为 `docs/design/modules/` 下的完整档名。

| # | Orig# | 文件 | 级别 | 状态 | 要点 |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/modules/replay.md | 🔴 | Fixed | §3 恢复入口 clockFrom / restoreSession；§5 与分档均列 session.ts |
| 2 | 2 | docs/design/modules/replay.md | 🔴 | Fixed | isReplayable 两道校验贯穿导入与回放页三种坏输入 |
| 3 | 3 | docs/design/modules/replay.md | 🔴 | Fixed | 存储两条兜底与续局丢弃分支都带复现来源与断言 |
| 4 | 4 | docs/design/modules/replay.md | 🟡 | Fixed | §5 指向 app-shell §4，不再重复职责 |
| 5 | 5 | docs/design/modules/replay.md | 🟡 | Fixed | 旧同步清单已删，路由措辞与壳档一致 |
| 6 | 6 | docs/design/modules/replay.md | 🟡 | Fixed | 分档结论与 ReplayPage 两区块切分已写 |
| 7 | 7 | docs/design/modules/replay.md | 🟡 | Fixed | 现有件检查与命名块齐备 |
| 8 | 8 | docs/design/modules/replay.md | 🟡 | Fixed | 验收命令按改动面给出 |
| 9 | 9 | docs/design/modules/replay.md | 🟡 | Fixed | 不存在 id 回列表并提示，集成用例覆盖 |
| 10 | 10 | docs/design/modules/online.md | 🟡 | Fixed | 快照补 startFen，协议件列入改动 |
| 11 | 11 | docs/design/modules/replay.md | 🟡 | Fixed | result 取值校验，时钟字段上下界 |
| 12 | 12 | 无（评审环境） | 🔵 | Accepted | 环境无文档地图，文档侧无可改动作 |
| 13 | 13 | docs/design/modules/replay.md | 🔵 | Fixed | 路由 #/replay/<id> 与壳档路由表一致 |
| 14 | 14 | docs/design/modules/replay.md | 🔵 | Fixed | id 撞号 +1 规则；clockMs 字段已去 |
| 15 | 15 | docs/design/modules/replay.md | 🔵 | Fixed | 关页不扣时给出技术理由并指 F1.6 |
| 16 | 16 | docs/design/modules/online.md | 🔴 | Fixed | 快照补 moveLog: Move[]，§3 改走 startFen / moveLog |
| 17 | 17 | docs/design/modules/replay.md | 🟡 | Fixed | restoreSession 参数改为 (startFen, moves, clock) |
| 18 | 18 | docs/design/modules/replay.md | 🟡 | Fixed | id 改为 number 或 null，与 current 说明一致 |
| 19 | 19 | docs/design/modules/replay.md | 🔵 | Fixed | Survey 段与改既有件段长行已拆成列表 |

计数：19 条全部闭合（Fixed 18 / Accepted 1）；未决 🔴 0；本轮无新增条目。

VERDICT: pass

## §4 用户批准（主 agent）

用户批准记录：

- 2026-11-14 03:06，用户回「收口」——批准本批交付（F1.6 棋谱存局：回放、导出导入、关页续下、联机终局入库），同意按收口链结算。
- 交付内容与验证读数见 §5、§6；F1.7 观战属 M5c，未在本批实现。

## §5 实施记录（实施者：主 agent ∥ coder）

**实施记录（M5b：棋谱回放与存局）**

落地文件：

- 新增 `src/shared/record.ts`：`GameRecord`、`positionAt`、`isReplayable`、`parseRecord`、`records.ts` 无关的 `notationsOf`、`recordText`。
- 新增 `src/client/storage/records.ts`：`listRecords` / `findRecord` / `saveRecord` / `deleteRecord` / `loadCurrent` / `saveCurrent` / `clearCurrent`，存储可注入（`KeyValueStore`），默认取 `globalThis.localStorage`。
- 新增 `src/client/pages/ReplayPage.tsx`：列表、回放（`demo` 棋盘 + 首/上一步/下一步/末 + 滑条 + 记谱点选）、导入、导出、坏记录与不存在 id 的兜底。
- 改 `src/shared/clock.ts`（`clockFrom`）、`src/client/game/session.ts`（`restoreSession`）、`src/client/shell/routes.ts`（`#/replay` 与 `#/replay/<id>`）、`src/client/App.tsx`（导航第五项、启动恢复、走子写 current、终局转存棋谱、`pagehide` 补写）、`src/client/pages/OnlinePage.tsx`（终局快照存谱）、`src/shared/protocol.ts` 与 `src/server/room.ts`（快照补 `startFen` 与 `moveLog`）、`src/client/app.css`（棋谱页样式与 720px 断点）。

机制要点：

- 记录只存起始局面 + 着法 + 结果 + 双方剩余；回放用 `playMove` 逐步重算，不存每步 FEN。
- 导入两道关：`parseRecord` 管结构（坐标、着法数、时钟上下界、`result` 取值），`isReplayable` 全量重放管走法；任一不过提示「文件不是有效的棋谱」，不进库。
- 续局：启动读 `current`，`restoreSession` 重放局面与记谱，时钟 `clockFrom(redMs, blackMs, 轮到谁, now)` 以恢复时刻为锚（关页期间不扣时）；坏记录丢弃并开新局。
- 终局：本地局写棋谱并清 `current`；联机局由棋手客户端在带 `result` 的快照到达时写一条（`moveLog` 为坐标来源）。

测试与读数：

- `npm run check`：typecheck 通过；**177 单测全绿**（新增 `test/record.test.ts` 6 条、`test/records-storage.test.ts` 9 条、`test/routes.test.ts` 棋谱路由 1 条）；**34 前端用例全绿**（新增 `test/integration/replay.test.tsx` 6 条，`test/integration/local-play.test.tsx` 加续局 3 条）。
- `npm run build`：成功，主包 94.95 kB（gzip）。
- 浏览器实跑：走「炮八进一」→ 黑方认输 → 棋谱页列表出现「红方胜 · 认输 1 着」→ 进入回放，拖到末着显示「第 1 / 1 着」且记谱高亮「1. 炮八进一」；刷新页面后对弈页恢复「炮八进一」、记谱与双方剩余（`红 09:57 黑 09:58`）、状态「黑方走棋」，`current` 已按新局重写。

未做：

- 移动端棋谱页未做真机 375px 截图核对（CSS 已给 720px 断点，结构单列）。
- 导出按钮的真机下载未验（浏览器实跑点击无异常；内容由 `recordText` 单测覆盖）。

**代码评审第 1 轮整改（5🟡 / 7🔵）**

- 去重跨挂载：`saveRecord` 增 `dedupe` 选项，按「起始局面 + 逐着坐标 + 结果」判同一局；`App` 与 `OnlinePage` 都走它，切页或刷新重连不再重复入库。
- 写失败不丢局：`App` 只在 `saveRecord` 返回记录时才 `clearCurrent()`。
- 补三处声明过的用例：联机终局快照 → 棋谱库（`moves` 逐着等于 `moveLog`）；导出文本回灌导入（stub `URL.createObjectURL` 取 Blob 文本）；未完成局走法非法 → 丢弃开新局。
- 口径对齐：不存在 id 只留右侧「棋谱不存在」、不改写地址；「这条棋谱无法回放」收敛为 `isReplayable` 为假 / `positionAt` 抛错两种入口（结构坏的条目在存储层就被丢掉）。
- 结果文案收成一份：新增 `src/client/panel/result-text.ts`，面板、联机页、棋谱页共用。
- 其余：`saveRecord` 淘汰按 `savedAt` 排序后截断；`deleteRecord` 返回 boolean 并按结果给回执；导出后 `revokeObjectURL` 推到下一个宏任务；删掉 `findOrNotice` 包装并注明 `records` 只作刷新触发；文档分档数字按实测（141 / 342 / 212 / 243 行）重填。

读数：`npm run check` **180 单测 + 37 前端用例全绿**；`npm run build` 94.94 kB（gzip）；`doc_check` 交付门 PASS（6 档）。

**代码评审第 2 轮整改**

- 去重只留给联机：`App` 的本地终局转存不再传 `dedupe`，两盘内容相同的本地对局各留一条；联机仍靠 `dedupe` 拦跨挂载重复。`docs/design/modules/replay.md` §4 写明「仅联机」及本地不需要去重的理由（`savedRef` 拦单次挂载、终局后 `current` 已清、`loadCurrent` 拒绝已结束记录）。
- 删掉 `OnlinePage` 的 `resultText` 纯转发，直接调 `resultLabel`。
- 用例标题与口径对齐：「不存在的 id：右侧提示且不改写地址」。

读数：`npm run check` **180 单测 + 37 前端用例全绿**；`npm run build` 94.93 kB（gzip）。

## §6 验证与收口（父代理）

**验证与收口**

验证读数（收口时最后一次全量）：

- `npm run check`：`tsc --noEmit` 通过；`node --test "test/**/*.test.ts"` **180 通过 / 0 失败**；`vitest run` **37 用例全绿**。
- `npm run build`：成功，主包 **94.93 kB**（gzip；上批 92.16 kB）。
- `doc_check` 交付门：PASS（`docs/design/modules/replay.md`、`docs/design/modules/online.md`、`docs/design/modules/app-shell.md`、`docs/design/modules/local-play.md`、`test/RTM.md`、批次档共 6 档，0 命中）。
- 设计评审 3 轮、代码评审 2 轮，末轮均 pass。
- 浏览器实跑（Chromium + `npm run dev`）：走「炮八进一」→ 黑方认输 → 棋谱页列表出现「红方胜 · 认输 1 着」→ 进入回放，末着显示「第 1 / 1 着」、记谱高亮「1. 炮八进一」；刷新页面后对弈页接回「炮八进一」、双方剩余（红 09:57 / 黑 09:58）与「黑方走棋」，未完成局按新局重写。

需求对照：

| 需求 | 结论 | 落点 |
|---|---|---|
| F1.6 对局结束后可逐步回放 | 完成 | `src/shared/record.ts` 的 `positionAt` + `src/client/pages/ReplayPage.tsx` 的步进器 |
| F1.6 棋谱导出与导入 JSON | 完成 | `recordText` / `parseRecord` / `isReplayable` + 回放页导入导出；导出→导入端到端有用例 |
| F1.6 本地对局关页重开后接着下 | 完成 | `src/client/storage/records.ts` 的 `current` + `restoreSession` + `clockFrom`；集成用例覆盖局面、记谱与双方剩余 |
| 联机终局入库（用户批准的口径） | 完成 | `src/client/pages/OnlinePage.tsx` 终局钩子，`moveLog` 为坐标来源，内容去重 |

测试与用例：`test/record.test.ts` 6 条、`test/records-storage.test.ts` 11 条、`test/integration/replay.test.tsx` 7 条（新增 F1-5 行）、`test/integration/local-play.test.tsx` 加 4 条续局、`test/integration/online.test.tsx` 加 1 条联机存谱、`test/routes.test.ts` 加棋谱路由。矩阵见 `test/RTM.md` 的 F1-5 行。

未做与残余：

- F1.7 观战（含 8 人上限、只读）属 M5c，本批未实现。
- 移动端棋谱页只有 720px 单列布局，未做真机 375px 截图核对。
- 导出按钮的真机下载未验（jsdom 用 stub 覆盖、浏览器点击无异常）。

收口结论：本批交付完成，设计评审与代码评审均通过，验证链全绿。
