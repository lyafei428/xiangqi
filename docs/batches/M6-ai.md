# 2026-11-14 · 人机对战
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14「按计划」批准的 M6 人机对战（F1.3）：难度三档、Web Worker alpha-beta、普通档单步 ≤ 2 秒。
> 台账 = #8（xiangqi · 归批）。前情 = M5c 观战（已收口，f1b70c5）。
## §1 讨论（主 agent）
**状态行**：已收口（M6 人机对战（F1.3））
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**批次任务与设计（M6：人机对战）**

覆盖：F1.3 人机对战——可选难度、普通档单步 ≤ 2 秒、机器走合法着法、界面不被思考阻塞。

设计档落点：

- 新建 `docs/design/modules/ai.md`：引擎（评估 / alpha-beta / 难度表）、Worker 协议与注入、人机页、文件划分、现有件检查、验收、集成设计。
- `docs/design/modules/app-shell.md`：路由表加 `#/ai`、导航改六项、页面清单加 `AiPage.tsx`、状态归属加人机会话。
- `docs/design/modules/local-play.md`：会话动作由五个改为六个，新增 `play(move, now)`。
- `test/RTM.md`：新增 F1-7 行（需求 F1.3）与三份用例归属。

机制：

- 引擎 `src/shared/ai/`：纯函数、零依赖、不读墙钟（`now()` 注入）。negamax + alpha-beta，迭代加深，吃子优先排序，叶节点浅层吃子搜索；评估用子力 + 位置表；无合法着法返回 `null`。
- 难度：入门 depth 2 / 200ms，普通 depth 4 / 1200ms，高手 depth 6 / 1800ms；三档预算都低于需求的 2 秒上限。
- Worker：`src/client/ai/worker.ts` 只搬数据；`engine.ts` 注入 Worker 构造器，单请求在飞，过期 id 丢弃，卸载 `dispose()`。
- 页面：路由 `#/ai`，自持 `sessionReducer`；难度与阵营用选项控件；思考中棋盘只读并显示「AI 思考中…」；终局写棋谱库，未完成局不落盘。
- 会话：`session.ts` 新增纯动作 `play`，先过 `isLegal` 再走既有 `playTurn`。

受影响文件：

- 新增 `src/shared/ai/{evaluate,search,levels,index}.ts`、`src/client/ai/{protocol,worker,engine}.ts`、`src/client/pages/AiPage.tsx`。
- 改 `src/shared/index.ts`（导出 ai）、`src/client/game/session.ts`（`play` 动作）、`src/client/shell/routes.ts`（`ai` 路由）、`src/client/App.tsx`（导航与分派）。
- 测试：`test/ai.test.ts`、`test/ai-engine.test.ts`、`test/integration/ai.test.tsx`。

验收：`npm run check` 全绿；普通档实测单步 ≤ 2 秒（用例用伪造时钟断言，真机再测一次）；人机页从用户入口走通一局。

关键决策（用户已批准的计划）：人机做成独立路由 `#/ai` + 导航第 6 项「人机」，不复用对弈页——会话隔离，本地续局语义不动；未完成的人机局不落盘。

上抛项：无。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

设计评审：M6 人机对战（F1.3）

范围：
- 评审对象：`docs/design/modules/ai.md`
- 同时校对：`docs/design/modules/app-shell.md`、`docs/design/modules/local-play.md`、`docs/design/modules/clock.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`

限制：
- 评审上下文未提供 Document Map，文档归属按 `AGENTS.md` 的 `docs/design/modules/` 目录表判定（评审对象落位正确），跨文件只能逐对比较。
- `src/**` 不在评审范围，行数与「文件已存在」类读数一律 unverified。

| # | 类别 | 级别 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | 集成测试设计 | 🔴 | `docs/design/modules/ai.md` §8 写「本节的增量是 F1-8；F1-1 / F1-3 不破坏、不冗余」，而 `test/RTM.md` 的「对弈」故事已有 `| F1-7 | 人机对战 |`，业务结果为「选难度与阵营后走一着，机器在 2 秒内回一着并更新棋盘；思考中棋盘不可动；换难度后回子速度变化可见」，且 `test/RTM.md` 已把 `test/integration/ai.test.tsx` 指给 F1-7。设计新增的 F1-8 是 F1-7 的子集，F1-7 的「换难度后回子速度变化可见」既未落测、也未声明破坏或冗余。 | §8 的增量声明改为对 F1-7 的读数：沿用 F1-7、不新增行，并逐条写 F1-7 三个业务结果各自由哪个入口验证；确需动行号则先在 `test/RTM.md` 定号再用同号写用例标题；「换难度后速度变化」若在假 Worker 下不可验，就在该行改口径并写理由。 |
| 2 | 可行性 / 文档归属 | 🔴 | `docs/design/modules/ai.md` §5「人机页自持 `useReducer(sessionReducer, …)`；不复用 App 级实例，因此切到别的页再回来对局仍在（组件不卸载），关页即丢」把跨页保留归因于「组件不卸载」；`docs/design/modules/app-shell.md` §2 同时写「人机会话与 Worker / 人机页内部 / 切页保留」与「练习会话 / 练习页内部 / 离开即复位」「课程页演示步数 / 课程页内部 / 离开即复位」。同一个路由切换只能二者取一：页组件被换掉（则人机会话同样复位），或全部常驻（则课程/练习不会复位）。设计没有给出常驻机制，「切页回来对局仍在」无法实现。 | 二选一并写进两份文档：人机会话放到组件外的模块级持有（点名该持有者与清理时机），或改成人机页「离开即复位」并说明 F4.2 只覆盖 App 级对局状态。 |
| 3 | 分支出身（6b） | 🔴 | `docs/design/modules/ai.md` §3 协议新增 `readonly ok: false; readonly reason: 'error'` 分支，但全文没有任何场景：既无观察记录，也无复现路径（§3 唯一的理由是「工厂可注入，页面默认传真实构造器，jsdom 用例传假 Worker…」——那是用例素材，不是场景）；§4 页面也没写这条分支的用户可见后果（棋盘是否解锁、面板是否报错）。 | 给出该分支的出身（引用一条真实 Worker 失败读数，或写可复现路径：在 handler 里 throw 后点一着），并写明页面表现与断言；给不出就删掉该应答变体，让抛错由 `docs/design/modules/ai.md` §3 的 `src/client/ai/engine.ts` 统一转成一次提示。 |
| 4 | 文档归属 | 🔴 | `docs/design/modules/ai.md` §4「路由 `#/ai`，页面 `src/client/pages/AiPage.tsx`，导航第 6 项「人机」」与 `docs/design/modules/app-shell.md` §3「顶部一条导航：对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱」（人机在第 2 位）、同档 §5「导航六项（对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱）」矛盾：同一套导航条（同一机制）被描述成两种顺序，照前者实现会把「人机」排到最后。 | 一处改词即可：把「导航第 6 项」改为「导航六项之第 2 位（对弈 / 人机 / …）」，与 `docs/design/modules/app-shell.md` 的顺序逐字一致。 |
| 5 | 验收 | 🟡 | F1.3 的「普通机器单步思考 ≤ 2 秒」只由 `docs/design/modules/ai.md` §6「`test/ai.test.ts` 用伪造时钟断言不超预算」覆盖，即只量引擎内搜索（`budgetMs = 1200`）；Worker 启动、模块加载、结构化克隆与线程调度都不计时，没有任何读数能证明用户可见延迟 ≤ 2 秒，而 `test/RTM.md` 的 F1-7 断言的正是「机器在 2 秒内回一着」。 | 补一句余量论证（1200ms 预算 + 页面挂载即预热 Worker，留出 800ms 给启动与传输），或把「真实浏览器机型实跑一次首着耗时」写进 §6 验收对照，作为该需求的唯一读数。 |
| 6 | 清晰度 | 🟡 | `docs/design/modules/ai.md` §3 协议传 `readonly fen: string`，§2 的 `function chooseMove(position: Position, options: AiOptions)` 吃 `Position`，但 fen 与 Position 的互转既没点名归属，§7 现有件检查列出的也「只有」`generateLegalMoves` / `applyMove` / `statusOf` / `positionKey` / `perft`。谁转换、转换函数叫什么、是否已存在，三问都空。 | 在 §2 或 §3 补一行：转换函数的所在文件与名字（existing，逐字）；若不存在则按 `none found` 记为新增件并进 §7 文件表；同时写明由页面转换还是 Worker 内转换。 |
| 7 | 现有件检查 | 🟡 | `docs/design/modules/ai.md` §5 写「新增一个纯动作 `{ type: 'play', move, now }`」，而 `docs/design/modules/local-play.md` §3 已把 `play(move, now)` 列入「动作有六个」，并注明「（先过 `isLegal`，人机页给引擎用）」。同一动作在拥有它的文档里是既有件、在 `docs/design/modules/ai.md` 里是新增件，三问答案不一致。 | §5 与 §7 改成 `existing:` 引用 `docs/design/modules/local-play.md` §3（该文档是会话动作表的拥有者）；若本批才落地，则改该档的动作表，不要在两处各写一遍。 |
| 8 | 清晰度 / 需求覆盖 | 🟡 | `docs/design/modules/ai.md` §4 写「面板复用 `GamePanel`，模式标签显示「人机 · 普通」这类实际档位；终局文案与本地一致」，但 `docs/design/modules/clock.md` 的 `GamePanel` 职责是「时钟显示、三条新结局文案与「认输」」，且同档 §5 写「对弈页（本地）：面板顶部加双方时钟；「认输」按钮」。人机局是否计时（AI 思考时谁的钟在走）、是否可认输、两个功能如何按模式开关，三处都没定。 | 在 §4 加一行模式表：人机局是否带时钟、是否带「认输」、`GamePanel` 用哪个入参把这些关掉或打开；不做的写「不做」并给理由（可引 F1.4 / F1.5 的适用范围）。 |
| 9 | 清晰度 | 🟡 | `docs/design/modules/ai.md` §4 的控件是「难度三选一……；阵营二选一（`执红` / `执黑`，默认执红）」，§6 又写「页面在思考中仍可切换难度/离开」，但对局进行中换难度（是否取消在飞请求、是否影响同一局）、换阵营（是否即重开）都没有规则，与 §3「同一时刻只允许一个请求在飞」相遇时行为未定。 | 补两行规则：换难度只作用于下一着且丢弃在飞结果；换阵营等同「新局」重开（或禁止局中改），并说明 `cancel()` 的触发点。 |
| 10 | 验收 | 🟡 | `docs/design/modules/ai.md` §6 的「不阻塞界面 | Worker 计算；页面在思考中仍可切换难度/离开，棋盘标「AI 思考中…」」在 §8 没有对应断言，而 jsdom 里的假 Worker 是同步回子，这条结果无论如何都不会失败。 | 把这一行的验收改到浏览器实跑（照 `docs/design/modules/local-play.md` §8 处理响应式的办法），或在 jsdom 里改成可失败的可观察量（思考中点击后 `notations` 长度不变），并在 §8 的实现分工里点名。 |
| 11 | 测试文件归属 | 🟡 | `docs/design/modules/ai.md` §6 验收命令写 `node --test test/ai.test.ts test/ai-engine.test.ts test/game-session.test.ts`，而 `docs/design/modules/local-play.md` §7 与 `docs/design/modules/clock.md` §6 把本地会话的测试文件叫 `test/client-session.test.ts`（后者职责「本地会话计时与认输（扩展）」）。两个名字指向同一块被测面：要么命令点到一个不存在的文件（命令先失败，什么都没断言），要么新开第二个会话测试文件（碎片化）。 | 用实际存在的那个文件名（existing，逐字）；若确要新开文件，写出与 `test/client-session.test.ts` 的分工，避免同一 reducer 两处测。 |
| 12 | 受影响文件 / 分档 | 🟡 | `docs/design/modules/ai.md` §7「文件划分」只列源文件；`test/ai.test.ts`、`test/ai-engine.test.ts`、`test/integration/ai.test.tsx` 与会话测试只出现在 §6 / §8 的散文里。分档判据覆盖源与测试文件，表里缺这四行，结论就只对源文件成立。 | 把四个测试文件补进 §7 表（职责 + 是否新增/扩展），分档结论句一并覆盖测试文件。 |
| 13 | 分支出身（6b） | 🟡 | `docs/design/modules/ai.md` §3「页面卸载 `dispose()`；悔棋/重开导致局面换了，`cancel()` 丢弃在飞结果」以「悔棋」为取消场景，而 §1 明确「不做：开局库、思考过程 / PV 展示、悔棋、AI 对 AI、残局表」。取消分支的一半场景被本文档自己排除。 | 取消分支只留真实场景：「新局」按下时（用户可见、可复现）与卸载时丢弃在飞结果，写明按 `id` 丢弃的断言；删掉「悔棋」。 |
| 14 | 分档读数 | 🔵 | `docs/design/modules/ai.md` §7 写「既有文件实测（本次设计前读数）：`src/client/App.tsx` 139 行…`src/client/board/Board.tsx` 265 行——加人机接线后仍在 500 行以内」。准则要的是结论句，不是原始读数；且 Board.tsx 的 265 行与 `docs/design/modules/local-play.md` §2「最大 `src/client/board/Board.tsx` 394 行」相差 129 行，两个活着的读数打架；也没有 300+ 行单函数的结论句。（数无法复测：`src/**` 不在评审范围，unverified。） | 把原始行数删掉，只留结论句：「无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案」；Board.tsx 的数字与 `docs/design/modules/local-play.md` 对齐一次。 |
| 15 | 数字漂移 | 🔵 | `docs/design/modules/app-shell.md` §1「不引路由库：九条路由用 `parseHash` / `routeHash` 两个纯函数足够」，同节路由表列了十行（含 `#/lesson/<id>`、`#/replay/<id>`）。 | 改成「十条路由」或在表里说明九条指不含参数页的条数，二选一。 |
| 16 | 文档归属（限制声明） | 🔵 | 评审上下文未提供 Document Map，文档归属判据只能按 `AGENTS.md` 目录表逐对比较：`docs/design/modules/ai.md` 位于 `docs/design/modules/` ✅，与 `docs/design/modules/app-shell.md` §4 的 `src/client/pages/AiPage.tsx` 行交叉引用 ✅；但「哪个文件拥有导航顺序」「哪个文件拥有会话动作表」只能靠文风推断。 | 补一份文档地图（或在本轮评审上下文里提供），让「谁拥有哪一节」可机械核对。 |
| 17 | 公开接口 | 🔵 | `docs/design/modules/ai.md` §2 写「从 `src/shared/index.ts` 导出 `chooseMove`、`AI_LEVELS`、`AiLevel`、`AiReply`」，但导出的 `chooseMove` 形参类型是 `AiOptions`，它不在导出清单里。 | 清单补 `AiOptions`（或把 `AiOptions` 并入 `chooseMove` 的签名说明）。 |
| 18 | 性能（F5.2） | 🔵 | 引擎与 Worker 进入前端包体，首屏预算（F5.2「手机 4G 快档首屏 < 2s，请求数 ≤ 6」）在 `docs/design/modules/ai.md` 里没有落点：没有一句说引擎 chunk 只在进入 `#/ai` 时加载。 | 加一行：`src/client/ai/worker.ts` 走 Vite 的 worker 入口、仅在 `AiPage` 挂载时加载，主包体积不因此增加；必要时写进 §6 验收对照。 |
| 19 | 测试确定性 | 🔵 | `docs/design/modules/ai.md` §8 的分工里有「一步杀必找到」，但它依赖默认预算内跑完所需层数：慢机型或 CI 抖动会让搜索停在更浅一层、返回非杀着，这条断言会偶发失败。 | 该断言注入宽预算或伪造时钟（与「伪造时钟下不超预算」那条分开），让自己的失败只归因于搜索正确性。 |

VERDICT: changes-required

计数：🔴 4 · 🟡 9 · 🔵 6。closest precedent 与 survey evidence 两行在 `docs/design/modules/ai.md` 开头都有且带内容；验收命令未写全量套件。

### 轮次 2（评审子代理）

第 2 轮复核 · M6 人机对战（F1.3）· 对象状态：待评审

范围（7 档）：

- `docs/design/modules/ai.md`
- `docs/design/modules/app-shell.md`
- `docs/design/modules/local-play.md`
- `docs/design/modules/clock.md`
- `docs/design/architecture.md`
- `docs/requirements/xiangqi.md`
- `test/RTM.md`

限制：未找到 README 形态的文档地图。
本次以 `docs/design/architecture.md` §4 的「文档地图」表作为归属依据。

另：为核验 §7 的文件分档结论与两处 existing 声称，实测了 6 个文件的行数。
App.tsx 139 · game/session.ts 212 · shell/routes.ts 82 · shared/index.ts 12 · client-session.test.ts 184 · panel/GamePanel.tsx 127。
只就这些声称引用，不评其内容。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | Branch provenance（6b） | 🔴 | `docs/design/modules/ai.md` §3 给一个新状态配齐了四件伴随物：文案「AI 出错，请点新局重开」、棋盘「保持只读」、用例「Worker 报错转 rejected」。但没有一行交代这个场景从哪来。「Worker 崩溃（线程报错、`error` 事件）不进协议」只说触发机制，无观察读数、无日志、无用户报告、无复现路径。同档 §2 的 `AiReply \| null; // 无合法着法时 null` 同样无场景：§4 写「终局或人未轮到时不发起请求」，页面不会把无合法着法的局面交给引擎，这条 null 分支守的是不会发生的局面。 | 给两条分支各补一行来源。要么引用一次真实观察（例如 `new Worker` 因入口路径或 CSP 失败时的控制台报错原文），要么给出复现路径（「注入一个构造即抛错的假 Worker 后跑 `node --test test/ai-engine.test.ts`」，或「把 `src/client/ai/worker.ts` 的路径改错后 `npm run dev` 打开 `#/ai`」）。给不出场景的那一条，把提示文案与分支一并删掉，让失败走通用错误面。 |
| 2 | Acceptance / RTM 一致性 | 🟡 | §8 的行与 RTM 不同步。`test/RTM.md` F1-7 的业务结果是「选难度与阵营后走一着，机器在 2 秒内回一着并更新棋盘；思考中棋盘不可动；换难度后回子速度变化可见」。§8 的行却写成「玩家走子后机器在时限内回一着，棋盘与记谱同步；思考中棋盘不可动；终局后不再回子」。换难度那条消失，另加一条 RTM 里没有的「终局后不再回子」，而 §8 还声称「本批不新增行」。RTM 是「集成测试的唯一索引」，行与用例标题要能逐字对上。 | 让 §8 该行的业务结果与 RTM F1-7 逐字一致（保留「换难度后回子速度变化可见」）。新增的「终局后不再回子」要么写进 RTM 该行，要么从 §8 去掉。 |
| 3 | Integration-test design（12） | 🟡 | §8 只从「对弈」故事起算，只声明「F1-1 / F1-3 不破坏、不冗余」。但本档 §1/§5 承诺「切页回来对局仍在」，RTM 里管这条的是页面壳故事的 F4-1（「打开页面 → 对弈 → 课程 → 对弈」）。人机页这半边既没进 F4-1 的入口，§8 也没写不覆盖的理由。 | §8 补一行 delta。是扩 F4-1 的入口（「人机 → 课程 → 人机」）并同步 `docs/design/modules/app-shell.md` §6 的行文，还是写明人机页切页保留为什么不进集成用例。 |
| 4 | Integration-test design（12） | 🟡 | §1 与 §4 给人机局新增了一个写入共享棋谱库的入口：「终局的人机对局写入棋谱库，与本地对局同一条路径（`saveRecord`）」「收到带 `result` 的会话时调 `saveRecord`」。RTM F1-5 断言的正是「终局后棋谱页列出该局」。同一份库多了一个来源，§8 的 delta 一字未提哪行会被打坏、哪行变冗余。 | §8 补一句 F1-5 的判定。人机对局是否进回放列表、是否影响 F1-5 的断言；不影响就把理由写出来。 |
| 5 | Affected files（8） | 🟡 | §4 要求面板「模式标签显示「人机 · 普通」这类实际档位」，但 §7 的受影响文件表里没有 `src/client/panel/GamePanel.tsx`。该组件 props 只有 `session / open / now / onToggle / onReset / onResign`，标签写死为 `<span className="panel-mode">本地双人</span>`，不改它就出不来档位标签。随带的 `test/game-panel.test.tsx` 与 §6 验收命令也没覆盖这条新文案。 | 把 `GamePanel.tsx` 写进 §7 的受影响文件表并点明改法（加一个标签 prop，默认沿用「本地双人」）。`test/game-panel.test.tsx` 随改动面纳入验收命令。实测 127 行，仍在 500 行档内。 |
| 6 | Clarity（请求时序） | 🟡 | 发起 AI 请求的时机只有两处：「AI 执红时开局即请求一着」与玩家走子后回子。§4 的「终局或人未轮到时不发起请求」只给反面条件。配上 §3 的「页面卸载 `dispose()`……`cancel()` 丢弃在飞结果」，切页离开时正轮到 AI 的那局回到页面后没有规则说谁补这一手。`thinking` 又是组件内新状态，重挂载后 `canPlay` 恒假，棋盘只读且无提示。 | §4 或 §5 写全发起规则（例如「未终局 && 轮到 AI && !thinking ⇒ 发起请求」并说明重挂载据此补手），或把重挂载补手单列一条。 |
| 7 | Document ownership（跨档引用） | 🟡 | §7 把 F5.2 的首屏体积预算指到 `docs/design/modules/app-shell.md` §5。但那一节验收对照只有 F4.1 / F4.2 / F5.1 三行，没有 F5.2。预算实际在 `docs/design/architecture.md` §7（「JS 主包 \| < 150KB gzip」）。 | 该句改指 `docs/design/architecture.md` §7（或 `docs/requirements/xiangqi.md` F5.2）。 |
| 8 | Document ownership（跨档滞后） | 🟡 | `docs/design/modules/app-shell.md` §2 把「人机会话与 Worker」合成一格，切页后果写「切页保留」。`docs/design/modules/ai.md` §3 写「页面卸载 `dispose()`」。Worker 不随切页保留，只有会话保留，同一件事两档不同形。 | `docs/design/modules/app-shell.md` §2 该格拆成两条：「会话：切页保留」「Worker：随页挂载创建、卸载 `dispose()`」。 |
| 9 | Clarity（认输口径） | 🟡 | `docs/design/modules/ai.md` §4 写「双方都可认输」。`docs/design/modules/clock.md` §2 写「认输：只有当前行棋方可以认输（本地同屏由当前方按）」。同一句又声明「`GamePanel` 不按模式开关这两个功能，直接沿用」。轮到 AI 走时玩家能否认输，两种写法两个答案。 | 明确采用哪条口径，并按结论改 §4 措辞。AI 不会按按钮，「双方都可认输」本身没有对应动作。 |
| 10 | Existing-piece（11） | 🟡 | §7 的现有件检查覆盖了 `chooseMove` / `AI_LEVELS` / `AiPage` / `ai` 路由与四条文案。没覆盖 `createAiEngine`、`AiRequest` / `AiResponse`、`AiOptions` / `AiReply` / `AiLevel`、`canPlay`、`currentSession`，以及新增用户可见文案「人机 · 普通」「AI 出错，请点新局重开」。 | 把这些名字与文案按 existing / none found / existing but unusable 三态补进 §7。两条文案尤其要给，它们是页面上真会出现的字。 |
| 11 | Requirements（引用错位） | 🔵 | §1 写「关页重开不恢复（F1.5 的未完成局只覆盖本地双人）」。但 F1.5 是「认输与求和」，「本地对局关页重开后接着下」在 F1.6「棋谱存局」里。 | 改成 F1.6。 |
| 12 | Doc hygiene / 文件分档 | 🔵 | §7 的分档结论「无文件跳 500 行档」用了「跳」。同句还留了个把测量推到实施后的条件句「实施后若有文件跨档，写拆分方案」。结论本身经实测成立：App.tsx 139 行、game/session.ts 212、shell/routes.ts 82、shared/index.ts 12、client-session.test.ts 184、GamePanel.tsx 127，均未跨 500 行档。 | 「跳」改「跨」，删掉「实施后若有文件跨档」半句，让结论就是结论。新增文件的 200 行目标保留。 |
| 13 | Requirements（口径） | 🔵 | 需求 F1.3 的验收是「可选难度，普通机器单步思考 ≤ 2 秒」。§2 读作「需求只规定「普通档 ≤ 2 秒」」，「普通机器」更像机型而非难度档。三档 `budgetMs`（200 / 1200 / 1800）都低于 2000，两种读法都满足，不改判罚。 | §2 把读法写明（「普通机型上单步 ≤ 2 秒」），§6 的真机读数才好对着需求验。 |
| 14 | Doc hygiene | 🔵 | §6「真机读数：……记录首着回子的耗时（需求上限 2 秒），写进 §6」把一次批次测量写进设计档。这跟 AGENTS.md「需求与设计文档只写「现在是什么」，不写历史」相拗。 | 读数写进批次记录。设计档只留稳定验收口径：测什么、阈值多少。 |
| 15 | Feasibility（首屏预算） | 🔵 | §7 只保证「主包不引 `src/client/ai/worker.ts`」。但 §2 让 `src/shared/index.ts` 桶导出 `chooseMove`，而主包本来就引这个桶。搜索代码会不会被 tree-shake 掉，设计没给判据，F5.2 的「JS 主包 < 150KB gzip」没有落点。 | §7 补一句：Worker 直接引 `src/shared/ai/*`、不经 `src/shared/index.ts`；或说明桶导出为何不会进主包。 |

计数：🔴 1 · 🟡 9 · 🔵 5 · 合计 15。

已核验通过项：

- 设计档在模块层存在，主题与 `docs/design/architecture.md` §4 文档地图的「人机对战的引擎、Worker 与人机页」相符。
- Closest precedent 行有先例坐标与偏离理由；Survey evidence 行列出五个来源。
- §8 从 `test/RTM.md` 起算，四栏齐全：交互 / 业务结果 / 入口 / 需求。
- 验收只跑改动面 `node --test`，集成半场放收口，不写全量套件。
- 引擎可测性走 `createAiEngine(factory)` 注入，合 R6 的测试缝。
- existing 声称逐条核验属实：`src/shared/fen.ts`、`src/client/online/socket.ts`、`Board` 的 `play` 模式与 `isMovable`、`saveRecord`、`playTurn`。
- `GameAction` 现有 select / tap / tick / resign / reset，确无 `play`，与「本批落地」一致。

VERDICT: changes-required

### 轮次 3（评审子代理）

第 3 轮复核 · M6 人机对战（F1.3）· 对象状态：待评审

范围（7 档全读）：docs/design/modules/ai.md、docs/design/modules/app-shell.md、docs/design/modules/local-play.md、docs/design/modules/clock.md、docs/design/architecture.md、docs/requirements/xiangqi.md、test/RTM.md。

结论：上轮 15 条中 14 条已修，1 条 🔵 未修（零理由沉默）；新增 1 条 🔵。未决 🔴 = 0。

| # | 上轮# | 文件 | 严重度 | 状态 | 依据（本轮原文） |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/modules/ai.md | 🔴 | Fixed | 「复现：把 `new Worker(new URL('./worker.ts', …))` 的路径改成不存在的文件」；null 分支改为「无合法着法属于调用方破契约，不返回空值」。 |
| 2 | 2 | docs/design/modules/ai.md | 🟡 | Fixed | 两处业务结果已逐字一致：「换难度后回子速度变化可见；终局后不再回子」。 |
| 3 | 3 | docs/design/modules/ai.md | 🟡 | Fixed | 「页面壳的 F4-1 扩到人机页（入口变「对弈（人机）→ 课程 → 回原页」）」；docs/design/modules/app-shell.md §6 与 test/RTM.md F4-1 同步。 |
| 4 | 4 | docs/design/modules/ai.md | 🟡 | Fixed | 「棋谱的 F1-5 不受影响：人机局也入库、也出现在回放列表」。 |
| 5 | 5 | docs/design/modules/ai.md | 🟡 | Fixed | 文件表新增 GamePanel 一行：「新增模式标签 prop（默认「本地双人」）」；test/game-panel.test.tsx 入表并入验收命令。 |
| 6 | 6 | docs/design/modules/ai.md | 🟡 | Fixed | 「发起请求的完整规则：未终局 && 轮到 AI && `!thinking` ⇒ 发一着。」三个入口含重挂载补手。 |
| 7 | 7 | docs/design/modules/ai.md | 🟡 | Fixed | 改指「F5.2 的「JS 主包 < 150KB gzip」见 `docs/design/architecture.md` §7」。 |
| 8 | 8 | docs/design/modules/app-shell.md | 🟡 | Fixed | 「会话切页保留；Worker 随页卸载（`dispose()`）」，与 docs/design/modules/ai.md §3 同形。 |
| 9 | 9 | docs/design/modules/ai.md | 🟡 | Fixed | 「认输沿用 `docs/design/modules/clock.md` §2 的口径：只接受当前行棋方」。 |
| 10 | 10 | docs/design/modules/ai.md | 🟡 | Fixed | 名字清单已含「`createAiEngine`、`AiRequest` / `AiResponse`、`canPlay`、`currentSession`」；文案清单已含「「人机 · 普通」「AI 出错，请点新局重开」」。 |
| 11 | 11 | docs/design/modules/ai.md | 🔵 | Unfixed | 仍写「关页重开不恢复（F1.5 的未完成局只覆盖本地双人）。」——F1.5 是认输与求和，关页重开在 F1.6。 |
| 12 | 12 | docs/design/modules/ai.md | 🔵 | Fixed | 「无文件跨 500 行档」，把测量推到实施后的条件句已删。 |
| 13 | 13 | docs/design/modules/ai.md | 🔵 | Fixed | 口径写明：「读作「普通机型上单步 ≤ 2 秒」」。 |
| 14 | 14 | docs/design/modules/ai.md | 🔵 | Fixed | 读数不再写进设计档：「端到端读数在收口时实测并记入批次档」。 |
| 15 | 15 | docs/design/modules/ai.md | 🔵 | Fixed | 补了「Rollup 会把主包里没被引用的导出摇掉」与产物体积比对（基线 94.93 kB）。 |
| N | (new) | docs/design/modules/ai.md | 🔵 | New | 设计档反向引用可整档删除的批次记录：「2 秒本身由收口时的真机读数证明（批次档 §6）。」，与 docs/design/architecture.md §4「可整档删除，设计档与需求档不得引用」相拗。 |

计数：上轮 15 条 → 14 Fixed / 1 Unfixed（🔵）；新增 1 条（🔵）；未决 🔴 = 0。

VERDICT: pass

## §4 用户批准（主 agent）

用户于 2026-11-14 05:52 在本会话回「收口」，批准本批交付，授权写 §6、核销台账 #8 并提交。

批准范围：M6 人机对战（F1.3）的引擎、Worker 封装、人机页与路由导航，及配套文档与用例；不含开局库、PV 展示、悔棋、AI 对 AI、残局表（设计 §1 的「不做」清单）。

## §5 实施记录（实施者：主 agent ∥ coder）

**实施记录（M6 页面半边：人机页、路由与导航、面板模式标签、三份前端用例）**

实施者：coder（本批页面任务）。引擎与 Worker 封装（`src/shared/ai/`、`src/client/ai/`、`session.ts` 的 `play` 动作）由 #58 / #59 落地，本任务直接复用，未改动。

改动文件与落点：

| 文件 | 改法 |
|---|---|
| `src/client/pages/AiPage.tsx`（新，导出 `AiPage`） | 难度三选一（入门 / 普通 / 高手）与阵营二选一（执红 / 执黑，默认执红）；会话在模块级 `currentSession` 持有，挂载取回、每次 dispatch 后写回；Worker 随挂载创建、卸载 `dispose()`；`canPlay = 未终局 && 轮到玩家 && !thinking`；终局 `saveRecord` |
| `src/client/shell/routes.ts` | `Route` 加 `{ name: 'ai' }`；`parseHash('#/ai')` 与 `routeHash` 互逆 |
| `src/client/App.tsx` | 导航第 2 位「人机」（对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱）；`#/ai` 分派到 `AiPage` |
| `src/client/panel/GamePanel.tsx` | 新增可选 prop `modeLabel`（默认「本地双人」）；人机页传「人机 · 普通」 |
| `test/integration/ai.test.tsx`（新） | 7 条：默认档位与标签、换难度后请求的 `level` 变、换阵营重开且 AI 执红即回子、玩家走一着后 AI 回一着并更新棋盘、思考中点击不发 `play`、认输终局后不再请求并存谱、AI 出错提示 |
| `test/integration/navigation.test.tsx` | F4-1 增人机半段：人机 → 课程 → 人机，棋盘、记谱与可走状态不变 |
| `test/game-panel.test.tsx` | 模式标签按 prop 渲染；不传时仍是「本地双人」 |

关键决策（实施层）：

- 发起请求用一条规则落地成单个 effect（未终局 && 轮到 AI && !thinking），三个入口共用：玩家走子后、AI 执红的新局、切页回来重挂载。
- 同一局面只发一次：键 = 换局代数 + 着法数 + fen。AI 报错后不自动重试，等「新局」换代。
- 换局代数同时用来丢弃旧局面的迟到回子：`cancel()` 只清在飞标记，回子落地前再验一次代数。
- 换难度只改 `levelRef`，不进请求 effect 的依赖：在飞的一着仍按原档位落地，下一着才用新档位。
- 认输沿用 `docs/design/modules/clock.md` §2「只接受当前行棋方」：按钮的 `disabled` 条件与对弈页一致（`GamePanel` 只在终局禁用），行棋方由页面处理器把关——AI 回合点它不认输。
- 终局存谱用 `saveRecord(..., { dedupe: true })`，键带换局代数：新局撞上同样的着法数与结果时不会被误判成「已存过」；跨挂载代数归零那一层由 dedupe 拦。
- `AiPage` 导出 `resetAiSession()` 供用例清场：模块级持有者在同一进程里跨用例存活，不清就会带上上一局。

偏差：设计档 `docs/design/modules/ai.md` §4 写「面板显示『AI 思考中…』」，实际渲染在棋盘上方的控件区（与棋盘同一列），面板只按 §7 新增 `modeLabel` 一个 prop。理由：把思考提示放进面板需要第二个 prop，超出 §7 给 `GamePanel.tsx` 定的职责与本任务书「加一个可选标签 prop」的授权。错误提示「AI 出错，请点新局重开」同样落在该区。

验证读数：

- `npm run check` → 退出码 0（tsc 无输出；`node --test` 205 通过；vitest 9 文件 50 通过）
- `npx vitest run test/integration/ai.test.tsx` → 7 通过
- `npx vitest run test/integration/navigation.test.tsx` → 2 通过
- `npx vitest run test/game-panel.test.tsx` → 10 通过
- `npm run build` → 退出码 0；主包 `dist/assets/index-*.js` 304.68 kB / gzip 96.68 kB（基线 94.93 kB，+1.84%，在 ±5% 内）；`worker-*.js` 单独成包 8.69 kB，主包不含搜索代码
- 未做：真实浏览器下的视觉走查与单步耗时实测（本实施环境不能起后台 dev server），留收口时在真机验

**实施记录（主 agent 验收后的三处修正，M6）**

实施者：主 agent（本批后段，在三个 coder 交付后验收时改）。

| 文件 | 改法 | 为什么 |
|---|---|---|
| `src/client/panel/GamePanel.tsx` | 新增可选 prop `resignDisabled`（默认 false），认输按钮 `disabled={over \|\| resignDisabled}` | 人机页 AI 回合点认输原本「看着可点但不响应」，用户会当成坏了；设计 §4 要求「只接受当前行棋方」在按钮上也可见 |
| `src/client/pages/AiPage.tsx` | 难度/阵营/提示从 `.board-fit` 内移出，成为 `main.board-stage` 下的 `.ai-controls`；`GamePanel` 传 `resignDisabled={result !== null \|\| turn !== side}` | 控件原先在测量容器内，棋盘按整高算尺寸，1414×807 视口下底行被裁掉约 60px（实测 `svg.bottom` 868 > 807） |
| `src/client/app.css` | `.page-ai .board-stage { flex-direction: column; gap: 8px }` 与 `.ai-controls` 规则 | 让 `.board-fit` 拿到扣除控件后的真实高度，棋盘自动缩到装得下 |
| `test/game-panel.test.tsx` | 增一条：`resignDisabled` 置灰、默认不置灰 | 新增 prop 要有断言 |

实测（真实浏览器，1414×807）：棋盘 `svg` 677px 高、底边 791 < 807，底行完整可见；普通档单步「玩家走子→AI 回子渲染完成」in-page 读数 1207ms / 334ms / 1207ms，最大 1207ms，低于需求 2 秒。

## §6 验证与收口（父代理）

**收口（主 agent，2026-11-14）**

交付范围：F1.3 人机对战。引擎 `src/shared/ai/`（评估 / 搜索 / 难度 / 出口）、Worker 三件套 `src/client/ai/`、人机页 `AiPage` 与 `#/ai` 路由、导航第 2 位、`GamePanel` 两个可选 prop、会话 `play` 动作。

需求—落点对照：

| 需求 | 落点 | 读数 |
|---|---|---|
| F1.3 可选难度 | 三档 `AI_LEVELS`（2/200 · 4/1200 · 6/1800）+ 页面单选 | `test/ai.test.ts` 断言三档深度与预算单调 |
| F1.3 单步 ≤ 2 秒（普通机型） | 普通档预算 1200ms，Worker 随页创建不进首着 | 真机 in-page 三次读数 1207 / 334 / 1207ms，最大 1207ms |
| 机器走合法着法 | 只从 `generateLegalMoves` 取着法；`collectMoves` 内部把所有着法喂给 `statusOf`，顺带自证 | 引擎用例与 Worker 冒烟各断言一次 |
| 不阻塞界面 | Worker 计算，页面只等消息 | 真机：思考中难度控件可点、可切页 |
| F4-1 切页不丢状态 | 会话模块级持有、Worker 随页卸载 | 人机半段用例（人机 → 课程 → 人机） |

收口测试行：

- `npm run check` → 退出码 0；`node --test` 207 通过 / 0 失败；vitest 9 文件 52 通过。
- 相对 M5c 的增量：单测 184 → 207（+23），前端用例 40 → 52（+12）。
- 主包 gzip 96.68 kB（基线 94.93，上限 150）；Worker 独立成包 8.69 kB。

评审处置：设计评审三轮（#55 十九项 → #56 十五项 → #57 通过签 token）；代码评审一轮（1🔴 / 1🟡 / 5🔵），七条全修并逐条验证。🔴 为 StrictMode 双挂载下 `requestedRef` 拦住重发导致 AI 回合卡死——修复后新增 StrictMode 回归用例，临时移除修复时该用例如期变红。

验收时的两处实现修正（详见 §5 后段）：控件移出测量容器以修掉棋盘底行裁切；`GamePanel` 加 `resignDisabled` 让 AI 回合的认输按钮可见置灰。

遗留说明：

- §2 摘要里的「无合法着法返回 null」是设计评审前的写法，最终设计（`docs/design/modules/ai.md` §2）与代码都是「前置条件 + 破契约抛错」。§2 是过程记录，不回头改。
- 未完成的人机局不落盘、不续局；人机对局终局后与其他对局同路入库。
