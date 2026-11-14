# 联机对战（房间码）

两台设备用房间码进同一局：服务端持权威局面，客户端只发坐标。断线带 token 重连，服务端回权威快照。

Closest precedent: `docs/design/modules/local-play.md` — 对局页的棋盘、尺寸与本地会话已由该模块定下；`src/client/game/session.ts` 的选子与走子规则直接复用。本模块只把「本地落子」换成「发坐标、等快照」。

Survey evidence: 已核对以下文档与代码：

- `docs/requirements/xiangqi.md`：F1.2 房间码联机。
- `docs/design/architecture.md` §2（服务端权威判定）、§3（http + ws）、§5（客户端只发 from/to）、§8（M4 验收）、§10（token + 快照恢复）。
- `src/shared/rules.ts`：`playMove` / `statusOf` / `generateLegalMoves` / `judgeGame`。
- `src/shared/notation.ts`：`toChineseNotation`，记谱来源。
- `src/client/game/session.ts`：选子与走子状态。

未发现与 M4 冲突的既有设计。

## 1. 房间与身份

- 一房两席：先到者红，第二个进房者黑；两席都已坐满时，后来者进观战（不占座、不参与走子与计时）。
- 房间码 6 位，字符集 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`（去掉 0/O/1/I），碰撞重试。
- 进房发 token（16 字节随机十六进制）。客户端存 `sessionStorage`，断线后带 token 重连，服务端按 token 找回颜色与局面。
- 观战者的 token 不映射座位：重连带回去仍然是观战。观战按在线连接计、不按 token（同一 token 的新连接与尚未断开的旧连接各占一位）；八人满员时重连可能先收到 `spectators-full`，等旧连接断开后重试即可。
- 观战者发 `leave` 或断开即减计数、腾出观战位；服务端向房内广播新快照（`spectators` 变了）。
- 房间存内存：服务进程重启即清空。「断线重连恢复」限定在服务进程存活期内；持久化留后续批次。
- 回收：两名棋手都离线、且 `spectators === 0`，超 30 分钟才删房间，服务端每 60 秒扫一次；有观战在线时房间留住。
- 联机计时、认输与求和的判罚见 `docs/design/modules/clock.md` §2；对手离线只显示「等待重连」。

## 2. 协议

`src/shared/protocol.ts`，纯类型与纯校验，不碰 DOM、不碰 Node API。

```ts
type ClientMessage =
  | { type: 'join'; room?: string; token?: string }
  | { type: 'move'; from: number; to: number; seq: number }
  | { type: 'resign' }
  | { type: 'offer-draw' }
  | { type: 'draw-response'; accept: boolean }
  | { type: 'leave' }
  | { type: 'ping' };

type ServerMessage =
  | { type: 'joined'; room: string; token: string; role: 'player' | 'spectator'; color: Color | null; snapshot: Snapshot }
  | { type: 'state'; snapshot: Snapshot }
  | { type: 'rejected'; reason: RejectReason; snapshot: Snapshot }
  | { type: 'presence'; red: boolean; black: boolean }
  | { type: 'error'; code: 'room-not-found' | 'bad-message' | 'spectators-full'; message: string }
  | { type: 'pong' };

interface Snapshot {
  room: string;
  startFen: string;
  fen: string;
  seq: number;
  turn: Color;
  status: GameStatus;
  result: GameResult | null;
  lastMove: Move | null;
  moves: string[];         // 中文记谱，只供显示
  moveLog: Move[];         // 逐着坐标，回放与存局用
  red: boolean;   // 在线
  black: boolean;
  players: number; // 已坐下的座位数（1 或 2）
  spectators: number; // 在线观战人数（0..8），不占座位
  clock: ClockState;       // 快照时刻的剩余（redMs/blackMs 已按快照时间算好）
  drawOffer: Color | null; // 当前的和棋提议方
  drawBlocked: Color | null; // 拒绝后、对方走一着前不能再提议的一方
}
```

- `move.seq` 是客户端看到的快照序号。服务端只接受等于当前序号的着法；不等就回 `rejected` 与当前快照，防止重连后补发旧着。
- 认输与求和的判罚见 `docs/design/modules/clock.md` §2；协议只负责传输意图与结果。
- `rejected` 一定附带当前快照，客户端以快照为准，不做本地回滚。
- `rejected.reason` 是固定取值（`not-in-room` / `not-your-turn` / `game-over` / `stale-seq` / `illegal-move` / `draw-blocked` / `draw-pending` / `no-draw-offer`），客户端按取值给文案；非法着法、轮次不对、序号过期都走 `rejected`，房间状态不变。
- 三个新拒绝码的来源：
  - `draw-blocked`：被拒方在对方走一着前再次提议；复现：A 提议、B 拒绝后，A 再发 `offer-draw`。
  - `draw-pending`：已有待答提议时再提议；复现：A 提议后，B 在应答前也发 `offer-draw`。
  - `no-draw-offer`：没有待答提议或不是提议的对方时发 `draw-response`；复现：直接发 `{"type":"draw-response","accept":true}`，或提议方自己发应答。
- `error` 的三个取值的来源：
  - `room-not-found`：大厅输入一个注册表里没有的 6 位码；复现：`join` 带该码，服务端回此码。
  - `spectators-full`：两席已满、观战也满 8 人；复现：第 11 台设备进同一个满房（2 席 + 8 观战）。
  - `bad-message`：无法解析的帧、字段不合法，或未 `join` 就发 `move`；复现：直接发 `{}`，或未进房发一着合法坐标。

## 3. 服务端

| 文件 | 职责 |
|---|---|
| `src/server/room.ts` | 房间状态机：建房、加入、落子、快照、重连；纯函数，返回新的 `RoomState`，不碰 socket。 |
| `src/server/rooms.ts` | 房间码注册表：码生成、查找、回收（两人离线超 30 分钟且无在线观战，每 60 秒扫一次）。 |
| `src/server/server.ts` | http + `ws` 接线、心跳、消息分发；导出可测试的 `createOnlineServer()`。 |
| `src/server/main.ts` | 读端口、启动、优雅退出。 |

- 落子：`playMove(position, history, move)`；抛错即 `rejected`，房间不动；成功则更新局面、记谱（`toChineseNotation`，与本地对局同一套中文记谱）、`seq + 1`、`lastMove`，并取 `statusOf` / `judgeGame` 结果。
- 时钟：房间持 `ClockState`（剩余毫秒、在走方与锚点）；第二人就座时开锚；落子前先判超时，判超时才扣时并换边；每秒检查在走方是否归零，归零即判 `timeout` 并广播。
- 认输与求和：协议接线与广播；判罚与状态机见 `docs/design/modules/clock.md` §2/§4。
- 终局存棋谱：收到带 `result` 的快照时，棋手客户端用 `startFen` / `moveLog` 与快照里的时钟剩余写进本地棋谱库，格式见 `docs/design/modules/replay.md` §1；写入走 `dedupe`，切页或刷新后重连再收到同一终局快照不会重复入库。
- 广播：每次状态变化向房内全部连接发 `state`（两席 + 至多 8 位观战者）；`presence` 只发在线位变更（仍只报棋手），`rejected` 只回发起方。第二人进房或重连时也先给先到者补一份 `state`（`players` 变了，先到者才能从等待进到对局）。
- 在线状态只有一个权威：快照里的 `red` / `black`。`presence` 只是变更通知，客户端把两个字段合入当前快照，面板只读快照。
- 心跳：30 秒 ping，连续两次无 pong 视为掉线，保留房间与 token 供重连。
- 观战：两席都满且 token 不匹配任何一方时，第三人转观战（无需额外协议）；观战上限 8 人在线，满了回 `spectators-full`。
- 观战不占座、不进计时：房间的 `spectators` 只计数，不写入 `red` / `black` 的在线位；观战者发 `move` / `resign` / `offer-draw` / `draw-response` 时 token 不映射座位，一律 `not-in-room`（客户端对观战者的该码文案是「你正在观战，不能走棋」）。
- 观战者断开只减计数并广播 `state`；`presence` 仍只报棋手在线位。
- 回收：两人都离线且 `spectators === 0` 才计入 30 分钟回收；有观战在线时房间留住，棋手离开不结束观战。
- 处理异常：任一 handler 抛错就断开这条连接，让客户端走已有的重连路径；不新增协议错误码。
- 端口：`PORT` 环境变量，默认 8787；路径 `/ws`。

## 4. 客户端

- `src/client/online/session.ts`：纯 reducer。阶段：`idle` / `connecting` / `lobby` / `waiting` / `playing` / `spectating` / `reconnecting` / `error`；`waiting` 与 `playing` 由快照的 `players` 判定（1 人等待、2 人对局），`role` 为 `spectator` 时直接进 `spectating`；吃服务端消息，存快照与错误。
- `src/client/online/socket.ts`：WebSocket 封装与自动重连（1s → 2s → 4s → 8s 封顶）；`sessionStorage` 存 `{ room, token }`；重连时自动带 token 发 `join`。构造器接受 `WebSocketImpl` 注入（默认 `globalThis.WebSocket`），测试用假构造器驱动重连阶梯。
- `src/client/pages/OnlinePage.tsx`：大厅（建房 / 输房间码）与房间（棋盘 + 面板）同页切换；页面清单在 `docs/design/modules/app-shell.md` §4，本模块不重复。
- 导航项与顺序由壳档定义（见 `docs/design/modules/app-shell.md` §1/§3），本页不重复描述。
- 棋盘用 `play` 模式按己方颜色限权；选子与可落点在本地用 `generateLegalMoves` 算，落子只发 `{from, to, seq}`，等服务端快照。
- 面板：房间码、己方颜色、轮到谁、双方在线、双方时钟、记谱、结果、离开；对局中提供「认输」与「提议和棋」；对方提议时显示接受/拒绝。对手离线时显示「等待对手重连」，棋盘只读。
- 观战：棋盘用 `demo` 模式只读，隐藏「认输」「提议和棋」与和棋应答，面板显示「观战中 · N 人观战」；大厅输码进满房时直接进观战，无需额外按钮。

## 5. 路由与页面

路由由 `docs/design/modules/app-shell.md` §1 的路由表定义；本页只负责大厅与房间的切换。

- 联机页不保留本地对局状态；离开房间发 `leave` 并清 `sessionStorage`。
- 刷新页面：`sessionStorage` 有 `{room, token}` 就自动带 token 重连，回到房间。
- 面板结构与对弈页一致：`panel-focus` 是常驻条（身份「你是红方」、状态行、双方在线、时钟、认输、提议和棋、房间码、着法/离开按钮），`panel-body` 是可收起的着法抽屉。手机档这些若不进常驻条、全塞进抽屉，抽屉会浮在棋盘上把棋盘挡住（用户报的「你是红方挡住棋盘」）。
- 手机档棋盘：房间页复用 `play` 页的舞台与尺寸规则（`docs/design/modules/board-ui.md` §5）；建房后棋盘才出现，尺寸靠「每次渲染重新量」拿到，不能只在挂载时量一次。

## 6. 开发运行

- `npm run dev`：`scripts/dev.mjs` 同时起 Vite 与 WS 服务，任一退出即收另一个。
- `npm run dev:client` / `npm run dev:server` 可单起。
- Vite 代理 `/ws` → `ws://127.0.0.1:8787`；客户端连 `ws://<当前 host>/ws`，不写死端口。
- 新增依赖：`ws`、`@types/ws`。服务端 TS 由 Node 直接类型剥离运行（Node ≥ 22.18）。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `src/shared/protocol.ts` | 协议类型与消息校验（含 `role`、`spectators`、`spectators-full`）。纯函数。 |
| `src/server/room.ts` | 房间状态机。纯函数。 |
| `src/server/rooms.ts` | 房间注册表。 |
| `src/server/server.ts` | WebSocket 服务与分发。 |
| `src/server/main.ts` | 启动入口。 |
| `src/client/online/session.ts` | 联机页面状态 reducer。纯函数。 |
| `src/client/online/socket.ts` | WebSocket 封装与重连。 |
| `scripts/dev.mjs` | 同时起 Vite 与服务端。 |

页面文件（`src/client/pages/OnlinePage.tsx`）的清单在 `docs/design/modules/app-shell.md` §4，本表不重复。

现有件检查：

- 棋盘 `play` 模式：existing — `src/client/board/Board.tsx`，按 `side` 限权；本模块只传 `side = 己方颜色` 并复用选子与可落点规则。
- `generateLegalMoves`：existing — `src/shared/moves.ts`；只用于本地高亮可落点，不判结果。
- `toChineseNotation`：existing — `src/shared/notation.ts`；服务端用它生成 `Snapshot.moves`。
- 「联机」导航文案、「创建房间」「房间码」「等待对手重连」「离开房间」「观战中 · N 人观战」、错误文案：none found — 项目内无同一句文案。
- 观战棋盘 `demo` 模式：existing — `src/client/board/Board.tsx` 的 `BoardMode` 已有 `demo` 只读分支（教学演示在用）；观战只传 `mode={{kind:'demo'}}` 与局面，不传 `onTap`，不新写只读逻辑。
- `rejected.reason` 的用户文案：none found — 新增，取值见 §2 的 `RejectReason`。

命名：`OnlinePage`、`createOnlineServer`、`RoomState`、`joinRoom`、`applyRoomMove`、`snapshotOf`、`useOnlineSocket` 为新增名字，项目内无同名先例（checked, none found）。

文件分档：本批改动文件实测都不足 500 行。逐类读数：

- 服务端：`src/server/server.ts` 290 行、`src/server/room.ts` 324 行、`src/server/rooms.ts` 133 行。
- 共享与前端：`src/shared/protocol.ts` 114 行、`src/client/pages/OnlinePage.tsx` 351 行、`src/client/online/session.ts` 131 行、`src/client/online/socket.ts` 197 行。
- 测试：`test/room.test.ts` 419 行、`test/online.test.ts` 339 行、`test/integration/online.test.tsx` 426 行，均不足 500 行。

无 300 行以上的单函数，不需要拆分方案。

## 8. 验收对照

| 需求 | 落点 |
|---|---|
| F1.2 两台设备同房、走子实时同步 | `src/server/room.ts` + `test/online.test.ts` 双客户端 |
| F1.4 计时与归零判负 | 快照 `clock` + 服务端每秒检查；`docs/design/modules/clock.md` |
| F1.5 认输与求和 | `resign` / `offer-draw` / `draw-response`；判罚见 `docs/design/modules/clock.md` §2 |
| F1.7 观战：只读、不参与计时、上限 8 人、棋手离开不结束 | `joined.role` / `Snapshot.spectators` / `spectators-full`；回收看 `spectators`；`test/room.test.ts`、`test/online.test.ts`、`test/integration/online.test.tsx` |
| 非法着法被拒 | 服务端 `playMove` 校验 + `rejected` + 快照复原 |
| 断线重连恢复 | token + `Snapshot`；`test/online.test.ts` 断开重连 |
| 客户端不决定结果 | 客户端只发坐标，渲染服务端快照 |

本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；前端集成在收口时跑 `npx vitest run test/integration/online.test.tsx`。

## 9. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事。本节的增量是 F1-6；F1-2 / F1-4 不破坏、不冗余；F1-3 属本地，在 `docs/design/modules/clock.md` §8；壳的 `F4-1` 不受影响（断言不涉及导航项数）。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-2 | 两个客户端 → 房间 → 服务端权威判定 | 同房走子双方看到同一局面；非法着法被拒绝；断线重连带 token 恢复 | 打开页面 → 联机 | F1.2 |
| F1-4 | 两个客户端 → 房间时钟与求和 | 双方看到同一时钟；归零判负；求和被接受判和；被拒后再次提议被拒，对方走一着后可再提议 | 打开页面 → 联机 | F1.4、F1.5 |
| F1-6 | 两台设备对局 + 第三台进同一房间 | 第三台看到同一局面但不能走、无认输与求和按钮，面板显示观战中；棋手离开后观战仍在；第 11 台设备被拒 | 打开页面 → 联机 | F1.7 |

实现分工：

- `test/room.test.ts`：观战的房间层行为（第三人得 `spectator` 角色、八人后 `spectators-full`、观战不写在线位、`spectators === 0` 才回收），并在此断言「两名棋手断开后观战仍在、房间不回收」。
- `test/online.test.ts`：真 ws 开三端（两棋手 + 一观战），断言观战端收到 `state`、发 `move` 得 `not-in-room`、观战数进出。
- `test/integration/online.test.tsx`：jsdom 假 socket 验观战视角（棋盘只读、无认输与求和按钮、面板显示「观战中」）。
