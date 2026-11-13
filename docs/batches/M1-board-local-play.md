# 2026-11-13 · M1 棋盘组件 + 本地双人
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-13 · 来源 = 用户 2026-11-13「继续M1」；范围取 docs/design/architecture.md 里程碑表 M1。
> 台账 = #1（xiangqi · 归批）。前情 = M0 规则引擎（提交 37e70c8）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

本批判据：architecture 里程碑「| M1 | 棋盘组件 + 本地双人 | 浏览器里能下完一局；三档视口切换局面不丢 |」；需求侧覆盖 F1.1（本地双人同屏）、F4.1–F4.4（一套界面 / 状态不丢 / 格宽 ≥40 / 点选为主拖动为辅）、F5.1（简约）、F5.3（走子 <16ms）。

本批交付：
- 客户端脚手架：Vite + React 19 + TypeScript，`npm run dev/build/preview`；tsconfig 开 `jsx: react-jsx`。
- 棋盘组件：SVG `viewBox 0 0 900 1000`，按 docs/design/modules/board-ui.md 八层渲染；命中按 `getBoundingClientRect()` 现算，半径 45；点选两段式 + pointer 拖动增强；键盘 Tab/Enter/方向键/Esc；棋子 aria-label + 状态 aria-live。
- 本地双人：纯 reducer（position / history / notations / lastMove / result / selected / targets），走子经 `playMove` + `judgeGame`，终局锁盘，新局复位。
- 三档响应式：≥1024 左棋盘右固定栏；768–1023 上棋盘下抽屉 40%；<768 棋盘占宽 + 底部抽屉 ≤50dvh；手机横屏棋盘左面板右；`dvh`、`ResizeObserver`。
- 测试：几何换算与尺寸规则、会话 reducer；按 AGENTS.md 放 `test/`。

本批不做（按里程碑留给后续批次）：F4.5 PWA manifest、F1.2 联机、F1.3 人机、M5 计时/认输求和/棋谱回放、M2 教学与练习。

关键判据：
- 规则唯一真相：客户端不判规则，走法、将军、终局全部来自 `src/shared/`。可落点高亮改用 `generateLegalMoves`，不用伪合法的 `generateMoves`——伪合法会把送将的着法画成可落点，点下去必然被引擎拒，界面等于教错；docs/design/modules/board-ui.md §3 的措辞同步改。
- 状态不丢：局面只存在单一 reducer 状态里；三档布局只改 CSS 与棋盘像素尺寸，不重挂载棋盘、不重建状态。缩放时 `ResizeObserver` 只重算尺寸与命中，不触碰对局数据。
- 格宽 ≥40：尺寸函数以棋盘宽 360px 为下限，超窄屏横向滚动而不缩格。
- 简约：面板只保留行棋方/状态、着法列表、新局三件事；不做装饰性元素。

取舍（计划中已列明，用户「继续」授权）：拖动用 Pointer Events 轻量实现，不引手势库；着法列表保留，因为它同时服务「能下完一局」的核对与记谱引擎联动。

上抛项：无。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

设计档落点：新增 `docs/design/modules/local-play.md`（会话状态机、文件划分、交互落点、响应式布局、测试与验收）；同步修正 `docs/design/modules/board-ui.md` §3 的高亮口径为 `generateLegalMoves`。

机制设计：
- 会话 reducer（`src/client/game/session.ts`）持有 `startFen / position / history / notations / lastMove / result / status / selected / targets`；动作 `select` / `tap` / `reset`。`tap` 顺序：终局忽略 → 命中合法落点走子 → 点己方子选中或取消 → 其余取消选中。走子链路 `toChineseNotation` → `playMove` → `statusOf` + `judgeGame`，非法着法由引擎抛错，客户端不自己判。
- 几何（`src/client/board/geometry.ts`）：viewBox 900×1000、首点 (50,50)、间距 100、命中半径 45；`boardSize` 按 9:10 计算，高度上限 720，宽下限 360（格宽 40）。
- 棋盘（`src/client/board/Board.tsx`）：按 `docs/design/modules/board-ui.md` 八层渲染；指针按下选中、抬起落点走子，拖动超阈值才出幽灵子；键盘 Tab/Enter/方向键/Esc；棋子 `role="img"` + aria-label，状态 `aria-live`。
- 布局（`src/client/App.tsx` + `src/client/app.css`）：桌面左棋盘右 320px 侧栏；平板上下结构抽屉 40dvh 可收；手机底部抽屉 ≤50dvh；手机横屏棋盘左面板右；`dvh` 与 `ResizeObserver` 只改尺寸不动状态。

受影响文件与测试覆盖：

| 文件 | 动作 |
|---|---|
| `package.json` / `package-lock.json` | 增 react、react-dom、vite、@vitejs/plugin-react、@types/react、@types/react-dom；增 dev/build/preview 脚本 |
| `tsconfig.json` | 增 `jsx: react-jsx`，include 加 `vite.config.ts` |
| `index.html`、`vite.config.ts`、`src/client/vite-env.d.ts` | 新增脚手架 |
| `src/client/board/geometry.ts`、`src/client/game/session.ts` | 新增纯逻辑 |
| `src/client/board/Board.tsx`、`src/client/panel/GamePanel.tsx`、`src/client/App.tsx`、`src/client/app.css`、`src/client/main.tsx` | 新增界面 |
| `src/shared/rules.ts` | 导出 `kingSquareOf`，内部 `findKing` 改为调用它（将军高亮要用） |
| `test/client-geometry.test.ts`、`test/client-session.test.ts` | 新增单测 |
| `test/rules.test.ts` | 增 `kingSquareOf` 一条断言 |

验收对照：

| 验收 | 落点 |
|---|---|
| 能下完一局并判出结果 | 会话 reducer 走 `judgeGame`；面板展示终局并锁盘 |
| 三档视口切换局面不丢 | 状态在 reducer；布局只由 CSS 与尺寸测量决定 |
| 格宽 ≥40 CSS px | `boardSize` 下限 360；单测断言 |
| 点选为主、拖动为辅 | 指针两段式 + 拖动阈值，共用命中换算 |
| 简约 | 面板只留状态、着法、新局 |

关键决策：可落点用 `generateLegalMoves`（伪合法会教错着）；棋子以交叉点为 key（引擎无棋子身份），走子重绘两枚，性能预算不受影响；不引组件库、CSS-in-JS、状态管理框架，符合 architecture 技术栈约束。

上抛项：无。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

### 评审发现（设计评审 — M1 棋盘组件 + 本地双人）

文档地图缺失（文档根无地图文件），文档归属判定按 AGENTS.md 的层级表降级执行：本表据此检查 `docs/requirements/`、`docs/design/`、`docs/design/modules/` 的落位，未能核对更细的归属映射。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | 验收（集成测试设计） | 🔴 | `docs/design/modules/local-play.md` §7 的验收只有「浏览器实跑」与两个纯函数单测文件，没有从 test 目录的需求—测试矩阵（RTM）出发的集成测试设计节；`test/` 下也不存在任何 RTM 文件（该目录只有 8 个 `*.test.ts`），docs 全检索无 RTM 记录。F1.1「一台设备上红黑轮流走，能下完一局并判出结果」是可从用户入口观察的业务结果，现在只挂在一句人工实跑上，没有用例断言组件间交互的结果。 | 补写集成测试设计节：先建 test 目录的 RTM（每条业务故事一节、每个集成用例一行，行号在写用例标题前定死），再让该节以 delta 形式回答——本批破坏/冗余/缺失哪些行，每行写明评估的组件间交互、断言的业务结果、用户进入业务的入口、追溯到的需求编号（如 F1.1）。 |
| 2 | 文档归属（既有文档矛盾） | 🔴 | 走子渲染与动画这一套机制在两份在用文档里写法相反：`docs/design/modules/board-ui.md` §2「走子只改 transform，不重建节点、不改 viewBox」、§6「动画只碰 `transform` 与 `opacity`，时长 150ms，`prefers-reduced-motion: reduce` 时关闭」；`docs/design/modules/local-play.md` §4「棋子节点以交叉点为 key（引擎棋盘不带棋子身份），走子重绘起点与终点两枚」、§6「走子由 React 一次提交完成，不加过渡动画」。以交叉点为 key 时一枚棋子的「移动」是两处节点的文本互换、起点节点直接卸载，与「只改 transform」不是同一套；`src/client/app.css` 全篇没有 `transition` 与 `prefers-reduced-motion` 规则。`docs/design/modules/board-ui.md` 未被修订，读者无法判断哪份权威，M2 接入 demo 模式（其 §4「被吃子淡出」）会直接撞上。 | 二选一并统一到 owning 文档：若采用交叉点为 key + 无动画，就把 `docs/design/modules/board-ui.md` §2/§6 改成这套写法（并删掉 150ms 与 reduced-motion 条款）；若要保留棋子身份节点与 150ms 动画，就让 `docs/design/modules/local-play.md` §4/§6 改回并给出理由。无论哪种，两份文档只留一份描述。 |
| 3 | 文档归属（重复描述） | 🟡 | `docs/design/modules/local-play.md` §5 把 `docs/design/modules/board-ui.md` §5 的响应式尺寸表又写了一遍，且更松：后者的 <768px 行是「`min(容器宽, (可用高 - 面板高) * 0.9)`，**且格宽 ≥ 40px**」，前者同一行只剩「抽屉 ≤50dvh；棋盘按剩余区域计算」，公式没了；「由棋盘舞台横向滚动」又是 `docs/design/modules/board-ui.md` 没有的新说法。 | 让 §5 只留 M1 真正新增的决策（三档下棋盘舞台的滚动与抽屉开合），尺寸公式改为指向 `docs/design/modules/board-ui.md` §5；或把该 §5 的表格并过来，两处只留一份。 |
| 4 | 文档归属（偏差未登记） | 🟡 | `docs/design/modules/board-ui.md` §4 把棋盘组件入参写成 `type BoardMode = | { kind: 'play'; side: Color | 'both'; legalMoves: Move[] } …`，`docs/design/modules/local-play.md` §1 只说「M1 只接对弈模式所需的部分」，§4 的偏差登记里没有这一条，`docs/design/modules/board-ui.md` §4 也未修订；实际 `src/client/board/Board.tsx` 用的是 `movable: Color | 'both'` + `interactive` + `targets`，没有 mode 联合。组件契约因此有第二个版本。 | 在 §4 明确写出「M1 用扁平 props 替代 `BoardMode`，M2 接入 demo/drill 时如何收口」，并同步修订 `docs/design/modules/board-ui.md` §4（或保留联合、把 props 收敛进 `kind: 'play'` 一臂），使组件契约只有一个版本。 |
| 5 | 清晰度 | 🟡 | `docs/design/modules/local-play.md` §4 写「M1 的实现落点与两处偏差：」后面却跟了五条，其中「可落点高亮取自 `generateLegalMoves`」「键盘…」「无障碍…」三条在 `docs/design/modules/board-ui.md` §3/§7 已有同样规定，不算偏差；读者数不出那「两处」具体指哪两条。 | 把「偏差」与「沿用既有规格的落点」分开列：偏差条目逐条说明偏离了什么、为什么；沿用条目改成指向 `docs/design/modules/board-ui.md` 的章节号。 |
| 6 | 影响文件分层 | 🟡 | `docs/design/modules/local-play.md` §2 的文件表只有「文件 / 职责」两列，没有分层结论行。本轮实测：`src/client/board/Board.tsx` 394 行、`src/client/app.css` 390 行、`src/client/panel/GamePanel.tsx` 127 行、`src/client/game/session.ts` 119 行、`src/client/board/geometry.ts` 88 行、`src/client/App.tsx` 67 行、`src/client/main.tsx` 13 行，两个测试文件 53 与 117 行，无一超过 500 行，因此不需要拆分方案；但「哪些文件跨档、各自怎么拆，或一个都不跨」这句话在文档里缺席。 | 在 §2 表后加一行结论，例如「本批源文件与测试文件均未跨 500 行档，无需拆分方案」，把实测口径固定下来。 |
| 7 | 验收（错误路径） | 🟡 | `docs/design/modules/local-play.md` §7 声称 `test/client-session.test.ts` 覆盖「…非法着法…」，但该文件里只有「点不可落点取消选中，棋局不动」这一条 UI 层取消，没有任何用例走到该模块 §3 写的「（非法着法直接抛错）」；这条错误路径目前只有描述、没有验证。 | 补一条用例直接喂一个非 targets 的着法给 session（或直接断言 `playMove` 对非法着法抛错），或在 §7 把「非法着法」改成实际覆盖到的「点不可落点取消选中」。 |
| 8 | 需求覆盖 | 🟡 | `docs/requirements/xiangqi.md` F4.5「可添加到主屏全屏运行 | PWA manifest + 图标」与 §4「v1 采用简化判罚，并在规则页明示采用哪一版」「长捉、一将一闲等复杂判罚不在 v1 范围内，规则页写明」，在 `docs/design/architecture.md` §8 的 M0–M6 里程碑表里没有任何一批承接，五份文档中也无一处设计规则页或 manifest。 | 在 `docs/design/architecture.md` §8 里程碑表补上承接批次（或写明放到 v1 之后的哪个批次），让这两条需求有 owner，避免交付时才发现无人认领。 |
| 9 | 文档一致性（契约滞后） | 🟡 | `docs/design/rules-engine.md` 自称「本文件是 M0 的实现契约：实现与测试都按此判定」，但 §5–§7 的契约里没有 `playMove` / `recordMove` / `naturalLimitResult`；`docs/design/modules/local-play.md` §3 的主要落子入口恰恰是 `playMove`（「`playMove` 得新局面与 `history`（非法着法直接抛错）」），而这些函数确实在 `src/shared/rules.ts` 里导出。引擎契约已不能描述线上引擎。 | 在 `docs/design/rules-engine.md` §5/§6 补上 `playMove`、`recordMove`、`naturalLimitResult` 的签名与语义（以及与 `applyMove` 的分工），让契约与实现同版。 |
| 10 | 清晰度 | 🔵 | `docs/design/modules/local-play.md` §3 用「由 `checkSquareOf` 取被将方将帅坐标画高亮」，但其 §2 的文件表没有把这个导出挂到任何文件，而 `docs/design/rules-engine.md` 里同职能的引擎函数叫 `kingSquareOf`；它在代码里是 `src/client/game/session.ts` 的客户端辅助函数。读者会先去引擎层找。 | 写成「`src/client/game/session.ts` 的 `checkSquareOf`（内部调引擎的 `kingSquareOf`）」，并把该导出补进 §2 的职责列。 |
| 11 | 分层（前瞻） | 🔵 | `src/client/board/Board.tsx` 394 行里 `Board` 组件单函数约占 288 行，尚未到 300 行函数档，但 `docs/design/modules/local-play.md` §1 已写明 M2 要在这个组件里接入 demo/drill 两臂，按现在的形态接入时几乎必然越档。 | 借 M1 收尾把棋盘拆成「底图 / 棋子层 / 标记层」三个内部组件（几何与命中仍留在 `src/client/board/geometry.ts`），让 M2 的三模式接入有落点。 |

计数：🔴 2 · 🟡 7 · 🔵 2 · 合计 11

VERDICT: changes-required

### 轮次 2（评审子代理）

复核（第二轮）：逐条核验整改声明 + 复查新矛盾。范围 = `docs/design/modules/local-play.md` · `docs/design/modules/board-ui.md` · `docs/design/rules-engine.md` · `docs/design/architecture.md` · `docs/requirements/xiangqi.md` · `test/RTM.md` · `AGENTS.md`，外加受影响文件表内源/测试文件的尺寸抽检。无 document map，文档归属按 `AGENTS.md` 文档表判定（记此限制）。

已核验通过（不构成发现）：
- 行档结论行（`docs/design/modules/local-play.md` §2）自测核对：Board.tsx 394 / app.css 390 与作者声明一致；session.ts 119、GamePanel.tsx 127、geometry.ts 89、App.tsx 67、main.tsx 13；最长单函数 `Board` 约 288 行 < 300。无跨档，无需拆分方案。
- Closest precedent 行在案（前例 `docs/design/modules/board-ui.md`，写明沿用 viewBox/命中半径/八层顺序/三档尺寸）；Survey evidence 行在案（`docs/design/architecture.md`、`docs/design/modules/board-ui.md`、`docs/requirements/xiangqi.md` 的 F1.1 F4.1–F4.4 F5.1 F5.3、`src/shared/rules.ts` 与 `src/shared/notation.ts`，并声明未发现冲突）。
- 集成测试设计 §8 在案：起点 `test/RTM.md`「对弈」故事，声明新增 F1-1 一行、不破坏/不冗余/不缺失既有行，给出入口/组件间交互/业务结果/追溯需求/执行；`test/RTM.md` 的 F1-1 行与 `test/integration/local-play.test.tsx` 均存在，断言文案与 GamePanel 一致。
- 设计档无修订式残留；「8 着后三次重复」与 `docs/design/rules-engine.md` §6.1（起始局面计入）自洽。

| # | Category | Severity | Issue | Suggestion |
|---|---|---|---|---|
| 1 | Feasibility / 文档归属 | 🔴 | `docs/design/modules/board-ui.md` §5 的 768–1023px 行写「宽度取容器宽，高度按 9:10」，但 `src/client/board/geometry.ts` 的 `boardSize` 是先定高再定宽：「const width = Math.max(MIN_BOARD_WIDTH, Math.min(areaWidth, heightLimit * (VIEW_WIDTH / VIEW_HEIGHT)));」，`test/client-geometry.test.ts` 还把这条钉成用例（「可用宽大于高时以高为准，宽度仍守 40px 下限」）。按 §5 原文在 900×768 下棋盘宽 876 / 高 973，而该档棋盘舞台仅约 437 高（抽屉占 40dvh），该行不可实现；实现在用的统一公式在任何设计档里没有记录。 | 两面选一面改、只留一份：`docs/design/modules/board-ui.md` §5 该行把高度上限（容器可用高）写进公式，例如宽 = min(容器宽, 可用高 × 0.9)；或在 `docs/design/modules/local-play.md` §5 声明本批采用一条统一尺寸公式并说明它与三档表的关系。哪一面改由你定。 |
| 2 | Clarity | 🟡 | `docs/design/modules/local-play.md` §5「棋盘宽低于容器时由棋盘舞台横向滚动，格宽不缩。」触发条件写反：需要横向滚动的是“舞台窄于棋盘最小宽 360”那一侧，板比容器窄时是留白不是滚动。且该滚动说法 `docs/design/modules/board-ui.md` §5 没有（那边是「允许横向留白，**不继续压小**」），而响应式尺寸的拥有者是它。 | 触发条件改成“舞台宽 < 360 时”，并决定这条规则落在 `docs/design/modules/board-ui.md` §5（拥有者）还是作为 local-play 的新增决策，两处只留一份。 |
| 3 | Acceptance | 🟡 | `docs/design/modules/local-play.md` §7 的验收只到套件级：「集成用例 F1-1（`npm run test:ui`）走到三次重复判和并锁盘」，单元侧只列文件名不给命令（「单元测试：`test/client-geometry.test.ts` 覆盖坐标换算、命中半径、三档尺寸」）；`npm run test:ui` 即 `vitest run` 全套。 | 验收写成改到的那几个文件：`node --test test/client-geometry.test.ts test/client-session.test.ts` 与 `npx vitest run test/integration/local-play.test.tsx`；`npm run check` 留给收口行。 |
| 4 | Acceptance | 🟡 | 验收与 `test/RTM.md` 只覆盖和棋一种结局。F1.1 的验收是「能下完一局并判出结果」，而 `src/client/panel/GamePanel.tsx` 有五个结局分支（`case 'stalemate':` → 「${winnerName(result.winner)}胜 · 困毙」、「${winnerName(result.winner)}胜 · 长将判负」、「'和棋 · 60 回合无吃子'」等），被断言的只有「expect(screen.getByRole('status').textContent).toContain('和棋 · 三次重复局面');」。困毙判负是 `docs/requirements/xiangqi.md` §4 特意点出的口径，文案错了没有用例会红。 | 给胜负结局定一条可跑的验收（例如以带起始局面的入口渲染面板断言文案），或在 §8 写明为什么胜负结局在 M1 从入口不可达；二选一，但别留空。 |
| 5 | Existing-piece check | 🟡 | `docs/design/modules/local-play.md` 全篇没有 `existing: …` / `none found: …` 三问行。棋盘侧的既有关系只答了一半（「组件入参与交互语义统一由 `docs/design/modules/board-ui.md` §1–§4 规定」在案；「由 `src/client/game/session.ts` 的 `checkSquareOf` 取被将方将帅坐标画高亮（内部调引擎的 `kingSquareOf`）」算答了引擎既有件）；但面板新增的用户可见文案（「和棋 · 三次重复局面」「新局」「收起」/「展开」）与 `src/client/game/session.ts` 的 reducer 没有任何“既有/查无”交代。 | 对新增面板文案与会话模块补一行三问（`existing: …` / `none found: …` / `existing but unusable: …`），把“查过”这件事留在档上。 |
| 6 | Clarity | 🔵 | 引擎契约与客户端依赖不一致：`docs/design/rules-engine.md` §6 只有内联联合「statusOf(pos): 'playing' \| 'check' \| 'checkmate' \| 'stalemate'」，没有类型名 `GameStatus`，而代码是「export function statusOf(pos: Position): GameStatus {」且 `src/client/game/session.ts` 从 `src/shared/index.ts` 取该类型；同理 `INITIAL_FEN`、`pieceAt`、`xOf`、`yOf` 被客户端直接 import（「import { pieceAt, pieceName, xOf, yOf } from '../../shared/index.ts';」），§2 类型清单与 §9 文件表都不给这些名字。 | 在 `docs/design/rules-engine.md` §2 补 `GameStatus`（并点名 `INITIAL_FEN`、`pieceAt`、`xOf`、`yOf`），或让 `docs/design/modules/local-play.md` §2 的引擎依赖列全；二者取一。 |
| 7 | Clarity | 🔵 | `docs/design/modules/local-play.md` §3「`reset(startFen?)` 开新局」没说不带参时回到哪里；实现是「return createSession(action.startFen ?? state.startFen);」，即回到本局起始局面而非固定初始局面——这正是「新局」的语义。 | §3 补一句不带参时的默认（回到 `startFen`）。 |
| 8 | Clarity | 🔵 | `docs/design/modules/local-play.md` §4「拖动超过阈值才显示幽灵棋子」没给阈值，实现在 `src/client/board/Board.tsx` 是「const DRAG_THRESHOLD = 6;」。 | 把选定阈值写进 §4，让“拖动为增强”有可复现门槛。 |
| 9 | Clarity | 🔵 | `docs/design/modules/local-play.md` §2 文件表列了 7 个前端文件，但 `src/client/main.tsx` 依赖的 `index.html`（「const container = document.getElementById('root');」）没列，照表建工程会缺挂载点。 | 在 §2 表补 `index.html`，或注明它属构建脚手架、不在本模块表内。 |

计数：🔴 1 / 🟡 4 / 🔵 4。

VERDICT: changes-required

### 轮次 3（评审子代理）

复核（第三轮）：逐条核验上轮 1🔴/4🟡/4🔵 的整改，并复查修复是否引入新矛盾。九项全部 Fixed；新增 1🟡 / 1🔵，无新增 🔴。

| # | Orig# | 文件 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|---|
| 1 | 1 | `docs/design/modules/board-ui.md` | 🔴 | Fixed | §5 改为一条统一公式：「宽 = max(360, min(容器宽, min(容器高, 720px) × 0.9))」「高 = 宽 × 10 / 9」，与 `src/client/board/geometry.ts` 的 `const heightLimit = Math.max(0, Math.min(areaHeight, maxHeight));` 和 `const width = Math.max(MIN_BOARD_WIDTH, Math.min(areaWidth, heightLimit * (VIEW_WIDTH / VIEW_HEIGHT)));` 逐项一致；原 768–1023px 行「宽度取容器宽，高度按 9:10」已删，文档与出货行为一致。 |
| 2 | 2 | `docs/design/modules/local-play.md` | 🟡 | Fixed | 倒置的触发条件已删；滚动规则落在拥有者 `docs/design/modules/board-ui.md` §5：「容器宽不足 360px 时棋盘保持 360px，由棋盘舞台横向滚动，不继续压小。」local-play §5 只留「棋盘尺寸公式、格宽下限与滚动规则由 `docs/design/modules/board-ui.md` §5 规定。」；`src/client/app.css` 有「overflow: auto;」，行为相符。 |
| 3 | 3 | `docs/design/modules/local-play.md` | 🟡 | Fixed | §7 改为文件级命令：「集成用例 F1-1（`npx vitest run test/integration/local-play.test.tsx`）走到三次重复判和并锁盘」与「单元测试：`node --test test/client-geometry.test.ts test/client-session.test.ts` 覆盖坐标换算」；`npm run check` 只出现在收口句，不再充当验收命令。 |
| 4 | 4 | `docs/design/modules/local-play.md` | 🟡 | Fixed | `test/game-panel.test.tsx` 已存在（47 行），五条文案逐条断言，如「expect(statusTextOf({ type: 'checkmate', winner: 'red' })).toContain('红方胜 · 将死');」；§7 增「五种结局文案正确」一行；§8 增「五种结局文案由 `test/game-panel.test.tsx` 在组件层断言；App 没有残局入口，胜负结局不从集成入口构造。」，即上轮要求的"或在 §8 写明理由"。 |
| 5 | 5 | `docs/design/modules/local-play.md` | 🟡 | Fixed | §2「现有件检查」四行在案：「existing：棋盘与交互沿用」「none found：会话 reducer 是新模块」「existing but unusable：`checkSquareOf` 是新增导出」「none found：面板文案…都是新增用户可见文案」，覆盖上轮点名的文案与会话模块。 |
| 6 | 6 | `docs/design/rules-engine.md` | 🔵 | Fixed | §2 增 `export type GameStatus` 一行（playing/check/checkmate/stalemate），§6 签名改用「statusOf(pos): GameStatus」，§9 点名「`INITIAL_FEN` / `parseFen` / `toFen` / `initialPosition`」与「`indexOf` / `xOf` / `yOf`、`pieceAt`」，与 `src/client/game/session.ts` 的 import 面一致。 |
| 7 | 7 | `docs/design/modules/local-play.md` | 🔵 | Fixed | §3 增「`reset` 不带 `startFen` 时回到本局起始局面（`state.startFen`）；带参时从新起始局面开一局。」；`src/client/game/session.ts` 为「return createSession(action.startFen ?? state.startFen);」，一致。 |
| 8 | 8 | `docs/design/modules/local-play.md` | 🔵 | Fixed | §4 写「拖动超过 6px 才显示幽灵棋子」；`src/client/board/Board.tsx` 为「const DRAG_THRESHOLD = 6;」与「if (distance < DRAG_THRESHOLD) return;」，一致。 |
| 9 | 9 | `docs/design/modules/local-play.md` | 🔵 | Fixed | §2 文件表补 `index.html` 行：职责写「Vite 入口，提供 `#root` 挂载点。」，与 `src/client/main.tsx` 的「const container = document.getElementById('root');」相符。 |
| 10 | (new) | `docs/design/modules/board-ui.md` | 🟡 | New | §5 新句「宽与高同时受约束，棋盘不越出舞台。」与同节「容器宽不足 360px 时棋盘保持 360px，由棋盘舞台横向滚动，不继续压小。」以及公式外层 `max(360, …)` 相抵触——容器窄于 360px 时棋盘正是越出舞台、靠滚动进入视野。照「不越出舞台」实现会违反 F4.3 的 40px 格宽下限。建议把这句限成"除格宽下限那一档外"，或删去「棋盘不越出舞台」。 |
| 11 | (new) | `docs/design/modules/local-play.md` | 🔵 | New | §2「existing：棋盘与交互沿用 `docs/design/modules/board-ui.md`，几何、八层渲染、交互表、响应式与无障碍都由该档规定，本批按 §1–§4 使用。」枚举了响应式（§5）与无障碍（§7），却把在案范围截在 §1–§4；而 §5 又明写「棋盘尺寸公式、格宽下限与滚动规则由 `docs/design/modules/board-ui.md` §5 规定。」。建议范围写「§1–§7」，或删掉逐项枚举。 |

计数：🔴 0 / 🟡 1 / 🔵 1（上轮 9 项全部 Fixed，复核无遗留）。

VERDICT: pass

## §4 用户批准（主 agent）

用户于 2026-11-14 以「收口」确认本批交付，批准收口。

- 确认范围：M1 全部交付（客户端脚手架、棋盘组件、本地双人、三档响应式、测试与文档）。
- 评审状态：§3 第三轮 pass；两条非阻塞意见已修正。
- 用户未授权 git 提交：本批改动留在工作树，未提交。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



实施范围：
- 新增：`src/client/board/geometry.ts`、`src/client/board/Board.tsx`、`src/client/game/session.ts`、`src/client/panel/GamePanel.tsx`、`src/client/App.tsx`、`src/client/app.css`、`src/client/main.tsx`、`src/client/vite-env.d.ts`。
- 新增脚手架：`index.html`、`vite.config.ts`、`vitest.config.ts`。
- 新增测试：`test/RTM.md`、`test/client-geometry.test.ts`、`test/client-session.test.ts`、`test/game-panel.test.tsx`、`test/integration/local-play.test.tsx`。
- 修改：`package.json`、`tsconfig.json`、`AGENTS.md`、`src/shared/rules.ts`（导出 `kingSquareOf`）、`src/shared/notation.ts`（导出 `pieceName`）、`test/rules.test.ts`。
- 设计档同步：`docs/design/modules/local-play.md`、`docs/design/modules/board-ui.md`、`docs/design/rules-engine.md`、`docs/design/architecture.md`。

关键实现：
- 会话（`src/client/game/session.ts`）：`startFen / position / history / notations / lastMove / result / status / selected / targets`；`select` 只选中不切换，`tap` 按终局 → 合法落点 → 己方子 → 取消的顺序判定；走子 `toChineseNotation` → `playMove` → `judgeGame`；`reset` 无参回到 `state.startFen`；`checkSquareOf` 取被将方将帅。
- 几何（`src/client/board/geometry.ts`）：`pointOf` / `squareAtViewPoint`（最近交叉点 + 半径 45 过滤）/ `clientToViewPoint`（每次现算 rect）/ `boardSize`（9:10、高度上限 720、宽下限 360）。
- 棋盘（`src/client/board/Board.tsx`）：八层 SVG 渲染；`pointerdown` 选中并捕获指针、`pointerup` 落点走子、拖动 6px 出幽灵子；键盘 Tab/Enter/方向键/Esc；棋子 `role="img"`、棋盘 `role="group"`、状态 `aria-live`。
- 布局（`src/client/App.tsx` + `GamePanel.tsx` + `app.css`）：`useReducer` 单状态；`ResizeObserver` 只改棋盘像素尺寸；桌面右 320px 侧栏、平板 40dvh 抽屉、手机 42dvh 抽屉（≤50dvh）、横屏左右；面板只留状态、着法、新局。
- 测试：`node --test` 94 项纯逻辑；`vitest run` 8 项（3 项集成 F1-1 + 5 项五种结局文案）；`npm run check` = typecheck + 两者。

评审整改：三轮设计评审（见 §3），从 2🔴/7🟡/2🔵 到 1🔴/4🟡/4🔵 再到 pass；第一轮两盏红灯分别由「RTM + 集成用例」与「board-ui/local-play 的棋子渲染与动画统一为一套」消除；第三轮两条非阻塞意见（`docs/design/modules/board-ui.md` §5 越界措辞、`docs/design/modules/local-play.md` §2 范围笔误）已在收尾修正。

验证读数：
- `npm run check`：typecheck 通过；单测 94 项全过；前端用例 8 项全过；0 fail。
- `npm run build`：JS 242.22 kB / gzip 76.55 kB（预算 150 kB 内）；CSS gzip 1.49 kB。
- 浏览器最终代码：1414×807 棋盘 648×720、格宽 72，点红炮选中并给出 12 个落点；拖动走 `炮八进一`。
- 最终代码三档：iframe 375×667 棋盘 360×400、格宽 40、面板 280 可收；1280×800 棋盘 648×720、格宽 72、面板 320；375→1280 后 `黑方走棋`、`1.炮八进一` 保留。
- 更早同批实跑：800×700 平板上下结构；667×375 横屏左右结构；8 着三次重复判和并锁盘、新局复位；键盘 `车九进一`。

已知边界：将军/将死的棋盘高亮由 `checkSquareOf` 与 `kingSquareOf` 单测覆盖，浏览器里未单独构造将军局面；F4.5 PWA、联机、计时、棋谱回放不在 M1。

## §6 验证与收口（父代理）

收口验证（2026-11-14）：
- `npm run check` 全绿：typecheck 通过；`node --test` 94 项全过；`vitest run` 8 项全过（3 项集成 F1-1 + 5 项结局文案）。
- `npm run build` 成功：JS gzip 76.55 kB（预算 150 kB 内）；CSS gzip 1.49 kB。
- 浏览器最终代码：桌面 1414×807 棋盘 648×720、格宽 72；手机 375×667 棋盘 360×400、格宽 40、面板 280；375→1280 后「黑方走棋」「1.炮八进一」保留。
- 收口测试行：`npm run check` 为本批收口闸门；集成用例 F1-1 从 `App` 入口走完 8 着三次重复并锁盘。

M1 验收对照：

| 验收 | 结果 | 证据 |
|---|---|---|
| 浏览器里能下完一局 | 通过 | 集成用例 F1-1 + 浏览器实跑（点选、拖动、键盘、判和锁盘、新局） |
| 三档视口切换局面不丢 | 通过 | 375→800→1280 实跑，局面、着法、选中保留 |
| 格宽 ≥40 CSS px | 通过 | 手机档 360 / 9 = 40；`boardSize` 单测 |

遗留与边界：
- 将军/将死的棋盘高亮由 `checkSquareOf` 与 `kingSquareOf` 单测覆盖，浏览器未单独构造将军局面。
- F4.5 PWA、联机对战、计时/认输求和/棋谱回放按里程碑留给后续批次。
- 棋盘组件拆分建议（Board 单函数约 288 行）留到 M2 接入 demo/drill 时执行。

台账：#1 在收口链中结算为已核销，证据指向本节与 `npm run check` 读数。
