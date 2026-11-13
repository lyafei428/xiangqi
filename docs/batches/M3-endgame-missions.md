# 2026-11-14 · M3 第三章基本杀法 + 对弈型练习
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「m3」并「开工」；范围取 docs/design/architecture.md 里程碑 M3；F3.2 口径按 docs/requirements/xiangqi.md。
> 台账 = #3（xiangqi · 归批）。前情 = M2 教学框架 + 练习生成器 + 第一二章（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

本批判据：architecture 里程碑「M3 | 第三章 基本杀法 8 课 + 对弈型练习（F3.2） | 22 课全部可跑，内容自证测试全绿；攻杀 / 防守 / 找杀达成目标即通过」；需求侧覆盖 F2.2（三章 22 课）、F3.2（三类对弈题）、F3.3（答案由引擎生成）、F3.4（提示与答案）。

本批交付：
- 第三章 8 课：基本杀法讲解 + 引擎可跑的演示，课目拟为对面笑、双车错、马后炮、闷宫、重炮、铁门栓、天地炮、卧槽马；某个型构造不出干净演示就换成同级基本型并在 §5 说明。
- 对弈型练习：8 道题（每课一题），三类玩法——找杀（一着将死）、攻杀（`plies` 着内将死，引擎应着）、防守（化解对手一着杀）；新增判杀器、题目 schema 与会话。
- 页面：`#/missions` 列表、`#/mission/<id>` 单题；课程页第三章直链、练习页入口。
- 测试：22 课内容自证、8 题逐题自证、会话判分、F3-2 集成用例。
- 文档：`docs/design/modules/missions.md`；同步 lessons / drills / app-shell / RTM。

关键判据：
- 答案不手写：将死线、防守线、一着杀威胁都由判杀器现算；内容测试逐题回算。
- 攻杀必须「强制」：判杀器检查对手所有合法应着后玩家仍能杀，不只检查一条线。
- 题目是人工构造的局面，不做随机生成（题量小，先保证质量与自证）。
- 复用：棋盘 drill 模式、对弈页选子两段式、页面壳与尺寸规则。

本批不做：随机生成对弈题、课程进度持久化、第四章、联机、计时、棋谱回放。

上抛项：无（玩法口径与课目清单已在计划中说明并获「开工」授权）。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

设计档落点：新增 `docs/design/modules/missions.md`（三类题、题目 schema、判杀器、会话、页面、集成测试节）；同步 `docs/design/modules/lessons.md`（22 课 8/6/8、第三章关联题目）、`docs/design/modules/drills.md`（F3.2 指向）、`docs/design/modules/app-shell.md`（两条新路由与新页面）、`test/RTM.md`（F3-2 行）。

机制设计：
- 判杀器：`findMatingMoves` 找一步杀；`hasMateIn(pos, 2)` 检查「存在玩家着法，使对手任意应着后仍有一步杀」；`hasMateInOneThreat` 用 `withTurn` 换成对手先走再查一步杀。只支持 1–2 着，题目自证时跑一次并缓存。
- 题目：`content/missions/index.json` 8 条，字段 id / type / lesson / title / fen / plies / source / hint；局面人工构造，答案全部由引擎回算。
- 会话：复用 `GameSession` 的选子与走子；玩家落子后判定，攻杀未结束则引擎按排序取第一个合法应着，防守未化解则引擎走出那一着；重试回到题目 FEN。
- 页面：`#/missions` 列表、`#/mission/<id>` 单题；棋盘 drill 模式；课程页第三章直链，练习页加入口。
- 内容：第三章 8 课，每课演示结束于对应杀法将死；某型构造不出干净演示就换同级基本型并在 §5 说明。

受影响文件与测试覆盖：

| 文件 | 动作 |
|---|---|
| `content/lessons/index.json`、`content/lessons/*.json`（第三章 8 个） | 新增课程内容 |
| `content/missions/index.json` | 新增 8 道对弈题 |
| `src/client/missions/mate.ts`、`schema.ts`、`session.ts` | 新增判杀器、题目自证、会话 |
| `src/client/pages/MissionsPage.tsx`、`MissionPage.tsx` | 新增页面 |
| `src/client/shell/routes.ts`、`src/client/App.tsx`、`src/client/pages/LessonPage.tsx`、`app.css` | 路由、壳、课程页直链、样式 |
| `test/content.test.ts` | 改 22 课 8/6/8 |
| `test/missions.test.ts` | 新增题目自证与会话测试 |
| `test/integration/mission.test.tsx` | 新增 F3-2 集成用例 |

验收对照：

| 验收 | 落点 |
|---|---|
| 22 课全部可跑，内容自证全绿 | 内容测试逐课校验 |
| 攻杀 / 防守 / 找杀达成目标即通过 | 8 道题 + 判杀器判定 |
| 答案由引擎生成 | 题目自证与会话判定均调判杀器 |

关键决策：攻杀检查「所有应着」而非单线；防守口径为化解「对手一着杀」；不做随机生成；题目全量加载。

上抛项：无。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

## M3 第三章基本杀法 + 对弈型练习 — 独立设计评审

审查对象：`docs/design/modules/missions.md`、`docs/design/modules/lessons.md`、`docs/design/modules/drills.md`、`docs/design/modules/app-shell.md`、`docs/design/architecture.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`（仅这 7 份，未读代码）。无 document map，文档归属检查降级。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Feasibility / Clarity | 🟡 | `docs/design/modules/missions.md` 的防守判定用「按『对手先走』的局面回算」（`withTurn(position, color): Position      // 只换行棋方，供威胁判定`）计算「一着杀」，但没有写合法性前提：翻转后「不走棋的一方被将军」的局面不是引擎能判的局面。两类输入因此无定义——(a) 防守题初始 FEN 里玩家正被将军时；(b) 玩家化解的那一着反过来将了对手的军时（合法的「以攻代守」，同一文件 §1 的成功口径「走完后对手不再有「一着杀」」会把合法化解判成失败，并按「引擎走出那一着」去找一步并不存在的杀着）。同一个 API 里 `hasMateIn(position, plies): boolean      // 当前行棋方在 plies 着内强制将死` 本身就是相对行棋方的，走子后判断其实不需要翻转；两条路径文档没有分工。 | 在 `docs/design/modules/missions.md` §3 补一句翻转前提（「翻转后行棋方处于被将局面时不翻转，直接按相对行棋方判定」），并写清走子后的复查走 `hasMateIn(position, 1)` 而不是再翻一次；§4 的 defense 分支补「玩家那一着让对手被将」的落点。 |
| 2 | Clarity / Requirements | 🟡 | F3.4 的「三次给答案并演示正确走法」在 `docs/design/modules/missions.md` §4 只写「第三次把正确第一着走到棋盘上并给出记谱（`answerText`）」，没有写这一着怎么算；§3 的 API 也算不出它：`hasMateIn` 只返回 boolean，攻杀题（`plies = 2`）的强制首着拿不到见证着法；防守题的「正确第一着」是一步化解着，而 `findMatingMoves` 返回的是行棋方的一步杀。多个正解时也没说取哪一个。 | 在 `docs/design/modules/missions.md` §4 写明三类题各自的揭晓取法（例如：攻杀取 `findMatingMoves` 或见证着法的排序首项，防守取排序后第一个让对手无一着杀的合法着），并在 §3 增加返回见证着法的函数（或说明在 §4 里如何用现有 API 搜索）；记谱来源写 `toChineseNotation`。 |
| 3 | Acceptance / Integration design | 🟡 | `test/RTM.md` 的 F3-2 行只断言「走进将死着显示通过；走错显示未达成并可重试」，覆盖「走成将死」这一条；而需求 F3.2 要求攻杀 / 防守 / 找杀三类，`docs/design/modules/missions.md` §7 也自称落点是「三类题目 + 判杀器判定」。防守题的用户可见结果是「化解后显示通过」，在 RTM 里没有任何一行断言。 | 把 `test/RTM.md` 的 F3-2 业务结果扩到三类（或在同一用例里加一条防守断言：走化解着显示通过、走没化解的着显示失败并可重试）；若确实只做一条，在 `docs/design/modules/missions.md` §8 说明为什么一条能代表三类。 |
| 4 | Consistency (doc state) | 🟡 | `docs/design/modules/lessons.md` §5 写「`src/client/learn/schema.ts` 提供纯校验函数，内容测试对 14 课逐课调用：」，而同一节的检查行写「全书 8 / 6 / 8，共 22 课」、§7 写「F2.2 三章 22 课全部可跑」。14 是 M2 的两章口径，M3 的验收（`docs/design/architecture.md` §8「22 课全部可跑，内容自证测试全绿」）落在 22 课，这句话与它自己引出的检查行矛盾，也让「自证覆盖到哪几课」读不出来。 | 把 `docs/design/modules/lessons.md` §5 该句改成 22 课（或「全部课目逐课调用」），与同节检查行、§7 行一致。 |
| 5 | Consistency (cross-doc lag) | 🟡 | `docs/design/modules/missions.md` §2 把题库存放在 `content/missions/index.json`，但 `docs/design/architecture.md` §4 的目录树 `content/` 下只有「课程，每课一个 JSON」与「练习生成配置」两项，没有 `missions/`；架构的分层表也因此少了一层内容面。 | 在 `docs/design/architecture.md` §4 的 `content/` 树补 `missions/`（题库，每课一题），与其 §2 对齐。 |
| 6 | Existing-piece check | 🟡 | `docs/design/modules/missions.md` §6 的命名块只列了「`MissionPage`、`MissionsPage`、`hasMateIn`、`hasMateInOneThreat` 为新增名字，项目内无同名先例（checked, none found）。」，§3 公开的另两个新名字 `findMatingMoves`、`withTurn` 没有逐名三问；新增的用户可见文案「对弈题」也没有条目。 | 把 `findMatingMoves`、`withTurn` 与文案「对弈题」补进 `docs/design/modules/missions.md` §6 的命名块，各自按 `existing: …` / `none found: …` / `existing but unusable: …` 给一行。 |
| 7 | Clarity / State ownership | 🟡 | `docs/design/modules/app-shell.md` §2 的状态归属表只有四行（对局会话、看过的课、课程页演示步数、练习会话），M3 新增的「对弈题会话」（`docs/design/modules/missions.md` §4 的 `MissionSession`）不在表里；`docs/design/modules/missions.md` 也没写它放在哪、切页后是否保留。F4.2 要求「切换过程不丢状态」，答题中途切页会不会丢现在无从判断。 | 在 `docs/design/modules/app-shell.md` §2 的表里加一行「对弈题会话 | 对弈题页内部 | 离开即复位」（或写明跨页保留），并在 `docs/design/modules/missions.md` §4 呼应。 |
| 8 | Consistency (numeric drift) | 🔵 | `docs/design/modules/app-shell.md` §1 写「不引路由库：四条路由用 `parseHash` / `routeHash` 两个纯函数足够。」，而紧邻的路由表已是 6 条（含 M3 新增的 `#/missions`、`#/mission/<id>`）。 | 改成「六条路由」，或直接去掉数字写「几条路由」。 |
| 9 | Branch provenance | 🔵 | `docs/design/modules/app-shell.md` §1 的「未知路由按对弈页渲染，不改写地址」是给一个输入状态开的分支，但没有场景来源（无观察、无复现路径），`test/RTM.md` 里也没有用例断言它。同文件 `?seed=<n>&kind=<kind>` 那条分支则写足了来源（「场景：`test/integration/drill.test.tsx` 用固定 seed 进入并确定作答（复现命令 `npm run test:ui`）」），两者对比明显。 | 给未知路由分支补来源，或写明「无来源、也无用例断言，仅为地址栏兜底」；顺带说明该兜底不需要额外文案。 |
| 10 | Doc hygiene | 🔵 | `docs/design/modules/lessons.md` §4 写「本批（M2）只做本次会话内的进度，跨会话持久化在后续批次落地，不在本批验收。」——设计文档只写现在是什么，「本批」把文档绑在某一个批次上；到 M3 再读，「本批」指哪一批已经不确定。 | 改成与时点无关的现状句（如「跨会话进度持久化尚未实现，进度只在本次会话内保留」）。 |
| 11 | Clarity | 🔵 | `docs/design/modules/missions.md` §4 的 `MissionSession` 同时有 `attempts` 与 `failures`，但提示/答案阈值由「失败次数累计，重试不清零」驱动，`attempts` 没有说明消费者（显示在哪、用来做什么）；§6 的文件表也没有任何文件负责读 `content/missions/index.json`（§2 只说「一次全量加载」）。 | 要么给 `attempts` 一个可见用途，要么删掉；把题库加载归属写进 `docs/design/modules/missions.md` §6 的文件表。 |
| 12 | Affected-file tier | 🔵 | 四份模块设计（`docs/design/modules/missions.md`、`docs/design/modules/lessons.md`、`docs/design/modules/drills.md`、`docs/design/modules/app-shell.md`）的文件分档结论都是同一句「实测无文件跨 500 行档，不需要拆分方案；函数档（单个函数 300+ 行）本轮未测，由实现轮补测。」；本对象状态是「已实现」，函数档（第一档判据）在收口面仍无结论。 | 收口前把函数档实测结论写进这四句（「无 300+ 行单函数」或点名文件加拆分方案）；不要把行数/字节数写进设计文档，只写结论。 |
| 13 | Feasibility (unverified) | 🔵 | `docs/design/modules/missions.md` §5 称「棋盘沿用 `drill` 模式：只允许玩家一方操作，选中与可落点用对弈页的规则。」，而 `docs/design/modules/drills.md` §5 把模式规则指向 `docs/design/modules/board-ui.md` §4，该文件不在本次评审范围，所以「`drill` 模式允许在棋盘上落子」这条前提在本轮 `unverified`。 | 在 `docs/design/modules/missions.md` §5 引用 `docs/design/modules/board-ui.md` §4 的具体条款（或说明 `drill` 模式已按「只允许玩家一方落子」扩展），使前提可核对。 |

计数：🔴 0 · 🟡 7 · 🔵 6 · 合计 13。未做源码与测试文件的尺寸实测（本轮范围是文档，未读代码文件），故第 12 条只能判文档面的结论行。

VERDICT: pass

## §4 用户批准（主 agent）

用户批准：2026-11-14「m3」「开工」批准 M3 范围与方案；2026-11-14「收口」确认交付并同意走收口链。批准范围即 §1 所列：第三章 8 课、三类对弈题 8 道、判杀器与会话、页面与入口；不含随机生成、跨会话进度、第四章。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



实现记录（2026-11-14）：

内容：
- 第三章 8 课：对面笑、双车错、马后炮、闷宫、重炮、铁门栓、卧槽马、挂角马。每课讲解 + 一条走到将死的演示，全部过引擎校验。原计划的「天地炮」没有构造出干净的一步杀演示，换成同级的「挂角马」。
- `content/missions/index.json` 8 道题（每课一题）：找杀 4、攻杀 2、防守 2。局面人工构造，答案由判杀器回算。

逻辑：
- `src/client/missions/mate.ts`：`findMatingMoves`、`hasMateIn`（1–2 着）、`findForcingMoves`（强制杀见证着法）、`findDefenseMoves`（化解着法）、`hasMateInOneThreat`、`withTurn`。威胁判定先看对手是否正被将军，被将时不翻转。
- `src/client/missions/schema.ts`：题目字段与 FEN 校验；逐题自证（找杀有一步杀、攻杀有强制杀、防守有「对手一着杀」且玩家不在被将状态、存在化解着法）。
- `src/client/missions/session.ts`：复用 `GameSession` 的选子与走子；玩家落子后判定，攻杀未结束则引擎按排序取第一个合法应着，防守未化解则引擎走出杀着；错两次提示、三次把正确第一着走到棋盘上并给出记谱（失败次数累计，重试不清零）；会话在题目页内部。
- `src/client/missions/content.ts`：题库一次全量加载并逐题自证。

界面：
- `src/client/pages/MissionsPage.tsx` 按题型分组；`MissionPage.tsx` 用 `play` 模式（`side = player`）的棋盘 + 目标/提示/答案/重试/下一题。
- 路由 `#/missions`、`#/mission/<id>`；练习页加「对弈题 · 杀法练习」入口；课程页第三章每课直链对应题目；App 导航把三条对弈题路由归到「练习」。

验证读数：
- `npm run check` 全绿：node 单测 127 项、前端用例 15 项（新增 `test/missions.test.ts` 与 `test/integration/mission.test.tsx`，扩展 `test/content.test.ts`、`test/routes.test.ts`）。
- `npm run build` 成功：主 JS gzip 88.28 kB、CSS gzip 2.62 kB；22 课各自成 chunk。
- 浏览器实跑：题目列表 8 项按题型分组；找杀题走「车九平六」将死显示「过关」；错一次只显示「未达成」，错两次出提示，错三次显示「正确着法：车九平六」并把答案走到棋盘上；375 视口下题目列表与单题无横向溢出，单题棋盘 360×400、面板在棋盘下方整页滚动。

评审整改：第 3 节一轮（0🔴 / 7🟡 / 6🔵）全部处置——补威胁判定的被将守卫与「走子后不翻转」约定、补见证着法与防守着法 API、补防守题集成用例与 RTM 业务结果、修 14/22 课数与路由数、补 architecture 目录树、补命名块与题库加载归属、补状态归属表、补分档结论。第 2 轮复核结论见 §3。

与计划的差异：天地炮换挂角马（理由见上）；防守题归到卧槽马/挂角马两课，标题为「守住将门（左/右）」，不强行与杀法同名。

## §6 验证与收口（父代理）

收口验证（2026-11-14）：
- `npm run check` 全绿：typecheck 通过；`node --test` 127 项全过；`vitest run` 15 项全过（6 个测试文件）。
- `npm run build` 成功：主 JS gzip 88.28 kB、CSS gzip 2.62 kB；22 课各自成 chunk。
- 收口测试行：`npm run check` 为本批闸门；F3-2 集成用例覆盖找杀过关、错两次提示、三次给答案并演示、防守化解过关。

M3 验收对照：

| 验收 | 结果 | 证据 |
|---|---|---|
| 22 课全部可跑，内容自证全绿 | 通过 | `test/content.test.ts` 校验 8 / 6 / 8 共 22 课，演示逐步合法 |
| 攻杀 / 防守 / 找杀达成目标即通过 | 通过 | 8 道对弈题 + 判杀器判定；`test/missions.test.ts` 逐题自证 |
| 答案由引擎生成，不手写 | 通过 | 将死线、防守线、一着杀威胁全部现算 |
| 错两次提示、三次给答案并演示 | 通过 | 会话累计失败次数；第三次把正确着法走到棋盘上并给记谱 |
| 三端可用 | 通过 | 375 / 768 / 1414 实跑，无横向溢出 |

评审：第 3 节一轮，0🔴 / 7🟡 / 6🔵，全部处置；文档机检 0 命中。

遗留与边界：
- 对弈题是人工构造的局面，不做随机生成。
- 课程进度跨会话持久化尚未实现。
- 天地炮换成挂角马（构造不出一干净的天地炮一步杀演示）。
- 第四章、联机、计时、棋谱回放、AI、PWA 不在本批。

台账：#3 结算为已核销，证据指向本节与 `npm run check` 读数。
