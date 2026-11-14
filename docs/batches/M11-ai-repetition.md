# 2026-11-14 · M11 AI 认长将与重复
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户报「人机对战中机器出现长将判负」；台账 #14 记录该缺陷（AI 搜索不看历史，会自己走进长将）。
> 台账 = #14（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户原话：「人机对战中机器出现长将判负」。

诊断（已核）：规则侧没错——`src/shared/rules.ts` 的 `repetitionResult` 在两条路径都判：只有一方每着将军时按长将判该方负，否则按三次重复判和。问题在引擎侧：`chooseMove(position, options)` 只有局面与难度，`search` 里也没有任何历史，所以它看不到「这个局面已经出现两次」，会为一个看起来不错的子力或杀分把循环走下去，走到第三次由规则判它负。

范围：只改引擎与它的调用链（`search`、`chooseMove`、Worker 协议、`AiPage` 传参），外加把 `repetitionResult` 的入参放宽成结构型以便复用判罚。不改判罚口径、不改棋盘与面板、不改联机。

不做：自然限着（60 回合无吃子）不在搜索里建模——引擎不会主动走到那里；开局库、PV 展示仍不做。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

让引擎认得重复与长将，不再自己走进判负。

**设计**

落点写在 `docs/design/modules/ai.md` §2「长将与重复」与 §3 协议：搜索对每个节点按 `positionKey` 计路径出现次数，第三次出现即终端，按 `repetitionResult` 的胜负计分（胜方 = 行棋方取正、对手取负、和棋取 0）；判罚复用 `docs/design/rules-engine.md` 那套规则，不另写一套。历史经 Worker 协议从 `AiPage` 传入。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `src/shared/ai/search.ts` | 节点级重复检测与终端计分；窗口末 24 着 |
| `src/shared/ai/index.ts` | `AiOptions` 加 `history` / `startFen`，转交搜索 |
| `src/shared/rules.ts` | `repetitionResult` 的 history 入参放宽为 `{ fen, gaveCheck }` 结构型；判罚不变 |
| `src/client/ai/protocol.ts` | `AiRequest` 加 `history` / `startFen` |
| `src/client/ai/engine.ts` | `request` 透传两个新参数 |
| `src/client/ai/worker.ts` | 把协议字段转给 `chooseMove` |
| `src/client/pages/AiPage.tsx` | 发请求时带 `session.history` 与 `startFen` |
| `test/ai.test.ts` | 扩两条：长将线不被选中、非将军重复线计 0 分 |

**边界**

判罚口径不动；不改棋盘、面板、联机；自然限着不建模。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

评审对象：搜索里的重复 / 长将终端判定与调用链传参（台账 #14）。范围：`docs/design/modules/ai.md`（重点 §2「长将与重复」、§3 协议、§6 验收、§7 文件划分、§8 集成设计）、`docs/design/rules-engine.md`（§6.1 重复与长将契约）、`docs/requirements/xiangqi.md`、`test/RTM.md`。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Document ownership | 🔴 | `docs/design/modules/ai.md` §7 写「`repetitionResult` 的 history 入参放宽为 `{ fen, gaveCheck }` 的结构型」，而拥有这一契约的 `docs/design/rules-engine.md` 仍写 `repetitionResult(position: Position, history: readonly HistoryEntry[], startFen: string): GameResult | null`，且该文自称「本文件是 M0 的实现契约：实现与测试都按此判定。」受影响文件表里没有任何 docs 行，契约文档本批不改。同一机制两处描述不一致。 | 在受影响文件表加一行 `docs/design/rules-engine.md`：§6.1 签名改成放宽后的结构型、并写明 `{ fen, gaveCheck }` 足以算长将段的理由；或维持原签名，由 AI 侧构造真正的 `HistoryEntry[]` 传入。一处定死。 |
| 2 | Clarity / Completeness | 🔴 | 「复用 `repetitionResult(position, 窗口, startFen)`」没说 `窗口` 末元素是否就是当前节点局面。`docs/design/rules-engine.md` 的计数范围是「**重复检测**：计数范围 = **起始局面**（`startFen`，即 `history` 第一着之前的局面）加上 `history` 中每一着之后的局面；同一局面键累计出现第 3 次时判罚。」`position` 不单独计一次：窗口若不含当前局面，函数只看见两次 → 返回 null，而分数表只有「胜方 = 行棋方 → `+(MATE - ply)`；胜方 = 对手 → `-(MATE - ply)`；和棋（`winner === null`）→ `0`」三行，null 分支无落点。另外设计让搜索自己按「已有 ≥ 2 次」判第三次，却没说 `startFen` 那一格是否参与这次计数——两套计数差一格，就会在「双方各自挪回原位」这类循环上判早或判晚。 | 写明窗口末元素 = 当前节点局面、`startFen` 的局面键并入每节点计数，并补一行「`repetitionResult` 返回 null」时的落点（退化成非终端 / 0 分）。让两套计数在同一条规则下对齐。 |
| 3 | Branch provenance (6b) | 🔴 | 「第三次出现」终端分支只给了「玩家能直接撞上这个结果」一句断言：没有引用的观察（日志 / 用户报告 / 读数），也没有可复现路径（哪几步、哪条命令）。同一文档的 Worker 崩溃分支写了完整复现（「复现：把 `new Worker(new URL('./worker.ts', …))` 的路径改成不存在的文件，跑 `npm run dev` 打开 `#/ai`」），可见这里的缺席不是体例差异。 | 补场景：给出对局历史、旧行为实际选中的那一着与复现命令（或引用一条真实观察），使这条分支的提示文案、跨端一致与用例都有落点；若拿不出场景，明写去掉这条分支为何不影响需求 §4 的长将判负。 |
| 4 | Clarity | 🟡 | 「只用路径末 24 着 + 调用方传进来的对局历史；第三次出现必定落在末窗口内，所以不必扫全程」有两种读法：对局历史整段传入（24 只是搜索路径余量，树深 ≤ 6 确实够），或对局历史也被截到 24 着——后者会漏判周期长于 12 着的循环（三次出现的跨度可到 28 着以上），「必定落在末窗口内」没有依据。 | 一句话定死传给 `repetitionResult` 的确切切片（对局历史不截断，只对搜索路径限 24），并把「必定落在末窗口内」换成可核依据（路径长度 ≤ `maxDepth`）。 |
| 5 | Scope / 现有件 | 🟡 | 引擎层 `readonly history?: readonly HistoryEntry[];` 与 `readonly startFen?: string;` 都可选，协议层 `readonly history: readonly HistoryEntry[];` 与 `readonly startFen: string;` 必填；「未传历史」那一行（`退化成「只看树内重复」：仍按三次重复判和，不会自己转圈`）没有场景——产品路径永远传历史——也没有用例；`startFen` 的缺省值未写，与 `docs/design/rules-engine.md`「`repetitionResult` 与 `judgeGame` 的 `startFen` 是**必填参数**——不给默认值」的取向相反。 | 把 `AiOptions` 的 `history` / `startFen` 改成必填（或写明缺省值与理由），删掉「未传历史」退化分支，调用链只留一种形状。 |
| 6 | Acceptance | 🟡 | 两条新用例（①③）都从「同一局面已出现两次」的历史起步，没有一条覆盖 `startFen` 计入计数的那一格——而 `docs/design/rules-engine.md` 规定 startFen 必填的理由正是「起始局面必须计入：它真实存在过，漏掉它会让「双方各自挪回原位」这类循环晚一整圈才判和」。 | 补一条：开局后走一段回到初始局面的循环，断言第三次出现即判和（或长将判负），证明 `startFen` 真被计入。 |
| 7 | Doc hygiene | 🟡 | `docs/design/modules/ai.md` §2「长将与重复」以修订叙述开篇（「旧版搜索不看历史，会把「一直将军」当成正常着法去追」「改法：把对局历史交给搜索」），规范面写成了历史对比；AGENTS.md 要求「需求与设计文档只写"现在是什么"，不写历史。历史在 git 提交里。」 | 改写成现在的规格（搜索吃什么、在哪个节点判、判成什么分），缺陷来历移进批次记录与提交信息。 |
| 8 | 现有件 check | 🟡 | 现有件检查没有回答 `recordMove`：`docs/design/rules-engine.md` §5 提供它并写明「`recordMove` 供只需要历史条目的调用方使用，避免为了拿一条记录而重复搬家。」，而 §7 的现有件清单只列到「`generateLegalMoves` / `applyMove` / `statusOf` / `positionKey`（`src/shared/`）；`perft` 可作走法生成的性能基线，搜索直接吃它。」；设计让搜索自己用 `isInCheck` 现算 `gaveCheck`，却没说不复用的理由。 | 在现有件检查里加一行：`recordMove` — existing but unusable（窗口按 `Position` 懒物化、不建 fen 串才是理由），或改用它。 |
| 9 | Clarity | 🟡 | 「`HistoryEntry` 的 `gaveCheck` 由每着之后的 `isInCheck(下一局面, 行棋方)` 得出」里的「行棋方」两义：走这着的一方，或下一局面轮到的一方。只有后者给出「这着将军」的语义，取前者会把每条 `gaveCheck` 取反，长将段判给错的一方。 | 写成 `isInCheck(下一局面, 下一局面.turn)`（或「对手色」），消掉歧义。 |
| 10 | Integration-test design | 🟡 | §8 的 delta 只写「F1-7（人机对战）已在 RTM 里，本批不新增行；F1-1 / F1-3 不破坏、不冗余。」，没就长将这一改单独交代：`test/RTM.md` 的 F1-7 业务结果是「选难度与阵营后走一着，机器在 2 秒内回一着并更新棋盘；思考中棋盘不可动；换难度后回子速度变化可见；终局后不再回子」，没有一条断言「机器不会自己走进长将判负」，而这次改的正是这一可见结果。 | 在 §8 补一行：给 F1-7 加一条业务结果并给出驱动方式（玩家连续将军到第三次重复），或写明这一结果为何不需要集成用例。 |
| 11 | Clarity / 调用链传参 | 🟡 | 参数链上游没接完：页面要传 `history` 与 `startFen`，设计没写它们读自会话的哪个字段；受影响文件表里 `src/client/game/session.ts` 只列「`play(move, now)` 动作落地（动作表归 `docs/design/modules/local-play.md` §3）」，没有为 `startFen` 在会话状态里留位置。会话不带 `startFen`，这条链到页面就断。 | 在 §7 指明 `history` / `startFen` 的来源字段，并在会话状态里补 `startFen`（或说明它恒为 `INITIAL_FEN`）。 |
| 12 | Feasibility | 🔵 | 「每个节点多一次 `positionKey`（棋盘串）；窗口只在第三次出现那一下才构造，平均到节点上可忽略」没有读数支撑；`maxDepth` 6 / `budgetMs` 1800 下每节点拼一百来字符的棋盘串可能吃掉预算，而验收里「引擎内由 `test/ai.test.ts` 用伪造时钟断言不超预算」量不出这项开销。 | 收口时补一条真时钟读数（初始局面 + 高手档的 nodes 与耗时），或改用增量式局面键。 |
| 13 | Boundary | 🔵 | 自然限着不建模给了理由（「边界：60 回合无吃子的自然限着不建模——引擎不会在一局里主动走到那里，建模它只是多一条不会触发的分支。」），后果是落后方 AI 拿不到 120 着那条和棋；局面级判罚仍由 `judgeGame` 兜住，结果正确性不受影响。 | 无需改动；保留此句作为日后追溯的锚点。 |
| 14 | Affected-file tier | 🔵 | 分档结论行在（「文件分档：无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。」）。本次文档范围不含源码，无法自查行数，结论按作者所述记为未核（unverified）。 | 无需改动；如需核，抽查 `src/shared/rules.ts`、`src/shared/ai/search.ts`、`test/ai.test.ts` 三个最可能长的文件。 |

VERDICT: changes-required

计数：🔴 3 · 🟡 8 · 🔵 3

### 轮次 2（评审子代理）

第二轮复核（M11 修订稿）：逐条核对上一轮 14 项，全部按本轮 `read` 的当前状态判定；另记 3 条新发现。

| # | 原# | 文件 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/rules-engine.md | 🔴 | Fixed | §6.1 现写 `repetitionResult(position: Position, history: readonly RepeatEntry[], startFen: string)`，并补了放宽理由段：「`repetitionResult` 的入参放宽成 `RepeatEntry`：判罚只用到「这一着之后的局面 FEN」与「这一着是否将军」两项」。`src/shared/types.ts` 落了 `RepeatEntry`；`docs/design/modules/ai.md` §7 与现有件两处同口径，契约文档与设计不再两说。 |
| 2 | 2 | src/shared/ai/search.ts | 🔴 | Fixed | 计数接缝已定死：`bump(seen, fenKey(startFen));` 把起点计入；窗口以当前节点收尾（`window.push({ fen: toFen(node.position), gaveCheck: isInCheck(node.position, node.position.turn) });`）；`if (verdict === null) return null;` 把「计数到 3 却不成环」按非终端处理。`docs/design/modules/ai.md` 的 计数含起点 / 窗口 / 判不出 三行与代码逐条对上。 |
| 3 | 3 | test/ai.test.ts | 🔴 | Fixed | 场景已可复现且自带钉桩：`PERPETUAL_START` + 7 着循环 + `PERPETUAL_CLOSING`，先用 `judgeGame` 断言「这条线必须真的是长将负，否则用例测的是别的东西」，再断言 `assert.notDeepEqual(reply.move, PERPETUAL_CLOSING, '不许把自己送进第三次重复（判长将负）');`。`docs/design/modules/ai.md` 的复现行与 test/RTM.md F1-7 的业务结果都指到这条用例。 |
| 4 | 4 | docs/design/modules/ai.md | 🟡 | Fixed | 窗口行改为「前面接对局历史（整段，不截断）与搜索路径（长度 ≤ `maxDepth`，不需要额外的 24 着上限）」，24 着上限与「必定落在末窗口内」都已删除，两种读法消失。 |
| 5 | 5 | docs/design/modules/ai.md | 🟡 | Fixed | `history` / `startFen` 均改必填并给理由（「必填——缺了它搜索看不见已发生的重复。」「必填，规则档规定不给默认值。」）；`src/shared/ai/index.ts` 与 `src/client/ai/protocol.ts` 同步；「未传历史」退化行已删，只留一条形状。 |
| 6 | 6 | test/ai.test.ts | 🟡 | Fixed | 长将用例的起点即循环起点，注释写明「注意 startFen 就是循环起点：这条用例同时钉住「起点必须计入重复计数」。」；去掉起点计数该用例判不出长将，覆盖到位。 |
| 7 | 7 | docs/design/modules/ai.md | 🟡 | Fixed | 「旧版搜索不看历史…改法：…」整段改成现在的规格（「搜索吃两样东西：当前局面，以及**对局至今的着法史**（`history` + `startFen`）。」）。 |
| 8 | 8 | docs/design/modules/ai.md | 🟡 | Fixed | 现有件检查新增 `recordMove` 一行并给了不用的理由：「它为每一着造完整 `HistoryEntry`（含 `move` / `captured`），而搜索窗口按 `Position` 懒物化、判罚那一刻才补 `fen` 与 `gaveCheck`」。与 `repetitionScore` 的实现一致。 |
| 9 | 9 | docs/design/modules/ai.md | 🟡 | Fixed | 改为「这着走完之后，**对手**（`下一局面.turn`）是否被将军」；代码侧 `gaveCheck: isInCheck(node.position, node.position.turn)` 与 `src/shared/rules.ts` 的 `buildEntry` 同义，歧义消除。 |
| 10 | 10 | test/RTM.md | 🟡 | Fixed | F1-7 业务结果加了一条「机器不会自己把局面走成第三次重复而判长将负」，入口栏注明由 `test/ai.test.ts` 驱动；`docs/design/modules/ai.md` §8 的 delta 行同步（「本批给 F1-7 加一条业务结果」）。 |
| 11 | 11 | docs/design/modules/ai.md | 🟡 | Fixed | 已写「发请求时读会话的 `history` 与 `startFen`（`GameSession` 已有这两个字段，不新增状态）」；核对 `src/client/game/session.ts`，`GameSession` 确有 `readonly startFen: string;` 与 `readonly history: readonly HistoryEntry[];`，声明成立。 |
| 12 | 12 | docs/design/modules/ai.md | 🔵 | Accepted | 代价行的读数改成「高手档的实跑读数在收口行给出」——真时钟读数只能收口实测，设计层给不出；理由成立，不阻塞。 |
| 13 | 13 | docs/design/modules/ai.md | 🔵 | Accepted | 自然限着不建模的理由行未变且仍成立：局面级判罚由 `judgeGame` 兜住，最坏只是落后方 AI 不去求 120 着和棋。 |
| 14 | 14 | docs/design/modules/ai.md | 🔵 | Fixed | 分档结论行仍在（「无文件跨 500 行档，无 300+ 行单函数」）。本次抽查本批源码行数：`src/shared/ai/search.ts` 276、`src/shared/rules.ts` 158、`test/ai.test.ts` 184、`src/shared/ai/index.ts` 43、`src/client/ai/protocol.ts` 22、`src/shared/types.ts` 59 —— 均远低于 500 行档，结论成立。 |
| 15 | (new) | docs/design/modules/ai.md | 🟡 | New | 「复现（当前行为，未修）：…这条用例在修之前是红的——它同时是验收用例。」`src/shared/ai/search.ts` 已有 `repetitionScore`，文档仍称「未修」，且「在修之前是红的」是修订史叙述，与 AGENTS.md「设计文档只写『现在是什么』」相反。🟡 报告，不阻塞（非 must-fix）。 |
| 16 | (new) | src/shared/ai/search.ts | 🔵 | New | `PathNode` 的 `readonly key: string;` 存了没人读，`leave()` 又用 `const key = positionKey(position);` 重算，与注释「路径上的一格：局面 + 它的键（出节点时要用，别重算一遍）。」相反；顺带 `docs/design/modules/ai.md` 的「每个节点多一次 `positionKey`」实际为 enter / repetitionScore / leave 三次。不影响正确性，记录即可。 |
| 17 | (new) | docs/design/rules-engine.md | 🔵 | New | §9 的 `src/shared/types.ts` 一行仍写「§2 的全部类型」，但 `RepeatEntry` 定义在 §6.1、实际落在 `src/shared/types.ts`，该行没跟上。文档卫生级。 |

计数：🔴 0 · 🟡 1（New，非 must-fix）· 🔵 4；上一轮 14 项全部收口（Fixed 12 / Accepted 2），新发现无 🔴。

VERDICT: pass

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



**实现**

| 文件 | 改动 |
|---|---|
| `src/shared/types.ts` | 新增 `RepeatEntry`（`fen` + `gaveCheck`）：判罚只读这两项 |
| `src/shared/rules.ts` | `repetitionResult` 入参从 `HistoryEntry[]` 放宽为 `RepeatEntry[]`；判罚逻辑一字未动 |
| `src/shared/ai/search.ts` | `SearchLimits` 加 `history` / `startFen`；上下文记局面键计数与路径；节点进出时计数 +1 / −1；第三次出现调 `repetitionResult` 计分（胜方 = 行棋方取正、对手取负、和棋 0、不成环按非终端） |
| `src/shared/ai/index.ts` | `AiOptions` 加必填 `history` / `startFen` |
| `src/client/ai/protocol.ts` | `AiRequest` 加两个字段 |
| `src/client/ai/engine.ts` | `request(fen, level, history, startFen)` 透传 |
| `src/client/ai/worker.ts` | 协议字段转给 `chooseMove` |
| `src/client/pages/AiPage.tsx` | 发请求时带 `session.history` 与 `session.startFen`（会话本来就有） |
| `test/ai.test.ts` | 两条新用例；既有用例补必填参数 |
| `test/ai-engine.test.ts` | 请求形状补两个字段 |

**复现**：四步长将循环（红车在 4 / 3 两列往返将军，黑将在 (4,0) 与 (3,0) 间躲）走满七着后，同一局面已出现两次。不带历史时引擎选中循环着，把局面送到第三次、由规则判它长将负；带上历史后改走别的着法。两次运行都跑过。

**修的过程中抓到的一个真错误**：第一版把 `verdict.winner === position.turn` 写成负分——那是赢，应为正。复现脚本当场暴露（带着历史照样选循环着），改符号后两条用例转绿。

**评审后的收尾**：三条非阻塞意见一并处理——设计档的「未修」改写成现在时的复现口径；`PathNode.key` 存下后由 `leave` 复用，省掉每节点一次重算；规则档 §9 的文件表补上 `RepeatEntry`。

**验证**

- `node --test test/ai.test.ts`：10 条全过（含新增两条）。
- `npm run check`：253 单测（+2）/ 68 前端用例，0 失败；类型检查通过。
- 两条新用例各带反证：先断言 `judgeGame` 对那条线真的判「长将负」或「重复判和」，再断言 AI 不选它。

## §6 验证与收口（父代理）
