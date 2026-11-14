# 2026-11-14 · M9 棋谱库
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户要求「增加棋谱，包括开局中局终局残局」，并按默认口径定下：古谱残局 + 自编、每类 4 条、棋谱页加「棋谱库」分栏。
> 台账 = #12（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户要求「增加棋谱，包括开局中局终局残局」，并按默认口径定下三件：内容来源 = 古谱残局（公有领域）+ 自编；数量 = 每类 4 条共 16 条；入口 = 棋谱页加「棋谱库」分栏。

现状：棋谱页只有用户自己下过的局（localStorage 里的 `GameRecord`），回放器、记谱、导入导出都齐，缺的是「随包发布的只读棋谱」这一路。

做法：新增 `StudyRecord`（id / 标题 / 类别 / 来源 / 起始 FEN / 着法 / 结果 / 批注），内容放 `content/games/index.json`；校验与 `GameRecord` 同源（`parseFen` + 逐着 `playMove`）；界面在棋谱页加分栏，回放复用现有组件。

范围外：不做棋谱编辑、不做云端同步、不做解说文本全文检索；棋谱库内容不参与棋谱导出。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

棋谱页加「棋谱库」分栏：开局 / 中局 / 终局 / 残局各 4 条，可分类筛选、点开逐步回放。需求侧新增 F1.9。

**设计**

`docs/design/modules/study-library.md`：数据结构、内容来源与校验口径、界面、集成测试增量、文件划分、风险。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `src/shared/study.ts` | 新增类型与 `parseStudyRecord` |
| `src/shared/record.ts` | 抽出 `positionAtMoves(startFen, moves, step)` |
| `src/client/study/content.ts` | 新增内容加载 |
| `src/client/pages/ReplayPage.tsx` | 分栏、筛选、内容回放接线 |
| `content/games/index.json` | 16 条棋谱 |
| `test/study.test.ts`、`test/integration/study.test.tsx` | 内容自证与 F1-9 |
| `docs/requirements/xiangqi.md`、`test/RTM.md` | F1.9 与 F1-9 |

**边界**

不改回放器的既有语义（步进、记谱显示）；不动「我的棋谱」那一路；内容只读，不可编辑、不可导出；古谱只用公有领域来源并逐条标注。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

### 设计评审：棋谱库（F1.9）

评审对象：`docs/design/modules/study-library.md`，并对照 `docs/design/modules/replay.md`、`docs/design/modules/lessons.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Clarity | 🟡 | 终局与残局没有区分口径：`docs/design/modules/study-library.md` 只给「终局那条要以 `statusOf` 的将死收尾」一条提示，而古谱残局同样以将死收尾，四条残局也会满足它；分类浏览与「四类各有条目」因此没有可判定的标准 | 在内容规格里给四类各一句判别口径，并让内容自证至少能判 phase 与条目对得上（或明确 phase 由作者标注、测试只验计数） |
| 2 | Scope | 🟡 | `notes` 超出 F1.9 验收：「一条棋谱的价值在「能看懂」，所以每条带 1–3 条 `notes`（说清关键着法的用意），不堆注释。」为 `StudyRecord` 加字段、加校验、加棋盘下方说明 UI 与 16 条写作成本，但 §1 的验收列、拟加进需求文档的 F1.9 行、§5 的 F1-9 集成行都没有断言 notes | 二选一：把 notes 写进 F1.9 验收并让 F1-9 行断言某一步的说明可见；或本批删掉 notes |
| 3 | Document ownership | 🟡 | 本改动改了 `src/shared/record.ts` 的对外面（`抽出 positionAtMoves(startFen, moves, step)`）与 `ReplayPage.tsx` 的页面结构，而两者的所有权在 `docs/design/modules/replay.md`（§1 记 `positionAt` 契约，§4 记该页列表/回放布局）；受影响文件表没有 `docs/design/modules/replay.md`，新模块文档又复述了一遍页面布局（「点开条目复用现有回放：棋盘 + 步进条 + 记谱列表」），同一页面结构从此两处活描述 | 把 `docs/design/modules/replay.md` 列入受影响文件并在该处描述页面结构，`docs/design/modules/study-library.md` 只写新增分栏与内容来源并引用其 §4 |
| 4 | Existing-piece | 🟡 | 三问式回答不完整：`existing` 行里的 `notationsOf` 与 §3 依赖的 `statusOf` 在评审范围内无出处（`docs/design/modules/replay.md` 记录 record.ts 接口只有 positionAt/isReplayable/parseRecord/recordText，其现有件检查列的是 `INITIAL_FEN` / `parseFen` / `playMove`）；`none found` 只覆盖内容先例，新名字 `StudyRecord` / `StudyPhase` / `parseStudyRecord` / `positionAtMoves` / `src/client/study/content.ts` 没有同名检索结论（`docs/design/modules/lessons.md` 有「`demoFrames`、`loadLesson` 为新增名字，项目内无同名先例（checked, none found）」可循）；文案行「「我的棋谱」沿用页面现有标题」没给坐标，范围内只见导航「棋谱」与空库「还没有棋谱」 | 给 `notationsOf` / `statusOf` 补实现坐标；给新名字补一行 none-found 结论；「我的棋谱」补它现在所在的页面/组件，或改判为新增文案 |
| 5 | Affected-file tier | 🟡 | 结论行只判文件档（「分档：涉及文件均未跨 500 行档，无需拆分。」），没有函数档结论；而本改动正是往 `ReplayPage.tsx`（`docs/design/modules/replay.md` 自己记的 243 行、按「列表」「回放」两个内部区块切分）里加分栏、分类筛选与内容回放。本次评审范围只允许读被列出的五份文档，没有亲自量行数，判断依据是行内证据与 `docs/design/modules/replay.md` 的实测记数 | 补一句函数档结论，并说明新增分栏/筛选/内容回放各落在哪个内部区块，或按 `docs/design/modules/lessons.md` 的 `DemoBlock` 先例定为页内子组件 |
| 6 | Clarity | 🟡 | 共用接口没定型：`StudyRecord.moves` 写作 `readonly Move[]`，而记录格式用内联 `readonly { readonly from: number; readonly to: number }[]`；`Move` 来自哪里、两者形状是否一致没说，`positionAtMoves` 要同时吃两路就悬在这上面，其「step 夹到 `[0, moves.length]`、非法着法抛错」契约也没重申 | 写明 `Move` 的来源与形状，明确 `positionAtMoves` 继承 positionAt 的夹取/抛错契约、`positionAt` 改为委托它 |
| 7 | Feasibility | 🟡 | 内容怎么进包没说：`src/client/study/content.ts` 只写「读 `content/games/index.json`」，没说静态进主包还是按需加载，而 `docs/design/modules/lessons.md` 立的规矩是「课文件按需加载（Vite `import.meta.glob` 生成逐课 chunk），一次请求一课，不进主包」，F5.2 还压着首屏预算；`test/study.test.ts` 在 `node --test` 下怎么取到同一份 JSON 也没写 | 一句写清加载方式及其对首屏/请求数的影响，并写清内容测试的取数路径，使自证与运行时读同一份数据 |
| 8 | Clarity | 🟡 | 内容回放的落点没定：`docs/design/modules/replay.md` 的地址口径是「路由 `#/replay`（列表）与 `#/replay/<id>`（回放），导航第五项「棋谱」。」并有「地址里的 id 在库中不存在（删除后回退、旧地址）→ 左侧列表照常显示，右侧提示「棋谱不存在」」；库内 id 是 `'endgame-juzhongmi-1'` 这类字符串，存局 id 是毫秒时间戳。复用该地址会被「棋谱不存在」接住，另开地址则要动 `src/client/shell/routes.ts` 与 `docs/design/modules/app-shell.md` §4，两者都不在受影响文件表 | 定明库内回放是页内状态还是独立地址；若独立，把 routes.ts 与 `docs/design/modules/app-shell.md` 补进表并写清字符串 id 与时间戳 id 的区分 |
| 9 | Requirements coverage | 🟡 | 受影响文件表没有样式文件，而本改动加了分栏按钮行、分类筛选行、条目列表与棋盘下方说明；同页样式在 `docs/design/modules/replay.md` 里是明确列出的（「`src/client/app.css`：列表与回放样式。」）。新行在 375 宽下怎么排也没交代，F4.2 / F4.3 对每页都成立 | 把 `src/client/app.css` 补进受影响文件，并用一两句写新行在窄屏的排布 |
| 10 | Consistency | 🟡 | 校验口径与既有文档不同路：`docs/design/modules/replay.md` 是「导入、回放都要过两道：`parseRecord` 管结构，`isReplayable` 管走法——坐标合法但走法非法的文件不能进库，也不能让回放页崩。」，本设计让 `parseStudyRecord` 一道管结构与逐着合法性（「每一着用 `playMove` 逐着验，走不通就整条作废」）；内容那一路也没有运行时失败态，而本地那一路要求可见的「这条棋谱无法回放」 | 说明内容为何可以合流成一道（随包 + 发布前内容自证），并明确内容路出问题时是静默丢条目还是给可见提示，二者取一并写清 |
| 11 | Clarity | 🔵 | §1 把 F1.9 的需求与验收全文写进设计文档，同时又要「加 F1.9 一行」进需求文档，同一行验收从此两份活描述；兄弟模块用「需求 → 落点」对照表只引编号（`docs/design/modules/replay.md` §6、`docs/design/modules/lessons.md` §7） | 需求与验收口径留需求文档，设计文档改成编号引用 + 落点表 |
| 12 | Methodology（precedent 行） | 🔵 | closest-precedent 行给了实现坐标与对齐/偏差理由，但没给对应设计文档小节坐标——`docs/design/modules/replay.md` 只在 Survey evidence 行笼统点名，没到小节 | 补 `docs/design/modules/replay.md` 的具体小节坐标（记录格式 / 页面），并注明对齐的是那一节的回放方式与记谱显示 |
| 13 | Doc state | 🔵 | `docs/design/modules/replay.md` 的文件分档句把实测行数写进设计文档（「`src/client/App.tsx` 139 行、`src/client/pages/OnlinePage.tsx` 339 行、`src/client/game/session.ts` 212 行」以及「新增 `ReplayPage.tsx`（243 行）」）；本批正在改这个页面，数字下一批就过期 | 文件档只留结论（哪些文件跨档、怎么拆），实测数字留本批记录 |
| 14 | Doc state | 🔵 | 本次评审上下文声明「No document map found」，因此「谁拥有回放页与 record.ts 这一段」只能从 `docs/design/modules/replay.md` 自身与 AGENTS.md 的层表反推，文档归属这一维的结论带此限制 | 补一份文档地图标出各模块文档的领地 |
| 15 | Acceptance | 🔵 | §7 第二条既列集成命令（「集成：`npx vitest run test/integration/study.test.tsx`（F1-9 那一半在收口行报告）。」）又说那一半在收口行报告，实施轮难判断这一条要不要跑 | 本批验收只留改动面单测命令，集成那一半写明在收口行报告 |

计数：🔴 0 · 🟡 10 · 🔵 5。
已核：设计文档存在、closest precedent 有对齐与偏差理由、Survey evidence 有清单且记了相关性结论、受影响文件表与「无需拆分」结论行齐、§5 从 `test/RTM.md` 对弈故事起而非空列、F1-5 的不破坏/不冗余已说明、验收命令只跑改动面单测（`node --test test/study.test.ts`）、未发现新增无出处的防御分支（内容校验分支由内容自证兜住）。

VERDICT: pass

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
## §6 验证与收口（父代理）
