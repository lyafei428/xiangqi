# 本地对弈与界面模块

浏览器端的界面与本地双人对局。棋盘组件一套，M1 只接对弈模式所需的部分；演示与练习模式在各自批次接入时扩展，不另写棋盘。

Closest precedent: `docs/design/modules/board-ui.md` — 棋盘几何、渲染层次、交互表、响应式尺寸与性能预算已由该模块规格定死。本模块沿用其 viewBox、命中半径、八层顺序与三档尺寸规则，不另起坐标。

Survey evidence: 已核对 `docs/design/architecture.md`（分层、技术栈、响应式、性能预算、里程碑）、`docs/design/modules/board-ui.md`（几何与交互）、`docs/requirements/xiangqi.md`（F1.1、F4.1–F4.4、F5.1、F5.3）、`src/shared/rules.ts` 与 `src/shared/notation.ts`（`playMove` / `judgeGame` / `toChineseNotation` 契约）。相关条目已采用，未发现与 M1 冲突的既有设计。

## 1. 边界

- 规则只从 `src/shared/` 取。走法、合法着法、将军、终局、记谱全部调用引擎，客户端不复制任何判罚逻辑。
- 本地双人的对局数据只有一个 reducer 状态对象。布局变化只改 CSS 与棋盘像素尺寸，不重置状态，也不重挂载棋盘。
- 本模块含计时与认输；求和与联机计时见 `docs/design/modules/clock.md`；存局与回放见 `docs/design/modules/replay.md`；联机与棋谱持久化不在本模块。

## 2. 文件划分

| 文件 | 职责 |
|---|---|
| `src/client/board/geometry.ts` | 棋盘坐标系常量、交叉点与 viewBox 坐标互转、指针命中、棋盘尺寸计算。纯函数。 |
| `src/client/game/session.ts` | 本地对局 reducer：选子、走子、记谱、终局、新局；导出 `checkSquareOf`。纯函数。 |
| `src/client/board/Board.tsx` | SVG 棋盘渲染与指针、键盘输入。不判规则。 |
| `src/client/panel/GamePanel.tsx` | 行棋方、状态播报、着法列表、新局。 |
| `src/client/App.tsx` | 路由与页面骨架、三档布局。 |
| `src/client/pages/PlayPage.tsx`、`src/client/pages/AiPage.tsx` | 对弈页与人机页的容器，持有面板收起态与难度/阵营。 |
| `src/client/app.css` | 全部样式。不引组件库，不做 CSS-in-JS。 |
| `src/client/main.tsx` | 挂载入口。 |
| `index.html` | Vite 入口，提供 `#root` 挂载点。 |

本批源文件与测试文件均未跨 500 行档（最大 `src/client/board/Board.tsx` 265 行）；样式已过 800 行硬上限，按 `docs/design/modules/ui-refresh.md` §6 拆成按层的多个样式文件，`src/client/app.css` 只作引入入口。

现有件检查：

- existing：棋盘与交互沿用 `docs/design/modules/board-ui.md`，几何、八层渲染、交互表、响应式与无障碍都由该档规定，本批按 §1–§7 使用。
- none found：会话 reducer 是新模块，仓库内没有现成的对局状态机。
- existing but unusable：`checkSquareOf` 是新增导出；引擎只有 `kingSquareOf`，本批需要按 `status` 判定的客户端包装。
- none found：面板文案「和棋 · 三次重复局面」「新局」「收起」「展开」都是新增用户可见文案，仓库内没有既有文案表。

## 3. 会话状态机

| 字段 | 含义 |
|---|---|
| `startFen` | 起始局面，重复判罚的基准 |
| `position` | 当前局面 |
| `history` | 引擎格式的着法记录，喂给重复与自然限着 |
| `notations` | 中文记谱，与 `history` 逐着对齐，只用于显示 |
| `lastMove` | 上一着，棋盘标记用 |
| `result` | 终局结果，`null` 表示未结束 |
| `status` | 当前局面状态：`playing` / `check` / `checkmate` / `stalemate` |
| `selected` | 已选中的起点，`null` 表示无选中 |
| `targets` | 选中棋子的合法落点 |
| `clock` | 双方剩余时间与在走方，见 `docs/design/modules/clock.md` |

动作有六个：`select(square, now)` 在指针按下时选中己方棋子，不切换；`tap(square, now)` 做点击判定；`play(move, now)` 直接落一着（先过 `isLegal`，人机页给引擎用）；`reset(startFen?)` 开新局；`tick(now)` 推时钟；`resign(now)` 当前行棋方认输。时间由页面随动作传入，会话本身不读墙钟。时钟与认输的判罚见 `docs/design/modules/clock.md` §2。

`reset` 不带 `startFen` 时回到本局起始局面（`state.startFen`）；带参时从新起始局面开一局。

`tap` 的判据顺序：

| 顺序 | 条件 | 行为 |
|---|---|---|
| 1 | 终局已定 | 忽略 |
| 2 | 有选中且 `square` 在 `targets` 里 | 走子 |
| 3 | `square` 上是当前行棋方的子 | 选中；再点同一子取消 |
| 4 | 其余 | 取消选中，不弹错误 |

走子流程：`toChineseNotation(position, move)` 先取记谱 → `playMove` 得新局面与 `history`（非法着法直接抛错）→ `statusOf` 与 `judgeGame` 得状态和终局 → 清空选中。终局后所有 `tap` 被忽略，棋盘只读；`reset` 回到起始局面。

将军与将死时由 `src/client/game/session.ts` 的 `checkSquareOf` 取被将方将帅坐标画高亮（内部调引擎的 `kingSquareOf`）；困毙没有将军线，不标。

## 4. 棋盘与交互

几何、渲染层次、命中半径、组件入参与交互语义统一由 `docs/design/modules/board-ui.md` §1–§4 规定。本模块补本地对弈的接法：

- 可落点来自 `generateLegalMoves`。
- 指针两段式：`pointerdown` 选中己方棋子，`pointerup` 落在另一交叉点等同第二段点击；拖动超过 6px 才显示幽灵棋子，落点用同一套命中换算。
- 键盘：棋子可 Tab 聚焦，Enter 选中，方向键移动光标，Enter 在落点确认，Esc 取消选中。键盘光标用独立虚线框，不改选中语义。
- 无障碍：每枚棋子 `role="img"` 带中文 aria-label；将军与胜负写进 `aria-live="polite"` 的状态区。

## 5. 响应式布局

三档断点、棋盘尺寸公式与 `dvh` 规则按 `docs/design/modules/board-ui.md` §5 执行。本模块新增的面板决策：

| 视口 | 面板 |
|---|---|
| ≥1024px | 右侧固定侧栏 320px，常驻，不提供收起 |
| 768–1023px | 底部抽屉 40dvh，可收 |
| <768px | 覆盖式底部抽屉（`position: fixed`，`max-height: 50dvh`，自身滚动，不占棋盘高度），可收；细则见 `docs/design/modules/board-ui.md` §5 |

- 棋盘尺寸公式、格宽下限与滚动规则由 `docs/design/modules/board-ui.md` §5 规定。
- 面板在 M1 只有固定宽与全宽两态，没有宽度驱动的内部重排，不需要容器查询；等面板可拖动改宽的批次再按 `docs/design/architecture.md` §6 用 `@container`。
- 面板收起后 `ResizeObserver` 重算棋盘尺寸；旋转屏幕同样只重算尺寸，不重挂载组件。
- 面板内可加行：记谱输入占着法记录下方一行（细则见 `docs/design/modules/notation-input.md`），不改变上表的断点与高度。
- 手机横屏（`orientation: landscape and max-height: 500px`）改为棋盘在左、面板在右。

## 6. 性能

- 命中换算只在指针事件里调用一次，不在事件处理之外读布局。
- 棋盘尺寸只由 `ResizeObserver` 驱动，且只改棋盘的像素宽高。
- 走子由 React 一次提交完成，不加过渡动画；动画约束按 `docs/design/modules/board-ui.md` §6。
- 不做 memo：90 个交叉点不到需要优化的量级。

## 7. 测试与验收

| 验收 | 验证方式 |
|---|---|
| 浏览器里能下完一局 | 集成用例 F1-1（`npx vitest run test/integration/local-play.test.tsx`）走到三次重复判和并锁盘；浏览器实跑补走子与终局展示 |
| 八种结局文案正确 | `npx vitest run test/game-panel.test.tsx` 断言将死、困毙、长将、三次重复、60 回合无吃子五条，以及超时、认输、双方同意三条 |
| 三档视口切换局面不丢 | 同一页面改宽高，reducer 状态不变；三档截图核对 |
| 格宽 ≥40 CSS px | `boardSize` 单测断言棋盘宽 ≥360；手机档实测渲染宽 / 9 |
| 选中与终局状态保留 | 缩放后选中高亮、将军高亮、终局提示仍在 |
| 计时与认输 | 时钟归零显示「黑方胜 · 超时」并锁盘；认输立刻结束并锁盘；详见 `docs/design/modules/clock.md` §7 |

单元测试：`node --test test/client-geometry.test.ts test/client-session.test.ts` 覆盖坐标换算、命中半径、三档尺寸、选子、走子、换边、点不可落点、三次重复判和、终局锁盘、新局、记谱、将军高亮；非法着法的抛错路径由 `node --test test/rules.test.ts` 覆盖。

## 8. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事。本批新增 F1-3（计时与认输）；F1-1 原有断言不破坏、不冗余；F1-2 / F1-4 属联机，在 `docs/design/modules/online.md` §9。

| 项 | 内容 |
|---|---|
| 入口 | `src/client/main.tsx` 挂载的 `App`；测试直接渲染 `App` |
| 组件间交互 | `Board` 指针命中 → `session` reducer → `src/shared/` 的走法与终局 → 记谱 → `GamePanel` 显示 |
| 断言的业务结果 | 走子后行棋方与记谱变化；8 着重复后出现「和棋 · 三次重复局面」；终局后棋盘不可再走；「新局」复位 |
| 追溯需求 | F1.1；F4.2 的布局部分由浏览器实跑验证，不在 jsdom 用例内 |
| 执行 | `npx vitest run test/integration/local-play.test.tsx`（Vitest + jsdom） |

提交前 `npm run check` 全绿（AGENTS.md 的提交门），不属于本模块的验收。

八种结局文案由 `test/game-panel.test.tsx` 在组件层断言；App 没有残局入口，胜负结局不从集成入口构造。

响应式故事在 jsdom 里没有布局，不能冒充集成用例；它的验收仍按 §7 用浏览器实跑，等引入浏览器级测试框架后按 `test/RTM.md` 补行。
