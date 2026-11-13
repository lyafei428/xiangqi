# 2026-11-14 · M4 联机对战（房间码）
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「继续往下进行」并「开工」；范围取 docs/design/architecture.md 里程碑 M4；需求 F1.2（房间码联机）。
> 台账 = #4（xiangqi · 归批）。前情 = M3 第三章基本杀法 + 对弈型练习（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

本批判据：architecture 里程碑「M4 | 联机对战 | 两浏览器同房同步；非法着法被拒；断线重连恢复」；需求 F1.2「联机对战（房间码）| 两台设备进同一房间，走子实时同步」。

本批交付：
- 协议：`src/shared/protocol.ts`，客户端只发 `join / move / leave / ping`，服务端回 `joined / state / rejected / presence / error / pong` 与权威快照。
- 服务端：`src/server/` 的房间状态机、房间码注册表、http + ws 接线、心跳与重连。
- 客户端：`#/online` 大厅与房间、自动重连、sessionStorage 存 token、棋盘按己方颜色限权。
- 运行：`npm run dev` 同时起 Vite 与 WS 服务；Vite 代理 `/ws`。
- 测试：房间单测、真实 ws 双客户端、jsdom 联机页；RTM 增 F1-2。

关键判据：
- 服务端权威：客户端不判规则、不改局面；非法着法、轮次不对、序号过期一律 `rejected` 并回当前快照。
- 重连：token 找回颜色与局面；快照带 seq，客户端丢弃旧快照。
- 房间存内存：服务重启清空；「断线重连」限定服务进程存活期内。
- 不做超时判负（M5 计时）。

本批不做：观战、计时、认输求和、棋谱持久化、房间跨重启持久化、公网 WSS、聊天、再来一局。

上抛项：无（入口形态、内存房间、重连不判负三条口径已在计划中说明并获「开工」授权）。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

设计档落点：新增 `docs/design/modules/online.md`（房间与身份、协议、服务端、客户端、路由、运行方式、文件、验收、集成测试节）；同步 `docs/design/modules/app-shell.md`（`#/online` 路由、导航四项、联机会话状态、集成测试指向）、`test/RTM.md`（F1-2 行）；`docs/design/architecture.md` 的联机口径已就位，不再改。

机制设计：
- 房间：一房两人，先到红、后到黑；6 位房间码，字符集去 0/O/1/I；内存注册表。
- 协议：客户端只发坐标与 `seq`；服务端 `playMove` 校验后更新局面并广播快照；非法/越序回 `rejected` + 当前快照。
- 身份：进房发 16 字节 token；客户端存 sessionStorage；重连带 token 找回颜色与局面。
- 客户端：纯 reducer 管阶段（大厅 / 等待 / 对局 / 重连 / 错误）；socket 层做指数退避重连；棋盘 `play` 模式按己方颜色限权。
- 运行：`scripts/dev.mjs` 同起 Vite 与 WS；Vite 代理 `/ws`；服务端 Node 直接跑 TS。

受影响文件与测试覆盖：

| 文件 | 动作 |
|---|---|
| `src/shared/protocol.ts` | 新增协议类型与消息校验 |
| `src/server/room.ts`、`rooms.ts`、`server.ts`、`main.ts` | 新增服务端 |
| `src/client/online/session.ts`、`socket.ts` | 新增客户端联机逻辑 |
| `src/client/pages/OnlinePage.tsx`、`src/client/App.tsx`、`src/client/shell/routes.ts`、`app.css` | 新增页面、路由与导航 |
| `scripts/dev.mjs`、`vite.config.ts`、`package.json` | 运行方式与依赖 |
| `test/room.test.ts`、`test/online.test.ts`、`test/integration/online.test.tsx` | 新增测试 |
| `test/routes.test.ts` | 补联机路由 |

验收对照：

| 验收 | 落点 |
|---|---|
| 两浏览器同房同步 | 真实 ws 双客户端用例 + 浏览器双页实跑 |
| 非法着法被拒 | 服务端校验 + `rejected` |
| 断线重连恢复 | token + 快照 + 自动重连 |

关键决策：服务端权威；不信任客户端；房间内存；不做超时判负。

上抛项：无。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

设计评审批次：M4 联机对战（房间码）。
评审范围，7 档：
- `docs/design/modules/online.md`（下表简称 online 档）
- `docs/design/modules/app-shell.md`（简称壳档）
- `docs/design/modules/board-ui.md`
- `docs/design/modules/local-play.md`（简称本地档）
- `docs/design/architecture.md`
- `docs/requirements/xiangqi.md`
- `test/RTM.md`

文档地图缺失，层级归属按 AGENTS.md 的「文档」表判定。
文件分档自查：自量测 `src/server/server.ts`、`src/client/pages/OnlinePage.tsx`、`src/client/online/socket.ts`、`test/online.test.ts`、`test/integration/online.test.tsx`，均不足 300 行，无一逼近 500 行；online 档 §7 的分档结论成立。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|------|--------|------|------|
| 1 | 文档归属 | 🔴 | 顶部导航两处活文档说法不同。online 档 §5 写「顶部导航加第四项「联机」」；壳档 §3 仍写「顶部一条导航：对弈 / 课程 / 练习」，同一档 §5 又写「导航四项（对弈 / 联机 / 课程 / 练习）」。本批改的正是壳的导航，却没有改拥有导航的壳档 §3，读者判断不出哪一份权威。 | 让壳档 §3 承载四项列表（写明 M4 起含「联机」），导航内容只在壳档一处定义；online 档 §5 只保留新增路由与行为差别。 |
| 2 | 分支出处（6b） | 🔴 | online 档 §2 的 error 联合里 `code: 'room-full'` 另带 `'room-not-found'` 与 `'bad-message'`，§4 又有 `error` 阶段消费它，但全文没有一句给出这三个分支的场景出处：无引用的真实观察（数据读数 / 日志行 / 用户报告），无可复现的失败路径，RTM 也无对应行。每个分支都自带一条 `message: string`、一份用户可见文案与一套跨端处理。 | 逐码补场景出处。`room-not-found` 给出复现路径：用一个注册表从未发出过的房间码发 `join`，服务端回 room-not-found。`room-full` 与 `bad-message` 要么写明触发场景（第三台设备进房 / 畸形帧），要么删掉该码。 |
| 3 | 需求覆盖 / 集成设计 | 🟡 | online 档 §9 的增量只覆盖对弈故事：「起点：`test/RTM.md` 的「对弈」故事。本批新增 F1-2 一行；F1-1（本地双人）不破坏，不冗余。」但本批同时改了页面壳（§5），壳的故事行 F4-1 断言的是「走一着后去课程再回对弈，棋盘与记谱保持原样」，导航由三项变四项是否动了这一行，设计未表态。 | 在 §9 补一句：F4-1 的断言不涉及导航项数则不受影响并说明理由，或写明该行须按新导航重跑 / 改断言。 |
| 4 | 验收口径 | 🟡 | online 档 §8、§9 只点到测试文件名（`test/online.test.ts`、`test/integration/online.test.tsx`、`test/room.test.ts`），没有给出本批要跑的命令。本地档 §7 的写法是「集成用例 F1-1（`npx vitest run test/integration/local-play.test.tsx`）」，同一层可执行口径在本档缺失。 | 在 §8 或 §9 补逐文件验收命令：单测 `node --test test/room.test.ts test/online.test.ts`，前端集成 `npx vitest run test/integration/online.test.tsx`，只跑改动面文件。 |
| 5 | 完整性 / 清晰度 | 🟡 | online 档 §3 的 rooms 行写「房间码注册表与码生成、查找、回收」，但「回收」全文无触发条件与时限。同节又写「心跳：30 秒 ping，连续两次无 pong 视为掉线，保留房间与 token 供重连」，可见保留窗长是重连正确性的承重参数，两人都离场的房间却没有回收口径。 | 在 §3 写明保留窗（多久内可带 token 重连）与回收触发（两人都离开且超过保留窗，或空房定时清扫），让回收与重连窗口一致。 |
| 6 | 清晰度 / 跨端一致 | 🟡 | online 档 §3 写「成功则更新局面、记谱、`seq + 1`、`lastMove`」，Snapshot 又给出 `moves: string[]`，但没指定记谱来自哪里。共享层这个契约是既有的：本地档记作「`src/shared/notation.ts`（`playMove` / `judgeGame` / `toChineseNotation` 契约）」；online 档的 Survey evidence 只列了 `src/shared/rules.ts`。`moves` 的字符串格式（中文记谱还是引擎着法串）也未写。 | 在 §3 点名 `toChineseNotation` 作为 `moves` 的来源并写明格式（与本地面板同一套中文记谱），Survey evidence 补上 `src/shared/notation.ts`。 |
| 7 | 既有件检查（第 11 条） | 🟡 | online 档 §7 只有一行「命名：`OnlinePage`、`createOnlineServer`、`RoomState`、`joinRoom`、`applyRoomMove`、`snapshotOf`、`useOnlineSocket` 为新增名字，项目内无同名先例（checked, none found）。」七个代码名之外，没有 `existing:` 形式的复用答复（棋盘 `play` 模式、`generateLegalMoves`、`presence`），也没有为新用户可见文案写 `none found`：§4「面板：房间码、己方颜色、轮到谁、双方在线、记谱、结果、离开」，以及「等待对手重连」、《联机》导航项、大厅「建房 / 输房间码」、`rejected` 的 `reason` 自由文本、三个 error 码的文案。 | 按本地档 §2「现有件检查：」的块式补齐：既有件写 `existing:` 或 `existing but unusable:` 并点名落点，新文案写 `none found:`；`reason: string` 要么定成稳定串，要么说明不展示给用户。 |
| 8 | 状态一致性 | 🟡 | 在线状态有两个通道。§2 的 ServerMessage 定义 `presence`，同一份 Snapshot 又带「red: boolean;   // 在线」；§3 写「连接/断开发 `presence`」，而每份快照也带着这两个布尔。同一事实两种载体，同一时刻可能互斥（快照说在线、presence 说离线），面板「双方在线」与「棋盘只读」会跟着抖。 | 定一处权威：要么在线状态只走 `presence` 由客户端合并进本地视图，要么只留在快照里让 `presence` 退化成触发一次快照；同时写明冲突时以谁为准。 |
| 9 | 可行性 / 测试缝（R6） | 🟡 | online 档 §9 写「test/integration/online.test.tsx（jsdom 假 socket，从联机页建房并走一着）」，但没给注入点。§4 的 `src/client/online/socket.ts` 是「WebSocket 封装与自动重连（1s → 2s → 4s → 8s 封顶）」；若重连阶梯里直接 `new WebSocket(...)`，假 socket 无法确定性驱动阶梯与消息往返。 | 在 §4 或 §9 写明测试缝：工厂参数或模块级 setter，默认回落到真实构造器（`??` 兜底），生产行为不变，用例在 `finally` 里还原。 |
| 10 | 文档归属（重复） | 🟡 | online 档 §5 的路由表与 §7 的 `OnlinePage` 行复述壳档既有段落：壳档 §1 的「\| `#/online` \| 联机大厅 / 房间 \|」与 §4 的「\| `src/client/pages/OnlinePage.tsx` \| 联机大厅与房间。 \|」，同一份清单在库里有了第二份。 | 路由与文件清单留在壳档，online 档改为引用（或删掉壳档的重复行），清单只活一份。 |
| 11 | 确定性（R4） | 🔵 | online 档 §9 写「test/online.test.ts（真实 ws，两个客户端）」，§3 又写「端口：`PORT` 环境变量，默认 8787」；用例绑固定端口会与并行跑或本机已在跑的服务撞车。 | 用例改用 `createOnlineServer()` 绑 0 号端口并读回实际端口，把端口选择留在测试里。 |
| 12 | 清晰度 | 🔵 | online 档 §3 写「纯房间状态机：建房、加入、落子、快照、重连；不碰 socket」，§7 却写「房间状态机。纯函数。」；若注册表持可变房间对象，「纯函数」与契约不符。 | 二者选一写死：函数式（返回新状态）还是持有可变状态的状态机，§3 与 §7 用同一措辞。 |
| 13 | 文档卫生 | 🔵 | 本地档 §8 的验收行里带「收口由 `npm run check` 跑全套」；该档的逐项验收本身是逐文件口径（「集成用例 F1-1（`npx vitest run test/integration/local-play.test.tsx`）」），全套只在 AGENTS.md 的提交红线里。 | 收口跑全套留在提交红线，验收表只保留逐文件口径，避免把发布门写成每轮成本。 |

计数：🔴 2 · 🟡 8 · 🔵 3

VERDICT: changes-required

### 轮次 2（评审子代理）

复核：M4 联机对战（房间码）· 第 2 轮

评审范围（7 档）：
- `docs/design/modules/online.md`
- `docs/design/modules/app-shell.md`
- `docs/design/modules/board-ui.md`
- `docs/design/modules/local-play.md`
- `docs/design/architecture.md`
- `docs/requirements/xiangqi.md`
- `test/RTM.md`

实现面（本轮一并核）：`src/server/room.ts`、`src/server/rooms.ts`、`src/server/server.ts`、`test/room.test.ts`。

前轮 13 项复核结果：13 项全部 Fixed（下表 1–13）。本轮新增 1 红、2 黄、1 蓝。

| # | Orig# | File | Severity | Status | Notes |
|---|-------|------|----------|--------|-------|
| 1 | 1 | `docs/design/modules/app-shell.md` | 🔴 | Fixed | 导航已改成四项：「顶部一条导航：对弈 / 联机 / 课程 / 练习」；`docs/design/modules/online.md` §5 只声明新增第四项并写出「导航由壳档拥有，见其导航节」，两档不再互相矛盾。 |
| 2 | 2 | `docs/design/modules/online.md` | 🔴 | Fixed | §2 新增「`error` 的三个取值的来源」，逐码给出场景与复现路径（`room-not-found`：大厅输入注册表里没有的 6 位码；`room-full`：第三人用新 token 进满房；`bad-message`：直接发 `{}`）。 |
| 3 | 3 | `docs/design/modules/online.md` | 🟡 | Fixed | §9 补行：壳的行 `F4-1` 不受影响，理由写明「它的断言不涉及导航项数」，并点名 `test/integration/navigation.test.tsx` 不改。 |
| 4 | 4 | `docs/design/modules/online.md` | 🟡 | Fixed | §8 末补验收命令：「本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；`npx vitest run test/integration/online.test.tsx`。」 |
| 5 | 5 | `src/server/rooms.ts` | 🟡 | Fixed | 回收有了窗口与触发：`docs/design/modules/online.md` §1「回收：两人都离线超过 30 分钟的房间删除，服务端每 60 秒扫一次」；实现 `sweep(now = Date.now(), ttlMs = 30 * 60_000): number {` 且 `src/server/server.ts` 起 60 秒定时扫；`test/room.test.ts` 有「离线回收」「两人中一人在线时不回收」两例。 |
| 6 | 6 | `docs/design/modules/online.md` | 🟡 | Fixed | 记谱来源点名：Survey evidence 增「`src/shared/notation.ts`：`toChineseNotation`，记谱来源」；§3 写明「记谱（`toChineseNotation`，与本地对局同一套中文记谱）」；`src/server/room.ts` 实调 `const notation = toChineseNotation(room.position, move);`。 |
| 7 | 7 | `docs/design/modules/online.md` | 🟡 | Fixed | §7 补「现有件检查：」块：棋盘 `play` 模式/`generateLegalMoves`/`toChineseNotation` 记 existing，新增导航文案与四种用户文案、`rejected.reason` 文案记 none found。 |
| 8 | 8 | `docs/design/modules/online.md` | 🟡 | Fixed | §3 定权威：「在线状态只有一个权威：快照里的 `red` / `black`。`presence` 只是变更通知」，`src/server/server.ts` 的 presence 与 state 广播与该条一致。 |
| 9 | 9 | `docs/design/modules/online.md` | 🟡 | Fixed | §4 写明接缝：「构造器接受 `WebSocketImpl` 注入（默认 `globalThis.WebSocket`），测试用假构造器驱动重连阶梯」——参数覆盖 + `??` 默认回退，生产行为不变。 |
| 10 | 10 | `docs/design/modules/online.md` | 🟡 | Fixed | 路由与文件清单不再复制：§5「路由由 `docs/design/modules/app-shell.md` §1 的路由表定义」；§4/§7 对 `OnlinePage.tsx` 只写「页面清单在 …§4，本模块不重复」。 |
| 11 | 11 | `docs/design/modules/online.md` | 🔵 | Fixed | §9 写明「`createOnlineServer()` 绑端口 0，避免与本地服务或并行用例抢 8787」；`src/server/server.ts` 支持 `options.port` 并回 `port`，可行。 |
| 12 | 12 | `docs/design/modules/online.md` | 🔵 | Fixed | 措辞统一：§3 表「纯函数，返回新的 `RoomState`，不碰 socket」，§7 表「纯函数」；`src/server/room.ts` 确为返回新对象。 |
| 13 | 13 | `docs/design/modules/local-play.md` | 🔵 | Fixed | 「提交前 `npm run check` 全绿（AGENTS.md 的提交门），不属于本模块的验收。」——全套跑已从验收里摘出。 |
| 14 | (new) | `src/server/server.ts` | 🔴 | New | 错误码联合设计与实现不一致：`docs/design/modules/online.md` §2 的协议块写「type: 'error'; code: 'room-full'」起头、只列三个取值，紧接着又写「`error` 的三个取值的来源」；但 `src/shared/protocol.ts` 的 `ErrorCode` 有第四个取值 `'server-error'`，且 `src/server/server.ts` 实际会发「code: 'server-error', message: '服务端处理失败'」。按设计写客户端的实现者不会处理这个值，且它没有来源/复现行。同一处 `bad-message` 还被用于设计未定义的场景：「code: 'bad-message', message: '先加入房间'」，而设计对 `bad-message` 的界定是「客户端发非 JSON 或字段不合法的帧」。 |
| 15 | (new) | `src/server/server.ts` | 🟡 | New | 心跳检测与设计差一档：设计写「连续两次无 pong 视为掉线」，实现是 `if (!conn.alive) {` 即 terminate（随后 `conn.alive = false;` 再 ping），一次未回 pong 即断。表现为「等待对手重连」比设计更早出现（有 token 可重连，不丢对局）。 |
| 16 | (new) | `docs/design/modules/app-shell.md` | 🟡 | New | 导航修好后留下的首句未同步：第 3 行仍写「一个页面壳承载对弈、课程、练习三块业务」，而同档 §3 导航与 §5「导航四项（对弈 / 联机 / 课程 / 练习）」已是四块。读者仍要自己判定哪句作准。 |
| 17 | (new) | `docs/design/architecture.md` | 🔵 | New | 数据流仍写「只发 {from, to}，服务端校验后广播权威结果」，而 `docs/design/modules/online.md` §2 的着法消息是 `{from, to, seq}`；本批沿用旧说法，未更新。 |

计数：🔴 1 · 🟡 2 · 🔵 1

VERDICT: changes-required

### 轮次 3（评审子代理）

复核轮次：第 3 轮（设计复核 · M4 联机对战（房间码） · 已实现）

本轮全部重读的评审面：
- `docs/design/modules/online.md`
- `docs/design/modules/app-shell.md`
- `docs/design/modules/local-play.md`
- `docs/design/architecture.md`
- `test/RTM.md`
实现面：`src/shared/protocol.ts`、`src/server/room.ts`、`src/server/rooms.ts`、`src/server/server.ts`、`test/room.test.ts`

结论：前轮 13 项 + 上轮新增 4 项，共 17 项全部 Fixed；无未解决 🔴，修复未引入新 🔴。

| # | Orig# | File | Severity | Status | Notes |
|---|-------|------|----------|--------|-------|
| 1 | 1 | docs/design/modules/app-shell.md | 🔴 | Fixed | §3 现为「顶部一条导航：对弈 / 联机 / 课程 / 练习；当前项用 `aria-current="page"` 标记。」；`docs/design/modules/online.md` §5 只声明新增第四项并写明导航归壳档拥有，两档不再互相矛盾。 |
| 2 | 2 | docs/design/modules/online.md | 🔴 | Fixed | §2 新增「`error` 的三个取值的来源」，逐码给场景与复现：room-not-found（大厅输入注册表里没有的 6 位码）、room-full（第三人用新 token 进满房）、bad-message（直接发 `{}`，或未进房发一着合法坐标）。 |
| 3 | 3 | docs/design/modules/online.md | 🟡 | Fixed | §9 补：「本批也改了壳的导航（第四项），壳的行 `F4-1` 不受影响：它的断言不涉及导航项数；`test/integration/navigation.test.tsx` 不因新增一项而改。」 |
| 4 | 4 | docs/design/modules/online.md | 🟡 | Fixed | §8 末补「本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；`npx vitest run test/integration/online.test.tsx`。」 |
| 5 | 5 | src/server/rooms.ts | 🟡 | Fixed | 回收窗口与触发齐：`docs/design/modules/online.md` §1 与 §3 表都写「两人都离线超过 30 分钟…每 60 秒扫一次」；`src/server/rooms.ts` 有 `sweep(now = Date.now(), ttlMs = 30 * 60_000): number {`；`src/server/server.ts` 起 `setInterval(() => rooms.sweep(), 60_000)`；`test/room.test.ts` 补「离线回收」与「两人中一人在线时不回收」两例。 |
| 6 | 6 | docs/design/modules/online.md | 🟡 | Fixed | 记谱来源三处到位：§7 survey evidence「`toChineseNotation`，记谱来源」、§3「记谱（`toChineseNotation`，与本地对局同一套中文记谱）」、§7 现有件检查；`src/server/room.ts` 实调 `const notation = toChineseNotation(room.position, move);`。 |
| 7 | 7 | docs/design/modules/online.md | 🟡 | Fixed | §7 有「现有件检查：」，逐项标 existing / none found（棋盘 `play` 模式、`generateLegalMoves`、`toChineseNotation`、导航与面板文案、`rejected.reason` 文案）。 |
| 8 | 8 | docs/design/modules/online.md | 🟡 | Fixed | §3 定权威：「在线状态只有一个权威：快照里的 `red` / `black`。`presence` 只是变更通知…」；`src/server/server.ts` 的 state 与 presence 广播与该说法一致。 |
| 9 | 9 | docs/design/modules/online.md | 🟡 | Fixed | §4 写明接缝：「构造器接受 `WebSocketImpl` 注入（默认 `globalThis.WebSocket`），测试用假构造器驱动重连阶梯」——参数覆盖 + 默认回退，生产路径不变。 |
| 10 | 10 | docs/design/modules/online.md | 🟡 | Fixed | 不再复制壳清单：§5「路由由 `docs/design/modules/app-shell.md` §1 的路由表定义；本页只负责大厅与房间的切换。」；§4 / §7 对页面清单只指向壳档 §4。 |
| 11 | 11 | docs/design/modules/online.md | 🔵 | Fixed | §9 写明 `createOnlineServer()` 绑端口 0；`src/server/server.ts` 支持 `options.port` 并回传 `port`，说法可行。 |
| 12 | 12 | docs/design/modules/online.md | 🔵 | Fixed | 措辞统一：§3 表「纯函数，返回新的 `RoomState`，不碰 socket。」与 §7 表「纯函数。」一致；`src/server/room.ts` 确为返回新对象。 |
| 13 | 13 | docs/design/modules/local-play.md | 🔵 | Fixed | 「提交前 `npm run check` 全绿（AGENTS.md 的提交门），不属于本模块的验收。」——全套跑已从验收摘出。 |
| 14 | (new) | src/shared/protocol.ts | 🔴 | Fixed | 错误码联合已对齐：`export type ErrorCode` 只列三个取值，与 `docs/design/modules/online.md` §2 协议块一致；`src/server/server.ts` 不再发 server-error，handler 抛错改为断开该连接，且设计 §3 明写「不新增协议错误码」；bad-message 的「未 `join` 就发 `move`」场景也已写进设计。 |
| 15 | (new) | src/server/server.ts | 🟡 | Fixed | 心跳对上「连续两次无 pong 视为掉线」：实现以 `missed` 计数，`if (!conn.alive) {` 时 `conn.missed += 1;`，`if (conn.missed >= 2) {` 才 terminate，收到 pong 置 `conn.alive = true` 并在下一拍清零。 |
| 16 | (new) | docs/design/modules/app-shell.md | 🟡 | Fixed | 首句改为「一个页面壳承载对弈、联机、课程、练习四块业务。」，与 §3 导航、§5「导航四项（对弈 / 联机 / 课程 / 练习）」一致。 |
| 17 | (new) | docs/design/architecture.md | 🔵 | Fixed | §5 数据流改为「联机对局：只发坐标与序号 {from, to, seq}，服务端校验后广播权威结果」，与 §2 协议一致。 |

计数：🔴 0 · 🟡 0 · 🔵 0（17 项全部 Fixed）

VERDICT: pass

## §4 用户批准（主 agent）

用户批准：2026-11-14「继续往下进行」授权进入 M4；同日「开工」批准计划中三条口径——入口取独立 `#/online` 加导航第四项、房间只存内存（重连限定服务进程存活期内）、M4 只恢复不判超时负；同日「收口」确认交付并同意走收口链。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



实现记录（2026-11-14）：

协议与引擎：
- `src/shared/protocol.ts`：`ClientMessage`（join / move / leave / ping）、`ServerMessage`（joined / state / rejected / presence / error / pong）、`Snapshot`、`RejectReason`、`ErrorCode`；`isClientMessage` / `parseClientMessage` 做入口校验。
- 服务端落子走 `src/shared/` 的 `playMove` / `statusOf` / `judgeGame`，记谱走 `toChineseNotation`；客户端不判规则。

服务端：
- `src/server/room.ts`：纯房间状态机，返回新的 `RoomState`；建房、按 token 重连或坐空位、落子校验（轮次、序号、合法性）、快照、`idleSince`。
- `src/server/rooms.ts`：房间码注册表（6 位、去 0/O/1/I、碰撞重试）、token（16 字节十六进制）、`sweep(now, ttlMs)` 回收两人离线超 30 分钟的房间。
- `src/server/server.ts`：http + `ws`（路径 `/ws`）、消息分发、房间广播、presence、30 秒心跳（连续两次无 pong 掉线）、60 秒回收扫描、异常断开连接不新增错误码；导出 `createOnlineServer()` 供测试绑端口 0。
- `src/server/main.ts`：`PORT` 环境变量、启动与优雅退出。

客户端：
- `src/client/online/session.ts`：纯 reducer，阶段 idle / connecting / lobby / waiting / playing / reconnecting / error；`players` 判等待与对局；`rejected` 给固定文案。
- `src/client/online/socket.ts`：WebSocket 封装、`sessionStorage` 存 `{room, token}`、断线指数退避重连（1s→2s→4s→8s）、`WebSocketImpl` 注入缝。
- `src/client/pages/OnlinePage.tsx`：大厅（建房 / 输房间码）与房间（棋盘 + 面板）；棋盘 `play` 模式按己方颜色限权，选子本地算，落子只发 `{from,to,seq}`。
- `src/client/shell/routes.ts`：`#/online`；`src/client/App.tsx`：导航四项（对弈 / 联机 / 课程 / 练习）与联机页渲染；`src/client/app.css`：大厅与房间样式。

运行：
- `scripts/dev.mjs` 同起 Vite 与服务端；`vite.config.ts` 代理 `/ws` → `ws://127.0.0.1:8787`；`package.json` 增 `dev` / `dev:client` / `dev:server` 与 `ws`、`@types/ws`。

验证读数：
- `npm run check` 全绿：typecheck 通过；`node --test` 137 项（新增 `test/room.test.ts`、`test/online.test.ts`，扩展 `test/routes.test.ts`）；`vitest run` 16 项（新增 `test/integration/online.test.tsx`）。
- `npm run build`：主 JS gzip 90.87 kB、CSS 2.81 kB。
- 浏览器实跑：`#/online` 建房（QA7R7H / 3HGUAL 两次），独立 ws 客户端执黑入房；红走「马八进七」，黑应「炮2进1」，双方快照 seq 到 2、着法一致；刷新页面后 sessionStorage 带 token 重连，房间、着法与轮到谁全部恢复。
- 评审中发现并修复：第二人进房时先到者只收到 presence、`players` 仍为 1 卡在等待——服务端在 join 成功后向房内补一份 `state`；已补 ws 用例断言。

评审整改：第 1 轮 changes-required（2🔴/8🟡/3🔵）、第 2 轮 changes-required（1🔴/2🟡/1🔵，前轮 13 项 Fixed）、第 3 轮 pass（17 项全部 Fixed）。主要改动：导航统一四项、error 码逐个写来源并把「未 join 就发 move」纳入 bad-message、移除第四错误码（异常改为断连）、心跳补 `missed` 计数、补房间回收实现与用例、补验收命令与注入缝、记谱来源与现有件检查、路由与文件清单归壳档。

与计划的差异：无范围变化；入口取独立 `#/online` 加导航第四项，房间内存、不判超时负（M5）。

## §6 验证与收口（父代理）

收口验证（2026-11-14）：
- `npm run check` 全绿：typecheck 通过；`node --test` 137 项全过；`vitest run` 16 项全过（7 个测试文件）。
- `npm run build` 成功：主 JS gzip 90.87 kB、CSS gzip 2.81 kB。
- 收口测试行：`node --test test/room.test.ts test/online.test.ts` 与 `npx vitest run test/integration/online.test.tsx` 都在 `npm run check` 里跑过。
- 浏览器实跑：建房 → 独立 ws 客户端执黑入房 → 红「马八进七」→ 黑「炮2进1」→ 双方快照一致；刷新后带 token 重连恢复。

M4 验收对照：

| 验收 | 结果 | 证据 |
|---|---|---|
| 两浏览器同房同步 | 通过 | `test/online.test.ts` 两个真实 ws 客户端同房走子、快照逐字相等；浏览器双端实跑 |
| 非法着法被拒 | 通过 | 服务端 `playMove` 校验；非法、轮次不对、序号过期均回 `rejected` + 当前快照 |
| 断线重连恢复 | 通过 | token + 快照；`test/online.test.ts` 断开重连拿回颜色与 seq；浏览器刷新实跑 |
| 客户端不决定结果 | 通过 | 客户端只发 `{from,to,seq}`，只渲染服务端快照 |

评审：第 1 轮 changes-required（2🔴/8🟡/3🔵）、第 2 轮 changes-required（1🔴/2🟡/1🔵）、第 3 轮 pass（17 项全部 Fixed）；文档机检 0 命中。

遗留与边界：
- 房间存内存，服务进程重启即清空；断线重连限定进程存活期内。
- 两人都离线 30 分钟后回收；不判超时负（M5 计时）。
- 观战、计时、认输求和、棋谱持久化、公网 WSS 不在本批。

台账：#4 结算为已核销，证据指向本节与 `npm run check` 读数。
