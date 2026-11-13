# 页面壳与导航模块

一个页面壳承载对弈、人机、联机、课程、练习、棋谱六块业务。路由只用 hash，不引路由库；切换页面不丢对局状态。

Closest precedent: `docs/design/modules/local-play.md` — 对局页本身就是壳的一页，单 reducer、三档布局与棋盘尺寸测量已定。本模块把对局页装进导航，沿用同一套尺寸规则。

Survey evidence: 已核对 `docs/design/architecture.md`（技术栈、响应式、性能预算）、`docs/requirements/xiangqi.md`（F4.1 一套界面、F4.2 状态不丢、F5.1 简约）、`docs/design/modules/board-ui.md`（棋盘三模式）。未发现与 M2 冲突的既有设计。

## 1. 路由

| 路由 | 页面 |
|---|---|
| `#/play` | 对弈（默认） |
| `#/ai` | 人机对战 |
| `#/learn` | 课程目录 |
| `#/lesson/<id>` | 单课 |
| `#/drill` | 练习 |
| `#/missions` | 对弈题列表 |
| `#/mission/<id>` | 单道对弈题 |
| `#/online` | 联机大厅 / 房间 |
| `#/replay` | 棋谱列表 |
| `#/replay/<id>` | 单局回放 |

- hash 变化用 `hashchange` 订阅；未知路由按对弈页渲染，不改写地址。这是地址栏兜底，无观察来源、也无用例断言。
- 练习路由可带 `?seed=<n>&kind=<kind>`，用于复现同一道题；不带时随机出题。场景：`test/integration/drill.test.tsx` 用固定 seed 进入并确定作答（复现命令 `npm run test:ui`）；没有这个查询面，页面每次随机出题，用例无法确定答案。
- 不引路由库：十条路由用 `parseHash` / `routeHash` 两个纯函数足够。

## 2. 状态归属

| 状态 | 放在哪 | 切页后 |
|---|---|---|
| 对局会话（`GameSession`） | App 级 `useReducer` | 保留 |
| 本次会话看过的课 | App 级 `Set<string>` | 保留 |
| 课程页演示步数 | 课程页内部 | 离开即复位 |
| 练习会话 | 练习页内部 | 离开即复位 |
| 对弈题会话 | 题目页内部 | 离开即复位 |
| 联机会话 | 联机页内部（token 在 sessionStorage） | 断线后带 token 重连 |
| 人机会话与 Worker | 人机页内部：会话在模块级持有，Worker 随页面挂载创建 | 会话切页保留；Worker 随页卸载（`dispose()`），关页即丢（未完成局不落盘） |
| 棋谱库与未完成对局 | `localStorage`（`src/client/storage/records.ts`） | 关页保留；重开时恢复未完成局 |

对局是唯一需要跨页保留的状态：切到课程看一课再回来，棋盘与着法仍在。本次会话看过的课只在会话内保留；跨会话进度持久化不在本批，见 `docs/design/modules/lessons.md` §4。

## 3. 导航与布局

- 顶部一条导航：对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱；当前项用 `aria-current="page"` 标记。
- 桌面：导航横排；内容区沿用对弈页的「棋盘 + 面板」两栏。
- 平板 / 手机：导航仍在顶部，内容区改为上下结构，棋盘尺寸规则复用 `docs/design/modules/board-ui.md` §5。
- 课程页与练习页的棋盘都在内容区内，尺寸由同一 `boardSize` 计算。

## 4. 文件划分

| 文件 | 职责 |
|---|---|
| `src/client/shell/routes.ts` | `parseHash` / `routeHash` / `Route` 类型。纯函数。 |
| `src/client/shell/useRoute.ts` | 订阅 `hashchange` 的 hook。 |
| `src/client/pages/PlayPage.tsx` | 对弈页（M1 的棋盘 + 面板）。 |
| `src/client/pages/AiPage.tsx` | 人机页：难度与阵营、思考锁、终局存谱；模块规格见 `docs/design/modules/ai.md`。 |
| `src/client/pages/LearnPage.tsx` | 课程目录。 |
| `src/client/pages/LessonPage.tsx` | 单课与演示。 |
| `src/client/pages/DrillPage.tsx` | 练习。 |
| `src/client/pages/MissionsPage.tsx` | 对弈题列表。 |
| `src/client/pages/MissionPage.tsx` | 单道对弈题。 |
| `src/client/pages/OnlinePage.tsx` | 联机大厅与房间。 |
| `src/client/pages/ReplayPage.tsx` | 棋谱列表、回放、导入导出。 |
| `src/shared/record.ts` | 棋谱记录格式、校验与逐步重放。纯函数。 |
| `src/client/storage/records.ts` | `localStorage` 里的棋谱库与未完成对局。 |
| `src/client/App.tsx` | 壳：路由订阅、导航、对局状态与课程进度。 |

命名：`parseHash`、`routeHash`、`useRoute` 为新增名字，项目内无同名先例（checked, none found）。

文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。

## 5. 验收对照

| 需求 | 落点 |
|---|---|
| F4.1 三端同一套界面 | 一套组件 + 三档 CSS，无第二套页面 |
| F4.2 切换不丢状态 | 对局状态在 App 级；切页不重建；跨会话进度不在本批 |
| F5.1 界面简约 | 导航六项（对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱），不附加装饰控件 |

## 6. 集成测试设计

起点：`test/RTM.md` 的「页面壳」故事。本批新增 F4-1 一行；F1-1（对弈）不破坏，F2-1 / F3-1 各自归课程与练习模块，不在此重复，不冗余。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F4-1 | 对弈页 / 人机页 → 课程 → 回原页 | 走一着后切页再回来，棋盘与记谱保持原样（对弈靠 App 级会话，人机靠模块级持有） | 打开页面 → 对弈（人机）→ 课程 → 回原页 | F4.2 |

实现：`test/integration/navigation.test.tsx`。该行不需要真实布局（jsdom 能验），与「响应式需要浏览器实跑」的挂起是两件事。

F3-2（对弈题）的集成测试设计在 `docs/design/modules/missions.md` §8，不在此重复。

F1-2（联机）的集成测试设计在 `docs/design/modules/online.md` §9，不在此重复。
