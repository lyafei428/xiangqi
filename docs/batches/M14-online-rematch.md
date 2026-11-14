# 2026-11-14 · 联机再来一局
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户反馈「联机无新局按钮导致只能下一局」——终局后同一房间无法再开一局。
> 台账 = #18（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 任务

联机终局后能在同一房间再开一局，不用重新建房、不用重新发房间码。

## 设计

**协议**：新增客户端消息 `{ type: 'rematch' }`，服务端广播新的 `state` 快照。拒绝理由多一个 `'not-over'`。

**房间**：`rematchRoom(room, token, now)` —— 只认棋手（观战者没有座位）、只在终局后（对局中重开等于单方面毁局）。重开时局面回到 `startFen`，着法、序号、上一着、和棋提议全部清空，双方时钟重置；**座位与 token 不变**，所以两人都还在原座位，不用重新分配颜色。

**页面**：终局后常驻条出现「再来一局」（观战者不出现）。点它发消息，收到新快照后棋盘自然归位。

## 边界

不做「双方都要点同意才重开」——一局终了、同一房间，任一方点重开即可，这和对局页「新局」的语义一致。也不做房间内换边。

## §3 设计评审（评审子代理）

### 轮次 1（评审子代理）

### 设计评审（M14 联机再来一局 · 交付前评审收口）

Scope note: 本轮无 document map，ownership 按 AGENTS.md 的层表与三份文档内部的相互引用核对。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Clarity / Feasibility | 🔴 | 本批的消息没有进协议契约：`docs/design/modules/online.md` §2 的 `ClientMessage` 只有 `join` / `move` / `resign` / `offer-draw` / `draw-response` / `leave` / `ping`，而 §5 要求「终局后棋手可发 `{ type: 'rematch' }`」；§2 又声明「`rejected.reason` 是固定取值（`not-in-room` / `not-your-turn` / `game-over` / `stale-seq` / `illegal-move` / `draw-blocked` / `draw-pending` / `no-draw-offer`）」，缺 §5 引入的 `not-over`；§3 观战段「观战者发 `move` / `resign` / `offer-draw` / `draw-response` 时 token 不映射座位，一律 `not-in-room`」也未列 `rematch`。 | 把 `{ type: 'rematch' }` 加进 `docs/design/modules/online.md` §2 的 `ClientMessage`，把 `not-over` 加进同一处的固定拒绝码并配文案，把 `rematch` 补进观战者的 `not-in-room` 清单；§5 只指向这两处清单，不再自行复述。 |
| 2 | Acceptance / Integration design | 🔴 | F1.2 的再来一局在验收面上没有落点：`docs/design/modules/online.md` §8「验收对照」无再来一局行（F1.2 行只写「两台设备同房、走子实时同步」）；§9 的增量仍停留在上一批「本节的增量是 F1-6；F1-2 / F1-4 不破坏、不冗余」；§9「实现分工」三个测试文件也没一个声明为 rematch 断言；§4 面板清单只到「对局中提供「认输」与「提议和棋」」，没有再来一局控件。 | §8 补一行挂 F1.2 的「终局后可在同房间再来一局（不必重新建房）」；§9 补一行（交互 / 用户可见结果 / 入口 / 需求），用例号先在 `test/RTM.md` 定死再写用例名，并写明由哪个测试文件断言；§4 面板清单补上该控件。 |
| 3 | Document ownership | 🔴 | 同一机制（房间与 token 存哪）在 `docs/design/modules/online.md` 内有两套答案：「客户端存 `sessionStorage`，断线后带 token 重连」（§1）、「`sessionStorage` 存 `{ room, token }`」（§4）、「离开房间发 `leave` 并清 `sessionStorage`」对「房间与 token 写 `localStorage`（`xiangqi.online`），关掉浏览器再回来也能自动回到同一间房；老版本只写 `sessionStorage`，读取时兼容」（§5）。只有 localStorage 那套能满足 F1.2「房间与身份记在本机，重开浏览器能回到上次的房间」；其余三句与之冲突，连「离开」清哪个 key 都无法确定。 | 定一套说法（运行期写 localStorage、sessionStorage 只作旧数据只读兼容），并把 `docs/design/modules/online.md` §1 / §4 / §5 的「离开」那句改成同一个 key。 |
| 4 | Document ownership | 🔴 | 同一机制（何时开表、有没有「开始」控件）在 `docs/design/modules/clock.md` 内有两套答案：「按下「开始」，或落下第一着，才由 `startClock` 把锚点挪到那一刻」与「「开始」与「认输」是同一个按钮的两种身份」对 §3 的「开局即开始计时，不设「开始」按钮」；`startClock` 只出现在那段散文里，不在 §1 的 API 块（`createClock` / `remainingOf` / `switchClock` / `stopClock` / `timeoutColor` / `formatClock`）中，F1.10 列举对弈页控件时也没有「开始」。 | 只留一套开表规则与一套控件；不论留哪套，`docs/design/modules/clock.md` §1 的散文、API 块与 §3 那句必须同时对齐。 |
| 5 | Requirements | 🟡 | 层间数字不一致：`docs/requirements/xiangqi.md` F1.4 写「每方 15 分钟包干」，`docs/design/modules/clock.md` §1 写「每方 10 分钟（600000 毫秒）包干；不加秒、不读秒。」，而这正是 F1.4 的验收口径；范围内没有一句说明哪个值权威。 | 在需求层定死数值，`docs/design/modules/clock.md` 的模型行跟着改成同一个数。 |
| 6 | Clarity | 🟡 | 再来一局的语义只有一句：「终局后棋手可发 `{ type: 'rematch' }`，服务端把房间重置成开局（座位与 token 不变、时钟重置），向全房广播新的 `state`」。未定：对方是否要同意（一方就能重置对方的终局，而同一句的理由是「对局中「重开」等于单方面毁局」）；对方与观战者在请求到重置之间看到什么；`result` / `moves` / `moveLog` / `drawOffer` / `drawBlocked` 是否都回开局值；§4 的阶段表（`idle` / `connecting` / `lobby` / `waiting` / `playing` / `spectating` / `reconnecting` / `error`）没有终局标记，客户端「回到 playing」只能靠猜。 | 把这个决定记录进 `docs/design/modules/online.md`（谁能触发、是否需要同意、其它席位看到什么），并逐字段列出重置后回开局值的快照字段。 |
| 7 | Branch provenance | 🟡 | `docs/design/modules/online.md` §2 给三个新拒绝码各配了复现（如「复现：A 提议、B 拒绝后，A 再发 `offer-draw`」），也给三个 `error` 取值各配了复现，但 §5 引入的 `not-over` 分支既无观察也无复现路径，只有理由「对局中「重开」等于单方面毁局」。 | 按同批兄弟码的写法补 `not-over`：产生它的一帧（对局中某棋手发 `{"type":"rematch"}`）与返回的码。 |
| 8 | Document ownership | 🟡 | F1-4 集成行写了两遍：`docs/design/modules/clock.md` §8 的「两个客户端 → 房间时钟与求和」与 `docs/design/modules/online.md` §9 同一行（交互 / 结果 / 入口 / 需求相同，仅标点微差）；`docs/design/modules/clock.md` 已声明归属（「本批新增两行：F1-3（本地计时与认输）、F1-4（联机计时、认输与求和）」），`docs/design/modules/online.md` 那份属重复描述。 | 让 `docs/design/modules/clock.md` §8 独占 F1-4 行，`docs/design/modules/online.md` 改为引用（照它已对 F1-3 做过的那样：「F1-3 属本地，在 `docs/design/modules/clock.md` §8」）。 |
| 9 | Existing-piece check | 🟡 | `docs/design/modules/online.md` §7 的现有件检查覆盖了「联机」/「创建房间」/「房间码」/「等待对手重连」/「离开房间」/「观战中 · N 人观战」与 `OnlinePage` / `createOnlineServer` / `RoomState` / `joinRoom` / `applyRoomMove` / `snapshotOf` / `useOnlineSocket`，但本批自己的新文案「再来一局」与新消息名 `rematch`、新码 `not-over` 没有 `existing:` / `none found:` / `existing but unusable:` 三问答案。 | 在 `docs/design/modules/online.md` §7 的现有件检查与命名行各补这两条。 |
| 10 | Affected-file tier | 🟡 | 结论在（「无 300 行以上的单函数，不需要拆分方案」「改动后仍不足 500 行，不需要拆分方案」），但 `docs/design/modules/online.md` §7 同时贴了逐文件读数（「`src/server/server.ts` 290 行、`src/server/room.ts` 324 行、`src/server/rooms.ts` 133 行」等），档规要求设计文档只留结论；`docs/design/modules/clock.md` §6 又把文件档写成「本批新增与扩展文件均不足 300 行」（文件档是 500 触发主动拆、800 硬顶）；`docs/design/modules/online.md` §7 表格里的源文件 `scripts/dev.mjs` 没有任何分档结论。本轮范围只有三份文档，未重测文件。 | 每份文档只留一行结论（无文件越档，或越档文件的分拆方案），删掉逐文件读数，把 300 改成 500/800，并把表格内每个源/测试文件（含 `scripts/dev.mjs`）都纳进结论。 |
| 11 | Doc hygiene | 🟡 | 规范面留着修订式表述：`docs/design/modules/clock.md` §1 的「刷新页面不会白丢时间——旧行为是加载即走秒，刷一次掉几秒」与 §6 的「`ClockView` 不再单列，直接复用 `ClockState`」。AGENTS.md 定的是「需求与设计文档只写"现在是什么"，不写历史。历史在 git 提交里。」 | 删掉这两处，只留当下成立的规则。 |
| 12 | Clarity | 🔵 | 再来一局的机制（消息、服务端重置、拒绝码、客户端控件）写在 `docs/design/modules/online.md` §5「路由与页面」，而拥有消息类型与服务端状态迁移的 §2 协议、§3 服务端对它一字未提；按文档自身结构读的人找不到本批的功能。 | `docs/design/modules/online.md` §2 / §3 补齐条目后，§5 只留页面层行为并回指。 |

Counts: 🔴 4 · 🟡 7 · 🔵 1

VERDICT: changes-required

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
## §6 验证与收口（父代理）
