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
**状态行**：评审通过（round 2：原 12 条 11 Fixed / 1 Accepted，🔴 全消；新增 🟡 5（含 1 残项）+ 🔵 1，不阻塞）



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

### 轮次 2（评审子代理）

Review-object: design | Target: M14 联机再来一局（修复轮）| Round 2 复审 — 核第 1 轮 12 条是否处置到位
Scope: `docs/design/modules/online.md`、`docs/design/modules/clock.md`、`docs/requirements/xiangqi.md`（另核 `docs/design/modules/theme.md` §4 的交叉引用，成立）。

汇总：原 12 条 → 11 Fixed、1 Accepted（🔵 放置偏好）；新增 6 行（其中 1 行为原 #10 残项、4 条 🟡 + 1 条 🔵 由本次修复引入）；🔴 0。

| # | Orig# | File | Severity | Status | 依据与建议 |
|---|---|---|---|---|---|
| 1 | 1 | `docs/design/modules/online.md` | 🔴→已消 | Fixed | 协议契约已补齐：`ClientMessage` 有 `\| { type: 'rematch' }`；固定拒绝码表已收到 `` `no-draw-offer` / `not-over`） ``；观战段已改为 `` `draw-response` / `rematch` 时 token 不映射座位 ``。 |
| 2 | 2 | `docs/design/modules/online.md` | 🔴→已消 | Fixed | 验收有了落点：§8 增 `\| F1.2 终局后同房间再玩一局…` 行（行内为 `` `rematchRoom`（服务端）+ `OnlinePage` 的新局按钮 ``，并点名 `test/room.test.ts` 与 `test/integration/online.test.tsx`）；§9 增量改为 `本批的增量是 **F1-2 扩写一行「终局后同房间再玩一局」**`，并新增 `\| F1-2（再来一局） | 终局快照 → 点「新局」→ 服务端重置 → 全房新快照 `` 行。面板清单的残项单列为第 14 行。 |
| 3 | 3 | `docs/design/modules/online.md` | 🔴→已消 | Fixed | 存储口径统一为 localStorage + 旧 sessionStorage 兼容读：`客户端把房间与 token 存 `localStorage`（`xiangqi.online`）`、`` `localStorage` 存 `{ room, token }`（读的时候也认旧版写在 `sessionStorage` 的那份） ``、`离开房间发 `leave` 并清 `localStorage` 里的 `xiangqi.online``。 |
| 4 | 4 | `docs/design/modules/clock.md` | 🔴→已消 | Fixed | 开表机制只剩一种说法：API 块含 `startClock(clock, now, turn): ClockState  // 开表：锚点挪到 now，交给 turn 走秒`，§3 已改为 `开局按下「开始」才走秒（见 §1 的开表时机）`，原先「不设『开始』按钮」的否定句已不在档内。要求层侧的残项单列为第 16 行。 |
| 5 | 5 | `docs/design/modules/clock.md` | 🟡 | Fixed | 数值已对齐需求层：`每方 15 分钟（900000 毫秒）包干；不加秒、不读秒。`，与 `docs/requirements/xiangqi.md` F1.4 的 `每方 15 分钟包干` 一致；新局重置句同为 15 分钟。 |
| 6 | 6 | `docs/design/modules/online.md` | 🟡 | Fixed | 再玩一局语义已分四条写明：`谁触发：任一棋手，不需要双方确认。`、`重置到什么：`、`观战者看到什么：`、`客户端相位：`，含 `result` / `moves` / `moveLog` / `lastMove` / `drawOffer` / `drawBlocked` 的复位清单。 |
| 7 | 7 | `docs/design/modules/online.md` | 🟡 | Fixed | `not-over` 已与同类分支同形（含复现）：`` `not-over`：对局还没结束就发 `rematch`；复现：开一局、走一着后发 `{"type":"rematch"}`，服务端回 `not-over`，房间状态不变。 `` |
| 8 | 8 | `docs/design/modules/online.md` | 🟡 | Fixed | 重复行已收口：`F1-4 的行归 `docs/design/modules/clock.md` §8 拥有，本档只引用不重写`，表内改为 `\| F1-4 \| （本行由 `docs/design/modules/clock.md` §8 拥有，此处不重写）`。 |
| 9 | 9 | `docs/design/modules/online.md` | 🟡 | Fixed | 新名字/新文案有了三问答案：`「新局」按钮文案与 `rematch` / `not-over` 两个名字：none found — 新增`。 |
| 10 | 10 | `docs/design/modules/online.md` | 🟡 | Fixed | 行数与档位话术已撤：`各文件的实测行数不进本档（量在评审时现取），这里只留结论。`，且结论覆盖 `scripts/dev.mjs` 与 500 行线。`docs/design/modules/clock.md` 的残项见第 13 行。 |
| 11 | 11 | `docs/design/modules/clock.md` | 🟡 | Fixed | 修订式表述已清：`刷新页面不丢时间：进页面时表不走，锚点只在开表那一刻落定。`、`` `ClockView` 直接复用 `ClockState`（线上投影同形状）。 `` |
| 12 | 12 | `docs/design/modules/online.md` | 🔵 | Accepted | 放置偏好仍成立但已不伤人：契约本体在 §2/§3，§5 只剩行为叙述；读者不再缺契约，故本轮按理由收口不再要求搬移。 |
| 13 | 10（残） | `docs/design/modules/clock.md` | 🟡 | Unfixed | 同档 §6 仍写 `文件分档：本批新增与扩展文件均不足 300 行，无 300+ 行单函数`——仍是一句按 300 行计的尺寸断言，而代码结构线是 500（主动拆分复核）/ 800（硬上限）。建议只留结论（不足 500 行、无 300 行以上单函数、不需要拆分方案）。 |
| 14 | (new) | `docs/design/modules/online.md` | 🟡 | New：面板清单与验收点名不一致 | §8/§9 点名了 `OnlinePage` 的新局按钮，但 §4 面板清单仍是 `面板：房间码、己方颜色、轮到谁、双方在线、双方时钟、记谱、结果、离开；对局中提供「认输」与「提议和棋」`，§5 常驻条清单为 `` `panel-focus` 是常驻条（身份「你是红方」、状态行、双方在线、时钟、认输、提议和棋、房间码、着法/离开按钮） ``，两处都没有再玩一局控件。建议把该控件补进这两处清单（或指明由别档拥有）。 |
| 15 | (new) | `docs/design/modules/online.md` | 🟡 | New：新名字未走现有件检查 | 修复引入了 `rematchRoom`（`\| F1.2 终局后同房间再玩一局 \| `rematchRoom`（服务端）…`），但命名行仍是 `命名：`OnlinePage`、`createOnlineServer`、`RoomState`、`joinRoom`、`applyRoomMove`、`snapshotOf`、`useOnlineSocket` 为新增名字`，§3 文件表也没提这个导出。建议把 `rematchRoom` 补进命名/现有件检查。 |
| 16 | (new) | `docs/design/modules/clock.md` | 🟡 | New：与 F1.10 的默认控件清单不一致 | 修复选了「开始」这一侧：`「开始」与「认输」是同一个按钮的两种身份：开表前显示「开始」，开表后显示「认输」`；而需求 F1.10 写 `对弈页与人机页默认只显示棋盘、行棋方与双方计时、新局与认输`。首次进页时按钮显示的是「开始」而非「认输」，两侧需择一处落定（改需求口径或改设计）。 |
| 17 | (new) | `docs/design/modules/clock.md` | 🟡 | New：新局起始态两种读法 | §3 写 `新局重置为 15 分钟、红方在走。`，而本档 §1 把「在走」定义为时钟在走方（`running: Color | null;  // 正在走的一方`），同页又要求 `开局按下「开始」才走秒`。字面读成 running=red 会与开表规则相反。建议改成「红方先行（表未开）」一类说法。 |
| 18 | (new) | `docs/design/modules/online.md` + `docs/design/modules/clock.md` | 🔵 | New：计数词未跟上 | 第 1 条的修复让拒绝码增至四个，但小标题仍是 `三个新拒绝码的来源：`（其下列四条），`docs/design/modules/clock.md` §6 的 `三个新消息、快照字段与三个新拒绝码` 同样过期。改词即可。 |

Counts: 原 12 条 = Fixed 11 · Accepted 1 · Unfixed 0（🔴 全消）；新增 6 行 = 🟡 5（含 1 残项）· 🔵 1。

VERDICT: pass

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
## §6 验证与收口（父代理）
