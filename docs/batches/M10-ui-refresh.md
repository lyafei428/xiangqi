# 2026-11-14 · M10 界面改版
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户要求：灰白为基准有立体效果、对局时只显示主要信息并自动隐藏无关显示、手机棋盘整个显示不需拖动；默认按「轻浮雕 + 对局页默认专注模式」执行。
> 台账 = #16（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户原话：「UI界面优化，以灰白为基准有立体效果，对局时只显示主要信息和棋盘自动隐藏无关显示，特别是优化手机显示，使得棋盘整个显示而不需要拖动。」随后「按默认走」定下两条：轻浮雕（不做拟物木纹）、对局页默认专注模式。

现状与问题：`src/client/app.css` 里颜色与圆角是散落的字面值，没有 token 层；`<768` 档面板占 40dvh 与棋盘争高度，加上棋盘 360px 宽度下限，375×667 上棋盘被顶出可视区，只能滚动看——这正是「需要拖动」的物理原因。

做法：①`app.css` 顶部收一组变量（底色、表面、线、字色、轻浮雕投影、圆角），全站只引用变量；②对局页默认收起着法记录与记谱输入，面板顶部一个「着法」切换；③窄屏面板改覆盖式抽屉，棋盘按 `100dvh − 顶栏` 的高度优先级算尺寸，对局页禁纵向滚动。

范围外：联机、观战、棋谱、课程、练习页的布局不动；不加背景音乐、不加装饰插画；不做深色主题（可作为后续一批）。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

全站换材料（灰白 + 轻浮雕），对局页默认专注，手机一屏装下棋盘。需求侧新增 F5.5 / F1.11 / F4.6。

**设计**

`docs/design/modules/ui-refresh.md`：token 表、专注模式取舍、手机一屏的两条改法、集成测试增量、文件划分、风险。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `src/client/app.css` | 收变量、换材料、面板覆盖式、对局页禁滚动 |
| `src/client/pages/PlayPage.tsx`、`src/client/pages/AiPage.tsx` | 面板默认收起；人机页开局前展开一次 |
| `src/client/panel/GamePanel.tsx` | 切换按钮与 `aria-expanded` |
| `scripts/acceptance.mjs` | F4-6 读数 |
| `test/RTM.md`、`docs/requirements/xiangqi.md` | F4-6 / F1-10 行与三条需求 |

**边界**

不动棋盘尺寸公式与命中换算；不动联机/观战/棋谱/课程页布局；不做拟物纹理与深色主题。

**设计第一轮评审后的修订（🔴 5 · 🟡 8 · 🔵 3）**

| # | 处置 |
|---|---|
| 1 | 棋子材质冲突：`docs/design/modules/board-ui.md` §2 改为「可加描边内 1px 内阴影，不做外投影、不做渐变、不加纹理」，并把该档列入本批文件表 |
| 2 | 窄屏面板几何三处并存：覆盖式几何写进 `docs/design/modules/board-ui.md` §5，`docs/design/modules/local-play.md` §5 的 42dvh 行改为指向该节；两份旧档列入文件表 |
| 3 | `src/client/app.css` 1451 行过 800 硬上限：给出按层拆分计划，八个样式文件各自低于 500 行，`src/client/app.css` 只剩八条 `@import`，`main.tsx` 引入不变 |
| 4 | 现有变量层被判成不存在：改为沿用 `:root` 的 15 个变量名改值，只新增 `--raise` 与 `--radius`；`--line` 的旧值 `#d9c9a8` 明确作废 |
| 5 | F1.8 的 `/` 验收回归：`/` 规则写进设计（收起态先展开记谱区再聚焦），F1-8 列入受影响行，断言不变 |
| 6 | RTM 增量漏项：F4-4 收窄为「格宽 ≥ 40px」，完整可见归 F4-6；补 F1-7、F4-3、F4-5 的影响与处置；§4 现状改为「先跑现读数再定」 |
| 7 | RTM 读法写错：改为响应式故事 F4-3…F4-5（浏览器实跑）加页面壳 F4-1/F4-2（jsdom，不在本批范围） |
| 8 | 抽屉尺寸未定：定 `max-height: 50dvh`、自身滚动、收起 `translateY(100%)` 加 `visibility: hidden`、展开 `overscroll-behavior: contain` |
| 9 | 高度预算漏常驻条：改为「不手算，`useStageSize` 实测舞台盒子；页面壳保证舞台与常驻控件不重叠」 |
| 10 | 需求编号与职责：三条需求行落进 `docs/requirements/xiangqi.md`（F1.10、F4.6、F5.5），设计只留落点表，不再复制验收 |
| 11 | F1.10 与 §3 两处默认态不一致：统一为「人机页难度与阵营未走子时显示，走第一着后收为一行摘要」 |
| 12 | F5.5 不可判：`--muted` 改 `#5b6472`（在 `--page-bg` 上约 5.5:1），§7 补三条读数（对比度计算、无图片与渐变、层级截图） |
| 13 | `scripts/acceptance.mjs` 596 行过 500 主动复核档：分档结论点名，本批只加一段约 30 行的 F4-6 读数 |
| 14 | 棋盘公式复述不全：改为「公式、720 上限、360 下限全按 `docs/design/modules/board-ui.md` §5 不变，只改可用高来源」 |
| 15 | 偏差指向错节：偏差句改为直接写明理由并指向 `docs/design/modules/board-ui.md` §5 |
| 16 | F1-10 用例落点：写进 `test/RTM.md` 的用例实现清单（对弈页与人机页各一条） |

RTM 同步：新增 F1-10、F4-6 两行；F4-4 收窄为格宽下限；F4-5 补「着法」抽屉开合；用例实现清单补 F1-10。

**设计评审通过**（第二轮 `VERDICT: pass`，剩余 5 🟡 / 1 🔵 全为 advisory）。通过后当轮已落地的修订：

- 人机行的「难度与阵营」从「默认收起」列移出，改为表下一句：未走子时常驻、走完第一着收为一行摘要；
- `docs/design/modules/board-ui.md` §2 渲染层次第 1 层「木纹底」改为「棋盘底色」；
- ≥1024 档写明：侧栏常驻不变，收起的是侧栏内的着法记录与记谱输入；
- 样式拆分的构建口径补进文件表（生产合成一张 CSS，dev 分请求不计入 F5.2）；
- `docs/design/modules/local-play.md` §2 文件表更正 App.tsx 职责并补两个页面的归属。

**实施决定（评审通过后新增，落在这里而不是改设计档）**

面板结构拆成「常驻条 + 可收起的着法区」，因为原结构把状态行、计时、认输、新局都放在 `panel-body` 里——窄屏收起时这些会一起消失，与 F1.10 的「常驻清单」冲突。

| 区域 | 内容 | 行为 |
|---|---|---|
| 常驻条 | 标题、模式、状态行、双方计时、认输、新局 | 任何档位、任何展开态都可见；`<768` 时是贴底条 |
| 着法区 | 着法记录、记谱输入 | 默认收起；「着法」按钮切换 |
| 抽屉（`<768`） | 着法区 | `position: fixed` 贴底、`max-height: 50dvh`、自身滚动；展开时盖住棋盘下沿，不挤棋盘 |

按钮文案：常驻条上的切换按钮叫「着法」（带 `aria-expanded`）；抽屉内另有一个「收起着法」按钮——抽屉展开时贴底条被盖住，需要抽屉自己的关闭入口。两个名字不重复，避免 `getByRole` 单匹配撞车。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

### 设计评审：灰白 + 轻浮雕 + 对局专注 + 手机一屏（F5.5 / F1.11 / F4.6）

评审对象：`docs/design/modules/ui-refresh.md`（对象状态：待评审；触发：M10 界面改版设计首轮评审）。同批通读：`docs/design/modules/board-ui.md`、`docs/design/modules/local-play.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。文件档位为本轮实测。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Document ownership（同一机制两处描述） | 🔴 | `docs/design/modules/board-ui.md` §2 写「棋子用圆形底 + 单字，红黑两色加中性描边。**不做立体阴影、不做渐变**。」；`docs/design/modules/ui-refresh.md` §2 写「棋子保持红黑两色 + 中性描边，加一圈内阴影表现厚度」，§8 再限定「棋子内阴影限在描边内 1px」。棋子材质这一机制在两份文档里各有一套说法，而 `docs/design/modules/ui-refresh.md` §6 的文件表不含 `docs/design/modules/board-ui.md`，旧句无人删。（实测 `src/client/app.css` 现无任何 `box-shadow`，故此矛盾是本批新引入，不是旧滞后。） | 二选一：把棋子材质规格并回 `docs/design/modules/board-ui.md` §2，改写那句「不做立体阴影、不做渐变」；或在 `docs/design/modules/ui-refresh.md` §2 显式声明本条替代该句，并把 `docs/design/modules/board-ui.md` 列入 §6 文件表。 |
| 2 | Document ownership（同一机制两处描述） | 🔴 | 窄屏面板几何三处并存：`docs/design/modules/board-ui.md` §5「≥1024px 与右侧栏并排；768–1023px 在下抽屉上方；<768px 在底部抽屉上方。」、`docs/design/modules/local-play.md` §5 表「| <768px | 底部抽屉 42dvh（不超过 50dvh），可收 |」，对 `docs/design/modules/ui-refresh.md` §3「<768 档改覆盖式抽屉（见 §4）」+ §4「**面板改覆盖式**：`position: fixed` 贴底…棋盘始终按「整个可用区」算尺寸。」。三份互为对方的权威，§6 文件表只列了自己。 | 把 <768 的覆盖式几何（贴底、高度或高度上限、收起后是否仍占位）写进 `docs/design/modules/board-ui.md` §5，让 `docs/design/modules/local-play.md` §5 的 42dvh 行随之改写或删；两份旧档进 §6 文件表。 |
| 3 | 文件分档（criterion 8） | 🔴 | 实测 `src/client/app.css` 1451 行，过 800 行硬上限；设计的分档结论却是「`app.css` 已过 1000 行，属样式单一入口，按层（变量 / 页面 / 组件 / 三档）分区维护，不按源文件档拆。」这正是一条豁免理由，而硬上限不设豁免通道；`docs/design/modules/local-play.md` §2 的「样式集中在 `src/client/app.css` 一处维护，不按源文件分档」也不能充当档位权威。设计里没有拆分计划。 | 为 `src/client/app.css` 补一份拆分计划：按层落成多个样式入口（变量与基元、页面壳、棋盘与棋子、三档媒体查询），或按现有分区抽成棋盘、面板、页面三份独立样式表（名字随实现定），并在 §6 写明各文件与 `src/client/main.tsx` 的引入顺序和级联约束。 |
| 4 | 现有件检查（criterion 11） | 🔴 | 设计称「none found —— 设计 token 层：`app.css` 现存字面色值与圆角分散，无变量层（检索 `--bg|--surface|--radius` 零命中）」，正文另写「仓库里没有设计 token 层…本批首次把它们收成变量」。实查 `src/client/app.css` 的 `:root` 已有 15 个自定义属性：`--page-bg: #e9e0cf`、`--panel-bg: #fbf6ea`、`--board-bg: #f0d9a7`、`--board-line: #7a5230`、`--piece-face: #fdf6e3`、`--piece-edge: #8a6a45`、`--red`、`--black`、`--accent`、`--target`、`--text`、`--muted: #746a5c`、`--line: #d9c9a8`、`--font-ui`、`--font-board`。检索词只搜了三个不存在的名字，等于把存在的层判成不存在。另有重名风险：新表 `--line` = `#e2e4e8`，现存 `--line` = `#d9c9a8`。 | 改成 `existing: src/client/app.css 的 :root 变量层（--page-bg / --text / --muted / --line …）`，并说明是沿用旧名改值、还是换新名并一次性替换全部引用；`--line` 这类同名不同值须显式交代取舍。 |
| 5 | 需求覆盖（F1.8 回归） | 🔴 | `docs/requirements/xiangqi.md` F1.8 的验收含「`/` 能聚焦输入框」，`test/RTM.md` F1-8 同样断言「`/` 聚焦输入框」；而 `docs/design/modules/ui-refresh.md` §3 把「记谱输入」列入默认收起，§8 只说「发现依赖「面板常开」的断言就改入口，不改业务断言」。`/` 恰恰没有可点的入口——它直接落到一个已隐藏的输入框上，设计没有给这条路径任何规则。按现稿实施，F1.8 的这条验收要么失效，要么被悄悄改写成另一条断言。 | 在 §3/§8 补一条：`/` 先展开「记谱」区再聚焦输入框（幂等，不改变局面），并把 F1-8 列入 §5 的 RTM 增量受影响行，写明断言不变、入口改为 `/` 直接可用。 |
| 6 | 需求覆盖 / RTM 增量 | 🟡 | §5 的增量只交代 F4-3、F4-5、F1-1，漏了最贴的 `test/RTM.md` F4-4「375 视口下棋盘完整可见，格宽不低于 40px」：它与新 F4-6 的「棋盘第 10 行完整可见」是同一个可观察结果。更关键的是 §4 现状「375×667 上棋盘被顶出可视区，只能滚动看」等于说 F4-4 现在并不成立，而 RTM 里 F4-4 是一行既有用例——两条读数互相矛盾，且 §4 给的是断言不是读数，没有复现命令。F1-7（人机页选难度与阵营）也因「难度与阵营」默认收起而入口改变，未列入。 | 在 §5 交代 F4-4：是保留（并说明它在哪个视口高度下成立）还是并入 F4-6（把该行收窄为「格宽 ≥40px」，完整可见交给 F4-6）；§4 现状补一条可复现的现有读数（`node scripts/acceptance.mjs` 在 375×667 的输出）或复现命令；F1-7 列入受影响行并写明入口变化。 |
| 7 | 清晰度（RTM 读法） | 🟡 | §5「起点：`test/RTM.md` 响应式故事（F4-1…F4-5 由 `scripts/acceptance.mjs` 实跑）」与 RTM 实况不符：F4-1、F4-2 属「页面壳」节，用例实现是 `test/integration/navigation.test.tsx`、`test/integration/rules.test.tsx`；`scripts/acceptance.mjs` 只承载 F4-3…F4-5。 | 改成「响应式故事 F4-3…F4-5（`scripts/acceptance.mjs`）+ 页面壳故事 F4-1/F4-2（jsdom 用例，本批不动）」，并只声明 F4-3…F4-5 的复核。 |
| 8 | 清晰度（覆盖式抽屉尺寸） | 🟡 | §4 只给 `position: fixed` 贴底与「盖住棋盘下沿」，没给高度：沿用 `docs/design/modules/local-play.md` §5 的 42dvh（不超过 50dvh）还是别的值；展开后内容超出时是自身滚动还是背景滚动（§8 只说「展开时锁定背景滚动」）。F4-6 的「展开「着法」后抽屉盖在棋盘上方」与 F1-10 的「点「着法」后两者出现」都要靠这个尺寸才能判。 | 在 §4 写出抽屉高度或高度上限、内部滚动容器、以及锁定背景滚动的落点（锁在哪个元素上），让这两条读数可判。 |
| 9 | 清晰度（一屏高度预算） | 🟡 | §4 把可用高算成「`100dvh − 顶栏高`（不含面板）」，但 §3 的常驻列还有「行棋方与双方计时、新局、认输」四项。若这几项不在顶栏内，棋盘可用高就会超过可见区，F4.6 的「棋盘 `getBoundingClientRect().bottom <= innerHeight`」直接挂。 | 把高度预算写全：顶栏与常驻状态条/按钮区各占多少、是否随档位变化，并写明 `boardSize` 的入参就是扣完这些之后的可用高。 |
| 10 | 需求覆盖（编号落位） | 🟡 | `docs/requirements/xiangqi.md` 现读到 F1 表止于 F1.9、F4 表止于 F4.5、F5 表止于 F5.4；设计用的 F5.5、F1.11、F4.6 三条在需求文档里还不存在（§6 说本批补行），而 F1 表下一个空号是 F1.10，直接取 F1.11 留了空洞。另 §1 把「需求 + 验收」整表复制进设计文档，与需求文档的职责重复。 | 三条需求行先落进 `docs/requirements/xiangqi.md` 并带验收口径，编号用 F1.10 或写明谁占了 F1.10；设计文档只保留到需求编号的引用，不再复制一份验收。 |
| 11 | 清晰度（同文两处不一致） | 🟡 | §1 的 F1.11 行写「难度与阵营默认收起」，§3 表的人机行写「难度与阵营（开局前展开一次）」——进入人机页时二者必居其一，同一份文档给了两个默认态。 | 二选一写死：未开局时展开则把 F1.11 的需求句改成「开局后收起」，并让 §3 表与验收同口径；默认收起则删掉「开局前展开一次」。 |
| 12 | 验收（F5.5 可判性） | 🟡 | F5.5 验收写「文字对比度不低于正文 4.5:1」，但 §2 的 `--ink-muted` `#6b7280` 落到 `--bg` `#f4f5f7` 上，按表中十六进制值算得约 4.43:1，正压在门槛之下；另一条「页面底色、卡片、分隔线、棋子四层可辨」没有判据（`--bg` 与 `--surface` 只差一档灰，靠 `--raise` 才分得出）。§7 的验收清单里也没有任何一条读 F5.5，实施轮交付的视觉基准无人验。 | 把 `--ink-muted` 压深到在 `--bg` 上过 4.5:1（或钉定它只用于 `--surface` 背景并写明）；「四层可辨」给出可判的量（底色/卡片、卡片/分隔线各自的对比度下限）；§7 补一条 F5.5 的读数（对比度计算或无装饰性图片/纹理的静态检查）。 |
| 13 | 文件分档（criterion 8） | 🟡 | 实测 `scripts/acceptance.mjs` 596 行，过 500 行的主动复核档，而 §6 的分档结论「只改样式与两处 state 初值，不新增文件」没提它；本批还要往里加 F4-6 的读数。 | 在分档结论里点名 `scripts/acceptance.mjs` 596 行过 500 档，说明本批读数的落点（新增一节读数器）以及是否需要拆分、何时拆。 |
| 14 | 清晰度（棋盘公式复述） | 🔵 | §4 把公式复述成「`min(可用宽, 可用高 × 9/10)`」，比 `docs/design/modules/board-ui.md` §5 的「宽 = max(360, min(容器宽, min(容器高, 720px) × 0.9))」少了 720px 上限与 360 下限，读者会以为是第三条变体。 | 写成「公式、720 上限与 360 下限全按 `docs/design/modules/board-ui.md` §5 不变，只改可用高的来源」，不再复述公式。 |
| 15 | 清晰度（偏差指向） | 🔵 | 开头偏差句写「理由见 §2/§3」，但覆盖式抽屉的理由在 §4（面板与棋盘争同一段高度），§2 讲材料、§3 讲专注。 | 指向改成 §3/§4，或直接在偏差句里写明「窄屏面板与棋盘争同一段高度」。 |
| 16 | 清晰度（用例落点） | 🔵 | §5 给了 F1-10 一行，§6 只说 `test/RTM.md` 加「用例实现」，没说是哪个集成文件；RTM 的惯例是按节列用例实现。 | 在 §5 或 §6 写明 F1-10 落在 `test/integration/local-play.test.tsx`（对弈页）与 `test/integration/ai.test.tsx`（人机页）各一条，与 §7 的跑法一致。 |

计数：🔴 5 · 🟡 8 · 🔵 3。本轮无 token（changes-required）。

VERDICT: changes-required

### 轮次 2（评审子代理）

## 第二轮复核（原 16 项 + 新记 5 项）

| # | Orig# | 文件 | 级别 | 状态 | 说明 |
|---|-------|------|------|------|------|
| 1 | 1 | `docs/design/modules/board-ui.md` §2 + `docs/design/modules/ui-refresh.md` §2 | 🔴 | 已修 | `docs/design/modules/board-ui.md` 现为「可加一圈 1px 内阴影表现厚度；**不做外投影、不做渐变、不加纹理**」；`docs/design/modules/ui-refresh.md` §2 与偏差 ③ 同口径，并注明该节已同步改写。 |
| 2 | 2 | `docs/design/modules/board-ui.md` §5 + `docs/design/modules/local-play.md` §5 | 🔴 | 已修 | `docs/design/modules/board-ui.md` §5 写入覆盖式几何（贴底 / `max-height: 50dvh` / `translateY(100%)` / 不参与布局也不可聚焦）；`docs/design/modules/local-play.md` §5 的 <768 行改为「覆盖式底部抽屉（`position: fixed`，`max-height: 50dvh`，自身滚动，不占棋盘高度），可收；细则见 `docs/design/modules/board-ui.md` §5」。 |
| 3 | 3 | `docs/design/modules/ui-refresh.md` §6 | 🔴 | 已修 | 已给拆分计划：「过了 800 行硬上限，本批拆成上表八个样式文件（按现有分区估算，单文件均 < 500 行）；拆后 `src/client/app.css` 只剩八行引入」；`docs/design/modules/local-play.md` §2 同步。 |
| 4 | 4 | `docs/design/modules/ui-refresh.md` §2 与现有件检查 | 🔴 | 已修 | 现称「`:root` 已有一层设计变量」并「沿用这套名字改值，只新增 `--raise` 与 `--radius`，不另起一套并行命名」；`--line` 明写旧值 `#d9c9a8`、「不存在两种 `--line` 并存」。 |
| 5 | 5 | `docs/design/modules/ui-refresh.md` §3/§5 + `docs/requirements/xiangqi.md` F1.10 | 🔴 | 已修 | 「`/` 的规则：记谱区处于收起态时，先展开再聚焦输入框；已展开则只聚焦。幂等，不改变局面。」F1.8 受影响行写「断言不变：`/` 仍能聚焦输入框」。 |
| 6 | 6 | `docs/design/modules/ui-refresh.md` §4/§5 + `test/RTM.md` F4-4 | 🟡 | 已修 | §4 现状改为「需要一条可复现的读数支撑」并给出 `node scripts/acceptance.mjs` 与「以读数为准修正本节」；§5 补 F1-7/F1-8/F4-4/F4-3/F4-5 受影响行；`test/RTM.md` F4-4 已收窄为「375 视口下格宽不低于 40px（棋盘完整可见归 F4-6）」。 |
| 7 | 7 | `docs/design/modules/ui-refresh.md` §5 | 🟡 | 已修 | 起点改为「响应式故事 F4-3…F4-5（由 `scripts/acceptance.mjs` 实跑）与对弈故事（F1-1…F1-9，jsdom 用例）。页面壳故事 F4-1/F4-2 不在本批改动范围」，与 `test/RTM.md` 两节归属一致。 |
| 8 | 8 | `docs/design/modules/ui-refresh.md` §4 | 🟡 | 已修 | 抽屉尺寸写全：`max-height: 50dvh`、自身纵向滚动、收起 `translateY(100%)` + `visibility: hidden`、展开时 `overscroll-behavior: contain`。 |
| 9 | 9 | `docs/design/modules/ui-refresh.md` §4 | 🟡 | 已修 | 改为实测驱动：「`useStageSize` 实测棋盘舞台的盒子，页面壳保证舞台与常驻控件（顶栏、行棋方与计时条、新局/认输）不重叠」+「舞台的实测盒子才是唯一来源」。 |
| 10 | 10 | `docs/requirements/xiangqi.md` + `docs/design/modules/ui-refresh.md` §1 | 🟡 | 已修 | 需求文档已有 F1.10 / F4.6 / F5.5 三行（编号用 F1.10，不再跳号）；设计 §1 只记落点，不再复制需求与验收口径。 |
| 11 | 11 | `docs/design/modules/ui-refresh.md` §3 | 🟡 | 未修（残留） | 「\| 人机 \| 同上 + 难度与阵营（仅未走子时） \| 着法记录、记谱输入、难度与阵营（走第一着后收为一行摘要，点摘要可展开改） \|」——人机行的「难度与阵营」同时出现在常驻列与默认收起列，两列默认态互斥。需求 F1.10 已给定口径（未走子时显示），实现可判，故降为 🟡：删掉默认收起列里的「难度与阵营」，或单列一行写「走第一着后收为一行摘要」。 |
| 12 | 12 | `docs/design/modules/ui-refresh.md` §2/§7 | 🟡 | 已修 | `--muted` 改 `#5b6472` 并标「在 `--page-bg` 上约 5.5:1，过 4.5:1」（按表值复算约 5.5:1，相符）；`--text` 约 14.5:1 亦复算相符；§7 给 F5.5 三条读数（对比度脚本、`url(`/渐变 grep、截图留档）。 |
| 13 | 13 | `docs/design/modules/ui-refresh.md` §6 | 🟡 | 已修 | 「`scripts/acceptance.mjs` 实测 596 行，过了 500 行的主动复核档。本批只在它既有读数器旁加一段 F4-6 读数（约 30 行），按页拆开放到下一批。」 |
| 14 | 14 | `docs/design/modules/ui-refresh.md` §4 | 🔵 | 已修 | 「本批只改「可用高」的来源」，公式、720 上限与 360 下限全部按 `docs/design/modules/board-ui.md` §5 不变。 |
| 15 | 15 | `docs/design/modules/ui-refresh.md` 开头偏差句 | 🔵 | 已修 | 偏差改为三条并各自指向落点文档（`docs/design/modules/board-ui.md` §5 / §2 已同步改写），不再指错节。 |
| 16 | 16 | `docs/design/modules/ui-refresh.md` §5/§6 | 🔵 | 已修 | 两行 F1-10 各带用例实现（`test/integration/local-play.test.tsx` / `test/integration/ai.test.tsx`），与 `test/RTM.md` 对弈节的用例实现行一致。 |
| 17 | (新) | `docs/design/modules/board-ui.md` §2 | 🟡 | 新 | 渲染层次第 1 层仍写「1  木纹底（单色，不做纹理图）」，而 `docs/requirements/xiangqi.md` F5.5 明令「（无木纹、无重阴影、无渐变金属）」、`--board-bg` 已改为 `#f7f2e6`；`docs/design/modules/ui-refresh.md` §6 的文件表只列该档 §2 棋子材质与 §5，未把该层改名。 |
| 18 | (新) | `docs/design/modules/local-play.md` §5 + `docs/design/modules/ui-refresh.md` §3 | 🟡 | 新 | ≥1024 档仍是「\| ≥1024px \| 右侧固定侧栏 320px，常驻，不提供收起 \|」，而 `docs/design/modules/ui-refresh.md` §3 说「≥1024px 与 768–1023px 两档的面板几何不变（右侧栏 / 底抽屉），只改默认收起；<768px 按 §4。」——该档「默认收起」收起的是什么没写死（侧栏常驻时收起后只剩「着法」按钮？）需一句话交代。 |
| 19 | (新) | `docs/design/modules/ui-refresh.md` §6 + `docs/requirements/xiangqi.md` F5.2 | 🟡 | 新 | 拆分方案落到「只留八条 `@import`」，而 F5.2 的验收是「手机 4G 快档首屏 < 2s，请求数 ≤ 6」；设计没说构建产物是否仍是一张 CSS、dev 下的多请求是否不计入读数。 |
| 20 | (新) | `docs/design/modules/local-play.md` §2 + `docs/design/modules/ui-refresh.md` §1 | 🟡 | 新 | `docs/design/modules/local-play.md` §2 文件表仍把面板收起记在「\| `src/client/App.tsx` \| 页面骨架、三档布局、面板收起、棋盘尺寸测量。 \|」，且表内无 `pages/` 两页；`docs/design/modules/ui-refresh.md` §1 把默认收起与「着法」切换放在 `GamePanel`、人机显隐放在 `AiPage`。本批两档都要改，这一行应随之更新。 |
| 21 | (新) | `docs/design/modules/ui-refresh.md` §6 | 🔵 | 新 | 文件表仍写「\| `docs/requirements/xiangqi.md` \| 新增 F1.10、F4.6、F5.5 三行 \|」，而需求文档已有这三行，动作已完成。 |

剩余问题计数：🔴 0 · 🟡 5 · 🔵 1。原 16 项：15 已修、1 残留（#11，降为 🟡，非阻塞）。

VERDICT: pass

## §4 用户批准（主 agent）

用户原话：「收口」。

批前已交付：灰白 + 轻浮雕、对局专注、手机一屏三件全部落地，提交 `c5019ac` 与 `626f3fe`；`npm run check` 251 单测 / 66 前端用例全绿；`node scripts/acceptance.mjs` 全部阈值通过（含 375×667 一屏读数）；独立只读代码审查 11 条意见全部处置。

## §5 实施记录（实施者：主 agent ∥ coder）

实施者：主 agent（面板结构、变量层、对局页与窄屏样式）+ coder ×3（样式拆分、面板结构代码、F1-10 用例）。

**改动清单**

| 文件 | 改法 |
|---|---|
| `src/client/app.css` | 只剩八条 `@import`，顺序按原分节：base → shell → play → panel → learn → drill → responsive → replay |
| `src/client/styles/base.css` | 变量层换灰白值，新增 `--raise`、`--raise-flat`、`--radius`、`--accent-strong`；补 `:focus-visible` 焦点环 |
| `src/client/styles/shell.css` | 顶栏与页面壳换材料；主按钮改用 `--accent-strong`（过 4.5:1） |
| `src/client/styles/play.css` | 对局页禁纵向滚动；棋盘加 1px 描边与圆角；棋盘在舞台内上下居中；`.ai-controls` 卡片化、新增 `.ai-summary` |
| `src/client/styles/panel.css` | 面板拆成常驻条与着法区；新增 `.panel-focus`、`.panel-actions`、`.panel-body-head`、`.panel-close`；时钟与按钮同行、`nowrap` |
| `src/client/styles/responsive.css` | 窄屏常驻条；着法区改 `position: fixed` 覆盖式抽屉（`max-height: 50dvh`、自身滚动）；≥1024 收起时侧栏 264px；手机档隐去品牌名，七项导航单行装下 |
| `src/client/panel/GamePanel.tsx` | 结构拆分：常驻区含状态行、计时、认输、着法开关、新局；着法区含记录与记谱输入，`hidden={!open}` |
| `src/client/pages/PlayPage.tsx`、`AiPage.tsx` | 面板初始收起；人机页按 `hasMoves` 在控件组与一行摘要间切换 |
| `scripts/acceptance.mjs` | 新增 `measurePhoneOneScreen`：375×667 下棋盘底边、页面滚动高度、开合抽屉前后棋盘的底边 |
| `test/integration/{local-play,ai}.test.tsx` | 各一条 F1-10 用例 |
| `test/integration/notation-input.test.tsx` | 入口适配：收起态先点「着法」再敲记谱；`/` 一例改为收起 → 按 `/` 展开并聚焦 → 收起 → 再按 `/` |

**实施决定（与设计档的差异，逐条说明）**

- 棋子的「描边内 1px 内阴影」没有做：SVG 元素没有 inset 阴影，加一层圆环要改 `src/client/board/Board.tsx`，而它不在本批文件表里。F5.5 的「卡片与控件具轻浮雕层次」由卡片、面板、按钮承担，需求验收不受影响；棋子仍用 3px 描边表现厚度。
- 收起用 `hidden` 属性而不是 `translateY(100%)`：两者同样满足「不参与布局、不可聚焦、不进可访问树」，`hidden` 更直接，代价是没有滑动动画。
- 面板常驻条的 `认输` 留在计时行（桌面上三者同行），窄屏跟着常驻条走；`新局` 与「着法」成对放在 `.panel-actions`。
- 人机页的摘要判定用 `session.notations.length > 0`，因此执黑时 AI 的先手也会让控件收起——口径是「这一局已经开走了」，与 F1.10 的「走第一着后」一致。

**验证读数**

- `npm run check`：`node --test` 251 通过 / 0 失败；`vitest` 12 文件 66 用例通过 / 0 失败。
- `npm run build`：退出码 0，产物只有一张 CSS（八份被合成）。
- `node scripts/acceptance.mjs`（冻结构建后跑，全部阈值通过）：三视口格宽 72 / 72 / 40 px、请求 5 / 6 / 6、首屏 LCP 1116ms、CLS 0.000；触摸四项全 true；F4.6 读数 375×667 下棋盘 102→502（视口 667）、页面滚动高 667 = 可视高、开合抽屉棋盘底边不变。
- 样式拆分逐字节核对：八份按 `@import` 顺序拼接与拆分前 `app.css` 逐字节相同（21251 = 21251 字节）。
- 实机目视：1440 宽桌面（面板收起 / 展开两态）与 375×667 手机（常驻条、覆盖式抽屉）各截图确认。

**独立代码审查（#100）后的修一轮**

顾问通道两次评错范围（M8/M9 旧账），改用只读 explore 子代理逐文件审。它给出 2 🔴 / 6 🟡 / 3 🔵，全部处置：

| # | 发现 | 处置 |
|---|---|---|
| 1 🔴 | `.status-line.is-result` 用 `--accent` 作字色，18px 下 3.8:1，F5.5 的 4.5:1 不达标 | 改用 `--accent-strong`（约 5.1:1），并在注释里写明为什么不能用本色 |
| 2 🔴 | `controlsOpen` 点开一次后无复位：之后每局「新局 → 走一着」都不再收成摘要 | `hasMoves` 转 false 时复位（`useEffect`），新局即回到控件组 |
| 3 🟡 | 收起态 `scrollHeight` 为 0，「滚到最新」空转；展开时不补 | effect 依赖补 `open`，展开那一刻补滚一次 |
| 4 🟡 | 手机横屏（≤767 且 ≤500 高）面板已改侧栏，但 `.panel-body` 仍是向上的浮层 | 横屏段把 `.panel-body` 复位为 `position: static`（面板内自滚） |
| 5 🟡 | 手机抽屉贴视口底，展开时盖住常驻条（状态、计时、认输、新局全不可见） | 抽屉改为 `position: absolute; bottom: 100%`，贴在常驻条上沿展开；不写死条高 |
| 6 🟡 | F4.6 没断言抽屉真展开：`hidden` 下点 `.panel-close` 也不抛错 | 加三条断言：`hidden === false`、高度 > 0、浮层底 ≤ 条顶 + 1；收起后再断 `hidden === true` |
| 7 🟡 | 「页面无纵向滚动」恒真：`.app` 已 `100dvh + overflow:hidden` | 改为逐元素查底边是否越出视口（导航、棋盘、常驻条），被裁也算不达标 |
| 8 🟡 | `data-panel`（页面）与 `open`（组件）靠调用页保持同步，未成文 | 在 props 注释与 §2 实施决定里写明契约 |
| 9 🔵 | `panel.css` 散着 10 处硬编码色值 | 新增 `--raise-bg`、`--sunken-bg`、`--low`，该文件已无字面色值 |
| 10 🔵 | `.new-game { flex: 0 0 auto }` 覆盖了 `.panel-actions > *` 的等分 | 删掉该行，两个按钮等宽 |
| 11 🔵 | 验收脚本用无作用域的 `document.querySelector('svg')` | 三处统一为 `svg.board` |

修后读数：`npm run check` 251 / 66 全绿；`build` 通过；验收全部阈值通过，F4.6 读数变为：收起 棋盘 102→502、常驻条 555→667、浮层 `hidden`；展开 浮层 332→556（底边在条顶 555 上沿）、棋盘不动；再收起浮层回到 `hidden`。

## §6 验证与收口（父代理）

**收口判定**：三条需求全部落地并各有读数；一处设计细节（棋子内阴影）因 SVG 限制未做，已记录且不影响需求验收。

**需求对照**

| 需求点 | 落点 | 状态 |
|---|---|---|
| F5.5 灰白 + 轻浮雕，文字对比度 ≥ 4.5:1，无装饰图片与纹理 | 变量层 + 浮雕 token；样式表里 `gradient`/`url(` 零命中；正文 14.5:1、次要 5.5:1、主按钮与终局结果行 5.1:1 | 完成 |
| F1.10 对局专注：默认只显示棋盘、行棋方与计时、新局与认输；着法区一键展开；`/` 展开并聚焦 | `GamePanel` 的常驻条 + 可收起着法区；两页 `panelOpen` 初始 false；人机页摘要 | 完成 |
| F4.6 小屏一屏装下棋盘，页面无纵向滚动 | 覆盖式抽屉 + 棋盘按舞台实测 + 对局页禁滚动 | 完成（读数见下） |

**评审链**

设计评审两轮（首轮 5🔴/8🟡/3🔵 → 修订后第二轮 pass）。代码评审：顾问通道两次评错范围（#97 stale、#99 评的是 M8/M9 旧账），改用只读 explore 子代理做独立审查，产出 2🔴/6🟡/3🔵 共 11 条，全部处置（对比度、常驻条被抽屉遮挡、人机摘要不复位、横屏抽屉几何、两条恒真/空转的验收断言、硬编码色值、按钮宽度）。

**验证读数（收口行）**

- `npm run check`：`node --test` 251 通过 / 0 失败；`vitest` 12 文件 66 用例通过 / 0 失败。
- `npm run build`：退出码 0，CSS 合成一张（19.5 kB / gzip 4.2 kB）。
- `node scripts/acceptance.mjs`：全部阈值通过 —— 格宽 72 / 72 / 40 px；请求 5 / 6 / 6；首屏 LCP 1116ms、CLS 0.000；触摸四项全 true；F4.6 收起态棋盘 102→502、常驻条 555→667、页面无元素越出视口；展开态浮层 332→556（底边在条顶 555 上沿，不遮常驻条），棋盘底边不变；再收起浮层回到 `hidden`。
- 实机目视：1440 桌面对局页（收起 / 展开）、375×667 手机（常驻条、覆盖式抽屉）三张截图确认。
- 样式拆分：八份按 `@import` 顺序拼接与拆分前 `app.css` 逐字节相同（21251 = 21251）。

**遗留**

- 棋子的「描边内 1px 内阴影」未做：SVG 元素无 inset 阴影，加圆环要改 `src/client/board/Board.tsx`（不在本批文件表）。F5.5 的浮雕由卡片、面板、按钮承担；要补是「加一层圆环 + 一条 CSS」，可作为下一批的小改动。
- 顾问代码评审通道在本会话不可用（两次评错范围），本批的独立审查由 explore 子代理承担；下一批开工前应先验证该通道是否恢复，否则继续用替代渠道。
- 已冻结的 M8 批次档 §5 仍有一句「输入框未加 placeholder」与实现相反；档案不改，以设计档为准。
