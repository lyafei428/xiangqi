# 发布前验收：三端与性能

F4.2 / F4.3 / F4.4 / F5.2 / F5.3 / F5.4 的取数口径。取数器是 `scripts/acceptance.mjs`：node 内置模块起本机 Chromium，用 CDP 在三个视口跑同一组检查，任一阈值不达即退出码 1。

Closest precedent: `test/RTM.md` 的「响应式」节——那一节写明「视口验收需要真实布局，jsdom 没有布局能力；这一节由浏览器实跑，引入浏览器级测试框架后补行」。本模块补的就是那一节的读数：不引入测试框架，用 CDP 驱动本机浏览器。

Survey evidence: 已核对 `docs/requirements/xiangqi.md`（F4.2–F4.4、F5.2–F5.4 的验收原文）、`docs/design/architecture.md` §6 响应式策略与 §7 性能预算、`docs/design/modules/board-ui.md` §5（棋盘尺寸公式与 40px 格宽下限）、`test/RTM.md` 响应式节、`vite.config.ts`（preview 服务）。

## 1. 阈值

| 需求 | 阈值 | 怎么量 |
|---|---|---|
| F4.2 切换不丢状态 | 1440 → 375 多步缩放后局面、选中、计时、课程进度全保留 | 桌面走一着并选中一枚子 → 以 20 步递减视口 → 每步读着法记录、`.piece-selected`、时钟文本；另开一页课程：进一课走两步 → 同样递减 → 读步数文本 |
| F4.3 格宽 ≥ 40 CSS px | 棋盘渲染宽 / 9 ≥ 39.95（保留一位小数的判定容差） | 三视口各读一次棋盘 `getBoundingClientRect().width` |
| F4.4 触屏与鼠标同一套交互 | 点选走子、拖动走子、新局、导航在合成触摸下都成立；非 hover 入口有样式层证据 | 触摸：点兵再点目标、拖黑子一格、点新局、点导航，各读可见变化。非 hover：`src/client/app.css` 的 5 处 `:hover` 全部只改配色 |
| F5.2 首屏 < 2s、请求 ≤ 6 | LCP < 2000ms；请求数 ≤ 6 | 清缓存 + 4G 快档节流（下行 1.6 Mbps、RTT 150ms、CPU 4×）后加载，读 LCP 与 CDP 的请求计数 |
| F5.3 走子流畅 | 单步指针抬起 → 着法记录更新 < 16ms；连续三着期间最大帧间隔 ≤ 32ms | 单步用 MutationObserver 量；连走三着期间用 `requestAnimationFrame` 采帧间隔 |
| F5.4 布局稳定 | CLS < 0.05 | 导航前注入的 `layout-shift` 观察器，加载期累计 |

Lighthouse 手机档 Performance ≥ 90 不在脚本里：本机没有 lighthouse CLI，也不为一次验收引入依赖。替代口径为「LCP + CLS + 长任务读数 + 人工在 DevTools 里跑一次 Lighthouse」，人工那次的读数按 §6 记录。

## 2. 方法

- 启动：按 `ACCEPTANCE_BROWSER` 环境变量取浏览器可执行文件；未设置时依次试 `msedge.exe`（PATH）、`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`、`C:\Program Files\Microsoft\Edge\Application\msedge.exe`。取不到就报「找不到浏览器，设 ACCEPTANCE_BROWSER 指向 msedge/chrome」并退出 1。
- 页面服务：脚本不自己起服务，先探测 `ACCEPTANCE_URL`（默认 `http://localhost:4173/`），打不开就报「先跑 npm run preview」。
- 连接：`/json/list` 取 target 的 `webSocketDebuggerUrl`，用 node 内置 `WebSocket` 连。
- 视口：`Emulation.setDeviceMetricsOverride`；1440×900、834×1112、375×812。
- 性能档：`Network.emulateNetworkConditions`（下行 1.6 Mbps、RTT 150ms）+ `Emulation.setCPUThrottlingRate`（4×），仅 F5.2 一档使用，其余读数在无节流下取。
- 观察器：`Page.addScriptToEvaluateOnNewDocument` 在导航**之前**注入，布局偏移与 LCP 从文档创建起就开始记。

## 3. 脚本形状

| 段 | 做什么 |
|---|---|
| `launch` / `attach` / `send` | 起浏览器、连 target、Promise 化的命令队列 |
| `measureViewports` | 三视口：清缓存、换查询串、重载，读格宽、导航是否溢出、请求数 |
| `measureFirstPaint` | 4G 档 + CPU 4×：清缓存、重载，读 LCP 与请求数 |
| `measureContinuity` | 走一着 + 选中一子，20 步递减视口，逐步读着法记录、选中态、时钟；课程页另跑一条同样递减、读步数文本 |
| `measureMoveFluency` | 单步时延（从 `pointerup` 到着法记录更新）+ 连走三着时的最大帧间隔，帧数不足 10 就报错 |
| `measureLessonContinuity` | 课程页进一课走两步，再递减视口，读 `.demo-text` 前后是否一致；进不去课或读不到就报错，不静默跳过 |
| `measureTouch` | 合成触摸：点选走子、拖动一子、点新局、点导航 |
| `selfTest` | 正控：用 2G 档跑一次 F5.2 的同一段，断言它**确实**判负 |

## 4. 自证（正控）

量尺必须能失败。`--self-test` 用 400 kbps / RTT 300ms 的档位重跑首屏那段：预期 LCP 超过 2000ms，脚本断言「这一档判负」成立才算自证通过；如果慢档也判过，说明 F5.2 的检查是空转。自证读数是 §6 的一部分。

## 5. 集成测试设计

起点：`test/RTM.md`。本节新增 6 行，页面壳的 F4-1 / F4-2 不破坏、不冗余——它们断言的是切页保状态与规则页，与本节量的视口读数无关。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F4-3 | 视口从 1440 递减到 375 | 着法记录、选中态、时钟不变；课程页步数不变 | 打开页面 → 对弈 / 课程 | F4.2 |
| F4-4 | 375 视口下的棋盘 | 棋盘完整可见，格宽不低于 40px | 打开页面 → 对弈（375） | F4.3 |
| F4-5 | 合成触摸下的棋盘与按钮 | 点选能走子、拖动能走子；点「新局」棋盘重置、点「规则」换到规则页 | 打开页面 → 对弈 / 规则（触摸） | F4.4 |
| F5-1 | 4G 快档 + 4× CPU 的首屏 | 首屏可交互时间低于 2 秒，请求不超过 6 个 | 打开页面 | F5.2 |
| F5-2 | 单步与连走三着 | 单步到画面 < 16ms；连走无掉帧 | 打开页面 → 对弈 | F5.3 |
| F5-3 | 首屏加载期 | 布局稳定，CLS < 0.05 | 打开页面 | F5.4 |

实现：`scripts/acceptance.mjs`。复现：一个终端 `npm run preview`，另一个 `node scripts/acceptance.mjs`；自证：`node scripts/acceptance.mjs --self-test`。

## 6. 结果记在哪

读数写进批次档 §6（一次性的执行记录）。可重放的凭据是脚本本身加 §5 的两条命令——批次档删掉也能重跑出同样的表；需要长期留档的基线读数，抄进本节的表下方的「基线」小节（只在需要比对时写，不写过程）。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `scripts/acceptance.mjs` | CDP 驱动与六项检查、正控。 |
| `docs/design/acceptance.md` | 本文档：阈值、方法、RTM 增量、结果去向。 |
| `test/RTM.md` | 补 6 行（F4-3 / F4-4 / F4-5 / F5-1 / F5-2 / F5-3）与实现命令。 |

分档：没有既有源码或测试文件被修改；两个新增文件是 `.mjs` 与 `.md`，不存在越档文件。

现有件检查：

- existing — `npm run preview`（`vite.config.ts` 已配预览服务与代理）；`scripts/dev.mjs`、`scripts/pwa-icons.mjs` 是「node 内置模块、不引依赖」的先例。
- existing — `test/RTM.md` 的响应式节与「集成测试的唯一索引」约定，行号 F4-1 / F4-2 已占用，本节从 F4-3 起。
- none found：CDP、`Emulation.setDeviceMetricsOverride`、`Network.emulateNetworkConditions` 在本仓无先例（检索式 `setDeviceMetricsOverride|emulateNetworkConditions|webSocketDebuggerUrl`，全仓零命中）。
- none found：性能基线读数（LCP / CLS / 帧间隔）在本仓没有任何记录。

## 8. 风险

- 无头 Edge 的字体渲染与真机不同；几何读数不受影响，时间读数会偏乐观，因此首屏按 4G 节流 + CPU 4× 取，仍不等于真机。
- 合成触摸来自 CDP，不是手指。它要求两个前提：开触摸仿真（否则不合成 pointer 事件）与不开 mobile 视口仿真（开了以后坐标与布局对不上）；两者都不写进产品。
- 帧间隔阈值取 32ms（一次掉帧），是对「连续走子无掉帧」的可操作化；更严的判定要设备级 vsync 数据，这里拿不到。
