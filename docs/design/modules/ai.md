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
| `src/shared/ai/levels.ts` | 三档难度：`入门` / `普通` / `高手`，各自的 `maxDepth` 与 `budgetMs`。 |
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
| 入门 | 2 | 1200 | 深度 2 很快跑完，预算基本用不上 |
| 普通 | 4 | 2200 | ≤ 2.2 秒（需求上限 3 秒） |
| 高手 | 8 | 4000 | ≤ 4 秒（需求上限 4 秒） |

判据：需求写的是「可选难度，普通机器单步思考 ≤ 3 秒、高手 ≤ 4 秒」——每档再留 500–800ms 给机型差异与 Worker 传输。桌面机上实测：入门 39ms 就走完（深度 2 到顶），普通 1173ms（深度 4 到顶），**高手 4000ms 用满预算仍未跑完深度 8**——它的有效深度由预算决定，不由 `maxDepth` 决定；手机更慢，能到的深度更低。搜索在每次节点展开前检查时限，超时用已完成的最深一层着法，绝不在半层上返回。

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
- 状态行常驻占一行高（`.ai-status`，`min-height: 20px`）：思考提示每走一步都会出现一次，按内容撑开会让棋盘缩一下再弹回。
- 面板复用 `GamePanel`，模式标签显示「人机 · 普通」这类实际档位；终局文案与本地一致。
- 人机局的计时与认输：每方 15 分钟包干（与需求 F1.4 同一个 `CLOCK_MS`，不是另设一个值），AI 思考耗时计在它自己那份里；终局后停表。认输沿用 `docs/design/modules/clock.md` §2 的口径：只接受当前行棋方，所以玩家只在自己回合可认输（`GamePanel` 的 `resignDisabled` 在 AI 回合置灰）；AI 不会认输。
- 控件语义：换难度只影响下一着（在飞结果仍按原难度落地）；换阵营等同重开一局，旧请求 `cancel()` 丢弃。
- 控件占位：两组选项放同一行，中间一条竖分隔线分组（前三个是难度、后两个是阵营）。手机档藏掉「难度 / 阵营」两个视觉标签与圆形单选钮（`radiogroup` 自带 `aria-label`，选中项靠 `is-chosen` 的加粗与底色表达，读屏与键盘仍可操作；键盘焦点另用 `:focus-visible` 的 `--accent` 描边标出——原生圆点藏掉之后，焦点环是唯一能看出「现在在哪一组」的线索）——标签与圆点合起来正好把这一行挤成两行，白占棋盘上方三四十像素。整条控件高 29px。
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
| F1.3 单步思考上限 | 普通档 `budgetMs = 2200`（上限 3 秒）、高手档 4000（上限 4 秒） + 页面挂载即创建 Worker（每局不再重开线程），留 800ms 余量给启动与传输；引擎内由 `test/ai.test.ts` 用伪造时钟断言不超预算；端到端读数在收口时实测，写进收口行。 |
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

## 9. 每步胜率

每一着后给出红方与黑方的胜率，四个棋局页面都显示。概率来自**静态评估**，不跑搜索——理由在下面「为什么不做搜索」。

Closest precedent: `src/shared/ai/evaluate.ts`（局面评估，红正黑负、出口切行棋方视角）与 `src/client/panel/GamePanel.tsx`（记谱按回合两列渲染）。
对齐：概率就是评估值的一次单调映射，不另立第二套局面判断；显示挂在既有的记谱区与面板顶部，不新开一栏。
偏离：评估原本只服务搜索，现在要给人看——所以必须**标定**（分差 → 百分比）并把常数集中在一处；搜索侧不需要这个映射。

Survey evidence: 已核对 `docs/design/modules/board-ui.md`（棋盘与面板的渲染归属）、`docs/design/modules/local-play.md`（`HistoryEntry` 每着都带走完后的 FEN）、`docs/requirements/xiangqi.md` F5.1 与 F5.7。相关：FEN 逐着可得、记谱区已有两列结构两处被沿用；其余来源与本题无关。

### 概率模型

| 项 | 规则 |
|---|---|
| 出口 | `redExpectation(position, result): number`，红方期望分 0..1。结果由调用方给（`GameResult` 或 `null`），函数的活只做「局面 → 期望分」。 |
| 取值 | `evaluate` 返回的是**行棋方视角**，先按 `turn` 换成红方视角的 `score`，再 `p = 1 / (1 + 10 ** (-score / 400))`。 |
| 常数 400 | 一车 900 分 → 99%，一马 400 分 → 91%，一兵 100 分 → 64%。这是「差一子≈九成」的标定，与象棋残局的常识量级一致；常数只写一处，可调。 |
| 终局 | `result !== null` 时按结果收敛：红胜 1、黑胜 0、和棋 0.5（和棋各得半分）。为什么结果必须从外面传：和棋来自三次重复 / 自然限着 / 协议和棋，认输与超时也不是棋盘状态——`statusOf` 只有 playing / check / checkmate / stalemate 四值，一个 `Position` 推不出这些。 |
| 和棋口径 | 显示的是**期望分**（胜 1、和 0.5、负 0），所以和棋终局读作 50%。两列数字永远互补，合计 100%。 |

**要同步的三处**：本批改到联机页与回放页的显示、以及设置浮层里的开关，这三处分别由 `docs/design/modules/online.md`、`docs/design/modules/replay.md`、`docs/design/modules/board-ui.md` 拥有——每档各补一句（联机/回放的记谱带百分比与条；`docs/design/modules/board-ui.md` 的开关清单加「胜率」），避免同一页面行为只在本档一侧有描述。

**为什么不做搜索**：每走一着就跑一次浅层搜索，实时对局里会有可感延迟（普通档实测 1.2 秒），且要再进一次 Worker；静态评估是 O(81) 的纯函数，一局 200 着不到两万次操作。代价是看不见下一步的战术，这一点在界面上如实呈现（只给数字，不写「红方必败」这类判断）。

### 显示

| 位置 | 规格 |
|---|---|
| 记谱每一格（两列：对弈 / 人机） | 着法后面跟一个小字百分比，取**该着之后**的红方期望分，四舍五入到整数。两列用同一个视角（红方），但**各算各的局面**：同一回合里红格与黑格是两个不同局面，数值本来就该不同。 |
| 记谱每一格（单列：联机 / 回放） | 同样跟一个小字百分比，同样是红方视角。这两页的记谱本来就是平铺一列（`src/client/pages/OnlinePage.tsx` 的 `{index + 1}. {move}`、回放页的 `replay-moves`），没有第二列可对齐。 |
| 着法区的顶部 | 一条红黑概率条（左红右黑，宽度按百分比分配）+ 两个数字「红 62% · 黑 38%」，后者是前者的补数。放在可收起的着法区里、不占常驻条：需求 F1.10 把对弈页与人机页的默认可见集定成「默认只显示棋盘、行棋方与双方计时、新局与认输」，常驻一条胜率条会改写那个列举。 |
| 终局后 | 条按结果贴边：红胜满红、黑胜满黑、和棋对半；数字与结果文案并列，不重复解释。 |
| 手机档 | 概率条占一行 20px，数字与条同行；记谱字不因此缩小。 |

- 开关：`xiangqi.eval.v1`，默认开；设置浮层里「胜率 开/关」。关掉后条与记谱数字都不渲染（不留空位）。
- 着色按 `docs/design/modules/theme.md` §2 的「结果着色」：红方数字用 `--red-text`、黑方用 `--black-text`，条本身用两个色块加 `--line` 分隔，不新增颜色。
- 无障碍：条外面包 `role="img"` 并给 `aria-label`（「红方胜率 62%」），两个数字本身是文本，读屏直接读得到。

### 四个页面的数据来源

| 页面 | 着法序列 | 当前局面 | 传给 `redExpectation` 的 result（**只在该着之后正是终局那一着时传，其余传 `null`**） |
|---|---|---|
| 对弈 / 人机 | `session.history`（每项带 `fen`） | `session.history` 末项或开局 FEN | 末格（即当前局面）且 `session.result !== null` 时传 `session.result`，其余格传 `null` |
| 联机 | `replayHistory(snapshot.startFen, snapshot.moveLog)` | `snapshot.fen` | 末格且 `snapshot.result !== null` 时传它，其余格传 `null` |
| 回放（我的棋谱 / 棋谱库两条入口） | `replayHistory(record.startFen, record.moves)`（与联机页同一个函数，不另起 `playMove` 循环） | 回放游标那一着之后 | 回放到终局那一着时传 `record.result`，否则 `null` |

- 增量算，不整段重算：记谱的百分比按着法数缓存——新着一只补算一格（一次 `parseFen` + 一次 `evaluate`），着法数不变时命中缓存。整段重算会在每走一着时做 N 次 `parseFen`，与需求 F5.3 的「走子到画面 < 16ms」相冲。
- 实现形制：`useMemo` 依着法数，内部用一个 `useRef` 缓存已算好的前缀数组，只追加新格；**_着法数变小时截断到新长度_**（新局、联机再来一局都会让着法数从 0 长回原值，不截断会把上一局的数贴到新局上）。
- 联机与回放不另写判定：同一份 `redExpectation`。

### 边界

- 只覆盖棋局页面（对弈、人机、联机、回放）。课程、练习、对弈题不显示：那些页面的任务是「走对下一步」，给一条胜率条只会分心。
- 不预测「几着内必胜」，不标「妙手 / 漏着」，不显示搜索深度。
- 概率是评估值的映射，不是引擎的搜索结论——文案只说「胜率」，不说「引擎认为」。

### 命名与文件

| 名字 | 三问答复 |
|---|---|
| `redExpectation` | `none found`：新增纯函数，住在 `src/shared/ai/probability.ts`；不碰 DOM，可直接单测。 |
| `EVAL_SCALE` | `none found`：新增常量（400），同上文件，标定只此一处。 |
| `EvalBar` | `none found`：新增组件，住在 `src/client/panel/EvalBar.tsx`；三个页面共用。 |
| `xiangqi.eval.v1` | `none found`：新存储键，读写都在 `src/client/storage/prefs.ts`，与另外三个开关同处。 |
| `useMoveEvals` / `useEvalPoint` | `none found`：新增 hook，同上文件；前者给记谱逐格（前缀缓存），后者给条上的数字——三个页面共用同一段增量逻辑，分放三处会漂。 |
| `useEvalEnabled` | `none found`：新增 hook，住在 `src/client/panel/useEval.ts`；沿用 `src/client/board/useMoveTrail.ts` 的定式（`useSyncExternalStore` + 模块级 store），理由同它注释里那句「多个页面要读同一个值」——联机页与回放页也要读到开关状态。 |
| 「胜率 开/关」 | `none found`：新文案，与「音效 / 走子轨迹 / 对坐下棋」并列在设置浮层。 |

| 文件 | 改动 |
|---|---|
| `src/shared/ai/probability.ts` | 新增：`redExpectation` 与 `EVAL_SCALE` |
| `src/shared/ai/index.ts` | 导出 `redExpectation`（`evaluate` 也一并出口，页面侧要用） |
| `src/client/panel/EvalBar.tsx` | 新增：条 + 两个数字 |
| `src/client/panel/GamePanel.tsx` | 记谱格加百分比（`.move-eval` 兄弟节点）；着法区顶部插 `EvalBar` |
| `src/client/pages/OnlinePage.tsx` | 用 `replayHistory` 算序列，插 `EvalBar`，记谱行加百分比 |
| `src/client/pages/ReplayPage.tsx` | 同上 |
| `src/client/App.tsx` | 设置浮层加开关 |
| `src/client/storage/prefs.ts` | `xiangqi.eval.v1` 读写（沿用 `KeyValueStore` 注入、默认 `defaultStore()` 的既有形制） |
| `src/client/panel/useEval.ts` | 新增：`useEvalEnabled`（`useSyncExternalStore` + 模块级 store） |
| `src/client/styles/panel.css` | 概率条与 `.move-eval` 的版式（条、两色块、手机档 20px 行） |
| `src/client/styles/play.css` | 联机页单列记谱的 `.move-eval` 版式 |
| `test/probability.test.ts` | 新增：映射单调、终局收敛、互补 |
| `test/integration/eval.test.tsx` | 新增：F5-7 的集成行（四页观察 + 开关记住） |
| `test/RTM.md` | 新增 F5-7 行；「用例实现」段补一句 |

分档结论：涉及的每个文件都在 500 行内。实测 `src/client/panel/GamePanel.tsx` 244 行、`src/client/pages/ReplayPage.tsx` 373 行、`src/client/pages/OnlinePage.tsx` 444 行（本批最大的一个，加条与逐着百分比后预计 +20 行，仍离 500 档有三十余行余量）；`src/client/App.tsx` 与新增件都在 300 行内。**本批不需要拆分方案**；若实施时 `src/client/pages/OnlinePage.tsx` 越过 500 行，按面板/联机两块拆出，不拖到下一批。

### 验收

| 层 | 手段 |
|---|---|
| 概率函数 | `test/probability.test.ts`：均势≈50%、红方净一车≥95%、黑白互补；终局三分支（红胜/黑胜/和）分别 100/0/50——直接传 `result` 断言，不靠局面推 |
| 显示 | 集成用例：对弈页走两着，两格都有百分比、条上的数字与末格一致；联机页与回放页各一条最小观察（条在、数字与末格一致）；人机页共用 `GamePanel`，随对弈一并覆盖 |
| 改动面命令 | `node --test test/probability.test.ts`（集成半段在收口行报告） |

### 集成测试设计

起点是 `test/RTM.md` 的「## 性能（需求 F5）」：该节现有 F5-1 / F5-2 / F5-3 / F5-4 / F5-6 五行，**本变更新增 F5-7「每步胜率」一行**（业务结果「每一着后给出双方胜负概率；四个棋局页面都显示；有开关且记住」，用户入口「打开页面 → 对弈 → 走子」，需求 F5.7，用例实现 `test/integration/eval.test.tsx`）。「用例实现」段同步补一句，形如既有的「F5-6 另有一条集成用例 `test/integration/sound.test.tsx`」。

| 分类 | 结论 |
|---|---|
| 破坏 | **有，一处**：`test/integration/navigation.test.tsx` 对 `.move-red` / `.move-black` 用 `toBe` 断言整段文本（F4-1 的「切页回来记谱不变」）。百分比必须渲染在这两个 span **之外**的兄弟节点上（`.move-eval`），格子文本保持原样；若放进格子里，那三处断言要同批改。本批取前者。 |
| 冗余 | 无：不复制任何既有对局用例 |
| 缺失 | 一行：F5-7 的集成行——对弈页走两着，断言「两格都有百分比」「概率条数字与末格一致」「关掉开关后两者都不显示、重开页面仍是关」；同一行再带两条最小观察：联机页收到快照后条在且数字与末格一致、回放页游标走到终局后条与结果一致 |

该行的断言只取业务可观察结果（有没有数字、数字是否一致、开关是否记住），不取内部浮点精度；映射精度留给 `test/probability.test.ts`。
