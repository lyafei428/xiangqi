# 2026-11-14 · M5a 计时与认输求和
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「按计划」批准 M5 需求草案与两批拆分；本批为 M5a：F1.4 计时、F1.5 认输与求和。
> 台账 = #5（xiangqi · 归批）。前情 = M4 联机对战（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

本批判据：用户 2026-11-14 批准 M5 需求草案与两批拆分；本批取 M5a。需求条目已落 `docs/requirements/xiangqi.md`：F1.4 计时、F1.5 认输与求和（F1.6 棋谱存局、F1.7 观战留在 M5b）。

用户确认的四条口径：
- 用时：每方 10 分钟包干（10+0），无读秒、无加秒。
- 关页：本地对局关页暂停、重开接上（M5b 的存局实现）；联机由服务端时钟继续走。
- 求和：每方在对方走一着前只能提议一次，不设总次数。
- 观战：上限 8 人，不占座位、不能走子/认输/求和（M5b）。

本批交付：
- 共享时钟模型与 `timeout` 判罚；本地会话的时钟、认输；联机房间的权威时钟、认输、求和与拒绝后阻塞；两处页面显示时钟与按钮。
- 测试：时钟单测、本地会话、房间与双客户端、jsdom 本地与联机。
- 文档：`docs/design/modules/clock.md` 新增；`docs/design/modules/online.md`、`docs/design/modules/local-play.md`、`test/RTM.md` 同步。

关键判据：
- 时钟只存剩余毫秒；本地由页面每秒 tick，联机由服务端每秒检查并以服务端时间为唯一裁决。
- 归零判 `timeout`、认输判 `resign`、求和接受判 `agreement`；终局后棋盘锁盘。
- 求和只在联机；本地同屏不设求和。

本批不做：棋谱回放、持久化、观战（M5b）；不做读秒、加秒、时间档位选择。

上抛项：无（四条口径已获用户「按计划」批准）。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

设计档落点：新增 `docs/design/modules/clock.md`（时钟模型、判罚、本地与联机分工、页面、文件、验收、集成测试）；同步 `docs/design/modules/local-play.md`（会话字段与动作、验收、§8 delta）、`docs/design/modules/online.md`（协议消息、快照字段、服务端规则、面板、验收、§9 delta）、`test/RTM.md`（F1-3 / F1-4 两行）。

机制设计：
- 时钟：`src/shared/clock.ts` 纯函数，只存双方剩余毫秒与在走方；本地页面每秒 `tick`，联机服务端每秒检查；归零判 `timeout`。
- 认输：`resign` 只接受当前行棋方，判 `resign`；本地与联机都有。
- 求和：联机专属；`offer-draw` / `draw-response`，拒绝后 `drawBlocked` 阻止同一方在对方走子前重复提议；接受判 `agreement`。
- 结果类型：`ResultType` 增 `timeout` / `resign` / `agreement`，`GamePanel` 与联机面板补文案。

受影响文件与测试覆盖：

| 文件 | 动作 |
|---|---|
| `src/shared/clock.ts` | 新增时钟模型 |
| `src/shared/types.ts` | 结果类型增三值 |
| `src/client/game/session.ts` | 时钟、认输、tick |
| `src/client/panel/GamePanel.tsx`、`src/client/pages/PlayPage.tsx` | 时钟显示与认输、每秒 tick |
| `src/server/room.ts`、`src/server/rooms.ts`、`src/server/server.ts` | 房间时钟、认输、求和、逐秒检查 |
| `src/shared/protocol.ts` | 三个消息与快照字段 |
| `src/client/online/session.ts`、`src/client/pages/OnlinePage.tsx` | 求和状态、按钮与横幅 |
| `test/clock.test.ts`、`test/client-session.test.ts`、`test/room.test.ts`、`test/online.test.ts`、`test/integration/local-play.test.tsx`、`test/integration/online.test.tsx` | 新增/扩展 |

验收对照：

| 需求 | 落点 |
|---|---|
| F1.4 每方 10 分钟、归零判负、缩放不重置 | `src/shared/clock.ts` + 会话/房间 |
| F1.5 认输 | 本地与联机 `resign` |
| F1.5 求和与拒绝后不重复 | 联机 `offer-draw` / `draw-response` / `drawBlocked` |

关键决策：时钟只存剩余毫秒（不存绝对时间）；联机以服务端时间为唯一裁决；求和仅联机。

上抛项：无。

收口核对（落地与设计一致性）：

- `docs/design/modules/clock.md` 的模型、判罚、页面、文件表、验收对照、集成设计均与代码一致；两处签名差异已在 §1 与 §5 修正为 `createClock(now, perSide?)`、`formatClock(ms)`。
- 联机快照的时钟语义定为「快照时刻的剩余」，已写进 `docs/design/modules/clock.md` §4 与 `docs/design/modules/online.md` §2；代码 `snapshotOf(room, now)` 按此实现。
- 设计未写、实现补上的两道门槛（两人未坐满不接受落子；认输与求和也先结清超时）已回写 `docs/design/modules/clock.md` §4 与 `docs/design/modules/online.md` §3。
- 批量拆分未变：F1.6 棋谱存局与 F1.7 观战留在 M5b。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

**独立设计评审：M5a 计时与认输求和（`docs/design/modules/clock.md` 及其联动的 `docs/design/modules/local-play.md` / `docs/design/modules/online.md`）**

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | Requirements | 🔴 | F1.5 写「任一方可提议和棋」，设计两处都缩成行棋方：`docs/design/modules/clock.md`「`offer-draw`：只接受行棋方、且在 `drawBlocked` 不是自己时；记录 `drawOffer`。」，`docs/design/modules/online.md` §3「`offer-draw` 只接受行棋方且自身未被 `drawBlocked`」，无偏离理由；且 `docs/design/modules/clock.md`「任意一方走子后清空 `drawBlocked`（对方已走一着，可以再提议）」与需求「对方走一着前不能重复提议」在放开提议权后并不等价。 | 二选一：放开为两名棋手皆可提议、清空条件改成「非被拒方走子后清空」；或写明偏离理由并回报需求层确认，同时改 `test/RTM.md` 的 F1-4 验收文字。 |
| 2 | Feasibility | 🔴 | 时钟模型按写下的签名无法实现：`docs/design/modules/clock.md` 称「倒计时按 `Date.now()` 差值与「上次切换时刻」计算；`ClockState` 只存剩余毫秒，不存绝对时间戳，避免两套时间。」，而接口只有 redMs/blackMs/running；`switchClock(clock, now)` 却要「扣掉 running 方从上次切换至今的时间」，「上次切换时刻」无处存放。改成每秒 tick 累减又违反同句，并在切页/缩放/后台标签下白送时间，破坏 F1.4「不停表」。联机同病：`docs/design/modules/online.md`「房间持 `ClockView`（剩余毫秒与在走方）；落子成功扣时并换边」同样没交代锚点字段。 | 明确第二套时间放哪：`ClockState` 增 `lastSwitchAt`（或 `switchClock(clock, now, since)` 显式传锚点），tick 只负责显示刷新、扣时一律按 `now − lastSwitchAt`；联机的 RoomState 同样写明锚点。 |
| 3 | Feasibility | 🔴 | 联机时钟在两次 `state` 之间不走：`docs/design/modules/online.md`「广播：每次状态变化向房内两人发 `state`」，而 `docs/design/modules/clock.md` 规定「时钟显示每秒刷新一次；只在走子、切页、缩放时以会话状态为准，不另存一份」——每秒刷新读的是同一份快照数字，玩家看到静止数字后被判负，F1-4「双方看到同一时钟」无法成立。 | 定一种机制写清：客户端按「快照值 − (now − 收到快照时刻)」投影在走方剩余（仅显示、归零仍由服务端裁决，快照带 `serverNow` 消除漂移），或服务端每秒广播一次 `state`；并写清切页/重连后重取快照。 |
| 4 | Requirements | 🔴 | 三个新结果的文案无归属：F1.4 验收要「归零立刻判负并显示「超时」」、`test/RTM.md` 的 F1-3 要「显示「超时，对方胜」」，但 `docs/design/modules/clock.md` 文件表只写 GamePanel「时钟显示与「认输」」，现有件检查更写「`GamePanel`：existing — 结局文案与「新局」照旧，只加时钟与认输」；`timeout`/`resign`/`agreement` 三条文案、`test/game-panel.test.tsx` 与 `docs/design/modules/local-play.md`「五种结局文案正确」的断言都停在旧状态。 | 给出三条新结局文案并把 GamePanel 的文件表职责补上；`docs/design/modules/local-play.md`「五种结局文案」改八种；`test/game-panel.test.tsx` 进改动面验收命令。 |
| 5 | Requirements / Protocol | 🔴 | F1.5 验收「重复提议被拒」在协议层没有出口：`docs/design/modules/online.md` 定「`rejected.reason` 是固定取值（`not-in-room` / `not-your-turn` / `game-over` / `stale-seq` / `illegal-move`）」，被 `drawBlocked` 拦下的再次提议（此时提议方仍是行棋方，`not-your-turn` 是假话）与无提议时的 `draw-response` 都没有取值，客户端也无文案可渲染。 | 增补取值（如 `draw-blocked` / `no-draw-offer`），按 `docs/design/modules/online.md` §2 的既有格式写「来源 + 复现」，并给对应文案。 |
| 6 | Document ownership | 🔴 | 同一机制两处活描述相反：`docs/design/modules/local-play.md` §1 仍写「本模块不做联机、计时、认输求和、棋谱持久化；这些在后续批次。」，同一文件的会话表却已列 `clock`、`resigned`、动作行「`tick(now)` 推时钟；`resign` 当前行棋方认输」、§7「计时与认输 \| 时钟归零显示「超时，对方胜」并锁盘」，读者无法判断计时归谁。 | 把 §1 边界句改成本批后的现状（本模块含计时与认输，求和与联机计时见 `docs/design/modules/clock.md` / `docs/design/modules/online.md`），删掉「这些在后续批次」。 |
| 7 | Methodology | 🟡 | `docs/design/modules/clock.md` 的 Survey evidence 列了需求档、架构 §10、types.ts、session.ts、GamePanel.tsx，却漏掉本批要改的 `docs/design/modules/local-play.md` 与 `docs/design/modules/online.md`（Closest precedent 正指向前者、§4 把协议字段交给后者），第 6 条的冲突正是漏勘察的产物，末尾「未发现与既有设计冲突之处」因此不成立。 | 把这两份文档补进勘察清单，并重写冲突结论。 |
| 8 | Document ownership | 🟡 | 判罚条文两处重复：`docs/design/modules/clock.md` §4 已定「`resign`：只接受当前行棋方的请求；判 `resign`」「任意一方走子后清空 `drawBlocked`…」，`docs/design/modules/online.md` §3 又整段重述「认输与求和：`resign` 只接受当前行棋方；`offer-draw` 只接受行棋方且自身未被 `drawBlocked`；…」，分头修改即漂移（同文档 §2 已有「判罚见 `docs/design/modules/clock.md` §2」的正确写法）。 | `docs/design/modules/online.md` §3 只留「协议与广播怎么接」并指向 `docs/design/modules/clock.md` §2，判罚条文只留一处。 |
| 9 | Clarity | 🟡 | 和棋提议的生命周期没定：只说走子清空 `drawBlocked`，没说走子、认输、超时、终局是否清空 `drawOffer`；提议方必须是行棋方，最常见的「提议后自己走一着」是继续挂着还是一并作废，实现只能猜。 | 补一句：任一方走子、任一方认输/超时、终局时 `drawOffer` 一律清空（或明确「应答前有效」），并说明横幅随之消失。 |
| 10 | Acceptance criteria | 🟡 | `drawBlocked` 无断言落点：`test/RTM.md` 的 F1-4「双方看到同一时钟；归零判负；求和被接受判和；被拒后可继续」里的「被拒」指对方拒和，未覆盖 F1.5 验收「重复提议被拒」；`docs/design/modules/clock.md` §7 只给机制落点，不是可验证断言。 | F1-4 业务结果加「再次提议被拒并给出提示」，或在 room/online 单测验收行点名断言 `drawBlocked` 的拒绝路径。 |
| 11 | Affected-file tier check | 🟡 | 文件表没有测试文件行（`test/clock.test.ts` 新增，`test/client-session.test.ts`/`test/room.test.ts`/`test/online.test.ts` 都会长），而「文件分档：本批新增文件均不足 300 行；`src/client/game/session.ts` 与 `src/server/room.ts` 改动后仍不足 500 行，无 300+ 行单函数，不需要拆分方案。」只覆盖源码，测试文件档位无法判断也无法抽查。 | 测试文件补进文件表并各给一行档位结论。 |
| 12 | Clarity | 🟡 | `src/client/pages/PlayPage.tsx` 存在性没交代：`docs/design/modules/clock.md` 文件表直接列「每秒 tick 与新局重置」，命名节又没把它写成新名字，而 `docs/design/modules/local-play.md` 文件表只有「`src/client/App.tsx` \| 页面骨架、三档布局、面板收起、棋盘尺寸测量。」——「本地对弈页面在哪」两处说法不同。 | 在现有件检查里给 PlayPage 一条 existing / none found 结论，并把 `docs/design/modules/local-play.md` 文件表对齐。 |
| 13 | Verification | 🔵 | F1.4 验收的「从 1440 缩到 375，时钟不重置、不停表」只给了机制（`docs/design/modules/clock.md`「时钟只存剩余毫秒，布局变化不重建会话」），没给验证方式；本项目响应式验收惯例是浏览器实跑（`test/RTM.md` 的响应式节明说 jsdom 无布局）。 | 照 `docs/design/modules/local-play.md` §7 的写法补一条「浏览器实跑：连续缩放后时钟不断且数值接上」。 |
| 14 | Clarity | 🔵 | 同一形状两个名字：`docs/design/modules/clock.md` 的 `ClockState` 与 `docs/design/modules/online.md` 的 `ClockView` 字段完全一致，关系未说明。 | 写一句「`ClockView` 是 `ClockState` 的线上投影（同形状，可复用同一类型）」。 |
| 15 | Scope | 🔵 | 观战者（M5b）的 `resign`/`offer-draw` 拒绝路径只写「不参与认输与求和」，没给服务端回什么码；M5b 落地时要再补 `RejectReason`。 | 先记下：本批或 M5b 开头补观战者拒绝码（可复用 `not-your-turn` 或新增 `observer`），本批不实现。 |
| 16 | Clarity | 🔵 | `resigned: Color \| null` 与 `result` 是同一事实的两个来源（`docs/design/modules/clock.md`「`GameSession` 增加 `clock: ClockState`、`resigned: Color \| null`」），与项目「状态只有一个权威」的惯例相抵。 | 若不用于区分「谁认输」的文案，直接从 `result` 推导并去掉该字段；若保留，写明两者的同步不变式。 |

计数：🔴 6 · 🟡 6 · 🔵 4，共 16 条。🔴 集中在时钟模型的时刻存放（#2）、联机时钟显示机制（#3）、求和提议权被收窄为行棋方（#1）、拒绝码缺口（#5）、新结局文案归属（#4）、`docs/design/modules/local-play.md` §1 边界句与新内容相反（#6）。

VERDICT: changes-required

### 轮次 2（评审子代理）

**第 2 轮复核：M5a 计时与认输求和（整改核实）**

上轮 16 条逐条核实：
- #1 求和授权：已放开为「任一棋手」（已核实）。
- #2 时钟模型：`docs/design/modules/clock.md` 已加 `since` 锚点，`remainingOf` 为唯一时间源（已核实）。
- #3 联机显示：已改为按收到快照的时刻投影，归零仍由服务端裁决（已核实）。
- #4 结局文案：三条新文案入 §2 表，`test/game-panel.test.tsx` 进验收命令（已核实）。
- #5 拒绝码：`draw-blocked` / `no-draw-offer` 已入固定取值表并带来源与复现（已核实）。
- #6 边界句：`docs/design/modules/local-play.md` §1 已改写为「本模块含计时与认输」（已核实）。
- #8 判罚重复：已收敛为引用（已核实）。
- #10–#13 已闭合：`drawBlocked` 断言、测试文件与分档、`PlayPage` 结论、缩放实跑都已补上。
- #9 未闭合：走子是否清空 `drawOffer` 两档不一致（见下表 #2）。
- #14 / #16 已消除：`ClockView` 不再单列、`resigned` 字段已删。
- #15 改为延到 M5b，但留下悬空引用（见下表 #3）。

| # | 类别 | 严重度 | 文件 | 问题 | 建议 |
|---|---|---|---|---|---|
| 1 | Document ownership | 🔴 | `docs/design/modules/clock.md` | 认输权限同一规则两处相反：§7 写「本地与联机的 `resign`，任一棋手可认输」，§2 写「认输：只有当前行棋方可以认输（本地同屏由当前方按）；终局后不可。」，§4 写「`resign`：只接受当前行棋方的请求；判 `resign`。」；`docs/requirements/xiangqi.md` F1.5 亦为「行棋方随时可认输」。按 §7 实施会放开非行棋方认输。 | 把 §7 该行改为「本地与联机的 `resign`，只接受当前行棋方」。 |
| 2 | Document ownership | 🔴 | `docs/design/modules/clock.md` | 清空 `drawOffer` 的事件列表两处不一致：`docs/design/modules/clock.md` §4 写「提议、拒绝、接受、认输、超时、终局都清空 `drawOffer`」（无「走子」），`docs/design/modules/online.md` §3 写「提议、拒绝、接受、走子、认输、超时、终局都清空 `drawOffer`」（有「走子」）。走子后待答提议是保留还是作废，两档给不出唯一答案。 | 以 `docs/design/modules/clock.md` 为准补「走子」进 §4 列表（或写明「走子不作废提议」），`docs/design/modules/online.md` §3 只引用。 |
| 3 | Doc reference | 🟡 | `docs/design/modules/clock.md` | 悬空引用：§4 写「观战者不参与认输与求和；拒绝码留到 M5b（见 `docs/design/modules/online.md` §9 的观战说明）」，但 `docs/design/modules/online.md` §9 是集成测试设计，无观战说明；观战只在其 §1 的「第三个人被拒（观战属 M5）」。 | 改指 `docs/design/modules/online.md` §1，或删括注。 |
| 4 | Doc state | 🟡 | `docs/design/modules/local-play.md` | 「五种结局文案」旧口径留两处：§7 行标题仍写「五种结局文案正确」而同格正文写「加计时后扩为八种（加超时、认输、双方同意）」；§8 末尾仍写「五种结局文案由 `test/game-panel.test.tsx` 在组件层断言」。 | 两处「五种」改「八种」，与 `docs/design/modules/clock.md` §2 对齐。 |
| 5 | Clarity | 🟡 | `docs/design/modules/clock.md` | 求和状态机的边界输入没定义：提议权放开给「任一棋手」后，「已有待答提议时另一方再提议」（§4 只说「记录 `drawOffer`」，等于静默覆盖）与「提议方自己发 `draw-response`」都没有语义；`docs/design/modules/online.md` §2 的固定码只有 `draw-blocked` / `no-draw-offer`，套不上这两种。 | 补两句：已有提议时再提议走 `rejected`（复用或新增码）；非提议对方发 `draw-response` 回 `no-draw-offer`。 |
| 6 | Doc hygiene | 🔵 | `docs/design/modules/clock.md` | §9「需要同步的两份文档」是已执行的 TODO 段，按 AGENTS「只写现在是什么」应删；其 `docs/design/modules/online.md` 一项只做一半：§1 仍以「M4 不判超时负；」开头，§3 却已写「每秒检查在走方是否归零，归零即判 `timeout` 并广播。」 | 删 §9；§1 那句改成现状陈述。 |

计数：🔴 2 · 🟡 3 · 🔵 1（共 6 条）；上轮 6 条 🔴 已全部闭合，本轮 2 条 🔴 由整改引入。

VERDICT: changes-required

### 轮次 3（评审子代理）

**第 3 轮复核：M5a 计时与认输求和（核实上轮 6 条）**

逐条核实，全部已整改并核实：
- 上轮 #1（认输权限两处相反）：`docs/design/modules/clock.md` §2 与 §4 为「只接受当前行棋方的请求」，§7 验收行已同步为「本地与联机的 `resign`，只接受当前行棋方」，与 `docs/requirements/xiangqi.md` F1.5「行棋方随时可认输」一致。
- 上轮 #2（清空 `drawOffer` 的事件列表两档不一致）：`docs/design/modules/clock.md` §4 已补「走子」；`docs/design/modules/online.md` §3 改为「判罚与状态机见 `docs/design/modules/clock.md` §2/§4」，重复列表消失。
- 上轮 #3（悬空引用）：`docs/design/modules/clock.md` §4 已改指 `docs/design/modules/online.md` §1，该节有「第三个人被拒（观战属 M5）」。
- 上轮 #4（五种/八种口径）：`docs/design/modules/local-play.md` §7 行标题与 §8 末句均已改为「八种结局文案」。
- 上轮 #5（求和状态机边界输入无定义）：已补 `draw-pending`（已有待答提议时再提议）与「提议方自己发 `draw-response` 回 `no-draw-offer`」，`docs/design/modules/online.md` §2 两条都有来源与复现。
- 上轮 #6（已完成同步的 TODO 段）：`docs/design/modules/clock.md` 的 §9 已删；`docs/design/modules/online.md` §1 已改为「联机计时、认输与求和已实现」的现状陈述。

本轮剩余仅两条非阻塞项：

| # | Orig# | File | Severity | Status | Notes |
|---|---|---|---|---|---|
| 1 | (new) | `docs/design/modules/clock.md` | 🔵 | New: 拒绝码数目漂移——§6 文件表写「三个新消息、快照字段与两个新拒绝码。」，实际新增码为 `draw-blocked` / `draw-pending` / `no-draw-offer` 三个，`docs/design/modules/online.md` §2 也写「三个新拒绝码的来源：」。由本轮补第三个码（`draw-pending`）后未回改所致。 | 「两个」改「三个」。 |
| 2 | (new) | `docs/design/modules/clock.md` | 🔵 | New: 悬空内部指针——勘察结论写「两处都需同步（见本文末）」，但原 §9（同步清单）已随本轮整改删除，文末现为 §8 集成测试设计；且该句是对已完成同步的将来时叙述。 | 删括注，或改写为现状陈述。 |

计数：🔴 0 · 🟡 0 · 🔵 2（共 2 条，均不阻塞）。

VERDICT: pass

## §4 用户批准（主 agent）

用户批准记录：

- 2026-11-14 02:38，用户回「收口」——批准本批交付（F1.4 计时、F1.5 认输与求和），同意按收口链结算。
- 交付内容与验证读数见 §5、§6；未做项 F1.6 / F1.7 属 M5b，已在 §1 与本段之外单独交代。

## §5 实施记录（实施者：主 agent ∥ coder）

**实现记录（M5a 计时与认输求和的代码落地）**

实现清单：

- `src/shared/clock.ts`（新增）：`ClockState`（`redMs` / `blackMs` / `running` / `since`）、`createClock`、`remainingOf`、`switchClock`、`stopClock`、`timeoutColor`、`formatClock`。剩余一律由 `now − since` 算出。
- `src/shared/types.ts`：`ResultType` 增 `timeout` / `resign` / `agreement`。
- `src/shared/protocol.ts`：`Snapshot` 增 `clock` / `drawOffer` / `drawBlocked`；`ClientMessage` 增 `resign` / `offer-draw` / `draw-response`；`RejectReason` 增 `draw-blocked` / `draw-pending` / `no-draw-offer`；`draw-response.accept` 必须是布尔。
- `src/client/game/session.ts`：`clock` 字段、`tick(now)` 与 `resign` 两个动作；落子成功后 `switchClock`，终局 `stopClock`；`reset` 重建 10 分钟时钟。
- `src/client/panel/GamePanel.tsx`：双方时钟（`mm:ss`，不足 60 秒变红）、「认输」按钮（终局禁用）、八条结局文案。
- `src/client/pages/PlayPage.tsx`：每秒 `setNow` + `dispatch({type:'tick'})`，终局停表停止定时器。
- `src/server/room.ts`：房间持时钟与求和字段；`resignRoom`（只接受行棋方）、`offerDrawRoom`（任一棋手，受 `drawBlocked` 与待答提议限制）、`respondDrawRoom`、`applyTimeout`；落子清空 `drawOffer`，`drawBlocked` 只在「非被拒方走子」时清空；快照带三个新字段。
- `src/server/rooms.ts`：`resign` / `offerDraw` / `respondDraw` 门面与 `timeouts(now)` 扫描。
- `src/server/server.ts`：三条新消息分发；每秒 `rooms.timeouts()`，判超时即广播 `state`。
- `src/client/online/session.ts`：三个新拒绝码的文案。
- `src/client/pages/OnlinePage.tsx`：时钟按「收到快照的时刻」做本地投影、认输/提议和棋按钮、对方提议的接受/拒绝横幅、三条新结局文案。
- `src/client/app.css`：`.clock-row` / `.clock` / `.is-low` / `.resign` / `.btn.small`。

验证读数：

- `npm run typecheck`：通过。
- `node --test test/clock.test.ts test/client-session.test.ts test/room.test.ts test/online.test.ts`：39 用例全绿。
- `npm run check`：`node --test` 156 通过；`vitest run` 7 个文件 24 用例全绿。
- `npm run build`：成功，主包 92.01 kB（gzip；上一批 90.87 kB）。

浏览器实跑（Chromium，`npm run dev`）：

- 本地：开局显示 `红 09:54 黑 10:00`；走「炮八进一」后变 `红 09:52 黑 09:59`，红方停走、黑方走秒。
- 缩放：把 `.board-stage` 压到 420px（棋盘 648 → 388），状态仍为「黑方走棋」、记谱仍在、时钟继续走（`红 09:52 黑 09:49`），未回 10:00。
- 认输：黑方按「认输」→ `红方胜 · 认输`，按钮禁用；「新局」→ `红 10:00 黑 10:00`、记谱清空。
- 联机：建房后另开一条真实 WebSocket 以黑方入房；红方「提议和棋」后按钮禁用，黑方快照 `drawOffer='red'`；黑方应答接受后，黑方快照 `result={type:'agreement',winner:null}`，红方页面显示 `和棋 · 双方同意`，时钟显示 `红 09:58 黑 10:00`。

单元测试文件：`test/clock.test.ts`（新增，随批次档保留）。其余为既有测试文件扩展。

未覆盖与限制：

- 10 分钟真实归零等不到，超时用假时钟集成用例（`test/integration/local-play.test.tsx` 的 F1-3）覆盖；浏览器只验证了走秒与缩放不停表。
- 「同屏双人各自认输」在本地只有一个面板，按当前行棋方认输，无第二种入口可验。

**代码评审整改（第 1 轮 findings 的落地）**

- 联机时钟起点（🔴）：`joinRoom` 坐到黑位时把时钟重锚为 `createClock(now, room.clockMs)`，`RoomState` 记 `clockMs`；`applyTimeout` 对 `players < 2` 直接返回 null；`server.ts` 处理 `move` 前先结清已归零的钟。浏览器实测：建房后等 3 秒仍在 `红 10:00 黑 10:00`，对手入房后才开始走。
- 客户端投影（🟡）：锚点 effect 改依赖 `snapshot?.clock`，`presence` 不再重置锚点；未坐满时不做投影（`started = snapshot.players >= 2`），等对手期间不显示掉秒；`myOffer` 横幅补「已提议和棋，等待对方答复」。
- 旗落后走子（🟡）：本地 `timedOutState` 前置到 `select` / `tap`，旗落即判超时且不接受着法；联机在 `move` 前先扫超时。
- 签名与文档（🟡）：`docs/design/modules/clock.md` §1 改为 `createClock(now, perSide?)` 并补 `formatClock`；§3/§4/§5 补超时前置、开局锚点、未坐满不投影；`docs/design/modules/online.md` §3 同步。
- 移动端一行式（🟡）：`认输`、`提议和棋` 移入 `.clock-row`，`flex-wrap: wrap`；`docs/design/modules/local-play.md` 的 action 列表改为带 `now` 的签名。
- 覆盖率（🟡）：新增 `test/room.test.ts` 两条（单人房间不判超时 / 第二人就座才开锚）、`test/client-session.test.ts` 两条（动作带时间的确定性、旗落后拒走）、`test/integration/online.test.tsx` 一条（被拒后再提议禁用 → 对方走一着后恢复）。
- 死条件与墙钟（🔵）：`online/session.ts` 的两分支三元去掉；本地 reducer 的时间全部由动作带入，`sessionReducer` 不再读墙钟。

验证读数：`npm run check` 159 单测 + 25 前端用例全绿；`npm run build` 92.15 kB（gzip）；文档机检 5 档 PASS。

**代码评审第 2 轮整改**

- 快照时钟改为快照时刻的剩余：`snapshotOf(room, now = Date.now())` 用 `remainingOf` 算出 `redMs` / `blackMs`，`since` 置为快照时刻。客户端「以收到时刻为锚」的投影因此成立；重连不再把在走方时钟顶回上一次切边的值。`docs/design/modules/clock.md` §4 与 `docs/design/modules/online.md` §2 的字段说明同步为「快照时刻的剩余」。
- 未坐满不接受落子：`applyRoomMove` 在轮次判据前加 `room.red === null || room.black === null` → `not-in-room`，开局与开钟面不再错位。
- 认输与求和也先结清超时：`server.ts` 的 `resign` / `offer-draw` / `draw-response` 分支前置与 `move` 相同的 `rooms.timeouts()` 扫描与广播。
- 用例：`test/room.test.ts` 新增「快照里的剩余是快照时刻的值，不是切边时的旧值」「两人未坐满时不接受落子」。

验证读数：`npm run check` 161 单测 + 25 前端用例全绿；`npm run build` 92.16 kB（gzip）。

收口清理：`test/client-session.test.ts` 的「走子后时钟切给黑方」改为显式传入 `now`（`since === 2_000`、`redMs === 598_000`），不再依赖真实时钟；`npm run check` 仍 161 通过 / 25 通过。

## §6 验证与收口（父代理）

**验证与收口**

验证读数（收口时最后一次全量）：

- `npm run check`：`tsc --noEmit` 通过；`node --test "test/**/*.test.ts"` **161 通过 / 0 失败**；`vitest run` **7 文件 25 用例全绿**。
- `npm run build`：成功，主包 **92.16 kB**（gzip；上批 90.87 kB）。
- `doc_check` 交付门：PASS（`docs/design/modules/clock.md`、`docs/design/modules/local-play.md`、`docs/design/modules/online.md`、`test/RTM.md`、批次档共 5–6 档，0 命中）。
- 代码评审：3 轮收敛，末轮 `VERDICT: pass`。
- 浏览器实跑（Chromium + `npm run dev`）：本地开局 `红 09:54 黑 10:00`，走「炮八进一」后 `红 09:52 黑 09:59`；把棋盘容器压到 420px（648 → 388）局面与记谱保留、时钟继续走、未回 10:00；认输 →「红方胜 · 认输」且按钮禁用；新局回 `10:00`。联机：建房等待 3 秒仍 `红 10:00 黑 10:00`，对手入房才开始走秒；提议和棋后出现「已提议和棋，等待对方答复」，对方接受后双方「和棋 · 双方同意」。

需求对照：

| 需求 | 结论 | 落点 |
|---|---|---|
| F1.4 每方 10 分钟包干、走子切给对面、归零判负并显示超时 | 完成 | `src/shared/clock.ts`、`src/client/game/session.ts`、`src/server/room.ts`、`src/client/panel/GamePanel.tsx`、`src/client/pages/OnlinePage.tsx` |
| F1.4 缩放不重置、不停表 | 完成（浏览器实跑） | 时钟只存锚点，布局变化不重建会话 |
| F1.5 行棋方随时认输 | 完成 | `resignRoom` / 本地 `resign`，终局锁盘 |
| F1.5 任一方可提议和棋、接受判和、被拒后对方走一着前不能重复 | 完成 | `offerDrawRoom` / `respondDrawRoom`，三个拒绝码，集成用例覆盖禁用与恢复 |
| 联机以服务端时间为唯一裁决 | 完成 | 服务端每秒扫描 + 落子/认输/求和前置结清；客户端只做显示投影 |

测试与用例：`test/clock.test.ts` 新增 6 条；`test/client-session.test.ts` +6；`test/room.test.ts` +9；`test/online.test.ts` +2；`test/game-panel.test.tsx` 扩到 8 条；`test/integration/local-play.test.tsx` +3（F1-3）；`test/integration/online.test.tsx` +3（F1-4）。矩阵见 `test/RTM.md` 的 F1-3 / F1-4 两行。

未做与残余：

- F1.6 棋谱存局、F1.7 观战（含 8 人上限、只读）属 M5b，本批未实现。
- 移动端「时钟与按钮同一行」以结构与 `flex-wrap` 实现，未做真机 375px 截图核对。
- 评审残余不阻断：ws 级超时广播用例未补（判罚在 room 层已有断言）。

收口结论：本批交付完成，设计评审与代码评审均通过，验证链全绿。
