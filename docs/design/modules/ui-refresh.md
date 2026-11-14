# 界面改版：灰白 + 轻浮雕 + 对局专注

把整个界面从「卡片拼装」改成一套有层次的材料：灰白基准、轻浮雕立体、对局时只留必要信息；手机上一屏装下整个棋盘，不用拖。

Closest precedent: `docs/design/modules/board-ui.md` §2（棋盘八层与棋子单字）、§5（三档断点与尺寸公式）与 `docs/design/modules/local-play.md` §5（面板三档高度表）。

对齐：断点（≥1024 / 768–1023 / <768）、棋盘 `boardSize` 的高度优先公式、棋子传统字与红黑两色、`ResizeObserver` 重算与 `dvh`——全部沿用。

偏差：①窄屏面板由「占位抽屉」改成覆盖式，不再挤压棋盘高度（几何写进 `docs/design/modules/board-ui.md` §5）；②对局页默认收起着法记录与记谱输入；③棋子允许一圈 1px 内阴影表现厚度（`docs/design/modules/board-ui.md` §2 已同步改写）。

Survey evidence: 已核对 `docs/requirements/xiangqi.md` §3 的 F1.1–F1.10、F4.1–F4.6、F5.1–F5.5，`docs/design/modules/board-ui.md` §2/§5/§6，`docs/design/modules/local-play.md` §2/§5，`src/client/app.css`（`main.tsx` 唯一引入点），`test/RTM.md` 的对弈与响应式两节。

相关：`src/client/app.css` 的 `:root` 已有一层设计变量（`--page-bg`、`--panel-bg`、`--board-bg`、`--board-line`、`--piece-face`、`--piece-edge`、`--red`、`--black`、`--accent`、`--target`、`--text`、`--muted`、`--line`、`--font-ui`、`--font-board`）。本批沿用这套名字改值，只新增 `--raise` 与 `--radius`，不另起一套并行命名。

## 1. 需求

需求口径在 `docs/requirements/xiangqi.md`，本批新增三行：F1.10（对局专注）、F4.6（小屏一屏装下棋盘）、F5.5（视觉基准）。本模块只记落点：

| 需求 | 落点 |
|---|---|
| F1.10 | 面板默认收起 + 「着法」切换（`GamePanel`）；`/` 先展开记谱区再聚焦（`GamePanel`）；人机页难度与阵营按「未走子显示、走第一着后收为一行摘要」渲染（`AiPage`） |
| F4.6 | 窄屏覆盖式面板（`app.css` 的窄屏段）；对局页禁纵向滚动；棋盘可用高来自 `useStageSize` 实测 |
| F5.5 | `src/client/styles/base.css` 的变量层；棋子内阴影与轻浮雕（`app.css` 的棋盘段与卡片段） |

## 2. 材料（变量层）

沿用 `:root` 现有名字改值，新增两个：

| 变量 | 值 | 说明 |
|---|---|---|
| `--page-bg` | `#f4f5f7` | 页面底（原木色） |
| `--panel-bg` | `#fbfbfc` | 卡片、面板、抽屉 |
| `--board-bg` | `#f7f2e6` | 棋盘底，略暖只为衬托棋子 |
| `--board-line` | `#b9a98d` | 棋盘线 |
| `--piece-face` | `#fdfcf7` | 棋子面 |
| `--piece-edge` | `#9a9184` | 棋子描边 |
| `--text` | `#1f2328` | 正文（在 `--page-bg` 上约 14.5:1） |
| `--muted` | `#5b6472` | 次要信息（在 `--page-bg` 上约 5.5:1，过 4.5:1） |
| `--line` | `#e2e4e8` | 分隔线。**旧值是木色 `#d9c9a8`**，本批换灰并把所有引用一起改；不存在两种 `--line` 并存 |
| `--raise` | `0 1px 0 rgba(255,255,255,.9) inset, 0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.06)` | 轻浮雕：内高光 + 近层 + 远层 |
| `--radius` | `10px` | 卡片、按钮、输入框 |
| `--red`、`--black`、`--accent`、`--target`、`--font-ui`、`--font-board` | 不变 | 语义色与字体，对比度已达标 |

- 立体只做「内高光 + 两层投影」，够看出浮起，又不吃棋盘线条。
- 棋子按 `docs/design/modules/board-ui.md` §2 的材质：圆形底 + 单字 + 中性描边 + 描边内 1px 内阴影；不做外投影、不做渐变、不加纹理。
- 棋盘底色按 `--board-bg`（`#f7f2e6`，单色无纹理）：`docs/design/modules/board-ui.md` §2 渲染层次第 1 层的旧名「木纹底」已按本次材料改为「棋盘底色」，需求 F5.5 的「无木纹」由此对齐。
- 明令不做：木纹、皮革、金属渐变、发光描边、装饰性插画。理由：教学工具，马腿、河界、九宫线要一眼读准。

## 3. 对局专注

| 页 | 常驻 | 默认收起 |
|---|---|---|
| 对弈 | 棋盘、行棋方与双方计时、新局、认输 | 着法记录、记谱输入 |
| 人机 | 同上 + 难度与阵营（仅未走子时） | 着法记录、记谱输入 |

- 人机页的难度与阵营：未走子时常驻；玩家走完第一着后收为一行摘要（显示当前难度与阵营），点摘要展开可改。它不属「默认收起」——进入页面时它就在。

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
- F5.5 三条各给一条读数：①用脚本按变量表算 `--text`、`--muted` 在 `--page-bg`／`--panel-bg` 上的对比度（须 ≥ 4.5:1）；②`grep` 确认样式表内无 `url(` 引用的图片与渐变（`linear-gradient`/`radial-gradient`）；③明暗层级靠 `--raise` 与 `--panel-bg` 差值判，截图留档。
- 提交门见 `AGENTS.md`。

## 8. 风险

- 覆盖式抽屉在 iOS 上随地址栏收缩会有 `dvh` 抖动：用 `100dvh` 而非 `100vh`，展开时锁页面滚动（`overscroll-behavior: contain`），收起后不参与布局。
- 默认收起会让部分既有用例的入口失效；实施轮逐个跑，只改入口，不改业务断言（F1-7 与 F1-8 各一处）。
- 轻浮雕调重会压掉棋盘线条：投影只上卡片与面板，棋子只留描边内 1px 内阴影。
- 样式拆成八个文件后，级联顺序是显式契约：引入顺序固定为原分节顺序（base → shell → play → panel → learn → drill → responsive → replay），`responsive.css` 不是最后一份——它原本就排在 `replay` 之前，两文件的选择器交集为 0，改顺序会在以后覆盖时出错。要覆盖媒体查询的新规则写进 `responsive.css` 对应档位，不要靠「写在最后」去赢；`main.tsx` 仍只引入 `src/client/app.css` 一处。
- F5.4（CLS < 0.05）受这次布局改动影响：棋盘可用高改由实测驱动，首帧到测量之间不得发生可见位移——收口时按 `scripts/acceptance.mjs` 的 CLS 读数复核一遍。
