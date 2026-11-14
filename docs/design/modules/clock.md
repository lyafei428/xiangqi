# 计时与胜负判定

每方 15 分钟包干，走子后切给对方，归零判负。认输与求和也在本模块定判罚；联机的传输细节在 `docs/design/modules/online.md`。

Closest precedent: `docs/design/modules/local-play.md` — 对局会话、终局锁盘与面板显示已由该模块定下；本模块只在对局状态上加时钟与「认输 / 求和」两个动作，不改棋盘与布局。`docs/design/modules/online.md` 的权威快照是联机的唯一状态来源，本模块把时钟放进去。

Survey evidence: 已核对以下文档与代码：

- `docs/requirements/xiangqi.md`：F1.4 计时、F1.5 认输与求和、F4.2 缩放保留计时。
- `docs/design/architecture.md` §10：断线与时钟以服务端时间为唯一裁决。
- `docs/design/modules/local-play.md`：会话字段与动作、结局文案、§8 集成设计。
- `docs/design/modules/online.md`：协议、快照与房间广播。
- `src/shared/types.ts`：`GameResult` / `ResultType`。
- `src/client/game/session.ts`：`GameSession` 的终局与锁盘。
- `src/client/panel/GamePanel.tsx`：结局文案与「新局」。

勘察结论：`docs/design/modules/local-play.md` 与 `docs/design/modules/online.md` 的边界句与判罚段已按本模块对齐。

## 1. 时钟模型

`src/shared/clock.ts`，纯函数，不碰 DOM、不碰 Node API：

```ts
interface ClockState {
  redMs: number;          // 红方在 since 时刻的剩余
  blackMs: number;        // 黑方在 since 时刻的剩余
  running: Color | null;  // 正在走的一方；终局后为 null
  since: number;          // 计时锚点（毫秒时间戳），只在切边/开新局时更新
}

createClock(now, perSide?): ClockState   // 建表：默认 running 为 null，等开表
startClock(clock, now, turn): ClockState  // 开表：锚点挪到 now，交给 turn 走秒
remainingOf(clock, color, now): number   // running 方按 since 扣减，另一方原样
switchClock(clock, now): ClockState      // 扣掉 running 方到 now 的用时，换边，锚点置 now
stopClock(clock, now): ClockState        // 终局：扣时后 running = null
timeoutColor(clock, now): Color | null   // running 方剩余为 0 时返回该方
formatClock(ms): string                  // 面板显示：mm:ss
```

- 每方 15 分钟（900000 毫秒）包干；不加秒、不读秒。
- 时间只有一个来源：`since` 是唯一的绝对时间戳，剩余一律由 `remainingOf` 按 `now − since` 计算；不存第二套累计值，避免两套时间漂移。
- 开表时机：进页面只建表、不走秒（`running: null`）。按下「开始」，或落下第一着，才由 `startClock` 把锚点挪到那一刻、交给当前行棋方。走子成功后 `switchClock` 切给对方。刷新页面不丢时间：进页面时表不走，锚点只在开表那一刻落定。
- 「开始」与「认输」是同一个按钮的两种身份：开表前显示「开始」，开表后显示「认输」。需求 F1.10 把对局页的控件列成「新局与认输」，这里读作「控件在场」：认输那枚按钮开表后才叫认输，开表前它叫开始——少一次误点（开局就认输没有意义），也不需要为此多占一个位置。用户 2026-11-14 裁定按这个读法，不改 F1.10 的措辞；外观与尺寸取认输那一套（`.resign`），换字时只做一次 200ms 淡入位移，按钮位置与宽度全程不跳。
- 归零即终局：`timeoutColor` 返回归零方，结果 `timeout`，winner 为对方。
- 本地：页面每秒调用 `tick(now)`，只做超时判定；显示由 `remainingOf` 计算，不每秒改写锚点。
- 联机：建房间时表不走（只有一方，等人不该扣时）；第二人就座由 `joinRoom` 建表并开红方的表。服务端为唯一裁决（架构 §10）；快照里的 `clock` 是 `ClockState` 的线上投影（同形状，直接复用该类型）。

## 2. 判罚

`src/shared/types.ts` 的 `ResultType` 增加三个取值：

| 结果 | winner | 触发 | 面板文案 |
|---|---|---|---|
| `timeout` | 超时方的对方 | 时钟归零 | `黑方胜 · 超时`（红方超时为例） |
| `resign` | 认输方的对方 | 行棋方认输 | `黑方胜 · 认输` |
| `agreement` | null（和） | 一方提议和棋、对方接受 | `和棋 · 双方同意` |

- 认输：只有当前行棋方可以认输（本地同屏由当前方按）；终局后不可。
- 求和：只在联机提供；本地同屏没有对手可谈，不设求和按钮。
- 求和流程：任一棋手随时可提议 → 对方接受（判和）或拒绝（继续）；拒绝后，提议方在**另一方**再走一着之前不能重复提议。
- 提议、拒绝、接受都写进快照；终局后所有动作（走子、认输、求和）都被拒绝，棋盘锁盘。
- 红方认输/超时后 winner 为黑方，文案按上表；黑方同理。

## 3. 本地对局

- `GameSession` 增加 `clock: ClockState`；动作 `tick(now)`、`resign`。
- 每次走子成功后 `switchClock`；`tick` 由页面每秒调用一次，`timeoutColor` 非空即把 `result` 置为 `timeout` 并 `stopClock`。
- 走子与选子入口先判一次超时：已经归零就不再接受着法（不靠每秒轮询抽到）。
- 新局重置为 15 分钟、红方先行（表未开，等「开始」）。
- 面板显示双方时钟（`mm:ss`）；不足 60 秒的数字变红。开局按下「开始」才走秒（见 §1 的开表时机）。

## 4. 联机对局

协议与快照的字段加在 `docs/design/modules/online.md`；本模块只定语义：

- 快照带 `clock`（`ClockState` 形状，`since` 为快照生成时刻，`redMs` / `blackMs` 已是该时刻的剩余；客户端只读 `redMs` / `blackMs` / `running`）、`drawOffer: Color | null`、`drawBlocked: Color | null`。
- 联机时钟从**第二人就座**开始走：一个人等对手期间不扣时，也不判超时。
- 落子前先判一次超时：旗落了就不接受着法，直接广播 `timeout` 终局。
- 服务端每秒检查一次 `timeoutColor`；归零即判 `timeout` 并广播。
- `resign`：只接受当前行棋方的请求；判 `resign`。
- `offer-draw`：接受任一棋手，且在 `drawBlocked` 不是自己时；记录 `drawOffer`；已有待答提议时再提议回 `rejected` + `draw-pending`。
- `draw-response { accept }`：只接受提议的对方；接受判 `agreement`，拒绝清空提议并把 `drawBlocked` 设为提议方；提议方自己发 `draw-response` 回 `no-draw-offer`。
- 提议、拒绝、接受、走子、认输、超时、终局都清空 `drawOffer`；清空 `drawBlocked` 的时机是「非被拒方走子」——即被拒方在对方走一着之前不能再提议。
- 观战者不参与认输与求和；观战规则见 `docs/design/modules/online.md` §3，拒绝码见同档 §2。

## 5. 页面

- 对弈页（本地）：面板顶部加双方时钟；「认输」按钮。
- 联机页：面板加双方时钟、「认输」与「提议和棋」；对方提议时显示「对方提议和棋 · 接受 / 拒绝」。
- 本地显示：每秒用 `remainingOf(clock, color, Date.now())` 计算，页面用一次每秒的重渲染驱动。
- 联机显示：以收到快照的时刻为锚（本地单调时钟），在走方剩余按「快照值 − 已过毫秒」投影；未坐满时服务端尚未开局，客户端也不投影，直接显示满额；归零仍由服务端裁决，投影只用于显示。切页、重连后重新取快照。
- 移动端时钟放在面板顶部一行，两个数字与按钮同一行内可换行，不出现横向滚动。

## 6. 文件划分

| 文件 | 职责 |
|---|---|
| `src/shared/clock.ts` | 时钟模型与扣时、切边、归零判定、`mm:ss` 格式化。纯函数。 |
| `src/shared/types.ts` | `ResultType` 增 `timeout` / `resign` / `agreement`。 |
| `src/client/game/session.ts` | 本地会话的时钟、认输、tick 动作。 |
| `src/client/panel/GamePanel.tsx` | 时钟显示、三条新结局文案与「认输」。 |
| `src/client/pages/PlayPage.tsx` | 每秒 tick 与新局重置。 |
| `src/server/room.ts` | 房间时钟、认输、求和状态与判罚。 |
| `src/server/server.ts` | 新消息分发与每秒超时检查。 |
| `src/shared/protocol.ts` | 三个新消息、快照字段与四个新拒绝码。 |
| `src/client/online/session.ts` | 求和提议、拒绝、阻塞的展示状态。 |
| `src/client/pages/OnlinePage.tsx` | 时钟、认输、求和的按钮与横幅。 |
| `test/clock.test.ts` | 时钟单测（新增）。 |
| `test/client-session.test.ts` | 本地会话计时与认输（扩展）。 |
| `test/room.test.ts` | 房间时钟、认输、求和（扩展）。 |
| `test/online.test.ts` | 双客户端认输与求和（扩展）。 |
| `test/game-panel.test.tsx` | 三条新结局文案（扩展）。 |
| `test/integration/local-play.test.tsx` | F1-3（扩展）。 |
| `test/integration/online.test.tsx` | F1-4（扩展）。 |

现有件检查：

- `GameSession`：existing — `src/client/game/session.ts`，终局与锁盘逻辑复用；只加 `clock` 与两个动作。
- `GamePanel`：existing — `src/client/panel/GamePanel.tsx`，结局文案表扩三项、加时钟与认输按钮。
- `PlayPage`：existing — `src/client/pages/PlayPage.tsx`，加每秒 tick 与认输回调。
- 快照：existing — `docs/design/modules/online.md` §2，只加字段。
- 「认输」「提议和棋」「对方提议和棋」文案：none found — 新增。

命名：`ClockState`、`createClock`、`switchClock`、`remainingOf`、`stopClock`、`timeoutColor`、`drawOffer`、`drawBlocked`、`draw-blocked`、`draw-pending`、`no-draw-offer` 为新增名字，项目内无同名先例（checked, none found）。`ClockView` 直接复用 `ClockState`（线上投影同形状）。

文件分档结论：本批所有改动文件都在 500 行内，也没有 300 行以上的单函数——**本批不需要拆分方案**。

## 7. 验收对照

| 需求 | 落点 | 怎么验 |
|---|---|---|
| F1.4 每方 15 分钟、归零判负、显示「超时」 | `src/shared/clock.ts` + 会话/房间归零判定 + `GamePanel` 文案 | `test/clock.test.ts`、`test/client-session.test.ts`、`test/game-panel.test.tsx` |
| F1.4 缩放不重置、不停表 | 时钟只存锚点，布局变化不重建会话 | 浏览器实跑：连续缩放后时钟不断且数值接上（jsdom 无布局，不进集成用例） |
| F1.5 认输 | 本地与联机的 `resign`，只接受当前行棋方 | `test/client-session.test.ts`、`test/room.test.ts`、`test/integration/local-play.test.tsx` |
| F1.5 求和与拒绝后不重复 | 联机 `offer-draw` / `draw-response` / `drawBlocked` | `test/room.test.ts`、`test/online.test.ts`、`test/integration/online.test.tsx` |

本批验收命令（只跑改动面）：`node --test test/clock.test.ts test/client-session.test.ts test/room.test.ts test/online.test.ts`；`npx vitest run test/game-panel.test.tsx test/integration/local-play.test.tsx test/integration/online.test.tsx`。

## 8. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事。本批新增两行：F1-3（本地计时与认输）、F1-4（联机计时、认输与求和）；既有 F1-1 / F1-2 不破坏，不冗余。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-3 | 本地会话 → 时钟 → 面板 | 红方时钟归零显示「黑方胜 · 超时」并锁盘；认输立刻结束 | 打开页面 → 对弈 | F1.4、F1.5 |
| F1-4 | 两个客户端 → 房间时钟与求和 | 双方看到同一时钟；归零判负；求和被接受判和；被拒后再次提议被拒、对方走一着后可再提议 | 打开页面 → 联机 | F1.4、F1.5 |

实现：`test/integration/local-play.test.tsx`（F1-3，jsdom 假时钟）；`test/online.test.ts` 与 `test/integration/online.test.tsx`（F1-4）。
