# 界面改版：灰白 + 轻浮雕 + 对局专注

把整个界面从「卡片拼装」改成一套有层次的材料：灰白基准、轻浮雕立体、对局时只留必要信息；手机上一屏装下整个棋盘，不用拖。

Closest precedent: `docs/design/modules/board-ui.md` §2（棋盘八层与棋子单字）、§5（三档断点与尺寸公式）与 `docs/design/modules/local-play.md` §5（面板三档高度表）。

对齐：断点（≥1024 / 768–1023 / <768）、棋盘 `boardSize` 的高度优先公式、棋子传统字与红黑两色、`ResizeObserver` 重算与 `dvh`——全部沿用。

偏差：①窄屏面板由「占位抽屉」改成覆盖式，不再挤压棋盘高度（几何写进 `docs/design/modules/board-ui.md` §5）；②对局页默认收起着法记录与记谱输入；③棋子允许一圈 1px 内阴影表现厚度（`docs/design/modules/board-ui.md` §2 已同步改写）。

Survey evidence: 已核对 `docs/requirements/xiangqi.md` §3 的 F1.1–F1.10、F4.1–F4.6、F5.1–F5.5，`docs/design/modules/board-ui.md` §2/§5/§6，`docs/design/modules/local-play.md` §2/§5，`src/client/app.css`（`main.tsx` 唯一引入点），`test/RTM.md` 的对弈与响应式两节。

设计变量按用途分四组。取值与每条用途归 `docs/design/modules/theme.md` §2，本档只记结构与落点：

- 表面：`--page-bg`、`--panel-bg`、`--raise-bg`、`--sunken-bg`
- 文字与线：`--text`、`--muted`、`--accent`、`--accent-strong`、`--on-accent`、`--low`、`--line`
- 棋盘与棋子：`--board-bg`、`--board-line`、`--piece-face`、`--piece-edge`、`--board-ink`、`--red`、`--black`、`--target`
- 形状与字体：`--raise`、`--raise-flat`、`--radius`、`--font-ui`、`--font-board`

## 1. 需求

需求口径在 `docs/requirements/xiangqi.md`，本批新增三行：F1.10（对局专注）、F4.6（小屏一屏装下棋盘）、F5.5（视觉基准）。本模块只记落点：

| 需求 | 落点 |
|---|---|
| F1.10 | 面板默认收起 + 「着法」切换（`GamePanel`）；`/` 先展开记谱区再聚焦（`GamePanel`）；人机页难度与阵营按「未走子显示、走第一着后收为一行摘要」渲染（`AiPage`） |
| F4.6 | 窄屏覆盖式面板（`app.css` 的窄屏段）；对局页禁纵向滚动；棋盘可用高来自 `useStageSize` 实测 |
| F5.5 | `src/client/styles/base.css` 的变量层；取值与对比度表归 `docs/design/modules/theme.md` |

## 2. 材料（变量层）

取值表只在一处维护：`docs/design/modules/theme.md` §2。本节不再抄一份，抄两份必然漂。

- 变量层沿用 `:root` 的现有名字改值，只在此之上新增 `--accent-strong`、`--raise-bg`、`--sunken-bg`、`--low` 四个。`--muted-2`、`--radius-lg`、`--red-text`、`--black-text`、`--target-text`、`--board-ink`、`--on-accent` 归 `docs/design/modules/theme.md` 那批。
- 立体不再靠投影：深底上投影看不出来，`--raise` 改成内描边，分层靠 1px 线 + 底色一档之差（见 theme.md §2 末段）。
- 棋盘仍是浅色纸：`--board-bg` / `--board-line` / `--piece-face` / `--piece-edge` 取值不变，棋子红黑对比靠「棋盘不跟着变深」保住。
- 棋子按 `docs/design/modules/board-ui.md` §2 的材质：圆形底 + 单字 + 中性描边；不做外投影、不做渐变、不加纹理。
- 明令不做：木纹、皮革、金属渐变、发光描边、装饰性插画。理由：教学工具，马腿、河界、九宫线要一眼读准。

## 3. 对局专注

| 页 | 常驻 | 默认收起 |
|---|---|---|
| 对弈 | 棋盘、行棋方与双方计时、新局、认输 | 着法记录、记谱输入 |
| 人机 | 同上 + 难度与阵营（仅未走子时） | 着法记录、记谱输入 |

- 终局结果按胜方着色：红胜红字、黑胜黑字、和棋留蓝（状态行与放大提示同色，用 `*_text` 那组令牌）。
- 终局提示：结果文字放大到棋盘中央停 3 秒，再缩回面板状态行原处（`ResultPop`）。落点用 FLIP 量算：起点是 `.board` 矩形中心，终点是 `.status-line` 矩形中心，缩放到状态行行高的一档；量不到目标就原地淡出，不做假动画。`prefers-reduced-motion: reduce` 时只停不飞。提示自身 `aria-hidden`——状态行的 `role="status"` 已经播报过同一句话，重复播报会吵。
- 人机页的难度与阵营：未走子时铺开；选过难度或阵营之后，鼠标移出控件组就收成一行摘要（显示当前难度与阵营），点摘要可再展开；新局重新铺开。玩家走完第一着后同样收成摘要。它不属「默认收起」——进入页面时它就在。
- 收起条件写在两处状态里：`picked`（这一局选过没有，没选过就不收）与 `collapsedByLeave`（被移开收起过）。新局把两者一起复位——只靠 `hasMoves` 的 effect 不够：还没走过子的新局里 `hasMoves` 没变，effect 不会重跑。
- 「指针离开」由全局 `pointermove` 判定，不用 `pointerleave`：后者只在指针悬停过该元素后才发，二次展开或键盘选择之后根本不会来，表现为「选完有时不收」。

- 「着法」是一个切换按钮（`aria-expanded`）：收起 → 只留棋盘与常驻条；展开 → 着法记录与记谱输入一起出现；再点收起。
- **只有第一次进来是收起的**：用户的展开/收起选择写进 `localStorage`（`xiangqi.panel-open.v1`），切页回来、刷新、重开浏览器都沿用；主动收起也记住。存储不可用（隐私模式、配额满）时按「未展开」处理，不报错。`/` 展开也记一笔（用户按了它就是意图要看）。
- ≥1024px 与 768–1023px 两档的面板几何不变（右侧栏 / 底抽屉），只改默认收起；<768px 按 §4。≥1024 档的侧栏本身常驻（`docs/design/modules/local-play.md` §5 的「不提供收起」不变），收起的是侧栏里的着法记录与记谱输入；收起后侧栏只留「着法」切换按钮与行棋方/计时，不留空白块。
- `/` 的规则：记谱区处于收起态时，先展开再聚焦输入框；已展开则只聚焦。幂等，不改变局面。焦点已在文本输入框里时不抢。
- 观战、联机、棋谱、课程、练习页不在本批改动范围。

## 4. 手机一屏

现状（需要一条可复现的读数支撑）：<768px 上面板占 40dvh 并与棋盘争高度，375×667 上棋盘被顶出可视区。执行前先跑 `node scripts/acceptance.mjs` 取现读数（棋盘底边与滚动高度），把数写进批次实施记录；读数与「棋盘完整可见」不符时，以读数为准修正本节。

改法两条：

1. **面板改覆盖式**（几何已写进 `docs/design/modules/board-ui.md` §5）：`position: fixed` 贴底、`max-height: 50dvh`、自身纵向滚动；收起时 `translateY(100%)` + `visibility: hidden`，不参与布局、不可聚焦；展开时页面容器加 `overscroll-behavior: contain`，抽屉内滚动不外溢到页面。
2. **棋盘按高度优先**：公式、720 上限与 360 下限全部按 `docs/design/modules/board-ui.md` §5 不变，本批只改「可用高」的来源——`useStageSize` 实测棋盘舞台的盒子，页面壳保证舞台与常驻控件（顶栏、行棋方与计时条、新局/认输）不重叠；对局页禁纵向滚动。

不手算高度：常驻条的高度随档位与内容变化，写死数字就会漂；舞台的实测盒子才是唯一来源。

## 5. 集成测试设计

起点：`test/RTM.md` 的响应式故事 F4-3…F4-5（由 `scripts/acceptance.mjs` 实跑）与对弈故事（F1-1…F1-9，jsdom 用例）。页面壳故事 F4-1/F4-2 不在本批改动范围。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 | 用例实现 |
|---|---|---|---|---|---|
| F4-6 | 视口 375×667 → 对弈页 → 棋盘底边与页面滚动容器 | 棋盘第 10 行完整可见；`document.scrollingElement.scrollHeight <= clientHeight`；展开「着法」后抽屉盖在棋盘上方，收起后棋盘恢复完整 | 打开页面 → 对弈（375×667 视口） | F4.6 | `scripts/acceptance.mjs` |
| F1-10 | 对弈页 → 「着法」切换 → `/` | 初始看不到着法记录与记谱框；点「着法」后两者出现，再点收起；收起态按 `/` 展开并聚焦记谱框 | 打开页面 → 对弈 | F1.10 | `test/integration/local-play.test.tsx` |
| F1-10 | 人机页 → 走第一着 → 难度与阵营 | 进入时可见；走一着后收为一行摘要；点摘要可展开 | 打开页面 → 人机 | F1.10 | `test/integration/ai.test.tsx` |

受影响行（不复述断言，只记入口与归属）：

| 行 | 影响 | 处置 |
|---|---|---|
| F1-7（人机对战） | 难度与阵营走第一着后收起，用例若先点难度需先展开摘要 | 断言不变，改入口 |
| F1-8（记谱输入） | 记谱框默认收起；`/` 走的是「先展开再聚焦」 | 断言不变：`/` 仍能聚焦输入框 |
| F4-4（手机格宽下限） | 「375 视口下棋盘完整可见，格宽不低于 40px」与 F4-6 重叠 | 该行收窄为「格宽不低于 40px」；「完整可见」归 F4-6，改行与改断言同一批落地 |
| F4-3（缩放不丢状态） | 面板默认收起后着法记录不可见 | 不新增断言；实跑时展开再看记录 |
| F4-5（触摸交互） | 覆盖式抽屉的展开/收起是新的触摸路径 | 实测复核点选、拖动与抽屉开合 |

不冗余：F1-1 的走子断言不重复；F4-6 只加「无纵向滚动」与 375×667 这一档，不复述 F4-4 的格宽下限。

## 6. 文件划分

| 文件 | 动作 |
|---|---|
| `docs/requirements/xiangqi.md` | F1.10、F4.6、F5.5 三行已就位 |
| `docs/design/modules/board-ui.md` | §2 棋子材质（允许描边内 1px 内阴影）；§5 窄屏覆盖式几何与可用高来源 |
| `docs/design/modules/local-play.md` | §2 样式拆分说明；§5 的 <768px 行改为覆盖式 |
| `src/client/styles/base.css` | 新增：变量层、reset、排版、按钮基元（约 40 行起） |
| `src/client/styles/shell.css` | 新增：顶栏、页面壳、五页容器 |
| `src/client/styles/play.css` | 新增：对弈页与人机页、常驻条、专注态 |
| `src/client/styles/panel.css` | 新增：面板、时钟、着法记录、记谱输入、抽屉开合 |
| `src/client/styles/learn.css` | 新增：课程目录与单课 |
| `src/client/styles/drill.css` | 新增：练习页 |
| `src/client/styles/responsive.css` | 新增：全部媒体查询（顺序按原分节，排在 `replay` 之前） |
| `src/client/styles/replay.css` | 新增：棋谱页与棋谱库分栏 |
| `src/client/app.css` | 只留八条 `@import`，顺序与原分节顺序一致：base → shell → play → panel → learn → drill → responsive → replay（`responsive` 在原文件里就排在 `replay` 之前，拆后不变），`main.tsx` 的引入不变。构建口径：生产构建把八份合成一张 CSS（`npm run preview` 的读数按此口径取）；dev 下按文件分请求，不计入 F5.2 的请求数 |
| `src/client/pages/PlayPage.tsx`、`src/client/pages/AiPage.tsx` | 面板默认收起；人机页按着法数决定难度与阵营的显隐 |
| `src/client/panel/GamePanel.tsx` | 「着法」切换按钮与 `aria-expanded`；`/` 先展开再聚焦 |
| `scripts/acceptance.mjs` | F4-6 读数（滚动高度、棋盘底边） |
| `test/RTM.md` | F4-6、F1-10 两行 + 受影响行改写 + 用例实现 |
| `test/integration/local-play.test.tsx`、`test/integration/ai.test.tsx` | F1-10 各一条 |

分档：`src/client/app.css` 实测 1451 行，过了 800 行硬上限，本批拆成上表八个样式文件（按现有分区估算，单文件均 < 500 行）；拆后 `src/client/app.css` 只剩八行引入。

其余受影响文件实测都在档内：`src/client/pages/AiPage.tsx` 265 行、`src/client/panel/GamePanel.tsx` 218 行、`src/client/pages/PlayPage.tsx` 67 行。

`scripts/acceptance.mjs` 实测 596 行，过了 500 行的主动复核档。本批只在它既有读数器旁加一段 F4-6 读数（约 30 行），按页拆开放到下一批。

现有件检查：

- existing —— `src/client/app.css` 的 `:root` 变量层（沿用改名值）；`boardSize` 高度优先公式；`useStageSize` 的 `ResizeObserver`；`.board-fit`/`.panel` 三档规则；`scripts/acceptance.mjs` 的浏览器读数通道。
- none found —— 「灰白 + 轻浮雕」这一套表面值：现有变量全是木色系（`--page-bg: #e9e0cf`、`--line: #d9c9a8`），无中性灰阶与投影变量。
- 文案：`着法` 为本批新增的切换文案；`新局`／`认输`／`我的棋谱` 沿用现状。

## 7. 验收

- 集成：`npx vitest run test/integration/local-play.test.tsx test/integration/ai.test.tsx`；F1-10 的两条在收口行报告。
- 浏览器读数：`node scripts/acceptance.mjs` 取 375×667 的滚动高度与棋盘底边（F4-6），以及 1440 / 768 两档的重算（F4-3 复核）。
- F5.5 三条各给一条读数：①对比度按 `docs/design/modules/theme.md` §3 的断言集逐对量（须 ≥ 4.5:1），取值表与断言集都归那份档；②`grep` 确认样式表内无 `url(` 引用的图片与渐变（`linear-gradient`/`radial-gradient`）；③明暗层级靠 `--raise` 与 `--panel-bg` 差值判，截图留档。
- 提交门见 `AGENTS.md`。

## 8. 风险

- 覆盖式抽屉在 iOS 上随地址栏收缩会有 `dvh` 抖动：用 `100dvh` 而非 `100vh`，展开时锁页面滚动（`overscroll-behavior: contain`），收起后不参与布局。
- 默认收起会让部分既有用例的入口失效；实施轮逐个跑，只改入口，不改业务断言（F1-7 与 F1-8 各一处）。
- 轻浮雕调重会压掉棋盘线条：投影只上卡片与面板，棋子只留描边内 1px 内阴影。
- 样式拆成八个文件后，级联顺序是显式契约：引入顺序固定为原分节顺序（base → shell → play → panel → learn → drill → responsive → replay），`responsive.css` 不是最后一份——它原本就排在 `replay` 之前，两文件的选择器交集为 0，改顺序会在以后覆盖时出错。要覆盖媒体查询的新规则写进 `responsive.css` 对应档位，不要靠「写在最后」去赢；`main.tsx` 仍只引入 `src/client/app.css` 一处。
- F5.4（CLS < 0.05）受这次布局改动影响：棋盘可用高改由实测驱动，首帧到测量之间不得发生可见位移——收口时按 `scripts/acceptance.mjs` 的 CLS 读数复核一遍。
