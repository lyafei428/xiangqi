# 2026-11-15 · 联机快速匹配
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-15 · 来源 = 用户 2026-11-14：「联机中增加随机分配功能，可以自动分配等待中的棋手，同时该棋手创建房间时允许别人不经过房间号就能匹配」；追问后裁定「默认关闭，创建房间时要勾上才会被匹配」。
> 台账 = #23（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 批次任务与设计

**交付目标**：联机加随机匹配——有在等的人就直接配上，没有就自己开一间等；建房时勾了「允许随机匹配」的房才会被陌生人配进来（用户裁定：默认关闭，勾上才进池）。

**设计档**：`docs/design/modules/online.md` §1（房间与身份）、§2（协议）、§3（服务端）、§4（客户端）、§5（大厅）、§8/§9（验收与集成测试）；需求 `docs/requirements/xiangqi.md` F1.2。

**做法**

| 层 | 设计 |
|---|---|
| 协议 | `join` 增 `matchable?: boolean`（只在建房时生效）；新增 client 消息 `quick-match`；快照带 `matchable`，房内可据此说明 |
| 服务端 | `Rooms.findOpenMatchable()` 挑「`matchable` 为真、只有红方一席、红方在线、对局未结束」的房；挑到就让发起者走普通 `join` 坐黑方，挑不到就建房并标可匹配——两条路复用同一份建房/就座/广播实现，不另开状态机 |
| 客户端 | 大厅三卡：创建（勾选默认关）/ 随机匹配 / 加入；`socket.quickMatch()` 握手后发 `quick-match`，意图留到 `joined` 才清 |
| 测试 | 服务端三条（配对与颜色、默认关闭、自匹配）、前端三条（勾选接线、两个入口不混） |

**边界**：匹配前先退掉发起者自己占着的房（否则同一连接匹配第二次会配到自己那间）；房主掉线的空座房不参与匹配。

**分档结论**：改动都落在既有文件内，无一文件跨 500 行档（余量最小的是 `src/client/pages/OnlinePage.tsx`），无 300 行以上单函数——**本批不需要拆分方案**。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

设计评审对象：`docs/design/modules/online.md`（联机随机匹配：协议 + 房间层 + 大厅 UI）。核对范围另含 `docs/requirements/xiangqi.md` 与 `test/RTM.md`。文档归属按 AGENTS.md 的目录约定核对（未找到 README 文档地图，本项为降级核对）：本档落在 `docs/design/modules/`，与约定一致。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | 需求覆盖 | 🔴 | F1.2 的随机匹配只落到协议与房间层，**大厅 UI 这一半没有落点**。需求以用户动作为验收口径——`docs/requirements/xiangqi.md` F1.2：「可随机匹配：有在等的人就直接配上，没有就自己开一间等；建房时勾了「允许随机匹配」的房才会被陌生人配进来，不勾只能凭房间码进」；`test/RTM.md` F1-2 断言「随机匹配：两人先后点「随机匹配」进同一间房且颜色不撞」。但设计里大厅只写了两张卡：`docs/design/modules/online.md` §5「大厅是两张卡：左边「创建房间」，右边「加入房间」（六位码手动输入）。」，§4 同样只写「大厅（建房 / 输房间码）与房间（棋盘 + 面板）同页切换」。协议侧却已经有 `matchable` / `quick-match` / `quickMatch()`，说明控件必须存在，但按钮与「允许随机匹配」勾选落在哪里、文案是什么、勾选如何接到 `join.matchable`，全档未写。§5 自述本页负责大厅与房间的切换，`docs/design/modules/app-shell.md` 只拥有页面清单，因此这条缺口无处可推。 | §5 大厅规格里补上随机匹配入口与「允许随机匹配」勾选的落点（第几张卡、按钮与勾选文案、默认不勾、与 `join.matchable` / `quick-match` 的接线），并写明未勾选的房不进匹配池；§4 的 OnlinePage 一行同步。 |
| 2 | 集成测试设计 | 🔴 | 随机匹配这个本批 headline 没有任何验收落点，且设计与 `test/RTM.md` 的增量口径互相打架。§9 自述「本批的增量是 **F1-2 扩写一行「终局后同房间再来一局」**（见下表第一行）」，表内 F1-2 行的业务结果只写「同房走子双方看到同一局面；非法着法被拒绝；断线重连带 token 恢复」，§9 实现分工三份测试文件写的全是观战与回收（「`test/room.test.ts`：观战的房间层行为」），§8 验收对照八行也没有随机匹配。而 `test/RTM.md` F1-2 那一行已经断言了随机匹配的两条业务结果。结果是：`test/RTM.md` 里有的断言，设计既没派给任何用例，也没说明为什么不需要——不是「不适用」，是没写。 | §9 补一行（或明确扩写 F1-2 行）把随机匹配的交互（两个客户端 → 匹配池 → 房间层就座）、业务结果（先点者等待、后点者配进同一房且颜色不撞；未勾可匹配的房配不进来）、入口（打开页面 → 联机 → 随机匹配）与需求号 F1.2 写全，并在实现分工里指到具体测试文件；§8 同步补一条落点。 |
| 3 | 现有件检查 | 🟡 | 三项问答没有覆盖本批新增的名字与文案。§7「现有件检查」列的文案只到「「联机」导航文案、「创建房间」「房间码」「等待对手重连」「离开房间」「观战中 · N 人观战」、错误文案：none found」；命名行只列「`OnlinePage`、`createOnlineServer`、`RoomState`、`joinRoom`、`applyRoomMove`、`rematchRoom`、`snapshotOf`、`useOnlineSocket` 为新增名字，项目内无同名先例（checked, none found）。」——「随机匹配」「允许随机匹配」、`quick-match`、`matchable`、`findOpenMatchable` 三问全缺。 | 给上述四个名字与两条文案各补一句 existing / none found / existing but unusable；若复用大厅已有卡片与按钮样式，写明复用点与不可用理由。 |
| 4 | 边界条件 | 🟡 | 匹配意图在 `joined` 回来之前断开就丢了。§4 只写「重连时自动带 token 发 `join`；`quickMatch()` 走同一条连接，握手完成后发 `quick-match` 而不是 `join`。」`localStorage` 记的是 `{ room, token }`，而 token 只有 `joined` 才拿到——握手后、`joined` 前掉线时，重连阶梯手里没有可重发的意图，落点未定义（用户可能被服务端配进 A 房，本地却另开 B 房）。 | 写明这个窗口的处置：重连后重发待匹配意图，或由 socket 记住「本次握手是 quick-match」，并说明服务端重复匹配如何收敛。 |
| 5 | 边界条件 | 🟡 | 匹配筛选条件不含「排除发起者自己」。§3「随机匹配：`Rooms.findOpenMatchable()` 挑「`matchable` 为真、只有红方一席、红方在线、对局未结束」的房」——同一个人第二次发 `quick-match`（双击，或同设备第二个标签页）时，自己刚建的那间房正好满足这四个条件，会被配成自己坐黑。档里没有对连线/身份加任何排除说明。 | 筛选条件补上对发起者自身座位或连接的排除，或写明为何该形状不会出现（并给出复现路径佐证）。 |
| 6 | 分支出处（6b） | 🟡 | 观战重连满员这条分支没有给出观察或复现路径。§1 写「观战按在线连接计、不按 token（同一 token 的新连接与尚未断开的旧连接各占一位）；八人满员时重连可能先收到 `spectators-full`，等旧连接断开后重试即可。」——「可能」是推测，既没有一条真实观察（谁在什么情况下撞到过），也没有一条可复现路径（旧连接在什么条件下不会先断）；而它为观战数带来「同一 token 占两位」的常设规则。 | 补复现路径（例如观战端不发 close 帧掉线后 30 秒内重连，对照 `spectators` 计数）或一条真实观察；否则写明观战计数为何不按 token 去重。 |
| 7 | 清晰度 | 🟡 | §3「第二人进房或重连时也先给先到者补一份 `state`（`players` 变了，先到者才能从等待进到对局）。」——括号里的理由只对「进房」成立；重连时座位数没变（`players` 仍是 2），变的是 `red` / `black`。照这句实现会把补发门控在 `players` 变化上，重连那半就不补发了。 | 把补发的两种情形分别写清（座位数变化 / 在线位变化各自为什么需要一份 `state`），避免实现按单一条件门控。 |
| 8 | 清晰度 | 🔵 | §3 的时钟句顺序读反了：「落子前先判超时，判超时才扣时并换边；每秒检查在走方是否归零，归零即判 `timeout` 并广播。」——扣时与换边是每着一律要做的，只有归零才判超时，句子的因果与顺序相反。 | 改写为：落子前先结清在走方已用时间；归零即判 `timeout`，未归零则落子并换边。 |
| 9 | 文档清晰 | 🔵 | §7 的「新局」一句自指：「按钮与对联机页的 `新局` 同一处（对局页也叫「新局」）」，而这一条本身讲的就是联机页那枚按钮。 | 改成指向对弈页的同名按钮，说明两处同名同文案、位置各自的容器即可。 |
| 10 | 分档结论（8） | 🔵 | §7「本批涉及的服务端、共享、页面、客户端联机模块、测试文件与 `scripts/dev.mjs` 都没有跨过 500 行（代码结构线），也没有 300 行以上的单函数——**本批不需要拆分方案**。」——实测复核：`src/client/pages/OnlinePage.tsx` 486 行、`test/room.test.ts` 462 行、`test/online.test.ts` 413 行、`test/integration/online.test.tsx` 500 行、`src/server/room.ts` 356 行、`src/server/server.ts` 317 行，无一超过 500 行，结论今天成立；但余量最小的两个文件正是 §9 指给新增用例的那两个，且缺的随机匹配用例还会往里加。函数档（无 300 行以上单函数）不在本次只读范围内，未核实。 | 结论保留，同时点名余量最小的文件并说明新增用例往哪个文件落；随机匹配用例落位后复测行数。 |

计数：🔴 2 · 🟡 5 · 🔵 3。

VERDICT: changes-required

### 轮次 2（评审子代理）

第 2 轮（设计评审 · 联机随机匹配修复轮）——只核第 1 轮 2🔴 5🟡 3🔵 的处置。

评审面说明：spawn 里点名的 `scripts/.tmp-append.mjs` 与 `scripts/.doc-edit.mjs` 在仓库里不存在（`scripts/` 只有 acceptance/、acceptance.mjs、build-standalone.mjs、dev.mjs、pwa-icons.mjs；两个路径直接读取均报 ENOENT），无物可评。修复实际落在 `docs/design/modules/online.md`，下表按该文件本轮实时读取状态逐条核对。

| # | Orig# | File | Severity | Status | Notes |
|---|-------|------|----------|--------|-------|
| 1 | 1 | docs/design/modules/online.md | 🔴 | Fixed | 大厅控件已落地且两处一致：§4「大厅（建房 / 随机匹配 / 输房间码）与房间（棋盘 + 面板）同页切换」；§5「大厅三张卡：」→「**创建房间**：…按钮下方一行勾选「允许随机匹配（不勾则只能凭房间码进）」，默认不勾」与「**随机匹配**：「随机匹配」按钮。发 `quick-match`」。与 `docs/requirements/xiangqi.md` F1.2「建房时勾了「允许随机匹配」的房才会被陌生人配进来」对齐；卡片样式落点也给了（`.online-cards` / `.online-card`）。 |
| 2 | 2 | docs/design/modules/online.md | 🔴 | Fixed | 增量口径与用例齐了：「本批的增量是 **F1-2 扩写两行**：一行「终局后同房间再来一局」，一行「随机匹配」」；§9 新增行「F1-2（随机匹配）｜两个客户端 → 匹配池 → 房间层就座｜先点「随机匹配」的人进房等；后点的人配进同一间房、颜色不撞；建房时没勾「允许随机匹配」的房配不进来｜打开页面 → 联机 → 随机匹配｜F1.2」；§8 新增「F1.2 随机匹配」落点（`findOpenMatchable` + `test/online.test.ts` 三条 + 前端三条）。`test/RTM.md` F1-2 的那两条断言现在有着落。 |
| 3 | 3 | docs/design/modules/online.md | 🟡 | Fixed | §7 文案清单已含「「随机匹配」「允许随机匹配（不勾则只能凭房间码进）」」；命名行已含「`quick-match`、`matchable`、`findOpenMatchable`」，并给了复用答案「「随机匹配」按钮与「创建房间」按钮同一套 `.btn` 样式与同一张大厅卡片结构（existing），不新造按钮样式」。 |
| 4 | 4 | docs/design/modules/online.md | 🟡 | Fixed | §4 socket 补了待匹配意图：「这次「来匹配」的意图一直留到收到 `joined` 才清——握手后、`joined` 前掉线时，重连重发 `quick-match` 而不是拿空 `join` 另开一间房（服务端可能已经把人配进了另一间）」。 |
| 5 | 5 | docs/design/modules/online.md | 🟡 | Fixed | §3 补了自匹配排除：「先退掉发起者自己已经占着的房，再由 `Rooms.findOpenMatchable()` 挑…——不退这一步，同一连接匹配第二次会配到自己那间（自己坐红又坐黑，看着配上了其实没有对手）」；§8 有对应用例「同一连接匹配两次不会配到自己那间」。 |
| 6 | 6 | docs/design/modules/online.md | 🟡 | Fixed | §1 给出复现路径：「（复现：观战端直接断网，30 秒内恢复；服务端心跳两次超时后旧连接才释放）」，与 §3「30 秒 ping，连续两次无 pong 视为掉线」自洽。 |
| 7 | 7 | docs/design/modules/online.md | 🟡 | Fixed | §3 改成两种情形分写并禁止单一门控：「进房时是座位数变了（`players` 1→2，先到者才能从等待进到对局），重连时座位数不变、变的是在线位（`red` / `black`），两种情形都要补，不能按 `players` 变化做门控。」 |
| 8 | 8 | docs/design/modules/online.md | 🔵 | Fixed | §3 时钟句已改顺：「落子前先结清在走方已用时间：归零即判 `timeout` 并广播，未归零则落子并换边；另每秒检查在走方是否归零。」 |
| 9 | 9 | docs/design/modules/online.md | 🔵 | Fixed | §7 自指句已消：「文案与对弈页那枚「新局」同名同字（两处各在自己的页面里，不复用组件）」。 |
| 10 | 10 | docs/design/modules/online.md | 🔵 | Fixed | §7 已点名余量最小者并给了触发规则：「这三个文件任一越过 500 行就同批拆出，不拖到下一批」；本轮实测 `test/room.test.ts` 462 行、`test/integration/online.test.tsx` 500 行，与档内数字一致（另有 #13 的遗漏）。 |
| 11 | (new) | docs/design/modules/online.md | 🟡 | New: §9「实现分工」没跟新增的两行——三条里只有观战：「`test/integration/online.test.tsx`：jsdom 假 socket 验观战视角（棋盘只读、无认输与求和按钮、面板显示「观战中」）。」随机匹配与再来一局的落点只散在 §8。advisory：在实现分工补一句，指到 `test/online.test.ts` / `test/room.test.ts` / `test/integration/online.test.tsx`。 |
| 12 | (new) | docs/design/modules/online.md | 🔵 | New: 「两行的业务结果与 `test/RTM.md` 的 F1-2 逐字对齐」不成立——是改写：`test/RTM.md` 原文「随机匹配：两人先后点「随机匹配」进同一间房且颜色不撞；没勾「允许随机匹配」的房不会被配进来」，档内写成「建房时没勾「允许随机匹配」的房配不进来」。语义对齐、逐字不成立，建议改口径为「覆盖同批断言」或直接抄 RTM 原文。 |
| 13 | (new) | docs/design/modules/online.md | 🔵 | New: 「余量最小的是 `test/room.test.ts` 与 `test/integration/online.test.tsx`（本批判定时刻分别 462 / 500 行）」漏了 `src/client/pages/OnlinePage.tsx`（本轮实测 486 行，余量 14 行 < `test/room.test.ts` 的 38 行），而三张卡的大厅规格恰好落在这个文件上。建议把这一个也补进那句。 |
| 14 | (new) | src/client/pages/OnlinePage.tsx | 🟡 | Coordination item（非缺陷）：本轮新增的大厅规格在实现上还没落地——该文件首行仍是「// 联机页：大厅（建房 / 加入）与房间（棋盘 + 面板）。」，行数与上轮判定时一致（486）。收口前确认三卡与勾选已实现（是否另有落点未核，超出本次只读面）。 |

计数：🔴 未决 0 · 新增 🔴 0 · 🟡 2（#11、#14，均 advisory，不阻断） · 🔵 3（#12、#13、#10 附注）。第 1 轮 2🔴 全部 Fixed，5🟡 与 3🔵 全部已处置；文件分档结论经本轮实测复核仍成立（无一文件超过 500 行）。

VERDICT: pass

## §4 用户批准（主 agent）

## 用户确认

- 2026-11-14 用户原话：「联机中增加随机分配功能，可以自动分配等待中的棋手，同时该棋手创建房间时允许别人不经过房间号就能匹配」。
- 追问「房主能不能拒绝陌生人随机匹配」后裁定：「默认关闭，创建房间时要勾上才会被匹配」。已按此实现：勾选框默认不勾，勾了才发 `matchable: true`；点「随机匹配」本身视为同意被配。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



## 实施记录

**改了什么**

| 文件 | 改动 |
|---|---|
| `src/shared/protocol.ts` | `join` 增 `matchable?: boolean`（只在建房时生效）；新增 client 消息 `quick-match`；`Snapshot` 增 `matchable` |
| `src/server/room.ts` | `RoomState` / `createRoom` / `snapshotOf` 带上 `matchable` |
| `src/server/rooms.ts` | `create(..., matchable)`；新增 `findOpenMatchable()`：`matchable` 为真、只有红方一席、红方在线、对局未结束 |
| `src/server/server.ts` | `quick-match` 分支：先退掉发起者自己占着的房，再找等待房（找到坐黑方，找不到建房并标可匹配）；两条路都走 `join` |
| `src/client/online/socket.ts` | `quickMatch()`；`pendingQuickMatch` 留到 `joined` 才清（握手后掉线会重发 `quick-match`，不会拿空 `join` 另开房） |
| `src/client/pages/OnlinePage.tsx` | 大厅三卡：创建（带「允许随机匹配」勾选，默认关）/ 随机匹配 / 加入 |
| `src/client/styles/drill.css` | `.online-matchable` 勾选行 |
| `test/online.test.ts` | 三条：两人先后匹配进同一房且颜色不撞、未勾可匹配的房配不进来、同一连接匹配两次不配到自己那间 |
| `test/integration/online.test.tsx` | 三条：默认不带 `matchable`、勾上带 `true`、点「随机匹配」发 `quick-match` 不发 `join` |

**两个评审抓出的真缺陷**（不是文档问题，是实现 bug）：

1. 同一连接连点两次随机匹配，会配到自己刚建的那间房，自己坐红又坐黑——看着配上了，其实没有对手。修法：匹配前先退掉自己占着的房。
2. 握手后、`joined` 前掉线，重连拿空 `join` 会另开一间房，而服务端可能已把人配进另一间。修法：`pendingQuickMatch` 留到 `joined` 才清。

**验证**：`npm run check` → tsc 通过、277 单测 0 失败、81 前端用例 0 失败。

**没做的**：单文件版未重打；联机服务仍未随站点部署（台账 #13）。

## §6 验证与收口（父代理）

## 验证与收口

```
npm run check
  tsc --noEmit              通过
  node --test               277 通过 / 0 失败
  vitest run                81 通过 / 0 失败（14 个文件）
```

**本批新增的用例**

| 位置 | 验什么 |
|---|---|
| `test/online.test.ts`：随机匹配：第一个等、第二个直接配上，颜色不撞 | 匹配池的配对与颜色分配 |
| `test/online.test.ts`：随机匹配不碰没勾「允许匹配」的房 | 默认关闭这条口径 |
| `test/online.test.ts`：随机匹配不会把自己配到自己那间房 | 同一连接匹配两次的自匹配缺陷 |
| `test/integration/online.test.tsx`：不勾时 join 不带 matchable=true | 勾选默认关 |
| `test/integration/online.test.tsx`：勾上后 join 带 matchable=true | 勾选生效 |
| `test/integration/online.test.tsx`：点「随机匹配」发 quick-match 不发 join | 两个入口不混 |

两轮设计评审：第 1 轮 2🔴 5🟡 3🔵（大厅控件未落档、无验收落点等），第 2 轮 pass；评审顺带查出两个实现缺陷（自匹配、重连丢意图）已修并补用例。

**没做的**：单文件版未重打；联机服务仍未随站点部署（台账 #13），随机匹配目前只能在 `npm run dev` 下实测。
