# 2026-11-14 · M2 教学框架 + 练习生成器 + 第一二章
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「开工」；范围取 docs/design/architecture.md 里程碑 M2；章节口径按 docs/requirements/xiangqi.md F2.2 三章。
> 台账 = #2（xiangqi · 归批）。前情 = M1 棋盘组件 + 本地双人（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

本批判据：architecture 里程碑「| M2 | 教学框架 + 练习生成器 + 第一二章 | 走法课可演示可练；判定题引擎自证 |」；需求侧覆盖 F2.1（讲解 + 演示）、F2.2（第一二章 14 课）、F2.3（局面经引擎验证）、F3.1（四类判定题）、F3.3（答案引擎生成）、F3.4（提示与答案）。

本批交付：
- 内容层：`content/lessons/index.json` + 14 个课文件（走法 8 + 判罚 6）+ `content/drills/default.json`；课文件纯 JSON，按需加载。
- 纯逻辑：课程 schema 与校验；种子随机 + 四类判定题生成器；练习会话 reducer（判分、提示、揭晓）。
- 棋盘：拆成底图/棋子/标记三层，入参收口成 `BoardMode`（play/demo/drill）。
- 页面：hash 路由壳（对弈/课程/练习）、课程目录、课程页与演示步进、练习页。
- 测试：内容自证、生成器自证、课程与练习集成用例。

章节口径：需求 F2.2 写三章 22 课（8/6/8），architecture M3 原写「第三至五章」；本批按需求三章执行，M2 = 第一二章 14 课，M3 = 第三章杀法 8 课，并同步修正 architecture M3 措辞。

关键判据：
- 答案只来自引擎：走法题落点、合法性、将军/合法着法、记谱全部现算，题库不存对错。
- 内容自证：14 课逐课过 schema 与引擎校验，坏课不许存在。
- 状态归属：对局状态留在 App 级，切课程/练习再回来不丢；课程进度只在会话内。
- 复用：棋盘与尺寸规则沿用 board-ui 与 local-play，不另写一套。

本批不做：F3.2 对弈型练习（攻杀/防守/找杀，随 M3 杀法课）、课程进度持久化（localStorage）、第三章内容、服务端与账号。

上抛项：无（章节口径与练习范围已在计划中说明并获「开工」授权）。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

设计档落点：新增 `docs/design/modules/lessons.md`（课程 schema、演示步进、校验）、`docs/design/modules/drills.md`（四类题、生成器、会话、自证）、`docs/design/modules/app-shell.md`（hash 路由、状态归属、导航）；同步 `docs/design/modules/board-ui.md` §4（BoardMode 与 props）、`docs/design/architecture.md` M3 措辞、`test/RTM.md`（F2-1 / F3-1 行）。

机制设计：
- 课程内容：索引与课文件分离，标题只写索引；演示步骤用 `[x, y]` 坐标，逐步应用并逐步校验；课程页的步进器状态是 `stepIndex`，`-1` 为起始局面。
- 判定题：`generateDrill(kind, seed, config)` 从初始局面随机走合法着法得到局面；四类答案分别由 `generateLegalMoves` / `isLegal` / `isInCheck` 或合法着法数 / `toChineseNotation` 现算；种子随机数用 mulberry32，测试可复现。
- 练习会话：`DrillSession` 记 `selected / choice / wrongAttempts / status / hintShown`；第一次错只提示，第二次显示提示，第三次揭晓答案并标记正确落点。
- 棋盘：拆出 `BoardBackground` / `BoardMarkers` / `BoardPieces`，Board 只留交互与组合；`mode` 分 play / demo / drill，demo 只读、drill 只动行棋方。
- 页面壳：`parseHash` / `routeHash` 纯函数；路由 `#/play`、`#/learn`、`#/lesson/<id>`、`#/drill`；对局状态在 App 级，课程进度为会话内 `Set`。

受影响文件与测试覆盖：

| 文件 | 动作 |
|---|---|
| `content/lessons/index.json`、`content/lessons/*.json`、`content/drills/default.json` | 新增内容 |
| `src/client/learn/schema.ts`、`src/client/learn/content.ts` | 新增校验与加载 |
| `src/client/drills/generator.ts`、`src/client/drills/session.ts` | 新增纯逻辑 |
| `src/client/shell/routes.ts` | 新增路由纯函数 |
| `src/client/board/Board.tsx`、`src/client/board/layers.tsx` | 重构：三模式与分层 |
| `src/client/pages/PlayPage.tsx`、`LearnPage.tsx`、`LessonPage.tsx`、`DrillPage.tsx` | 新增页面 |
| `src/client/App.tsx`、`src/client/app.css`、`tsconfig.json` | 改壳与样式；开 `resolveJsonModule` |
| `test/content.test.ts`、`test/drills.test.ts` | 新增单测 |
| `test/integration/learn.test.tsx`、`test/integration/drill.test.tsx` | 新增集成用例 |

验收对照：

| 验收 | 落点 |
|---|---|
| 走法课可演示可练 | 课程页演示步进 + 练习页四类题 |
| 判定题引擎自证 | `test/drills.test.ts` 固定种子逐题回算 |
| 第一二章 14 课可跑 | 内容测试逐课校验 |
| 三端可用、切页不丢对局 | 复用棋盘尺寸与三档布局；对局状态在 App 级 |

关键决策：答案不手写；课文件不进主包（逐课 chunk）；路由不引库；F3.2 与进度持久化留后续批次。

上抛项：无。

评审整改（§3 轮次 1 后）：
- 新增 F4-1 集成用例 `test/integration/navigation.test.tsx`（走一着后切课程再回对弈，棋盘与记谱保留）；`test/RTM.md` 增「页面壳」一节。
- 三份模块设计各补「集成测试设计」节；`docs/design/modules/drills.md` 补 `DrillConfig` 与配置归属、收敛记谱题干扰项规则、补 F3.2 去向；`docs/design/modules/lessons.md` 补进度口径与坐标换算说明；`docs/design/modules/app-shell.md` 补查询面的复现场景；`docs/design/modules/board-ui.md` 补先例与调查行、删掉无数据来源的「被吃子标记」；`docs/design/architecture.md` 的 M3 行纳入 F3.2。
- 生成器记谱题改为逐着挑选能凑够 3 个不同干扰记谱的着法，与设计一致。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

设计评审（对象：M2 教学框架 + 练习生成器 + 第一二章 · 已实现 · 触发：收口链独立设计评审）· 评审范围：`docs/design/modules/lessons.md`、`docs/design/modules/drills.md`、`docs/design/modules/app-shell.md`、`docs/design/modules/board-ui.md`、`docs/design/architecture.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Integration-test design | 🔴 | 三份模块设计的收尾都是「需求→落点」对照表，没有一份以 `test/RTM.md` 起点的集成测试设计节。`docs/design/modules/lessons.md` 写「\| F2.1 每课可读讲解、看到走法演示 \| 课程页正文 + \`DemoPlayer\` 步进 \|」，`docs/design/modules/drills.md` 写「\| F3.1 四类判定题可作答并判分 \| 练习页 + \`test/integration/drill.test.tsx\` \|」，`docs/design/modules/app-shell.md` 写「\| F4.2 切换不丢状态 \| 对局状态在 App 级；切页不重建 \|」——都不答「哪一行被破坏 / 哪一行冗余 / 哪一行缺失」。而三份文档共同引为最近先例的 `docs/design/modules/local-play.md` 有这一节：「起点：\`test/RTM.md\` 的「对弈」故事。本批新增 F1-1 一行；M1 是首批客户端代码，此前没有前端集成用例，因此不破坏、不冗余、不缺失既有行。」另有一行真需要却缺失：`docs/design/modules/app-shell.md` §2 承诺「对局是唯一需要跨页保留的状态：切到课程看一课再回来，棋盘与着法仍在。」，而 `test/RTM.md` 的「响应式」整节只写「视口验收需要真实布局，jsdom 没有布局能力；这一节由浏览器实跑，引入浏览器级测试框架后补行。」——切页保留对局状态不需要布局，jsdom 能验，这一行被整节挂起淹没了。 | 三份文档各补一节（或统一由 `docs/design/modules/app-shell.md` 一节）写明：本批落 F2-1 / F3-1 两行，既有行不破坏、不冗余；每行点明它验的是哪两个组件的交互、断言哪条用户可见结果、从哪个入口进、回溯哪条需求。把「切页不丢对局状态」先在 `test/RTM.md` 定下行号（如 F4-1）再写用例标题，并注明它与「响应式需要真实布局」不是同一类挂起理由。 |
| 2 | Branch provenance (6b) | 🔴 | `docs/design/modules/app-shell.md` §1 新增了一个输入面：「练习路由可带 \`?seed=<n>&kind=<kind>\`，用于复现同一道题；不带时随机出题。」带/不带是两条臂，但文档没有给出它的场景——没有真实观察（数据读值 / 日志 / 用户反馈）、没有可复现失败路径；需求 F3.1–F3.4 不要求它，`test/RTM.md` 的 F3-1 入口是「打开页面 → 练习」，`docs/design/modules/drills.md` §6 的复现走的是「对四类题各跑固定种子集」直接喂 `generateDrill`，所以这条臂既无场景也无验收挂靠。 | 要么写明场景（引用触发它的具体失败现象并给出复现命令，并在 `test/RTM.md` 为它留一行）；要么删掉这个查询面，只留 `#/drill`，复现需求由测试直接把 seed 交给 `generateDrill` 满足。 |
| 3 | Document ownership | 🔴 | 同一个机制（学习进度存在哪）在两份活文档里两套说法：`docs/requirements/xiangqi.md` §5「v1 不做账号体系，进度存浏览器本地；跨设备同步留到后续批次。」对 `docs/design/modules/lessons.md` §4「「去练习」进入练习页；本模块不记录跨会话进度，进度只在本次会话内保留。」读者无法判断哪句权威；「本批不做进度持久化」这个决定只落在批次记录（`docs/batches/M2-teaching-drills.md`，过程文档，不作设计依据），设计与需求两侧仍各留一句相反的话。 | 二选一并只留一处权威说法：改需求（把「进度存浏览器本地」推到有名字的批次）或改设计（`docs/design/modules/lessons.md` 把 `看过的课` 落到本地存储）；保留的那一处应是拥有「进度存在哪」的文档，其余处只引用。 |
| 4 | Clarity | 🟡 | `docs/design/modules/drills.md` §3 的签名「种子随机数用 mulberry32；\`generateDrill(kind, seed, config)\` 输出完全确定，测试可复现。」里 `config` 全项目没有类型或 schema；`docs/design/modules/lessons.md` §1 只写了「练习生成器配置（题型与随机步数范围）」这一句，且配置文件写在课程模块的内容布局里而不是练习模块；`docs/design/modules/drills.md` §3 的「随机走 6–24 着」「合法落点 ≥ 2」「≥ 3 个其他不同记谱」三个阈值也没说哪些来自 config、哪些写死。 | 在 `docs/design/modules/drills.md` 补 `DrillConfig` 类型（题型开关、随机步数上下限），并说明 §3 那三个阈值是配置项还是写死；把 `content/drills/default.json` 的内容布局归到练习模块，`docs/design/modules/lessons.md` §1 只引用。 |
| 5 | Clarity | 🟡 | `docs/design/modules/drills.md` §4 的会话状态只有「status: 'answering' \| 'correct' \| 'revealed';」，没有承载「刚答错」的字段，而 §5 要求「判分后显示正确/错误、提示或解释与「下一题」。」——第一次答错的「错误」与「再试一次」在状态机里没有落点（`hintShown` 要第二次错才为真，`revealed` 是第三次），页面无从区分「还没提交」与「刚判错」。 | 把「刚判错」进状态：如 `lastResult: 'pending' \| 'wrong'`，或 `status` 增加 `'wrong'`，并写清它何时回到 `answering`。 |
| 6 | Clarity | 🟡 | `docs/design/modules/lessons.md` §7 的验收对照用了「\`DemoPlayer\` 步进」，但同文档 §6 文件划分里没有这个组件（写的是「\| \`src/client/pages/LessonPage.tsx\` \| 课程页、演示步进与「去练习」。 \|」），读者不知道该建哪个文件；§2 的坐标格式「// [x, y]，0-based，x=0 左，y=0 黑方底线」与棋盘 API 的 90 格下标（`docs/design/modules/board-ui.md` §4 的 `selection?: { selected: number \| null; targets: readonly number[] }`、`docs/design/modules/drills.md` §2 的 `highlight: { from: number; to: number }`）是两套编码，而 `[x, y]` → 下标的换算发生在哪个文件没有人写；新名字（`DemoPlayer`、`parseHash`、`generateDrill`）也都没有 existing / none-found 的三问回答。 | `DemoPlayer` 要么进 `docs/design/modules/lessons.md` §6 文件表并写路径，要么改成 `LessonPage.tsx` 内的演示步进；补一句换算函数落在哪个文件；对新名字各补一行 `existing: …` / `none found: …`。 |
| 7 | Feasibility | 🟡 | `docs/design/modules/board-ui.md` §4 的 demo 行承诺「\| \`demo\` \| 不可动 \| 当前步标记、被吃子标记 \|」，但同节的 `BoardProps` 只有「marks?: readonly { square: number; kind: 'select' \| 'correct' \| 'wrong' }[];」和 `lastMove`，`docs/design/modules/lessons.md` §2 的 `DemoStep` 也只有 from / to / text 且 §3 只说「当前步的走法用棋盘的上一着标记；不播放动画。」——「被吃子标记」没有数据来源，按现有规格实现不出来。 | 把「被吃子标记」从 demo 行删掉，或给 `DemoStep` 加被吃子字段并在 `BoardProps` 加承载它的 prop；两者取一，别留一条无数据的承诺。 |
| 8 | Requirements fit | 🟡 | 需求 F3.4 是「\| F3.4 \| 答错有提示、有答案 \| 错两次给提示，三次给答案并演示正确走法 \|」，设计把后半段做成静态标记：`docs/design/modules/drills.md` §4「第三次错：显示答案并把正确落点/选项标在界面上（\`revealed\`）。」，§8 落点写「\`session.ts\` 的 \`hintShown\` / \`revealed\` + 练习页标记」。没有任何地方播放正确着法，而 `docs/design/modules/board-ui.md` §4 的 `demo` 模式正是为播步准备的；这一处简化也没有写理由。 | 二择一：写明「以标记代替播放」是有意简化并给理由（例如揭晓后棋盘要留给下一题），或让揭晓复用 `demo` 模式把正确着法走一遍，以对上需求的「演示」二字。 |
| 9 | Requirements coverage | 🟡 | 需求 F3.2「\| F3.2 \| 对弈型练习（棋盘上走） \| 攻杀题、防守题、找杀题达成目标即通过 \|」在 `docs/design/modules/drills.md` 里无一字（全文只覆盖四类判定题），`docs/design/architecture.md` §8 的里程碑表也没有任何一行承接它（M2 验收是「走法课可演示可练；判定题引擎自证」，M3 是「第三章 基本杀法 8 课」）。批次的延后决定只写在批次记录里，设计面读者看到的是悬空需求。 | 在 `docs/design/modules/drills.md` 落一句 F3.2 归哪个批次、与四类判定题什么关系，并同步 `docs/design/architecture.md` §8 的里程碑表。 |
| 10 | Closest precedent / Survey | 🟡 | `docs/design/modules/board-ui.md` 本批被改（§4「M2 起按 mode 分支：\`play\` 与 \`drill\` 可交互，\`demo\` 只读。」），却没有 Closest precedent 行也没有 Survey evidence 行，而 `docs/design/modules/lessons.md` / `docs/design/modules/drills.md` / `docs/design/modules/app-shell.md` 三份都写了。缺行与「没做过调查」在文档里长得一样。 | 补两行：先例是 M1 的棋盘与 `docs/design/modules/local-play.md` 的尺寸规则（及该文档 §5 被复用的事实），或明确写「无先例」；调查行写清核对了哪些公开源文档、有无相关。 |
| 11 | Affected-file tier | 🟡 | 三张文件表（`docs/design/modules/lessons.md` §6、`docs/design/modules/drills.md` §7、`docs/design/modules/app-shell.md` §4）都只有「文件 / 职责」两列，没有分档结论行。本轮按文件大小实测：`generator.ts` 8877 字节（offset 300 越界，<300 行）、`schema.ts` 7720 字节（<250 行）、`DrillPage.tsx` 5724 字节（<200 行）、`LessonPage.tsx` 4949、`session.ts` 3178、`content.ts` 2952、`App.tsx` 2430、`routes.ts` 1943、`PlayPage.tsx` 1858、`LearnPage.tsx` 1380；测试侧 `drills.test.ts` 4746、`content.test.ts` 1883、`integration/drill.test.tsx` 2328、`integration/learn.test.tsx` 1808——无一文件跨 500 行档，故不需要拆分方案；结论行仍然缺。函数档（300+ 行单函数）本轮未测，`unverified`。 | 在三张表下各加一行结论：「实测无文件跨档，不需要拆分方案」，并把 `unverified` 的函数档留一句由实现轮补测；不要把字节数或行数写进设计文档，只写结论。 |
| 12 | Clarity | 🟡 | `docs/design/modules/drills.md` §1 的记谱题兜底「记谱题的三个错项取自同一局面的其他合法着法，取不到时用其他伪合法着法的记谱补足，绝不参与判定。」与同文档 §3 的选材规则「走法题优先挑合法落点 ≥ 2 的棋子；记谱题挑有 ≥ 3 个其他不同记谱的着法。」互相矛盾/可达性未定义：如果 §3 已保证「≥ 3 个其他不同记谱」，§1 的「取不到时」这一臂就走不到；如果「不同记谱」只是彼此不同、可以等于正确着法本身，§6 的「四个选项互不相同」又会逼出这一臂。两节对同一件事给了两套描述，读者无法判断该实现哪一条。 | 写明「≥ 3 个其他不同记谱」是否排除正确着法自身的记谱：若已保证，删掉 §1「取不到时」一臂；若不能保证，说明什么局面会走到它并给出一个真实种子。 |
| 13 | Clarity | 🔵 | `docs/design/modules/lessons.md` §5 把章节与课数写死：「\| 章节号 1 / 2、课序连续、课数 8 / 6 \| 是 \|」，而 `docs/design/architecture.md` §8 已排定 M3 加第三章 8 课、22 课全部可跑——这条校验到 M3 当天就失效，文档没说它该怎么长。 | 改成由 `index.json` 推出的断言（每章课数 = 该章 lessons 长度、章号连续），或在 M3 批次里显式记一条「要改这条校验」。 |
| 14 | Document ownership | 🔵 | `docs/design/modules/drills.md` §5「棋盘处于 \`drill\` 模式：只允许行棋方操作；对错标记就地显示，不弹模态框。」复述了 `docs/design/modules/board-ui.md` §4 的「\| \`drill\` \| 只允许 \`side\` 方，且按题目要求 \| 对错标记（红叉 / 绿勾）就地显示，不弹模态框 \|」，两处维护同一句话。 | `docs/design/modules/drills.md` §5 改成一句指向 `docs/design/modules/board-ui.md` §4 的引用，别复述模式规则。 |

计数：🔴 3 · 🟡 9 · 🔵 2（共 14 项）。

范围说明：本轮未跑 git diff、未读实现代码；文件档只做了大小与越界探测，未读源码体（函数档因此 `unverified`）。`docs/design/modules/local-play.md` 不在评审范围，仅因三份被评审文档把它写成最近先例、且它确立了「以 RTM 起点的集成测试设计节」这一项目惯例，才引用其原文；`docs/batches/M2-teaching-drills.md` 同理由引用，工具标注为过程文档、不作设计依据。

VERDICT: changes-required

### 轮次 2（评审子代理）

第 2 轮：逐条核对第 1 轮 14 条整改，闭环 14/14。

本轮重读：

- `docs/design/modules/lessons.md`
- `docs/design/modules/drills.md`
- `docs/design/modules/app-shell.md`
- `docs/design/modules/board-ui.md`
- `docs/design/architecture.md`
- `docs/requirements/xiangqi.md`
- `test/RTM.md`
- `test/integration/navigation.test.tsx`
- `src/client/drills/generator.ts`

核对结果：

| # | 原# | 文件 | 严重度 | 状态 | 证据（本轮原文） |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/modules/lessons.md §8 · docs/design/modules/drills.md §9 · docs/design/modules/app-shell.md §6 · test/RTM.md | 🔴 | Fixed | 三份设计各补一节：「起点：`test/RTM.md` 的「教学」故事。本批新增 F2-1 一行」，表列「验的交互 / 用户可见结果 / 入口 / 需求」全填；test/RTM.md 新增 F4-1「切页不丢对局」，业务结果「走一着后去课程再回对弈，棋盘与记谱保持原样」，用例实现 `test/integration/navigation.test.tsx`（本轮已读，实做该断言）；另有「该行不需要真实布局（jsdom 能验），与「响应式需要浏览器实跑」的挂起是两件事。」 |
| 2 | 2 | docs/design/modules/app-shell.md §1 | 🔴 | Fixed | 「场景：`test/integration/drill.test.tsx` 用固定 seed 进入并确定作答（复现命令 `npm run test:ui`）；没有这个查询面，页面每次随机出题，用例无法确定答案。」场景来源与复现命令都在；用例文件本身不在本轮评审面，未核验。 |
| 3 | 3 | docs/design/modules/lessons.md §4 · docs/design/modules/app-shell.md §2 · docs/requirements/xiangqi.md §5 | 🔴 | Fixed | 「进度：需求 §5 的 v1 口径是「进度存浏览器本地」；本批（M2）只做本次会话内的进度，跨会话持久化在后续批次落地，不在本批验收。」「跨会话进度持久化不在本批」——两侧同口径，不再各说一套。「后续批次」未在架构 §8 里程碑表点名，可选补一句。 |
| 4 | 4 | docs/design/modules/drills.md §1 · docs/design/modules/lessons.md §1 | 🟡 | Fixed | §1「### 配置」给出 JSON 样例与 `interface DrillConfig`；§3「这两个下限是生成器常量，不进 config」界定归属；「练习配置 `content/drills/default.json` 的布局由 `docs/design/modules/drills.md` §1 拥有，本模块只引用。」 |
| 5 | 5 | docs/design/modules/drills.md §4 | 🟡 | Fixed | 「`wrongAttempts > 0` 即最近一次提交判错（作答中仍可改答）；`hintShown` 在第二次错时为真；第三次错进入 `revealed`。」「刚判错」有了承载字段。 |
| 6 | 6 | docs/design/modules/lessons.md §2 · §6 · §7 | 🟡 | Fixed | 「`DemoBlock` 是本文件内部组件」；「`[x, y]` 到 90 格下标的换算只在 `src/client/learn/schema.ts` 的 `demoFrames` / `validateDemo` 内发生」；「项目内无同名先例（checked, none found）」；§7 落点改为「`LessonPage.tsx` 内的演示步进」，`DemoPlayer` 消失。 |
| 7 | 7 | docs/design/modules/board-ui.md §4 | 🟡 | Fixed | demo 行的额外显示只剩「当前步标记」，与「`demo` 用 `lastMove` 标当前步」一致；「被吃子标记」已删，不再有无数据来源的承诺。 |
| 8 | 8 | docs/design/modules/drills.md §8 | 🟡 | Accepted | F3.4 落点改为「揭晓时在棋盘上高亮正确着法的起止格 / 标出正确落点，即演示；判定题只涉及一着，不播放逐步动画（避免为一次判定再加一套播放状态机）」——有意简化并给了理由，需求的「演示」有明确口径，属可接受的非改。 |
| 9 | 9 | docs/design/modules/drills.md §1 · §8 · docs/design/architecture.md §8 | 🟡 | Fixed | 「F3.2 对弈型练习（攻杀 / 防守 / 找杀）随 M3 杀法课落地，本批只做四类判定题。」；架构 §8 M3 行改为「第三章 基本杀法 8 课 + 对弈型练习（F3.2）」，里程碑表承接，不再悬空。 |
| 10 | 10 | docs/design/modules/board-ui.md | 🟡 | Fixed | 顶层已补「Closest precedent: `docs/design/modules/local-play.md` …」与「Survey evidence: 已核对 `docs/requirements/xiangqi.md`（F1.2 棋盘交互、F2.1 演示、F3.1 判定题）…」两行。 |
| 11 | 11 | docs/design/modules/lessons.md §6 · docs/design/modules/drills.md §7 · docs/design/modules/app-shell.md §4 | 🟡 | Fixed | 三处各有一行「文件分档：实测无文件跨 500 行档，不需要拆分方案；函数档（单个函数 300+ 行）本轮未测，由实现轮补测。」 |
| 12 | 12 | docs/design/modules/drills.md §1 · §3 · src/client/drills/generator.ts | 🟡 | Fixed | 「记谱题的三个错项取自同一局面其他伪合法着法的记谱，且与正确记谱、彼此都不同；生成器在合法着法里挑第一个能凑够 3 个不同记谱的着法，凑不够就报错（现有种子集未触发）。干扰项绝不参与判定。」原「取不到时补足」换成单一路径 + 报错，§3 下限与之一致；实现 `notation()` 同构（`if (pool.length < 3) continue;` →「记谱题干扰项不足」抛错）。备注：「现有种子集未触发」承认该报错臂尚无场景，作为不变量兜底可接受。 |
| 13 | 13 | docs/design/modules/lessons.md §5 | 🔵 | Fixed | 「章节号连续、课序连续、每章都有课；M2 的 8 / 6 由内容测试断言，M3 加第三章时同步改成 8 / 6 / 8」。 |
| 14 | 14 | docs/design/modules/drills.md §5 | 🔵 | Fixed | 「棋盘处于 `drill` 模式；模式规则见 `docs/design/modules/board-ui.md` §4，练习页只负责题目、作答与判分。」复述换成引用，归属回到 board-ui。 |

计数：🔴 未解 0 · 🟡 未解 0（Accepted 1）· 🔵 未解 0；14/14 关闭。

New：无。本轮未发现整改引入的崩溃、数据丢失或逻辑错误。

VERDICT: pass

## §4 用户批准（主 agent）

用户批准：2026-11-14「开工」批准 M2 范围与方案；2026-11-14「收口」确认交付并同意走收口链。批准范围即 §1 所列：第一二章 14 课、四类判定题、棋盘三模式、页面壳与路由；不含 F3.2、跨会话进度持久化、第三章内容。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



实现记录（2026-11-14）：

内容层：`content/lessons/index.json`（两章 14 课索引）、14 个课文件（走法 8 + 判罚 6）、`content/drills/default.json`（题型、随机步数 6–24、提示/答案阈值 2/3）。每条演示的 FEN 与逐步走法均由引擎校验。

纯逻辑：
- `src/client/learn/schema.ts`：课程索引与课文件校验、`demoFrames`、坐标到 90 格下标的换算；`src/client/learn/content.ts` 用 `import.meta.glob` 按课拆包加载，索引与练习配置随包进入。
- `src/client/drills/generator.ts`：mulberry32 种子随机；四类题（走法题取合法落点集合、合法性题取 `isLegal`、局面题取 `isInCheck`、记谱题取 `toChineseNotation`）；局面由随机合法着法走出，终局重抽。
- `src/client/drills/session.ts`：作答、集合判分、错两次提示、三次揭晓。
- `src/client/shell/routes.ts` / `useRoute.ts`：hash 路由纯函数与订阅。

界面：
- `src/client/board/layers.tsx` 抽出底图、上一着/可落点提示、选中/将军/练习标记；`Board.tsx` 收口为 `BoardMode`（play/demo/drill），demo 只读、drill 只动行棋方。
- `src/client/pages/PlayPage.tsx`、`LearnPage.tsx`、`LessonPage.tsx`（含 `DemoBlock` 步进）、`DrillPage.tsx`；`App.tsx` 承载导航、路由与对局/课程进度状态。
- `src/client/app.css`：导航、课程、单课、练习与三档布局；手机档整页纵向滚动，棋盘按宽自适应，课程演示卡在窄屏全宽。

验证读数：
- `npm run check` 全绿：node 单测 111 项、前端用例 12 项（新增 `test/content.test.ts`、`test/drills.test.ts`、`test/routes.test.ts`、`test/integration/learn.test.tsx`、`test/integration/drill.test.tsx`、`test/integration/navigation.test.tsx`）。
- `npm run build` 成功：主 JS gzip 84.51 kB，CSS gzip 2.47 kB；14 课各自成 chunk。
- 浏览器实跑（Edge，CDP 设备尺寸模拟）：375×667、768×1024、1414×807 三档课程页与练习页无横向溢出；手机档棋盘 360×400、练习面板在棋盘下方；桌面练习棋盘 648×720、面板 360。课程演示「下一步」走到目标格；练习答对显示判分，错两次出提示、三次出答案并标绿正确项；走法题点选后提交可用；记谱题四个选项互不相同。
- 切页保留：对弈页走「炮八进一」后去课程再回对弈，记谱与棋子位置保持。

与设计的差异：
- F3.4 的「演示」按设计 §8 的裁定做成「揭晓时高亮正确着法的起止格 / 标出正确落点」，不播逐步动画。
- 跨会话进度持久化不在本批；F3.2 对弈型练习随 M3。

评审整改：第 3 节两轮共 14 条（3🔴/9🟡/2🔵）已全部处置，第 2 轮结论 pass。新增 F4-1 集成用例与 RTM 行，三份设计补集成测试节，生成器记谱题改为逐着挑选可凑够 3 个不同干扰记谱的着法。

## §6 验证与收口（父代理）

收口验证（2026-11-14）：
- `npm run check` 全绿：typecheck 通过；`node --test` 111 项全过；`vitest run` 12 项全过（5 个测试文件）。
- `npm run build` 成功：主 JS gzip 84.51 kB、CSS gzip 2.47 kB；14 课各自成 chunk。
- 收口测试行：`npm run check` 为本批闸门；F2-1 / F3-1 / F4-1 三条集成用例分别从 App 入口走通课程演示、练习判分与切页保留。

M2 验收对照：

| 验收 | 结果 | 证据 |
|---|---|---|
| 走法课可演示可练 | 通过 | 课程页演示步进；练习页四类判定题作答 |
| 判定题引擎自证 | 通过 | `test/drills.test.ts` 四类题各 40 个种子回算答案 |
| 第一二章 14 课可跑 | 通过 | `test/content.test.ts` 逐课过 schema 与引擎校验 |
| 演示局面经引擎验证 | 通过 | 内容测试逐步走 `playMove`，非法即失败 |
| 错两次提示、三次答案 | 通过 | `session.ts` 阈值 + 浏览器实跑 |
| 三端可用、切页不丢对局 | 通过 | 375 / 768 / 1414 实测无横向溢出；F4-1 用例 |

评审：第 3 节两轮，第 1 轮 3🔴/9🟡/2🔵 全部整改，第 2 轮 pass；新增 F4-1 与三份设计的集成测试节。

遗留与边界：
- F3.2 对弈型练习（攻杀 / 防守 / 找杀）归 M3，architecture §8 已承接。
- 课程进度跨会话持久化不在本批；本次会话内进度已实现。
- F3.4 的「演示」按设计 §8 做成高亮正确着法起止格 / 正确落点，不播逐步动画。
- 第三章杀法 8 课归 M3。

台账：#2 结算为已核销，证据指向本节与 `npm run check` 读数。
