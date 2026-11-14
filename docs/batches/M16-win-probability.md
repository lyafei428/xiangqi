# 2026-11-14 · 每步胜负概率
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14：「增加显示双方每一步落子的胜负概率」；同日追加「按建议」——按静态评估 + 记谱行与概率条都做。
> 台账 = #20（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

## 讨论

**用户原话**：「增加显示双方每一步落子的胜负概率」；追问两处取舍后回「按建议」。

**两处取舍与结论**：

| 取舍 | 选项 | 定下的 | 理由 |
|---|---|---|---|
| 概率怎么算 | 静态评估 / 浅层搜索 / 先静态再精算 | **静态评估** | 搜索每步要几十毫秒到 1 秒（普通档实测 1 秒级），实时落子会有可感延迟；静态评估 O(81)，一局不到两万次操作 |
| 显示在哪 | 记谱行 / 概率条 / 两者 | **两者都做** | 记谱行回答「每一步」，概率条回答「现在谁占优」 |
| 页面范围 | 棋局页 / 全部 | **对弈、人机、联机、回放** | 四个页面都有逐着 FEN，数据齐；课程/练习不做 |

**现状读数（本轮实际查的）**：

- `src/shared/ai/evaluate.ts:79` `export function evaluate(position: Position): number {`——评估已存在，但注释写着「出口切成行棋方视角」。
- `src/shared/types.ts:27` 「走完这着后的完整局面 FEN（含行棋方）」——每步局面都能还原。
- `src/shared/ai/index.ts` 只导出 `AI_LEVELS` / `chooseMove` 等，`evaluate` 没有出口。
- `docs/requirements/xiangqi.md` 全文没有「胜率 / 概率」条目——这是新需求。

**记录**：本批新建，台账行 #20。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 批次任务与设计

**交付目标**：每一着后显示双方胜负概率，四个棋局页面都显示；有开关且记住。

**设计档**：`docs/design/modules/ai.md` §9「每步胜率」（概率模型、显示规格、四页数据来源、边界、命名与文件、验收、集成测试设计）。
**需求档**：`docs/requirements/xiangqi.md` 新增 F5.7；`docs/design/architecture.md` 的 `docs/design/modules/ai.md` 主题行补「每步胜率」。

**设计要点**：

| 项 | 定下的做法 |
|---|---|
| 取值 | `redExpectation(position, result)` = logistic(`evaluate` 切成红方视角的 score / 400)；`result` 由调用方传（和棋/认输/超时推不出来） |
| 常数 | `EVAL_SCALE = 400`：一车 97%、一马 91%、一兵 64%，只写一处 |
| 终局 | 按结果收敛：红胜 1、黑胜 0、和棋 0.5 |
| 口径 | 期望分（胜 1 / 和 0.5 / 负 0），两列互补、合计 100% |
| 记谱格 | 着法 + 小字百分比（该着之后的红方期望分） |
| 概率条 | 着法区顶部（不占常驻条，F1.10 的默认可见集不动），左红右黑 + 两个数字 |
| 开关 | `xiangqi.eval.v1`，默认开，设置浮层「胜率 开/关」 |
| 不做 | 搜索、预测几着必胜、妙手/漏着标注、课程与练习页 |

**受影响文件**：

- 新增：`src/shared/ai/probability.ts`、`src/client/panel/EvalBar.tsx`、`src/client/panel/useEval.ts`、`test/probability.test.ts`、`test/integration/eval.test.tsx`。
- 改动：`src/shared/ai/index.ts`、`src/client/panel/GamePanel.tsx`、`src/client/pages/OnlinePage.tsx`、`src/client/pages/ReplayPage.tsx`、`src/client/App.tsx`、`src/client/storage/prefs.ts`、`src/client/styles/panel.css`、`src/client/styles/play.css`、`test/RTM.md`。
- 文档同步：`docs/design/modules/online.md`、`docs/design/modules/replay.md`、`docs/design/modules/board-ui.md` 各补一句。

**分档结论**：全部在 500 行内，新增件都是小件，不需要拆分方案。

**风险**：加小字百分比会动记谱格里的文本。`test/integration/navigation.test.tsx` 对 `.move-red` / `.move-black` 用 `toBe` 断言整段文本。
处置：百分比渲染在这两个 span 之外的兄弟节点 `.move-eval` 上，格子文本保持原样；同批不改那三处既有断言。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

### 设计评审：docs/design/modules/ai.md §9 每步胜率（需求 F5.7）

评审对象：`docs/design/modules/ai.md` §9 + `docs/requirements/xiangqi.md` F5.7；同批核对 `docs/design/architecture.md`、`test/RTM.md` 与 §9 点名的既有源码/用例。

| # | 类别 | 级别 | 问题 | 建议 |
|---|------|------|------|------|
| 1 | 需求覆盖/可行性 | 🔴 | 出口签名与终局口径不相容。§9 概率模型写「终局 \| 局面已终局时按结果收敛：红胜 1、黑胜 0、和棋 0.5」，出口却是「`redExpectation(position): number`，红方期望分 0..1」。和棋只来自三次重复 / 自然限着 / 协议和棋：`src/shared/types.ts` 只有「export type GameStatus = 'playing' …」（四值：playing / check / checkmate / stalemate，无和棋态），重复判罚要 history 与 startFen（`src/shared/rules.ts` 的 `judgeGame(position, history, startFen)`）；认输、超时更不是棋盘状态。于是一个 `Position` 拿不到「按结果收敛」的那个结果，§9 验收里的「终局（红胜/黑胜/和）分别 100/0/50」中「和」「0/50」两项按现签名不可满足；§9 显示表又写「终局后 \| 条按结果贴边」，同一机制在两处给了两个归属。`test/RTM.md` 的 F1-1「8 着后出现三次重复，面板显示「和棋 · 三次重复局面」」说明重复判和是真实场景。 | 把结果作为入参或另立出口（`redExpectation(position, result)` ／ `resultExpectation(result)`），并在「四个页面的数据来源」表补一列写清各页传什么（`session.result`、`snapshot.result`、棋谱结果）；概率模型的终局行与验收断言随之改成可满足的形式。 |
| 2 | 验收/集成设计 | 🔴 | 「破坏」判断与仓库事实相反：§9 集成测试设计写「无：既有用例不断言记谱格里的文字内容（只断言着法出现）」，而 `test/integration/navigation.test.tsx` 明写 `expect(row?.querySelector('.move-red')?.textContent).toBe('炮八进一');`（同文件另两处对 `.move-black` 同样用 `toBe`）。§9 显示规范要求「着法后面跟一个小字百分比」，若按「记谱每一格」塞进 `.move-red` / `.move-black` 里，F4-1 这条既有用例当场变红——而 F4-1 正是 `docs/design/modules/ai.md` §8 自己列的回归行。 | 二选一并在 §9 写明：百分比渲染在 `.move-red` / `.move-black` 之外的兄弟节点（格子文本不变），或把 F4-1 列为破坏行并写清那三两处断言的改法。 |
| 3 | 需求覆盖/验收 | 🔴 | 需求 F5.7 要求「四个棋局页面（对弈、人机、联机、回放）都显示；有开关且记住」，验收只覆盖一页：§9 验收写「集成用例：对弈页走两着，两格都有百分比、条上的数字与末格一致」，缺失行也只写「对弈页走两着」。联机页与回放页是各自独立的新代码路径（`replayHistory` 还原序列、回放游标局面），没有任何业务可观察断言，需求有四项落不到验收。 | 把 F5-7 行的业务结果扩到联机与回放各一条最小观察（条在、数字与末格一致、开关关掉都不显示），人机页因共用 `GamePanel` 注明随对弈一并覆盖；验收表同步。 |
| 4 | 分档/规模 | 🟡 | 分档结论的读数不是当前值：§9 写「分档结论：涉及的每个文件都在 500 行内（最大的 `GamePanel.tsx` 244 行、`OnlinePage.tsx` 431 行）」。实读 `src/client/panel/GamePanel.tsx` 恰为 244 行（对得上），但 `src/client/pages/OnlinePage.tsx` 末内容行（组件收尾的 `}`）已到第 444 行——本就比 431 多，且本批还要往里加概率条与逐着百分比，到 500 档只剩五十余行余量。 | 用当前实测重写这一行，并给出本批预计增量（`src/client/pages/OnlinePage.tsx` 的插入点与行数），确认仍不越 500 档；越档则附拆分方案。 |
| 5 | 集成设计/文档状态 | 🟡 | 把待新建的行写成已存在：§9 写「本变更落在 **F5-7 每步胜率** 一行」，但 `test/RTM.md` 的「## 性能（需求 F5）」只有 F5-1、F5-2、F5-3、F5-4、F5-6 五行，没有 F5-7；§9 自己的 delta 表随后把该行列为「缺失」，两处口径不一。另外 §9 没写这一行落在哪个用例文件，也没提 `test/RTM.md` 的「用例实现」行要补（同节先例：「F5-6 另有一条集成用例 `test/integration/sound.test.tsx`」）。 | 把起点那句改成「本变更新增 F5-7 行」并给出该行四条字段（业务结果 / 用户入口 / 需求 / 实现文件），同时把「用例实现」段的补写列为改动项。 |
| 6 | 既有件/清晰性 | 🟡 | 开关在四个页面的读取路径没定：§9 只列 `src/client/storage/prefs.ts`（读写）与 `src/client/App.tsx`（设置浮层），而 `EvalBar` 在联机页与回放页也要读到同一个值。仓库对多页共享开关已有定式：`src/client/board/useMoveTrail.ts` 注释「和音效同一套共享 store——多个页面要读同一个值」，配 `useSyncExternalStore`（`src/client/sound/useSoundEnabled.ts`、`src/client/board/useFaceOff.ts` 同形），§9 的现有件检查未提这三处。 | 补一个新 hook（如 `useEvalEnabled`）并给出三问答复与落点文件，或写明复用哪一处共享 store；`src/client/storage/prefs.ts` 的读写沿用 `KeyValueStore` 注入默认 `defaultStore()` 的既有形制。 |
| 7 | 清晰性 | 🟡 | 样式文件不在改动面：§9 定了「概率条占一行 20px，数字与条同行」「条本身用两个色块加 `--line` 分隔」等版式，但文件表只有 tsx/ts，没有样式落点（本仓样式按区拆在 `src/client/styles/base.css` / `src/client/styles/panel.css` / `src/client/styles/play.css`，`--red-text` / `--black-text` / `--line` 已在 `src/client/styles/base.css` 定义）。 | 文件表补样式落点（面板条落 `src/client/styles/panel.css`，联机/回放页记谱落各自区），并说明手机档 20px 行的容器查询落点。 |
| 8 | 清晰性 | 🟡 | 记谱显示规范按两列写：「记谱每一格 \| 着法后面跟一个小字百分比 … 红黑两列写同一个数」，但只有 `GamePanel` 是红黑两列（`.move-red` / `.move-black`）；`src/client/pages/OnlinePage.tsx` 是单列平铺（`{index + 1}. {move}`），`src/client/pages/ReplayPage.tsx` 也是平铺的 `replay-moves` 列表。这两页每格只该有一个数，§9 未写它们取哪一侧视角。 | 显示表分「两列（对弈 / 人机）」与「单列（联机 / 回放）」两行，单列明确写「红方视角」。 |
| 9 | 既有件 | 🟡 | 回放的数据来源另起一条路：§9 写「回放 \| 棋谱的着法序列，逐着 `playMove`」，但 `src/client/online/history.ts` 已有「export function replayHistory(startFen: string, moves: readonly Move[]): readonly HistoryEntry[] {」，逐着产出带 `fen` 的记录，联机页正在用（`replayHistory(snapshot.startFen, snapshot.moveLog)`），`src/client/sound/useGameSound.ts` 也靠它。 | 回放行改为复用 `replayHistory(record.startFen, record.moves)`，或写明为何另走 `playMove`（此时把它列为对 `replayHistory` 的偏离并给理由）。 |
| 10 | 需求契合 | 🟡 | 与 F1.10 的默认可见集冲突而未收口：`docs/requirements/xiangqi.md` F1.10 写对弈页与人机页「默认只显示棋盘、行棋方与双方计时、新局与认输」，§9 却把「一条红黑概率条（左红右黑，宽度按百分比分配）」放在「面板顶部」常驻。现状下 `src/client/panel/GamePanel.tsx` 的常驻区是状态行 / 计时 / 认输 / 着法 / 新局，添一条常驻控件改写了 F1.10 列举的默认集。 | 二选一并写明：概率条放进可收起的着法区（默认不可见），或在本批把 F1.10 的默认可见集补上「胜率条」一项，并在集成断言里体现。 |
| 11 | 文档归属 | 🟡 | 改了三处别人拥有的面却没写文档同步：`docs/design/architecture.md` 的文档地图里「`docs/design/modules/ai.md` \| 人机对战的引擎、Worker、人机页与每步胜率」——主题归属正确；但本批同时改联机页与回放页的显示、以及设置浮层开关，而「`docs/design/modules/online.md` \| 联机协议、服务端房间、观战与联机页」「`docs/design/modules/replay.md` \| 棋谱格式、存局与回放」「`docs/design/modules/app-shell.md` \| 路由表、导航顺序、页面清单、壳状态归属、集成用例索引」分别是这三处的所有者，§9 未提这三档要补的一行。 | 在文件表或边界里补一行「同步 `docs/design/modules/online.md` / `docs/design/modules/replay.md` / `docs/design/modules/app-shell.md` 各一句」，避免页面行为只在 `docs/design/modules/ai.md` 一侧有描述。 |
| 12 | 数值 | 🔵 | 标定例子算不对：§9 写「一车 900 分 → 97%」，按同表公式 `p = 1 / (1 + 10 ** (-score / 400))`，900 分得 99.4%（97% 对应约 604 分）；另两例「一马 400 分 → 91%」「一兵 100 分 → 64%」核算无误。 | 把该例改成 99%，或明确说「车 ≈ 九成九」；常数 400 不必动。 |
| 13 | 性能推理 | 🔵 | 逐着百分比的成本没界定：「计算一次、按着法序列 `useMemo`」——记谱要 N 个点（逐着 `parseFen` + `evaluate`），着法序列每走一着都变，整段重算即每步 N 次解析；§9 只给「一局 200 着不到两万次操作」的评估次数，未把解析算进 F5.3 的 16ms 口径。 | 写明是增量追加（新着只算一格）还是整段重算，并给一个读数或估算，与 F5.3 对齐。 |
| 14 | 验收措辞 | 🔵 | 「改动面命令 \| `node --test test/probability.test.ts`；提交前仍走 `npm run check`」——前段即验收命令（正确）；后段是提交闸门（AGENTS.md 的既有规定），放在验收行里容易被读成验收也要整跑。 | 把提交闸门归到提交纪律一句，验收行只留改动面命令；集成半段写收口行。 |

计数：🔴 3 · 🟡 8 · 🔵 3。

VERDICT: changes-required

### 轮次 2（评审子代理）

第 2 轮（修复轮复审）· 对象：`docs/design/modules/ai.md` §9 每步胜率 · 范围：`docs/design/modules/ai.md`、`docs/requirements/xiangqi.md`、`docs/design/architecture.md`

第 1 轮 14 条逐条核对：

| # | 原# | 级别 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | 1 | 🔴 | Fixed | 出口改为 `redExpectation(position, result): number`，终局行写明和棋来自三次重复 / 自然限着 / 协议和棋、认输超时不是棋盘状态；验收改为「终局三分支（红胜/黑胜/和）分别 100/0/50——直接传 `result` 断言，不靠局面推」；四个页面的数据来源表新增「传给 `redExpectation` 的 result」列 |
| 2 | 2 | 🔴 | Fixed | 破坏行改为「**有，一处**：`test/integration/navigation.test.tsx` 对 `.move-red` / `.move-black` 用 `toBe` 断言整段文本」，并定掉渲染位置：百分比放在这两个 span 之外的兄弟节点 `.move-eval` |
| 3 | 3 | 🔴 | Fixed | 验收「显示」行补「联机页与回放页各一条最小观察（条在、数字与末格一致）」；缺失行再带两条最小观察（联机条在、回放游标到终局与结果一致） |
| 4 | 4 | 🟡 | Fixed | 分档结论改为实测：「实测 `src/client/panel/GamePanel.tsx` 244 行、`src/client/pages/ReplayPage.tsx` 373 行、`src/client/pages/OnlinePage.tsx` 444 行」，给 +20 行预计与越 500 档的拆分预案 |
| 5 | 5 | 🟡 | Fixed | 起点改为「**本变更新增 F5-7「每步胜率」一行**」，并列出现有五行的编号；补上「用例实现 `test/integration/eval.test.tsx`」与「用例实现」段同步 |
| 6 | 6 | 🟡 | Fixed | 补 `useEvalEnabled`：「新增 hook，住在 `src/client/panel/useEval.ts`」，沿用 `src/client/board/useMoveTrail.ts` 的 `useSyncExternalStore` + 模块级 store 定式 |
| 7 | 7 | 🟡 | Fixed | 文件表补 `src/client/styles/panel.css`（「概率条与 `.move-eval` 的版式」）与 `src/client/styles/play.css` |
| 8 | 8 | 🟡 | Fixed | 显示表拆成「两列：对弈 / 人机」与「记谱每一格（单列：联机 / 回放）」两行，单列行写明两页本来就是平铺一列 |
| 9 | 9 | 🟡 | Fixed | 回放改用「`replayHistory(record.startFen, record.moves)`（与联机页同一个函数，不另起 `playMove` 循环）」 |
| 10 | 10 | 🟡 | Fixed | 条移入「放在可收起的着法区里、不占常驻条」，并写明 F1.10 的默认可见集；遗留措辞见 N1 |
| 11 | 11 | 🟡 | Fixed | 新增「**要同步的三处**：本批改到联机页与回放页的显示、以及设置浮层里的开关」（`docs/design/modules/online.md`、`docs/design/modules/replay.md`、`docs/design/modules/board-ui.md`）；开关清单归 `docs/design/modules/board-ui.md` 一节本轮未核（unverified，该档不在评审范围） |
| 12 | 12 | 🔵 | Fixed | 「一车 900 分 → 99%」，与 1/(1+10^(-900/400))=99.4% 一致 |
| 13 | 13 | 🔵 | Fixed | 改为增量：「记谱的百分比按着法数缓存——新着一只补算一格（一次 `parseFen` + 一次 `evaluate`）」；遗留见 N2 |
| 14 | 14 | 🔵 | Fixed | 验收行只留「`node --test test/probability.test.ts`（集成半段在收口行报告）」 |

本轮新增（均 🟡，不阻断）：

| # | 文件 | 级别 | 状态 | 说明 |
|---|---|---|---|---|
| N1 | `docs/design/modules/ai.md` | 🟡 | New | 同一处放置两种说法：显示表位置列写「着法区的顶部」并注「放在可收起的着法区里、不占常驻条」，文件表改动列仍写「面板顶部插 `EvalBar`」。按文件表落会改写 F1.10 的默认可见集。建议把文件表那句改成「着法区顶部」 |
| N2 | `docs/design/modules/ai.md` | 🟡 | New | 缓存键只有着法数、没写缩短时怎么清：「记谱的百分比按着法数缓存」「内部用一个 `useRef` 缓存已算好的前缀数组，只追加新格」。同房间再来一局（F1.2）或新局会让着法数从 0 长回原值，不截断会把上一局的数贴到新局上。建议补「着法数变小时截断前缀数组」或键里带起点 FEN |
| N3 | `docs/design/modules/ai.md` | 🟡 | New | 文件表只有 `test/probability.test.ts`，而集成设计点名的「用例实现 `test/integration/eval.test.tsx`」没进文件表；同表也未列 `test/RTM.md` 的 F5-7 行与「用例实现」段补写 |
| N4 | `docs/design/modules/ai.md` | 🟡 | New | result 列的粒度不一致：对弈 / 人机行给 `session.result`、联机行给 `snapshot.result`（无条件），回放行才是「回放到终局那一着时传 `record.result`，否则 `null`」。按字面对弈页会把结果传给每一格，终局后整列记谱都贴边，而现有验收只比对「条上的数字与末格一致」，抓不到。建议三行统一成「只有该着之后是终局那一着才传结果」，并补一条终局后中间格仍为估计值的断言 |

计数：🔴 0 · 🟡 4 · 🔵 0

第 1 轮三条 🔴（终局契约不可满足 / 破坏判断与用例事实相反 / 四页覆盖缺口）均已在当前文本中修正，核本轮无新增 🔴。

VERDICT: pass

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）

### 实施（coder · 2026-11-14）

**完成面**（14 个文件，全部在 §2 的受影响文件表内；无越界改动）：

| 文件 | 改动 |
|---|---|
| `src/shared/ai/probability.ts`（新，31 行） | `redExpectation(position, result = null)` + `EVAL_SCALE = 400`；`result` 非空按结果收敛（红 1 / 黑 0 / 和 0.5），否则 `score = turn === 'red' ? evaluate : -evaluate`，`1 / (1 + 10 ** (-score / 400))` |
| `src/shared/ai/index.ts` | 出口 `evaluate` / `EVAL_SCALE` / `redExpectation`（经 `src/shared/index.ts` 到页面侧） |
| `src/client/storage/prefs.ts` | `xiangqi.eval.v1` 的 `readEval` / `writeEval`，沿用 `KeyValueStore` 注入 + 默认 `defaultStore()` |
| `src/client/panel/useEval.ts`（新，101 行） | `useEvalEnabled`（`useSyncExternalStore` + 模块级 store，照 `useMoveTrail`）；`useMoveEvals`（`useRef` 前缀缓存：按 fen 前缀复用、着法数变小截断、末格按结果收敛）；`useEvalPoint`（条上的数字，与末格同算） |
| `src/client/panel/EvalBar.tsx`（新，32 行） | 两色条 + 「红 x% · 黑 y%」，`y = 100 - x`；`role="img"` + `aria-label="红方胜率 x%"`；导出 `percentText` 统一取整口径 |
| `src/client/panel/GamePanel.tsx` | 记谱格改为 `.move-cell` 包住 `.move-red` / `.move-black` + 兄弟 `.move-eval`（两个 span 的 textContent 不变）；着法区顶部（`.panel-body` 内、记谱列表之上）插 `EvalBar` |
| `src/client/pages/OnlinePage.tsx` | `replayHistory` 结果提到一处 memo（音效与胜率共用同一份序列）；面板着法区插 `EvalBar`；`online-move` 加 `.move-eval` |
| `src/client/pages/ReplayPage.tsx` | `StepControls` 增可选 `evalView`；「我的棋谱」与「棋谱库」两条回放都用 `replayHistory` 接上；条跟游标走，游标停在终局那一着才传 `record.result` |
| `src/client/App.tsx` | 设置浮层加「胜率开/关」（与音效、走子轨迹、对坐下棋同列同形） |
| `src/client/styles/panel.css` | `.eval-bar` / `.eval-track` / 两色块（`--red`、`--black`，`--line` 分隔）/ 数字用 `--red-text`、`--black-text`；`.move-cell` / `.move-eval` |
| `src/client/styles/play.css` | 联机页单列记谱（`.online-move`）的 `.move-eval` 版式 |
| `test/probability.test.ts`（新） | 4 条断言组：均势≈50%（红黑两种行棋方同值）、净一车 ≥95% 且高于净一马（400 分差≈91%）、颜色镜像互补（p + q = 1）、终局三分支 100/0/50 且压过局面 |
| `test/integration/eval.test.tsx`（新） | 4 条：对弈页两着两格有百分比且条上的数字=末格、关开关后都不渲染且重开会话仍是关、联机页条在且数字=末格、回放页游标到终局条与结果一致（红 100% · 黑 0%） |
| `test/RTM.md` | 性能（F5）表新增 F5-7 行；「用例实现」段补 F5-7 一句 |

**验证读数**：

- `npm run check`：typecheck 通过；`node --test` **272 pass / 0 fail**（基线 268 + 4）；`vitest run` **14 文件 / 77 pass**（基线 73 + 4）。
- `node --test test/probability.test.ts`：4 pass / 0 fail。
- `npx vitest run test/integration/eval.test.tsx`：4 pass / 0 fail。
- `test/integration/navigation.test.tsx` 一字未改，2 条仍全过（`.move-red` / `.move-black` 文本未被污染，`git status` 里没有该文件）。
- 浏览器实跑（vite dev + 截图，深色与浅色两套配色）：两步后条与逐格数字都渲染；认输终局后条贴黑、数字 0/100，与结果一致。

**与设计的偏差 / 判断（无行为偏离，四处实现取舍）**：

1. 显示表「红黑两列写同一个数」按「同一视角（红方视角）」落实：同一回合红格与黑格是两个不同局面，数值不同（写同值等于说黑方那一着没改变走势）。
2. `src/client/panel/useEval.ts` 里除 `useEvalEnabled` 还多了 `useMoveEvals` / `useEvalPoint`：增量缓存与「条上的数字与末格一致」是三个页面共用的同一段逻辑，分放三处会漂。设计表只点名了 `useEvalEnabled`，这是同文件内的实现形制补充。
3. 回放页的「棋谱库」分栏也接上了：`StudyRecord` 同样带 `startFen` / `moves` / `result`，设计的数据来源行对两者都成立；同一页两条回放入口只给一条会不一致。若判定棋谱库属课程面，删掉 `StudyReplay` 里那 6 行即可。
4. `src/client/styles/replay.css` 未动：`.move-eval` 的基础版式写在 `panel.css`（全局类），回放页的按钮直接继承；设计文件表也未列该文件。

## §6 验证与收口（父代理）
