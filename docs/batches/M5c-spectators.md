# 2026-11-14 · M5c 观战
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「按计划」批准的 M5c（F1.7 观战）；口径：满员加入自动转观战。
> 台账 = #7（xiangqi · 归批）。前情 = M5b 棋谱回放与存局（已收口，274e717）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**批次任务与设计（M5c：观战）**

覆盖：

- F1.7 观战：联机房间除两名棋手外可进观战者，只读同一局面，不参与走子与计时；第三人加入能看不能走；棋手离开不结束观战；观战上限 8 人。

设计档落点：

- `docs/design/modules/online.md`：§2 协议（`joined.role`、`Snapshot.spectators`、`spectators-full`、`room-full` 保留不再触发）、§3 服务端（自动转观战、上限、只读、回收判据）、§4 客户端（`spectating` 阶段、`demo` 棋盘、隐藏棋手控件）、§7 分档、§8 验收、§9 集成行 F1-6。
- `test/RTM.md`：新增 F1-6 行与用例归属。

机制：

- 加入：两席都满且 token 不匹配任何一方 → 观战；`spectators` 满 8 回 `spectators-full`。`room-full` 不再触发，保留取值。
- 只读：观战者没有座位 token，落子/认输/求和天然 `not-in-room`；服务端不为其写 `red`/`black` 在线位。
- 计时：观战者不参与时钟，快照里的时钟仍由服务端裁决。
- 回收：两人离线且 `spectators === 0` 才计入 30 分钟回收——棋手离开不结束观战。
- 客户端：`role === 'spectator'` 时进 `spectating`，棋盘用 `demo` 模式，隐藏认输/求和/应答，面板显示「观战中 · N 人观战」。

受影响文件与测试：

- 改 `src/shared/protocol.ts`（`joined.role`、`Snapshot.spectators`、`ErrorCode`）、`src/server/room.ts`（`spectators` 字段、`joinRoom` 观战分支、`removeSpectator`）、`src/server/rooms.ts`（观战计数入口与回收判据）、`src/server/server.ts`（`Conn.role`、观战加入与离开、广播）、`src/client/online/session.ts`（`spectating` 与 `role`）、`src/client/pages/OnlinePage.tsx`（只读视角与观战文案）。
- 测试：`test/room.test.ts`（观战加入/上限/断连减法）、`test/online.test.ts`（ws 第三端只读）、`test/integration/online.test.tsx`（F1-6 集成：观战视角无按钮、棋盘只读）、`test/online-session.test.ts` 若存在则扩 role 分流。

验收对照：见 `docs/design/modules/online.md` §8 的 F1.7 行；集成设计见同档 §9 的 F1-6 行。

关键决策（用户已批准）：满员加入自动转观战，无需显式观战按钮；上限按需求字面理解为观战者 8 人（不含两名棋手）。

上抛项：无。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

**M5c 观战 · 设计评审（对象：`docs/design/modules/online.md` / `docs/design/modules/clock.md` / `docs/design/modules/app-shell.md` / `docs/requirements/xiangqi.md` / `test/RTM.md`）**

| # | Category | Severity | Issue | Suggestion |
|---|---|---|---|---|
| 1 | Requirements | 🔴 | `docs/design/modules/online.md` §1 与 §3 对同一输入给出两条相反的规则：§1 — "一房两人：先到者红，第二个进房者黑；第三个人被拒（观战属 M5）。"；§3 — "观战：两席都满且 token 不匹配任何一方时，第三人转观战（无需额外协议）；观战上限 8 人在线，满了回 `spectators-full`。" 照 §1 实现，本批等于没有观战路径，F1.7 在设计里没有落点。 | 把 §1 该句改成现在的规则（第三人在观战未满 8 人时转观战，满则 `spectators-full`），删掉「观战属 M5」的推迟语，使「第三人进房」全文只剩一处描述。 |
| 2 | Branch provenance | 🔴 | `docs/design/modules/online.md` §2 仍把 `room-full` 留在联合类型里（"code: 'room-full' \| 'room-not-found' \| 'bad-message' \| 'spectators-full'"），却自己声明 "`room-full`（保留但不再触发）"，而它给的「复现」是 "第三人进满房，收到 `joined` 且 `role` 为 `spectator`"——复现出的是相反结果。该拒绝码守着一个设计自认不会发生的场景（两席满 → 转观战 → 8 人满 → `spectators-full`），客户端却要为它写一条永远不出现的文案。 | 从 `error.code` 联合与客户端文案表里删掉 `room-full`；若确有会触发它的场景，就给出那条复现路径。 |
| 3 | Feasibility | 🔴 | `docs/design/modules/online.md` §3 — "广播：每次状态变化向房内两人发 `state`" 把受众钉在两席，而 §3 — "观战者断开只减计数并广播 `state`" 与 §4 — "面板显示「观战中 · N 人观战」" 都要求观战者收到 `state`。全文没有一句说 `state` 送到观战者，于是 F1.7 的 "只读同一局面" 可以完全照 §3 实现而不报错（观战棋盘不动）。 | 明写广播受众：房内每条活连接（两席 + 最多 8 观战）；并在同一处说明哪些消息只发给座位（`presence` / `rejected`）。 |
| 4 | Doc hygiene | 🟡 | `docs/design/modules/clock.md` §4 — "拒绝码留到 M5b（见 `docs/design/modules/online.md` §1）"：拒绝码已经存在（`docs/design/modules/online.md` §2 列出 "`draw-blocked` / `draw-pending` / `no-draw-offer`" 并带复现；`docs/design/modules/clock.md` §6 自己写 "三个新消息、快照字段与三个新拒绝码"），且指针指向 §1（房间与身份），该节没有拒绝码。规范面留着批次推迟语 + 悬空引用。 | 改成现在的状态（拒绝码见 `docs/design/modules/online.md` §2），删掉「留到 M5b」。 |
| 5 | Acceptance | 🟡 | `docs/design/modules/online.md` §9 开头 "本批新增 F1-2 一行"——本批新增的是 F1-6，F1-2 早于本批；同段还留着 "M5a 新增 F1-4（联机计时、认输与求和）" 与 "本批也改了壳的导航（第四项）"，而本批不动导航。对照 `AGENTS.md` — "需求与设计文档只写"现在是什么"，不写历史。"——增量陈述既过时又不是规范写法。 | 把增量写成现在的样子：新增 F1-6；F1-2 / F1-4 / F4-1 不受影响、不冗余。去掉批次历史与「改了导航」的陈述。 |
| 6 | Document ownership | 🟡 | `docs/design/modules/online.md` §5 — "顶部导航加第四项「联机」（导航由壳档拥有，见其导航节）。" 与属主档 `docs/design/modules/app-shell.md` §3 — "顶部一条导航：对弈 / 联机 / 课程 / 练习 / 棋谱" 及 §5 — "导航五项（对弈 / 联机 / 课程 / 练习 / 棋谱）" 冲突：联机是五项里的第二项，不是第四项。 | 删掉 `docs/design/modules/online.md` §5 的序数（保留指向属主节的交叉引用即可），让 `docs/design/modules/app-shell.md` §3 成为顺序的唯一描述。 |
| 7 | Existing-piece check | 🟡 | `docs/design/modules/online.md` §4 — "观战：棋盘用 `demo` 模式只读" 所依赖的棋盘件没有三问答案：§7 的现有件检查只记了 "棋盘 `play` 模式：existing — `src/client/board/Board.tsx`，按 `side` 限权"；新文案「观战中 · N 人观战」也不在文案清单里（清单止于 "「联机」导航文案、「创建房间」「房间码」「等待对手重连」「离开房间」、错误文案：none found"）。`demo` 模式的唯一线索是 `docs/design/modules/app-shell.md` 勘察句 "`docs/design/modules/board-ui.md`（棋盘三模式）"。 | §7 补两条：`demo` 模式的坐标与它保证的只读行为（`existing: …` 或 `existing but unusable: …` 的理由），以及「观战中 · N 人观战」的 existing / none found 答案。 |
| 8 | Acceptance | 🟡 | `docs/design/modules/online.md` §9 的「实现」段只描述了一个场景 — "`test/integration/online.test.tsx`（jsdom 假 socket，通过 `WebSocketImpl` 注入，从联机页建房并走一着）" 即 F1-2 — 而 `test/RTM.md` 把 F1-6 也归到同一文件（"`test/online.test.ts` 与 `test/integration/online.test.tsx`（F1-2、F1-4、F1-6）"）。F1-6 的三台客户端 + 第 11 台设备用哪套装置驱动、「棋手离开后观战仍在」在哪一步断言，留给实现者猜。 | 给 F1-2 / F1-4 / F1-6 各写一行实现（文件 + 装置 + 驱动的步骤），让 F1.7 的验收在写用例之前就定下来。 |
| 9 | Acceptance | 🟡 | 观战者身份半途而废：`docs/design/modules/online.md` §1 — "服务端按 token 找回颜色与局面" 只覆盖棋手，§2 却给观战者也发 token（"token: string; role: 'player' \| 'spectator'"），§3 又只计数不认身份（"房间的 `spectators` 只计数"）。未定：观战者重连拿到什么、掉线但还没被 "连续两次无 pong" 判死的旧 socket 是否仍占观战位（重连可能反被判 `spectators-full`）、观战者主动 `leave` 是否释放名额。 | 写明观战 token 的用途（不重复计数地重连，或明确不带身份）、8 人上限按活连接还是按 token 计，以及观战者 `leave` 的处理。 |
| 10 | Clarity | 🟡 | `docs/design/modules/online.md` 的回收规则写了两遍且内容不同：§1 — "回收：两人都离线超过 30 分钟的房间删除，服务端每 60 秒扫一次"；§3 — "回收：两人都离线且 `spectators === 0` 才计入 30 分钟回收；有观战在线时房间留住，棋手离开不结束观战。"（§3 的注册表行同写 "回收（两人离线超 30 分钟且无在线观战，每 60 秒扫一次）"）。只读 §1 会在观战在线时删房，直接违背 F1.7 的 "棋手离开不结束观战"。 | 把观战条件写进 §1，只留一处描述（两人都离线且无在线观战 → 30 分钟回收）。 |
| 11 | File tier | 🔵 | `docs/design/modules/online.md` §7 — "文件分档：实测无文件跨 500 行档（`src/server/server.ts` 268 行、`src/server/room.ts` 299 行、`src/client/pages/OnlinePage.tsx` 339 行、`src/client/online/session.ts` 119 行），无 300+ 行单函数，不需要拆分方案。" 只覆盖 4 个文件；§7 表里还有 `src/shared/protocol.ts`、`src/server/rooms.ts`、`src/server/main.ts`、`src/client/online/socket.ts`、`scripts/dev.mjs`，本批还要扩三个测试文件（含 `test/room.test.ts`），都没有量过的判断。我自查的体积（protocol.ts ≈3.5 KB、rooms.ts ≈3.9 KB、main.ts ≈0.5 KB、socket.ts ≈5.3 KB、OnlinePage.tsx ≈12.3 KB、room.test.ts ≈12.2 KB）与「无文件跨档」的结论一致。 | 把其余表内文件与被扩的测试文件补进测量清单（或说明抽样口径），让结论有自己的数字撑着。 |
| 12 | Doc hygiene | 🔵 | `docs/design/modules/online.md` §2 小标题 "`error` 的三个取值的来源：" 后面列了四条：`room-not-found`、`room-full`、`spectators-full`、`bad-message`。 | 数字与枚举对齐（删掉死码后正好是三条）。 |
| 13 | Clarity | 🔵 | `docs/design/modules/online.md` §3 — "观战者发 `move` / `resign` / `offer-draw` / `draw-response` 时拿不到座位 token，一律 `not-in-room`"：观战者确实持有 §2 `joined` 发的 token，也确实在房内，码名说的是相反的命题，`not-in-room` 的文案对观战者会读成「你不在房中」。 | 把规则写成「token 不映射到座位」，并让文案同时容纳两种情况，或单列一个拒绝码。 |
| 14 | Acceptance | 🔵 | `docs/design/modules/online.md` §8 — "本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；`npx vitest run test/integration/online.test.tsx`。"：改动面单测文件是对的闸门，但集成那半按口径应在收口行报告，不进实现轮的验收。 | 验收只留 `node --test …` 一行，集成运行移到收口行。 |
| 15 | Document ownership | 🔵 | 无文档地图（文档根下没有 README），所有权检查按 `AGENTS.md` 的层表降级判定。落位本身成立：三份被改模块都在 `docs/design/modules/` 下，各自拥有自己的主题（联机 / 计时与判罚 / 页面壳），用交叉引用代替重复章节；F1-6 行放在 `test/RTM.md` 的「对弈（需求 F1）」节内。 | 无需动作；记录一条：因缺文档地图，所有权按 `AGENTS.md` 层表判定。 |

VERDICT: changes-required

计数：🔴 3 · 🟡 7 · 🔵 5（共 15 条）

### 轮次 2（评审子代理）

**M5c 观战 · 设计评审复核（上轮 17 条逐条对当前文件核验）**

| # | 上轮# | 文件 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|---|
| 1 | 1 | `docs/design/modules/online.md` | 🔴 | Fixed | 本档 §1：「两席都已坐满时，后来者进观战（不占座、不参与走子与计时）」，与 §3 第三人转观战一致。 |
| 2 | 2 | `docs/design/modules/online.md` | 🔴 | Fixed | 本档 §2 联合类型只剩 room-not-found / bad-message / spectators-full；三条取值来源齐全，死码已删。 |
| 3 | 3 | `docs/design/modules/online.md` | 🔴 | Fixed | 本档 §3 广播：「向房内全部连接发 `state`（两席 + 至多 8 位观战者）」，`presence` 仍只报棋手。 |
| 4 | 4 | `docs/design/modules/clock.md` | 🟡 | Fixed | 本档 §4：「观战规则见 `docs/design/modules/online.md` §3，拒绝码见同档 §2」，批次推迟语已删。 |
| 5 | 5 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §9 起点行：「本节的增量是 F1-6」，并写明壳的 `F4-1` 断言不涉及导航项数。 |
| 6 | 6 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §5 把导航项与顺序交给壳档；`docs/design/modules/app-shell.md` §3 五项为唯一描述，无二份。 |
| 7 | 7 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §7 现有件检查补 `demo` 只读模式（existing）与「观战中 · N 人观战」文案行。 |
| 8 | 8 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §9 实现分工按房间层 / 真 ws 三端 / jsdom 观战视角三处落，F1-6 有对应器械。 |
| 9 | 9 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §1 补 token 不映射座位、上限按在线观战连接算、leave 与断开减计数腾位。 |
| 10 | 10 | `docs/design/modules/online.md` | 🟡 | Fixed | 本档 §1 回收条件加 `spectators === 0`，与 §3 及注册表职责行一致。 |
| 11 | 11 | `docs/design/modules/online.md` | 🔵 | Fixed | 本档 §7 分档已逐类实测（服务端 / 共享与前端 / 测试三组）；`scripts/dev.mjs` 仍未测，残余 🔵。 |
| 12 | 12 | `docs/design/modules/online.md` | 🔵 | Fixed | 本档 §2「`error` 的三个取值的来源」后正好三条，三与四的漂移消失。 |
| 13 | 13 | `docs/design/modules/online.md` | 🔵 | Fixed | 本档 §3 观战者四类消息统一 `not-in-room`，并给出客户端文案。 |
| 14 | 14 | `docs/design/modules/online.md` | 🔵 | Fixed | 本档 §8 验收命令只跑两个单测文件，前端集成留收口。 |
| 15 | 15 | — | 🔵 | Accepted | 文档地图缺失属观察项，归属按层表判；三模块各管其域并互引，不需动作。 |
| 16 | 16 | `docs/design/modules/clock.md` | 🔵 | Unfixed | 本档 §7 本批验收命令仍含 game-panel 与两个集成文件，与 `docs/design/modules/online.md` §8 的集成留收口写法不一；advisory，不阻塞。本轮无理由陈述。 |
| 17 | 17 | `docs/design/modules/online.md` | 🔵 | Fixed | 本档 §9 已在 `test/room.test.ts` 一栏写明「并在此断言『两名棋手断开后观战仍在、房间不回收』」。 |

计数：🔴 0 · 🟡 0 · 🔵 1 Unfixed（advisory，不阻塞）· Accepted 1；上轮 3 条 🔴 全部 Fixed，无新增 🔴。

VERDICT: pass

## §4 用户批准（主 agent）

用户 2026-11-14「按计划」批准 M5c（F1.7 观战），口径：满员加入自动转观战，无额外观战按钮；观战上限 8 人（不含两名棋手）。

设计档在批准后按此口径落地：`docs/design/modules/online.md` §1–§4；协议与房间层按设计实现，未缩小范围。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



**M5c 观战 · 实施记录**

改动文件与内容：

- `src/shared/protocol.ts`：`Snapshot.spectators: number`（在线观战连接数）；`joined` 增 `role: PlayerRole`，`color` 放宽为 `Color | null`；`ErrorCode` 删 `room-full`、加 `spectators-full`；新增导出 `PlayerRole`。
- `src/server/room.ts`：`RoomState.spectators`（建房为 0）；`joinRoom` 在两席都满后进观战（`role: 'spectator'`、`color: null`），8 人满回 `spectators-full`；新增导出 `MAX_SPECTATORS = 8` 与 `removeSpectator(room)`（减计数，到底不减成负数）；`snapshotOf` 透出 `spectators`；座位 token 匹配的重连判定仍在观战分支之前。
- `src/server/rooms.ts`：新增 `Rooms.removeSpectator(code)`（写回并返回房间供广播）；`sweep` 增加 `spectators > 0` 不回收。
- `src/server/server.ts`：`Conn.role`；`join` 下发 `role`/`color`、满员回 `spectators-full`、观战进出也广播 `state`、`presence` 只在棋手进出时发；`leave` 按角色分流——观战减计数并广播 `state`，棋手走原 `setConnected` + `presence`。
- `src/client/online/session.ts`：阶段加 `spectating`、状态加 `role`；`joined.color === null` 判为观战；`state` / `rejected` 的阶段沿用已存角色，不会把观战刷回 `playing`；观战者收到 `not-in-room` 时文案为「你正在观战，不能走棋」。
- `src/client/pages/OnlinePage.tsx`：观战棋盘用 `demo` 模式且不传 `onSelect` / `onTap`；隐藏认输与提议和棋（和棋应答本就需要座位颜色，天然不出现）；面板「观战中 · N 人观战」取代「你是红/黑方」。

测试（按设计档 §9 的分工）：

- `test/room.test.ts`：第三人得 `spectator` 且同 token 再进仍是观战；八人后 `spectators-full`、退出一人腾位；观战者走子/认输/求和/应答一律 `not-in-room` 且在线位、序号、和棋状态不变；`spectators === 0` 才回收，两名棋手断开后观战仍在、房间不回收。
- `test/online.test.ts`：真 ws 三端——观战端与红方快照深等、`move` / `resign` 得 `not-in-room`、观战进出都广播 `state`、棋手断开后观战仍收 `state`（seq 2）。
- `test/integration/online.test.tsx`：观战视角显示「观战中 · 1 人观战」、无认输/提议和棋/接受/拒绝、`demo` 棋盘无可聚焦子且点击不发 `move`、局面与记谱跟 `state` 更新、棋手离线后观战仍在。

读数：改动前 `node --test test/room.test.ts test/online.test.ts` = 20 通过 / 0 失败；改动后 = 24 通过 / 0 失败。`npx vitest run test/integration/online.test.tsx` = 7 通过。`npm run check` 退出码 0（类型检查无错、node 184 通过 / 0 失败、vitest 39 通过）。

偏差与口径：

- `joined.role` 全程透传（无偏差）：实现阶段曾用 `joined.color === null` 推观战角色，验收时按设计档 §4「`role` 为 `spectator` 时直接进 `spectating`」改回——socket 层带上 `role`，session 与页面都按 `role` 判定。
- 观战上限按「在线观战连接」计：同一 token 的新连接与尚未断开的旧连接各算一条（设计档 §1 原文）。
- `room-full` 按设计档 §2 从 `ErrorCode` 彻底删除；批次档 §2 里「保留取值」的旧表述以设计档为准。
- `leave` 先摘连接再广播，离开的连接不再收到自己那一次通知（观战减计数同理）。

## §6 验证与收口（父代理）

**验证与收口（M5c 观战）**

验证读数：

- `npm run check` 退出码 0：typecheck 无错，`node --test` 184 通过 / 0 失败，`vitest run` 8 文件 40 用例全过（本批新增观战用例后 39 → 40）。
- 浏览器真机（`npm run dev` 后）：两个 ws 客户端占住两席（房间 PLCTF5），浏览器作为第三人进房——面板显示「观战中 · 1 人观战」，棋盘只读，页面上只有「离开房间」，无认输 / 提议和棋 / 和棋应答。
- `grep -rn "room-full" src/ test/` 无输出；`spectators` 在协议、房间、注册表三处各有落点。

代码评审 #51 的 8 条处置：

| # | 处置 | 落点 |
|---|---|---|
| 1 | 已修 | `src/client/online/socket.ts` 的 `connect()`：连接已开时直接在同一条连接上重发 `join`，不再早返；大厅被 `spectators-full` / `room-not-found` 拒后可重试。新增 jsdom 用例「观战满员被拒后能在同一条连接上重试」守住。 |
| 2 | 已修 | `src/client/pages/OnlinePage.tsx` 房间视图补 `state.error` 横幅（`role="alert"`），观战满员重连不再静默冻结。 |
| 3 | 已修（改文档口径） | `docs/design/modules/online.md` §1 改成实现的语义：观战按在线连接计，同一 token 的新旧连接各占一位，满员重连先收 `spectators-full`、旧连接断开后重试即可。 |
| 4 | 已修 | 批次档 §5 的偏差条改成现状：`joined.role` 全程透传，无偏差。 |
| 5 | 已修 | `test/online.test.ts` 的 `blackSeesGone` / `blackSeesBack` 加 `seq` 谓词并在断言前排空队列，不再被旧广播满足。 |
| 6 | 已修 | `docs/design/modules/online.md` §7 分档按实施后重量：服务端 290 / 324 / 133 行，共享与前端 114 / 351 / 131 / 197 行，测试 419 / 339 / 426 行，均不足 500 行。 |
| 7 | 已修 | `test/RTM.md` 用例实现行补 `test/room.test.ts`（F1-6 的房间层：八人上限与回收）。 |
| 8 | 已修 | `src/server/server.ts` 新增 `dropEmptyRoom`：连接离开后清掉空的 `byRoom` 条目。 |

交付面：需求 F1.7 的三条验收（只看不走、不参与计时、棋手离开不结束观战）、8 人上限、客户端观战视角与只读棋盘均已落地并有机器可验用例覆盖。

遗留：无。观战位按连接计（不做 token 回收）是设计档 §1 现在的口径，不是欠账。
