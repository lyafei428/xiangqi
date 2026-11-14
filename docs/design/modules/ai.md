# 人机对战模块

浏览器端的人机对局：玩家对一条由本地引擎驱动的对手，难度三档，思考在 Web Worker 里跑，不阻塞棋盘。

Closest precedent: `docs/design/modules/local-play.md` — 单机对局的状态机、棋盘接法与面板分工已由该模块定死。本模块沿用同一个 `sessionReducer` 与 `Board` 的 `play` 模式，只把「另一个人」换成引擎；偏离处是会话实例、持久化与输入锁，写在 §1 与 §5。

Survey evidence: 已核对以下来源：

- `docs/design/architecture.md` §8：M6 = AI 对战，Web Worker alpha-beta，单步 ≤ 2 秒。
- `docs/requirements/xiangqi.md` F1.3：人机对战，可选难度，普通机单步思考 ≤ 2 秒。
- `src/shared/` 全部导出：`generateLegalMoves` / `applyMove` / `statusOf` / `positionKey` / `perft`。
- `src/client/game/session.ts`：现有动作与 `playTurn` 路径。
- `src/client/online/socket.ts`：依赖注入先例。

相关条目已采用；未发现与人机对战冲突的既有设计。

## 1. 边界

- 规则只从 `src/shared/` 取；搜索与评估不复制任何判罚逻辑，终局仍由 `statusOf` / `judgeGame` 判。
- 引擎是纯函数、零依赖：不放 DOM、不放 Worker API、不读墙钟（时间基准由参数注入）。它能在 Node 里直接单测，也能被 Worker 原样搬走。
- 人机页有自己的会话实例，**不动 App 级本地对局**；切页回来对局仍在（模块级持有，见 §5），关页重开不恢复（未完成局只覆盖本地双人，见 F1.6）。
- 终局的人机对局写入棋谱库，与本地对局同一条路径（`saveRecord`）。
- 不做：开局库、思考过程 / PV 展示、悔棋、AI 对 AI、残局表。

## 2. 引擎

目录 `src/shared/ai/`，从 `src/shared/index.ts` 导出 `chooseMove`、`AI_LEVELS`、`AiLevel`、`AiOptions`、`AiReply`。

导出走桶是为了守「前后端只从 `src/shared/index.ts` 取东西」的约定；AI 模块是纯函数、无副作用，Rollup 会把主包里没被引用的导出摇掉。收口时用 `npm run build` 的产物体积比对（基线 94.93 kB）验主包没因它长大。

`fen` ↔ `Position` 的转换归属 `src/shared/fen.ts`：页面发请求前用 `toFen(position)` 转成字符串，Worker 收到后用 `parseFen(fen)` 转回局面（两函数均为 existing）。

| 文件 | 职责 |
|---|---|
| `src/shared/ai/evaluate.ts` | 局面分：子力 + 位置表（兵按推进、马炮按中心）+ 将帅安全项。红正黑负，返回行棋方视角。纯函数。 |
| `src/shared/ai/search.ts` | negamax + alpha-beta：迭代加深、吃子优先排序、叶节点浅层吃子搜索（静态搜索）。返回着法与统计。纯函数，时限靠注入的 `now()`。 |
| `src/shared/ai/levels.ts` | 三档难度：`入门` / `普通` / `高手`，各带 `maxDepth` 与 `budgetMs`。 |
| `src/shared/ai/index.ts` | `chooseMove(position, options)`：组装搜索、裁剪时限、给出 `AiReply`。 |

```ts
type AiLevel = 'easy' | 'normal' | 'hard';

interface AiOptions {
  readonly level: AiLevel;
  readonly now?: () => number; // 默认 Date.now，单测注入伪造时钟
  /** 对局至今的着法史；必填——缺了它搜索看不见已发生的重复。 */
  readonly history: readonly HistoryEntry[];
  /** 对局起始局面 FEN；必填，规则档规定不给默认值。 */
  readonly startFen: string;
}

interface AiReply {
  readonly move: Move;
  readonly depth: number;   // 实际搜到的完整层数
  readonly nodes: number;   // 访问的节点数，做性能读数与用例断言
  readonly elapsedMs: number;
}

function chooseMove(position: Position, options: AiOptions): AiReply; // 前置条件：局面有合法着法
```

前置条件：调用方保证局面未终局且轮到 AI（人机页用 `result === null` 把关；`judgeGame` 判死局时已置 `result`）。无合法着法属于调用方破契约，不返回空值。

难度表：

| 档 | `maxDepth` | `budgetMs` | 用户可见等待 |
|---|---|---|---|
| 入门 | 2 | 200 | 立刻回子 |
| 普通 | 4 | 1200 | ≤ 1.2 秒（需求上限 2 秒） |
| 高手 | 6 | 1800 | ≤ 1.8 秒 |

判据：需求写的是「可选难度，普通机器单步思考 ≤ 2 秒」，读作「普通机型上单步 ≤ 2 秒」；三档 `budgetMs` 全部低于 2000，普通档 1200 还给机型与传输留了余量。搜索在每次节点展开前检查时限，超时用已完成的最深一层着法，绝不在半层上返回。

评估口径：将帅不参与被吃（`generateLegalMoves` 已排除自杀）；搜索里用 `MATE = 100000` 减去层数计杀分，避免同等子力下不进杀。

### 长将与重复

搜索吃两样东西：当前局面，以及**对局至今的着法史**（`history` + `startFen`）。树里走到同一局面第三次出现时，这个节点是终端，分数按规则判罚结果给——引擎不会为一个看起来不错的子力或杀分把自己送进长将判负。

| 项 | 口径 |
|---|---|
| 何时判 | 节点展开前，数当前局面的键在「起点 + 路径 + 对局历史」里出现过几次；已有 2 次则是第三次 |
| 计数含起点 | `startFen` 那一局面算一次（与规则档的计数范围同一口径）；漏掉它，「双方各自挪回原位」这类循环会晚一圈才判 |
| 判给谁 | 复用 `repetitionResult(position, 窗口, startFen)`；不另写一套长将规则 |
| 窗口 | 传给它的窗口末元素**就是当前节点局面**（规则档的计数范围不含单独一次），前面接对局历史（整段，不截断）与搜索路径（长度 ≤ `maxDepth`，不需要额外的 24 着上限） |
| 判不出 | `repetitionResult` 返回 `null`（计数没到 3，或判罚区间不成环）时按「非终端」继续展开，不当作和棋 |
| 分数 | 胜方 = 行棋方 → `+(MATE - ply)`；胜方 = 对手 → `-(MATE - ply)`；和棋（`winner === null`）→ `0` |
| 代价 | 每个节点多一次 `positionKey`（棋盘串）；窗口只在第三次出现那一下才物化，平均到节点上可忽略。高手档的实跑读数在收口行给出 |

边界：60 回合无吃子的自然限着不建模——引擎不会在一局里主动走到那里，建模它只是多一条不会触发的分支。

`gaveCheck` 的算法与 `playMove` 一致：这着走完之后，**对手**（`下一局面.turn`）是否被将军。窗口只存 `Position`，`fen` 与 `gaveCheck` 在判罚那一刻才现算；`recordMove` 不适用于这里——它为每一着造完整记录，而窗口要的是懒物化。

复现：`node --test test/ai.test.ts` 的用例 `AI 不走自成长将的重复线`。它先造一个「同一局面已出现两次、每着都将军」的局面与历史，用 `judgeGame` 钉死这条线确实是长将负，再断言 `chooseMove` 不选那一着。去掉历史参数，同一局面下引擎就会选中它。

## 3. Worker

| 文件 | 职责 |
|---|---|
| `src/client/ai/worker.ts` | Worker 入口：收请求 → 调 `chooseMove` → 回结果。只搬数据，不含规则。 |
| `src/client/ai/engine.ts` | 页面侧封装：`createAiEngine(factory)`，`request(fen, level, history, startFen)` / `cancel()` / `dispose()`；同一时刻只允许一个请求在飞。 |

协议（`src/client/ai/protocol.ts`，纯类型）：

```ts
type AiRequest = {
  readonly id: number;
  readonly fen: string;
  readonly level: AiLevel;
  /** 对局至今的着法史：引擎靠它认长将与重复（见 §2 长将与重复）。 */
  readonly history: readonly HistoryEntry[];
  /** 对局起始局面 FEN。 */
  readonly startFen: string;
};
type AiResponse = { readonly id: number; readonly reply: AiReply };
```

- Worker 用 `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`（Vite 原生支持）。
- 工厂可注入：页面默认传真实构造器，jsdom 用例传假 Worker，驱动「回子 / 取消」两条路径，不必真起线程。
- 页面卸载 `dispose()`；新局或换阵营导致局面换了，`cancel()` 丢弃在飞结果（按 `id` 比对，过期结果直接丢，既不 resolve 也不 reject，免得误报「AI 出错」）。
- 同一时刻只允许一笔在飞；真的撞上第二笔时同步抛错，不排队——排队会把旧局面的回子落进新局面。页面那条输入闸门（`!thinking`）先拦一道。
- Worker 崩溃（线程报错、`error` 事件）不进协议：`src/client/ai/engine.ts` 把它转成一次 rejected promise，并当场 `terminate()` 这条线程；下一次 `request` 重开一条（不自愈的话线程已死，提示里的「新局」永远回不了子）。页面收到后置一个提示「AI 出错，请点新局重开」，棋盘保持只读，不自作主张替 AI 走子。

  复现：把 `new Worker(new URL('./worker.ts', …))` 的路径改成不存在的文件，跑 `npm run dev` 打开 `#/ai`——浏览器控制台报模块加载失败（`error` 事件），面板出现上述提示。该分支只守这一种故障（Worker 构造或入口加载失败），不覆盖别的网络/业务错误。

## 4. 页面

路由 `#/ai`，页面 `src/client/pages/AiPage.tsx`；导航七项之第 2 位（对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱 / 规则，见 `docs/design/modules/app-shell.md` §3）。

- 控件：难度三选一（`入门` / `普通` / `高手`，单选按钮组）；阵营二选一（`执红` / `执黑`，默认执红）。两项都是固定取值，用选项不给文本框。
- 棋盘用 `Board` 的 `play` 模式，`side` 传玩家颜色——AI 的棋子不可选、不可拖。
- AI 思考中：棋盘只读（不传选子与落点回调），棋盘上方显示「AI 思考中…」；终局或人未轮到时不发起请求。
- 面板复用 `GamePanel`，模式标签显示「人机 · 普通」这类实际档位；终局文案与本地一致。
- 人机局的计时与认输：每人 10 分钟包干，AI 思考耗时计在它自己那份里；终局后停表。认输沿用 `docs/design/modules/clock.md` §2 的口径：只接受当前行棋方，所以玩家只在自己回合可认输（`GamePanel` 的 `resignDisabled` 在 AI 回合置灰）；AI 不会认输。
- 控件语义：换难度只影响下一着（在飞结果仍按原难度落地）；换阵营等同重开一局，旧请求 `cancel()` 丢弃。
- 控件收起：未走子时铺开；选过之后指针落到控件组外即收成一行摘要，点摘要可再展开，新局重新铺开（详见 `docs/design/modules/ui-refresh.md` §3）。
- 收起的判定听全局 `pointermove`，不用 `pointerleave`：后者只在指针确实悬停过该元素时才发，二次展开（点摘要进来）或键盘选完之后指针从没进过控件组，离开事件不会来，于是「选完不收」时有时无。全局指针移动与它此前在哪无关，行为确定。
- 新局：按当前阵营重开；AI 执红时开局即请求一着。
- 终局存棋谱：收到带 `result` 的会话时调 `saveRecord`（与本地对局同一函数，带 dedupe：切页重挂载不重复写；键里含换局代数，免得新局撞上同样着法数与结果被当成已存），未完成局不写。

## 5. 会话与输入

- 会话动作表由 `docs/design/modules/local-play.md` §3 拥有；`play(move, now)` 就在那张表里（先过 `isLegal`，人机页给引擎用），本批在代码里把它落地，不在本档重写一遍。
- 人机页的会话放在页所在的模块级持有者里（`src/client/pages/AiPage.tsx` 内的 `let currentSession`，挂载时取回、每次 dispatch 后写回）；切页回来对局仍在，关页即丢。不引入全局 store，也不改 `src/client/App.tsx` 的会话。
- 用例清场：页模块导出 `resetAiSession()`，把模块级会话置空；单进程里多个用例共用一块内存，不清会带上上一局。
- 输入闸门：`canPlay = 未终局 && 轮到玩家 && !thinking`；AI 回合的棋盘不响应点击。
- 发起请求的完整规则：未终局 && 轮到 AI && `!thinking` ⇒ 发一着。它同时覆盖三个入口：玩家走子后、AI 执红的新局开局、以及切页回来重挂载（页内取回模块级会话时自动补一手）。

## 6. 验收对照

| 需求 | 落点 |
|---|---|
| F1.3 人机对战，可选难度 | 三档 `AI_LEVELS`；页面单选；`test/ai.test.ts` 断言三档深度与时限单调 |
| F1.3 普通机型单步 ≤ 2 秒 | 普通档 `budgetMs = 1200` + 页面挂载即创建 Worker（每局不再重开线程），留 800ms 余量给启动与传输；引擎内由 `test/ai.test.ts` 用伪造时钟断言不超预算；端到端读数在收口时实测，写进收口行。 |
| 机器走的是合法着法 | `chooseMove` 只从 `generateLegalMoves` 取着法 |
| 机器不会自己下成长将负 | 搜索把「第三次出现」当终端节点，按 `repetitionResult` 的胜负计分；`test/ai.test.ts` 用带历史的长将局面断言 AI 不选那条重复线 |
| 不阻塞界面 | Worker 计算；浏览器实跑：思考中切难度/离开仍然可响应（jsdom 的假 Worker 同步回子，这条只能到真机验）。 |

验收命令（只跑改动面）：`node --test test/ai.test.ts test/ai-engine.test.ts test/client-session.test.ts`。前端集成在收口时跑：`npx vitest run test/integration/ai.test.tsx test/integration/navigation.test.tsx test/game-panel.test.tsx`。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `src/shared/ai/evaluate.ts` | 局面评估。纯函数。 |
| `src/shared/ai/search.ts` | alpha-beta 搜索与时限；含重复 / 长将的终端判定。纯函数。 |
| `src/shared/rules.ts` | `repetitionResult` 的 history 入参放宽为 `{ fen, gaveCheck }` 的结构型，AI 的轻量窗口与 `HistoryEntry[]` 都能传；判罚逻辑不变。 |
| `src/shared/ai/levels.ts` | 难度表。 |
| `src/shared/ai/index.ts` | `chooseMove` 出口。 |
| `src/client/ai/protocol.ts` | Worker 请求 / 应答类型。 |
| `src/client/ai/worker.ts` | Worker 入口。 |
| `src/client/ai/engine.ts` | 页面侧封装与工厂注入。只在 `AiPage` 挂载时创建，主包不引 `src/client/ai/worker.ts`（F5.2 的「JS 主包 < 150KB gzip」见 `docs/design/architecture.md` §7）。 |
| `src/client/panel/GamePanel.tsx` | 两个可选 prop：`modeLabel`（默认「本地双人」，人机页传实际档位）与 `resignDisabled`（人机页在 AI 回合置灰认输）；时钟与认输行为不动。 |
| `src/client/pages/AiPage.tsx` | 人机页：控件、棋盘、思考锁、终局存谱；发请求时读会话的 `history` 与 `startFen`（`GameSession` 已有这两个字段，不新增状态）。 |
| `src/client/shell/routes.ts` | 增加 `ai` 路由。 |
| `src/client/App.tsx` | 导航第 2 位「人机」与页面分派。 |
| `src/client/game/session.ts` | `play(move, now)` 动作落地（动作表归 `docs/design/modules/local-play.md` §3）。 |
| `src/shared/index.ts` | 导出 `src/shared/ai/`。 |
| `test/ai.test.ts` | 引擎层用例（新增）。 |
| `test/ai-engine.test.ts` | Worker 封装层用例（新增）。 |
| `test/client-session.test.ts` | 会话 reducer 用例，补 `play` 动作（扩展既有）。 |
| `test/game-panel.test.tsx` | 面板标签按 prop 渲染（扩展既有）。 |
| `test/integration/navigation.test.tsx` | 切页不丢对局扩到人机页（F4-1，扩展既有）。 |
| `test/integration/ai.test.tsx` | 人机页集成用例（新增）。 |

文件分档：无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。新文件按职责拆在 200 行以内。

现有件检查：

- 棋盘：existing — `src/client/board/Board.tsx` 的 `play` 模式已按 `side` 限权（`isMovable` 判 `movable === 'both' || piece.color === movable`），人机只需传玩家颜色，不新写只读逻辑。
- 会话状态机：existing — `src/client/game/session.ts` 的 `playTurn` 已含记谱、判罚与切时钟；`play(move, now)` 已在 `docs/design/modules/local-play.md` §3 的动作表内，本批只落地代码。
- 规则与评估素材：existing — `generateLegalMoves` / `applyMove` / `statusOf` / `positionKey`（`src/shared/`）；`perft` 可作走法生成的性能基线，搜索直接吃它。
- `repetitionResult` — existing，直接复用；入参放宽为 `{ fen, gaveCheck }` 结构型（见 `docs/design/rules-engine.md` §6）。
- `recordMove` — existing，但这里不用：它为每一着造完整 `HistoryEntry`（含 `move` / `captured`），而搜索窗口按 `Position` 懒物化、判罚那一刻才补 `fen` 与 `gaveCheck`；用它等于每个节点多造一份记录。
- none found：`chooseMove`、`AI_LEVELS`、`AiOptions`、`AiReply`、`AiLevel`、`createAiEngine`、`AiRequest` / `AiResponse`、`canPlay`、`currentSession`、`AiPage`、`ai` 路由。
- none found：用户可见文案「AI 思考中…」「执红」「执黑」「入门 / 普通 / 高手」「人机 · 普通」「AI 出错，请点新局重开」，仓库内无同名先例。
- none found：Web Worker 在本仓没有先例（`new Worker` 零命中），封装形状照 `src/client/online/socket.ts` 的构造器注入先例。

## 8. 集成测试设计

起点：`test/RTM.md` 的「对弈」故事。本批给 F1-7 加一条业务结果——「玩家连续将军走成第三次重复时，机器不会自己走成长将判负」——并把驱动方式写进该行；F1-1 / F1-3 不破坏、不冗余。

跨故事的 delta：

- 页面壳的 F4-1 扩到人机页（入口变「对弈（人机）→ 课程 → 回原页」），行文同步到 `docs/design/modules/app-shell.md` §6。
- 棋谱的 F1-5 不受影响：人机局也入库、也出现在回放列表，但该行断言的是「终局后棋谱页列出该局」，入口仍是从对弈进入，新来源不改变它的观察结果。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-7 | 人机页：选难度与阵营 → 走一着 → Worker 回子 | 选难度与阵营后走一着，机器在 2 秒内回一着并更新棋盘；思考中棋盘不可动；换难度后回子速度变化可见；终局后不再回子 | 打开页面 → 人机 | F1.3 |

F1-7 四个业务结果各自的落点：

- 「机器在 2 秒内回一着并更新棋盘」：jsdom 断言回子与记谱同步；2 秒本身由收口时的真机实测证明（收口行）。
- 「思考中棋盘不可动」：jsdom 断言思考中点棋盘不发 `play`。
- 「换难度后回子速度变化可见」：jsdom 断言请求携带的 `level` 随控件改变；「速度」在假 Worker 下不可见，由真机读数覆盖（入门 0.2 秒 vs 普通 1.2 秒）。
- 「终局后不再回子」：jsdom 在终局快照后再点棋盘，断言无新请求。

实现分工：

- `test/ai.test.ts`：引擎层——初始局面给合法着法、一步杀必找到（注宽预算与伪造时钟，不和时限那条混写）、白送大子的局面不吃亏、三档 `maxDepth` / `budgetMs` 单调、伪造时钟下不超预算、调用方破契约（无合法着法）时抛错。
- `test/ai.test.ts` 扩两条重复 / 长将用例（本批新增）：①传入一段「同一局面已出现两次」的历史，AI 有一条子力上很赚、但会把该局面送到第三次且自己每着都将军的着法——断言它不选那条；②一段双方都不将军的重复历史——重复线计 0 分，AI 在有正分非重复着法时不选它。两条都用伪造时钟与固定预算，不读墙钟。
- `test/ai-engine.test.ts`：注入假 Worker 的封装层——请求发出、应答回填、过期 id 丢弃、`cancel` 后不再回填、Worker 报错转 rejected。
- `test/integration/ai.test.tsx`：jsdom + 假 Worker 驱动整页——选难度、执红执黑、玩家走一着后 AI 回一着并更新棋盘、思考中点击无效、换难度后请求的 level 变了、终局后不再请求 AI。
- `test/client-session.test.ts`：`play` 动作的合法性闸门与记谱、终局、切时钟。
- `test/game-panel.test.tsx`：模式标签按 prop 渲染，默认仍是「本地双人」。
- `test/integration/navigation.test.tsx`：F4-1 的对弈半段保持原样，新增人机半段（人机 → 课程 → 人机，棋盘与记谱不变）。
