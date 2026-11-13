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

- 一房两人：先到者红，第二个进房者黑；第三个人被拒（观战属 M5）。
- 房间码 6 位，字符集 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`（去掉 0/O/1/I），碰撞重试。
- 进房发 token（16 字节随机十六进制）。客户端存 `sessionStorage`，断线后带 token 重连，服务端按 token 找回颜色与局面。
- 房间存内存：服务进程重启即清空。M4 的「断线重连恢复」限定在服务进程存活期内；持久化留后续批次。
- 回收：两人都离线超过 30 分钟的房间删除，服务端每 60 秒扫一次；窗口内带 token 可重连。
- M4 不判超时负；对手离线只显示「等待重连」，计时判负属 M5。

## 2. 协议

`src/shared/protocol.ts`，纯类型与纯校验，不碰 DOM、不碰 Node API。

```ts
type ClientMessage =
  | { type: 'join'; room?: string; token?: string }
  | { type: 'move'; from: number; to: number; seq: number }
  | { type: 'leave' }
  | { type: 'ping' };

type ServerMessage =
  | { type: 'joined'; room: string; token: string; color: Color; snapshot: Snapshot }
  | { type: 'state'; snapshot: Snapshot }
  | { type: 'rejected'; reason: RejectReason; snapshot: Snapshot }
  | { type: 'presence'; red: boolean; black: boolean }
  | { type: 'error'; code: 'room-full' | 'room-not-found' | 'bad-message'; message: string }
  | { type: 'pong' };

interface Snapshot {
  room: string;
  fen: string;
  seq: number;
  turn: Color;
  status: GameStatus;
  result: GameResult | null;
  lastMove: Move | null;
  moves: string[];
  red: boolean;   // 在线
  black: boolean;
  players: number; // 已坐下的座位数（1 或 2）
}
```

- `move.seq` 是客户端看到的快照序号。服务端只接受等于当前序号的着法；不等就回 `rejected` 与当前快照，防止重连后补发旧着。
- `rejected` 一定附带当前快照，客户端以快照为准，不做本地回滚。
- `rejected.reason` 是固定取值（`not-in-room` / `not-your-turn` / `game-over` / `stale-seq` / `illegal-move`），客户端按取值给文案；非法着法、轮次不对、序号过期都走 `rejected`，房间状态不变。
- `error` 的三个取值的来源：
  - `room-not-found`：大厅输入一个注册表里没有的 6 位码；复现：`join` 带该码，服务端回此码。
  - `room-full`：满房后又来一台设备（或旧 token 失效后座位已被占）；复现：第三人用新 token 进满房。
  - `bad-message`：无法解析的帧、字段不合法，或未 `join` 就发 `move`；复现：直接发 `{}`，或未进房发一着合法坐标。

## 3. 服务端

| 文件 | 职责 |
|---|---|
| `src/server/room.ts` | 房间状态机：建房、加入、落子、快照、重连；纯函数，返回新的 `RoomState`，不碰 socket。 |
| `src/server/rooms.ts` | 房间码注册表：码生成、查找、回收（两人离线超 30 分钟，每 60 秒扫一次）。 |
| `src/server/server.ts` | http + `ws` 接线、心跳、消息分发；导出可测试的 `createOnlineServer()`。 |
| `src/server/main.ts` | 读端口、启动、优雅退出。 |

- 落子：`playMove(position, history, move)`；抛错即 `rejected`，房间不动；成功则更新局面、记谱（`toChineseNotation`，与本地对局同一套中文记谱）、`seq + 1`、`lastMove`，并取 `statusOf` / `judgeGame` 结果。
- 广播：每次状态变化向房内两人发 `state`；第二人进房或重连时也先给先到者补一份 `state`（`players` 变了，先到者才能从等待进到对局）；连接/断开发 `presence`。
- 在线状态只有一个权威：快照里的 `red` / `black`。`presence` 只是变更通知，客户端把两个字段合入当前快照，面板只读快照。
- 心跳：30 秒 ping，连续两次无 pong 视为掉线，保留房间与 token 供重连。
- 处理异常：任一 handler 抛错就断开这条连接，让客户端走已有的重连路径；不新增协议错误码。
- 端口：`PORT` 环境变量，默认 8787；路径 `/ws`。

## 4. 客户端

- `src/client/online/session.ts`：纯 reducer。阶段：`idle` / `connecting` / `lobby` / `waiting` / `playing` / `reconnecting` / `error`；`waiting` 与 `playing` 由快照的 `players` 判定（1 人等待、2 人对局）；吃服务端消息，存快照与错误。
- `src/client/online/socket.ts`：WebSocket 封装与自动重连（1s → 2s → 4s → 8s 封顶）；`sessionStorage` 存 `{ room, token }`；重连时自动带 token 发 `join`。构造器接受 `WebSocketImpl` 注入（默认 `globalThis.WebSocket`），测试用假构造器驱动重连阶梯。
- `src/client/pages/OnlinePage.tsx`：大厅（建房 / 输房间码）与房间（棋盘 + 面板）同页切换；页面清单在 `docs/design/modules/app-shell.md` §4，本模块不重复。
- 棋盘用 `play` 模式按己方颜色限权；选子与可落点在本地用 `generateLegalMoves` 算，落子只发 `{from, to, seq}`，等服务端快照。
- 面板：房间码、己方颜色、轮到谁、双方在线、记谱、结果、离开。对手离线时显示「等待对手重连」，棋盘只读。

## 5. 路由与页面

路由由 `docs/design/modules/app-shell.md` §1 的路由表定义；本页只负责大厅与房间的切换。

- 顶部导航加第四项「联机」（导航由壳档拥有，见其导航节）。
- 联机页不保留本地对局状态；离开房间发 `leave` 并清 `sessionStorage`。
- 刷新页面：`sessionStorage` 有 `{room, token}` 就自动带 token 重连，回到房间。

## 6. 开发运行

- `npm run dev`：`scripts/dev.mjs` 同时起 Vite 与 WS 服务，任一退出即收另一个。
- `npm run dev:client` / `npm run dev:server` 可单起。
- Vite 代理 `/ws` → `ws://127.0.0.1:8787`；客户端连 `ws://<当前 host>/ws`，不写死端口。
- 新增依赖：`ws`、`@types/ws`。服务端 TS 由 Node 直接类型剥离运行（Node ≥ 22.18）。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `src/shared/protocol.ts` | 协议类型与消息校验。纯函数。 |
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
- 「联机」导航文案、「创建房间」「房间码」「等待对手重连」「离开房间」、错误文案：none found — 项目内无同名文案。
- `rejected.reason` 的用户文案：none found — 新增，取值见 §2 的 `RejectReason`。

命名：`OnlinePage`、`createOnlineServer`、`RoomState`、`joinRoom`、`applyRoomMove`、`snapshotOf`、`useOnlineSocket` 为新增名字，项目内无同名先例（checked, none found）。

文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。

## 8. 验收对照

| 需求 | 落点 |
|---|---|
| F1.2 两台设备同房、走子实时同步 | `src/server/room.ts` + `test/online.test.ts` 双客户端 |
| 非法着法被拒 | 服务端 `playMove` 校验 + `rejected` + 快照复原 |
| 断线重连恢复 | token + `Snapshot`；`test/online.test.ts` 断开重连 |
| 客户端不决定结果 | 客户端只发坐标，渲染服务端快照 |

本批验收命令（只跑改动面）：`node --test test/room.test.ts test/online.test.ts`；`npx vitest run test/integration/online.test.tsx`。

## 9. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事。本批新增 F1-2 一行；F1-1（本地双人）不破坏，不冗余。
本批也改了壳的导航（第四项），壳的行 `F4-1` 不受影响：它的断言不涉及导航项数；`test/integration/navigation.test.tsx` 不因新增一项而改。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-2 | 两个客户端 → 房间 → 服务端权威判定 | 同房走子双方看到同一局面；非法着法被拒绝；断线重连带 token 恢复 | 打开页面 → 联机 | F1.2 |

实现：`test/online.test.ts`（真实 ws，两个客户端；`createOnlineServer()` 绑端口 0，避免与本地服务或并行用例抢 8787）；`test/integration/online.test.tsx`（jsdom 假 socket，通过 `WebSocketImpl` 注入，从联机页建房并走一着）。房间状态机单测在 `test/room.test.ts`。
