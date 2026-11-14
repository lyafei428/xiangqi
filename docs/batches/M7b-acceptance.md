# 2026-11-14 · M7b 发布前验收
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户「开」——按 M7 收口时的建议，开一批发布前三端与性能验收。
> 台账 = #10（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户回「开」，按 M7 收口时的建议开这一批：把 F4.2 / F4.3 / F5.2 / F5.3 / F5.4 的真机读数补上。

为什么现在做：这些阈值从 M1 起就没留过读数，`test/RTM.md` 的响应式节自己写着「由浏览器实跑，引入浏览器级测试框架后补行」。M7 之后 v1 的功能面已经齐了，再往后就是发布，读数必须落在发布前。

做法：不引测试框架，写一个 node 内置模块的 CDP 脚本（`scripts/acceptance.mjs`），驱动本机 Edge 在三个视口跑同一组检查，不达阈值退出码非 0。Lighthouse 综合分取不到（本机无 lighthouse CLI），只给 LCP / CLS / 长任务读数，综合分标 unverified。

范围外：真机手机观感（只做 CDP 合成触摸）、真机 4G 网络时延（本地读数偏乐观）。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

发布前验收：F4.2 连续缩放不丢状态、F4.3 格宽 ≥ 40px、F4.4 触摸与鼠标同一套交互、F5.2 首屏请求 ≤ 6 与 4G 估算、F5.3 走子到画面 < 16ms、F5.4 CLS < 0.05。

**设计**

`docs/design/acceptance.md`：阈值表、CDP 方法、脚本形状、结果去向、风险。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `scripts/acceptance.mjs` | 新增：CDP 驱动与六项检查 |
| `docs/design/acceptance.md` | 新增：阈值与取数方法 |
| `docs/design/architecture.md` | 文档地图加一行 |
| `test/RTM.md` | 响应式节补复现命令 |

**边界**

不改任何业务代码；读数不达标时先修 CSS/布局，修完重跑。不做：真机 4G 时延、Lighthouse 综合分、跨浏览器矩阵（只跑本机 Edge）。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

本轮评审对象：`docs/design/acceptance.md`（交叉核对 `docs/design/architecture.md`、`docs/design/modules/board-ui.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`）

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | 验收·集成测试设计 | 🔴 | 本文档没有以 `test/RTM.md` 为起点的集成测试设计节。§4 只写「`test/RTM.md` 的响应式节保留「需浏览器实跑」的说明，并加一句指向本脚本与它的复现命令。」——只加指针，不加行、不先定死行号；而 RTM 自陈「集成测试的唯一索引。每个业务故事一节，每个集成用例一行；行号在写用例标题前定死」，其「## 响应式（需求 F4）」一节至今零行、原文仍是「这一节由浏览器实跑，引入浏览器级测试框架后补行」。本设计新增的恰是产品真正需要的场景（F4.2 缩放保状态、F4.3 格宽、F4.4 触摸），「本变更不新增场景」的豁免用不上——缺该节即设计不完整 | 补一节集成测试设计，对 RTM 逐行给 delta：哪些行被破坏、哪些冗余、哪些缺失；缺失行先把行号定进 RTM 再写用例标题，并说明浏览器读数怎么落进那一行 |
| 2 | 需求覆盖 F5.2 | 🔴 | F5.2 的 `< 2s` 既无阈值也无结论：§1 表中 F5.2 行「需求」列写「首屏 < 2s、请求 ≤ 6」，但「阈值」列只写「请求数 ≤ 6；首屏资源总量与 4G 快档估算」；§6 又写「4G 档的时间只做估算，不做验收结论。」而 `docs/requirements/xiangqi.md` F5.2 的验收原文是「手机 4G 快档首屏 < 2s，请求数 ≤ 6」，`docs/design/architecture.md` §7 预算表也仍是「首屏 \| 手机 4G 快档 < 2s」。这套读数因此对 F5.2 永远给不出通过或不通过 | 要么保留 < 2s 的通过线并写明无头环境里怎么得到可比加载时间（限速档位、排除项），要么把「v1 不验收 2s」写进 `docs/requirements/xiangqi.md` F5.2 的验收柱，不要只留在设计档风险节 |
| 3 | 需求覆盖 F4.2 | 🟡 | F4.2 行断言四项全保留（「1440 → 834 → 375 连续缩放后局面、选中、计时、课程进度全保留」），但「怎么量」只有「桌面走一着 → 依次改视口 → 读棋盘着法记录与计时」；§3 的脚本形状只有 `measure(viewport)` 与 `playOneMove()`，选中与课程进度没有读数步骤，计时也没有说明怎么把表走起来 | 把四项各自的可观察量写清：选中读哪一个 DOM 状态、课程进度读哪一页的哪一处、计时从哪个入口起表 |
| 4 | 需求覆盖 F5.3 | 🟡 | `docs/requirements/xiangqi.md` F5.3 的验收含「连续走子无掉帧」，本文档只量单次走子（§3「`playOneMove()`」一次一着），没有连续走子或长帧读数的任何交代 | 连续走 N 着同时采长帧或帧间隔，或在阈值表里明写「掉帧不做验收」及其理由 |
| 5 | 需求覆盖 F4.2 | 🟡 | 需求写「窗口从 1440 连续缩到 375」，方法写「依次改视口」——三次离散跳变与连续缩放的代码路径不同（`ResizeObserver` 多次触发 vs 一次），设计没说明为什么三档等价于连续 | 改成一段多步逼近的斜坡（如 1440 递减到 375 的几十步），并说明为什么这足以代表连续缩放 |
| 6 | 可验证性 F5.4 | 🟡 | §3 的 `measure()` 顺序是「改视口 → 重载 → 等棋盘挂载 → 读格宽、导航是否溢出、资源与字节数、CLS」——按此顺序观察器在挂载后才装，加载期真正的布局偏移（F5.4 的 CLS 要防的正是这一段）会漏计 | 明确观察器在导航前注入（新文档预置脚本），再谈重载后的读数 |
| 7 | 可验证性 F4.3 | 🟡 | 阈值恰好压在边界上：`docs/design/modules/board-ui.md` 的「宽 = max(360, min(容器宽, min(容器高, 720px) × 0.9))」与「格宽 = 棋盘渲染宽度 / 9。低于 40px 时按 40px 反推棋盘宽度（360px）」意味着最窄档正好 40.0；用 `>= 40` 比较一个带小数的渲染宽度（dvh 面板、亚像素）会在舍入上翻面，而文档没有取整或容差口径 | 写明读数取整规则与判定容差（例如以棋盘渲染宽 >= 360 判，或保留一位小数后比较），并说明为什么这样不会放过真失败 |
| 8 | 可验证性 F4.4 | 🟡 | F4.4 行写「点选走子可用；无 hover-only 交互」，方法写「触摸事件走一遍：CDP 派发 `touchStart`/`touchEnd`」——一次点按只能证明点选可用，证明不了「无 hover-only 交互」；需求里的「拖动为辅」也没走一遍 | 把「无 hover-only 交互」拆成可判定的项（逐控件列出不看 hover 也能拿到的信息），拖动单列一条合成手势 |
| 9 | 需求覆盖 F5.4 | 🟡 | `docs/requirements/xiangqi.md` F5.4 的验收含「Lighthouse 手机档 Performance ≥ 90」，本文档标 `unverified` 并给了理由（本机无 CLI、不该为一次验收引依赖）。理由站得住，但该条验收自此没有任何承接处 | 在 `docs/requirements/xiangqi.md` F5.4 的验收柱里记下这条按人工 DevTools 走一次并留读数，或写明 v1 明示放弃 |
| 10 | 验收命令 | 🟡 | 全文没有给出实施轮要跑的那条验收命令，也没说它与 `npm run check` 的关系；§5 的文件表只有三个文件、不含 `package.json`，而 `AGENTS.md` 写「提交前 `npm run check` 必须全绿」——脚本进不进 check 会直接决定没装 Edge 的机器上 check 还是不是绿的 | 写明命令原文、期望输出（读数表长什么样算通过），以及它是否属于 `check`/CI |
| 11 | 验收·自证 | 🟡 | 脚本的契约是「任一阈值不达即退出码 1」，但没有任何正控：没有一处演示某个检查在应该失败时确实变红（错的选择器、故意窄的视口）。不能失败的量尺给不出证据 | 加一条可复现的预计失败档（例如把某档临时压到格宽不足）作为脚本自证，把它的输出也记进批次档 |
| 12 | 文档归属·一致性 | 🟡 | §4 写「读数写进批次档 §6（一次性的执行记录）」，而 `docs/design/architecture.md` §4 的文档地图写「`docs/batches/` \| 每轮执行记录；可整档删除，设计档与需求档不得引用」。设计档引用批次档，且整套读数（这轮工作的全部产出）落在可整档删除的文件里；脚本可重跑这一点减轻了后果，故不判阻塞 | 说明读数的可重放凭据是什么（脚本 + 复现命令既是），或把「一次基线读数」放到不会被整档删除的位置 |
| 13 | 可行性 | 🟡 | 「启动：`msedge.exe --headless=new --remote-debugging-port=<port> --user-data-dir=<临时目录>`」没有交代浏览器可执行文件怎么找（PATH？已知安装路径？环境变量？），也没说找不到时怎么报错；而预览服务是明确交代了的（「脚本不自己起服务，缺服务就明确报错」）。`unverified`：本机是否把 `msedge.exe` 放进 PATH，本评审范围内不可核实 | 写明解析顺序与缺失时的报错文案，与「缺服务就明确报错」对齐 |
| 14 | 文档方法学 | 🟡 | 首句「需求 F4.2 / F4.3 / F5.2 / F5.3 / F5.4 的验收口径从没留过真机读数——早批大多只过了 jsdom 与手工走查。」是历史叙述，与 `AGENTS.md`「不写历史。历史在 git 提交里。」冲突——设计档的规范面只写现在是什么 | 把「现在缺什么读数、这套读数怎么取」写足，把「早批只过了 jsdom」这类溯源留给批次档与提交 |
| 15 | 文档方法学 | 🔵 | §5 写「两个新文件都在 200 行以内」，把篇幅数字写进设计档（分档判据要的是结论：有没有文件越档）；「none found：CDP / `Emulation.setDeviceMetricsOverride` 在本仓无先例；`grep` 零命中」没给检索式，无法复核；§1 有异体字「单次走子的提交到 DOM 更新耗時」 | 改成一句结论「无文件越档」；检索式可写可不写，若写就写全；统一用字 |
| 16 | 文档归属·限界 | 🔵 | 本轮评审上下文没有 Document Map（工具报「No document map found」），归属改按 `docs/design/architecture.md` §4 的文档地图核对——该表确有「`docs/design/acceptance.md` \| 发布前验收：三端与性能的阈值与取数方法」，归属成立，此条只记录判据来源的限界。另：§5 以「`vite.config.ts` 的 `preview.proxy` 已配」作为 4173 端口的证据，`vite.config.ts` 不在本轮评审范围内，此断言此处 `unverified` | 无需改动，仅记录；若要让 4173 这条可复核，把端口设置的那一行原文引一句进文档 |

结论统计：🔴 2 · 🟡 12 · 🔵 2（合计 16）

VERDICT: changes-required

### 轮次 2（评审子代理）

第 2 轮核对：上轮 2🔴/12🟡/2🔵 逐条对照当前文件，另核 `scripts/acceptance.mjs`（本轮新增的取数器）。口径按 `docs/requirements/xiangqi.md`、`docs/design/architecture.md`、`docs/design/modules/board-ui.md`、`test/RTM.md` 复算。

| # | 上轮 | 文件 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/acceptance.md | 🔴 | Fixed | §5「集成测试设计」已补，起点 `test/RTM.md`，6 行（F4-3…F5-3）各带交互/业务结果/入口/需求，并写「本节新增 6 行，页面壳的 F4-1 / F4-2 不破坏、不冗余」；`test/RTM.md` 已落同六行 |
| 2 | 2 | docs/design/acceptance.md | 🔴 | Fixed | F5.2 改「LCP < 2000ms；请求数 ≤ 6」，方法「清缓存 + 4G 快档节流（下行 1.6 Mbps、RTT 150ms、CPU 4×）后加载，读 LCP 与 CDP 的请求计数」；§2 用 `Network.emulateNetworkConditions` + `Emulation.setCPUThrottlingRate`；脚本 lcpMs=2000 并在 ≥2000 判负 |
| 3 | 3 | docs/design/acceptance.md | 🟡 | Fixed | F4.2 已读选中与课程进度：「每步读着法记录、`.piece-selected`、时钟文本；另开一页课程…读步数文本」；脚本读 `.piece-selected` 与 `.demo-text` 前后比对（残留见 #20） |
| 4 | 4 | docs/design/acceptance.md | 🟡 | Fixed | F5.3 已量掉帧：「连续三着期间最大帧间隔 ≤ 32ms」，§8 写明 32ms 是一次掉帧的可操作化；脚本用 rAF 采帧间隔（残留见 #22） |
| 5 | 5 | docs/design/acceptance.md | 🟡 | Fixed | 「1440 → 375 多步缩放」「以 20 步递减视口」；脚本 step 1..20 每步 `Emulation.setDeviceMetricsOverride` |
| 6 | 6 | docs/design/acceptance.md | 🟡 | Fixed | F5.4 改「导航前注入的 `layout-shift` 观察器，加载期累计」；§2「`Page.addScriptToEvaluateOnNewDocument` 在导航**之前**注入」；探针 buffered:true |
| 7 | 7 | docs/design/acceptance.md | 🟡 | Fixed | F4.3 给了边界口径与容差：「棋盘渲染宽 / 9 ≥ 39.95（保留一位小数的判定容差）」，脚本 cellPx=39.95 按 `<` 判负 |
| 8 | 8 | docs/design/acceptance.md、scripts/acceptance.mjs | 🟡 | Unfixed | 口径改为「每个按钮/链接不靠 hover 也能触发可见结果」，脚本只派了「新局」与「规则」两处；「无 hover-only 交互」仍未按控件逐项列出。证据：`docs/design/acceptance.md` 写「每个按钮/链接不靠 hover 也能触发可见结果」，`scripts/acceptance.mjs` 只 `find((item) => item.textContent.trim() === '新局')` 与 `=== '规则'` |
| 9 | 9 | docs/design/acceptance.md | 🟡 | Fixed | Lighthouse 缺口有承接处：「替代口径为「LCP + CLS + 长任务读数 + 人工在 DevTools 里跑一次 Lighthouse」，人工那次的读数按 §6 记录」 |
| 10 | 10 | docs/design/acceptance.md | 🟡 | Fixed | 命令已给：「复现：一个终端 `npm run preview`，另一个 `node scripts/acceptance.mjs`；自证：`node scripts/acceptance.mjs --self-test`」；与 `npm run check`/CI 的关系仍未写（并入 #24） |
| 11 | 11 | docs/design/acceptance.md | 🟡 | Fixed | 正控落地：§4「量尺必须能失败」+ `--self-test` 慢档断言判负；脚本 selfTest.failedAsExpected 为假时 push「自证失败」 |
| 12 | 12 | docs/design/acceptance.md | 🟡 | Accepted | 仍写「读数写进批次档 §6」，与 `docs/design/architecture.md` 文档地图「可整档删除，设计档与需求档不得引用」不一致；但已补可重放凭据（「可重放的凭据是脚本本身加 §5 的两条命令」）与「基线」小节，理由成立，收口 |
| 13 | 13 | docs/design/acceptance.md | 🟡 | Fixed | 浏览器解析已写：「按 `ACCEPTANCE_BROWSER` 环境变量取浏览器可执行文件；未设置时依次试 `msedge.exe`（PATH）…取不到就报…并退出 1」；脚本 CANDIDATES 与之一致 |
| 14 | 14 | docs/design/acceptance.md | 🟡 | Fixed | 历史叙述已删，首段改为「F4.2 / F4.3 / F4.4 / F5.2 / F5.3 / F5.4 的取数口径」 |
| 15 | 15 | docs/design/acceptance.md | 🔵 | Fixed | 篇幅数字已删：「分档：没有既有源码或测试文件被修改；两个新增文件是 `.mjs` 与 `.md`，不存在越档文件。」；异体字已改；「全仓检索无命中」仍无检索式（并入 #24） |
| 16 | 16 | docs/design/architecture.md | 🔵 | Accepted | 归属仍成立（文档地图有 `docs/design/acceptance.md`）；现有件检查改写为「`vite.config.ts` 已配预览服务与代理」，不再把端口系在 `preview.proxy` 上。本轮评审上下文仍无 Document Map，限界记录在此 |
| 17 | (new) | docs/design/acceptance.md、test/RTM.md | 🔴 | New | F4.4 覆盖自相矛盾：§1 写「该行记 unverified，不作通过/不通过」，§8 写「F4.4 记 unverified，需要真机点一下定案」，但 §5 行 F4-5 断言「点选能走子、拖动能走子；按钮不靠 hover 也能用」，`test/RTM.md` 落了同一行并以 `scripts/acceptance.mjs` 为实现，而脚本对 tap/drag 只 console.warn 不判负。同一机制两处活描述不一致（R1 例外） |
| 18 | (new) | scripts/acceptance.mjs | 🔴 | New | F4.2 判据可在锚点缺失时空转：`notations: document.querySelector('.moves') ? … : ''`、`clock: document.querySelector('.clock-red') ? … : ''` 全落空时各采样相等，`if (sample.notations !== base.notations)` 与 `if (sample.selected !== base.selected)` 都不触发；`.piece-selected` 改名则 selected 恒 0 也判过。与 §4「量尺必须能失败」相反 |
| 19 | (new) | scripts/acceptance.mjs | 🟡 | New | 采样与文档不符且基线取错：文档写「每步读着法记录」，脚本 `if (step % 5 === 0 \|\| step === 20)` 只读 4 点；`const base = data.continuity[0];` 取的是缩 5 步后（1174px）的状态，1440 的原始状态从未记录，首步丢状态会一路判过；打印头「取 5 个采样点」与实际 4 行不符 |
| 20 | (new) | scripts/acceptance.mjs | 🟡 | New | 课程页读不到即静默跳过且不判负：三处 `return { available: false }`，report 只打印「课程进度：本页没有可读的演示步数，跳过（记 unverified）」，退出码仍 0；文档把「课程进度全保留」列为 F4.2 阈值，未写这条降级 |
| 21 | (new) | scripts/acceptance.mjs | 🟡 | New | 单步 16ms 的起点不是「指针抬起」：`const started = await evaluate(cdp, `performance.now()`);` 在派发 mousePressed/mouseReleased 之前取，读数含 CDP 往返与两次事件派发，与文档「单步指针抬起 → 着法记录更新 < 16ms」不是同一区间 |
| 22 | (new) | scripts/acceptance.mjs | 🟡 | New | 帧间隔判据无最小样本保护：`window.__frames` 不足两帧时循环不执行得 0，`if (data.fluency.maxFrameGapMs > THRESHOLDS.frameMs)` 不触发，空转判过 |
| 23 | (new) | scripts/acceptance.mjs | 🟡 | New | 棋盘元素取法不一致：三处用 `document.querySelector('svg')`，measureTouch 用 `document.querySelector('svg.board') \|\| document.querySelector('svg')`；页面里先出现别的 svg 时格宽读数会取错元素 |
| 24 | (new) | docs/design/acceptance.md、scripts/acceptance.mjs | 🔵 | New | 小口径不一致：§2「下行 1 6 Mbps」；report 文案「格宽 … < 40」与 39.95 阈值不符；`> THRESHOLDS.moveMs` 允许恰为 16ms 而需求写 < 16ms；请求数在三视口都判而 §1 只在 F5.2 下写 ≤ 6；§3 函数名 `measureMoveFluency` 与脚本 `measureFluency` 不一致，measureLessonContinuity 未进 §3 表；「全仓检索无命中」无检索式 |

计数：新增 🔴 2（#17、#18）、🟡 5（#19–#23）、🔵 1（#24）；上轮 14 条已定（12 Fixed、2 Accepted），1 条 🟡 未决（#8）。

VERDICT: changes-required

### 轮次 3（评审子代理）

### 第 3 轮核验（发布前验收：三端与性能）

对象：`docs/design/acceptance.md`、`scripts/acceptance.mjs`、`test/RTM.md`；对照 `docs/design/architecture.md`、`docs/design/modules/board-ui.md`、`docs/requirements/xiangqi.md`。逐条复核上轮 2🔴/5🟡/1🔵 与 #8，共 24 条。

| # | Orig# | File | Severity | Status | Notes |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/acceptance.md | 🔴 | Fixed | §5「集成测试设计」已在：起点 `test/RTM.md`，六行 F4-3/F4-4/F4-5/F5-1/F5-2/F5-3，并写明「本节新增 6 行，页面壳的 F4-1 / F4-2 不破坏、不冗余」；`test/RTM.md` 已落同六行，业务结果与 §5 表逐条一致 |
| 2 | 2 | docs/design/acceptance.md | 🔴 | Fixed | F5.2 改「LCP < 2000ms；请求数 ≤ 6」，方法为清缓存 + 4G 快档节流（下行 1.6 Mbps、RTT 150ms、CPU 4×）后读 LCP 与 CDP 请求计数；脚本 lcpMs 2000，`if (data.firstPaint.lcp >= THRESHOLDS.lcpMs)` 判负 |
| 3 | 3 | docs/design/acceptance.md | 🟡 | Fixed | F4.2 已含选中与课程进度：阈值列写 `.piece-selected` 与「另开一页课程：进一课走两步 → 同样递减 → 读步数文本」；脚本读 selected 与 `.demo-text` |
| 4 | 4 | docs/design/acceptance.md | 🟡 | Fixed | F5.3 已含「连续三着期间最大帧间隔 ≤ 32ms」；脚本 measureFluency 采帧间隔并判 > 32 |
| 5 | 5 | docs/design/acceptance.md | 🟡 | Fixed | 「以 20 步递减视口」；脚本 `for (let step = 1; step <= 20; step += 1)` |
| 6 | 6 | docs/design/acceptance.md | 🟡 | Fixed | §2 写「在导航**之前**注入」；脚本先 `Page.addScriptToEvaluateOnNewDocument` 再 `Page.navigate` |
| 7 | 7 | docs/design/acceptance.md | 🟡 | Fixed | 「棋盘渲染宽 / 9 ≥ 39.95（保留一位小数的判定容差）」；脚本 cellPx 39.95，按 `<` 判负 |
| 8 | 8 | docs/design/acceptance.md | 🟡 | Fixed | 阈值不再写「每个」，改为按钮与导航链接可触发 + 棋盘点选拖动待真机定案；方法列点名「对新局、导航各派一次合成触摸」；非 hover 改样式层证据（`src/client/app.css` 的 5 处 :hover 只改配色，该文件不在本轮范围，未核） |
| 9 | 9 | docs/design/acceptance.md | 🟡 | Fixed | 保留替代口径「LCP + CLS + 长任务读数 + 人工在 DevTools 里跑一次 Lighthouse」，人工读数按 §6 记录 |
| 10 | 10 | docs/design/acceptance.md | 🟡 | Fixed | §5 末尾给命令：复现一个终端 `npm run preview` 另一个 `node scripts/acceptance.mjs`，自证 `--self-test` |
| 11 | 11 | docs/design/acceptance.md | 🟡 | Fixed | §4 自证 + 脚本 `--self-test`：慢档 `failedAsExpected: slow.lcp >= THRESHOLDS.lcpMs`，未成立即 push「自证失败」 |
| 12 | 12 | docs/design/acceptance.md | 🟡 | Accepted | 仍写「读数写进批次档 §6」，与 `docs/design/architecture.md` 的「可整档删除，设计档与需求档不得引用」并存；已给可重放凭据与「基线」小节理由，上轮按理由收口，本轮不再推动 |
| 13 | 13 | docs/design/acceptance.md | 🟡 | Fixed | 启动三来源 + 报错退出 1 已写；脚本 CANDIDATES 覆盖环境变量与两条 Edge 绝对路径（PATH 一项并入 #24） |
| 14 | 14 | docs/design/acceptance.md | 🟡 | Fixed | 开场白改为直接陈述取数口径，无历史叙述 |
| 15 | 15 | docs/design/acceptance.md | 🔵 | Fixed | 篇幅数字已删；检索式已给 `setDeviceMetricsOverride` / `emulateNetworkConditions` / `webSocketDebuggerUrl` |
| 16 | 16 | docs/design/acceptance.md | 🔵 | Accepted | 「`vite.config.ts` 已配预览服务与代理」措辞，上轮按理由收口 |
| 17 | 17 | docs/design/acceptance.md、test/RTM.md | 🔴 | Fixed | 三处口径已统一：§1 写棋盘点选与拖动待真机定案、读数照录但不判过否；§5 F4-5 写「本行不声明」；`test/RTM.md` F4-5 同文；§8 写「需真机点一下定案；在那之前 RTM 的 F4-5 只声明按钮与导航。」 |
| 18 | 18 | scripts/acceptance.mjs | 🔴 | Fixed | 基线与锚点先校验：`if (base.notations.trim() === '' \|\| base.selected !== 1 \|\| base.clock.trim() === '')` 抛错中止；锚点缺失不再空转判过 |
| 19 | 19 | scripts/acceptance.mjs | 🟡 | Fixed | 每步都读（step 1..20 逐次 push）；基线入样 `samples = [{ width: 1440, ...base }]`；打印头改为 `${data.continuity.length} 个采样点，含缩放前的基线` |
| 20 | 20 | scripts/acceptance.mjs | 🟡 | Fixed | 三处早退改 throw；§3 表写「进不去课或读不到就报错，不静默跳过」 |
| 21 | 21 | scripts/acceptance.mjs | 🟡 | Fixed | 改页内打点：pointerup 记 `window.__upAt`，`pollLatency` 返回 `pair.move - pair.up`，与「指针抬起 → 着法记录更新」同区间 |
| 22 | 22 | scripts/acceptance.mjs | 🟡 | Fixed | `if (gaps.count < 10) { throw new Error(...); }`，§3 表同步写「帧数不足 10 就报错」 |
| 23 | 23 | scripts/acceptance.mjs | 🟡 | Unfixed | 选择器仍不统一：读格宽与首段几何用 `const board = document.querySelector('svg');`，探针与连走三着用 `const svg = document.querySelector('svg.board') \|\| document.querySelector('svg');`；无理由陈述。读数取错元素会响亮报错而非静默判过，按 advisory 计 |
| 24 | 24 | docs/design/acceptance.md、scripts/acceptance.mjs | 🔵 | Unfixed | 4/6 已修（1.6 Mbps、格宽文案 < 39.95、`>= THRESHOLDS.moveMs`、measureLessonContinuity 进 §3 表、检索式）；残余：§3 表名 measureMoveFluency 与 `async function measureFluency(cdp) {` 不一致；三视口逐视口判请求数（`if (row.requests > THRESHOLDS.requests) failures.push(...)`）而 §1 未写该口径；文档称「依次试 `msedge.exe`（PATH）」而解析只 `for (const candidate of CANDIDATES) {`（列表起于 `process.env.ACCEPTANCE_BROWSER,`），无 PATH 查找 |

计数：🔴 0 未决（4 条全部 Fixed）· 🟡 1 未决（#23，advisory）· 🔵 1 未决（#24）· Accepted 2（#12、#16）· Fixed 20。

VERDICT: pass

## §4 用户批准（主 agent）

用户于 2026-11-14 08:33 回「开」，批准开这批验收；范围是 F4.2 / F4.3 / F4.4 / F5.2 / F5.3 / F5.4 的真机读数与取数器。
不含：Lighthouse 综合分（本机无 CLI，不引依赖）、真机 4G 时延、跨浏览器矩阵。

## §5 实施记录（实施者：主 agent ∥ coder）

**实施记录（主 agent）**

| 文件 | 动作 |
|---|---|
| `scripts/acceptance.mjs` | 新增：node 内置模块起无头 Edge，裸 WebSocket 走 CDP；三视口格宽与请求数、4G 快档 + CPU 4× 的首屏、21 点递减的缩放保状态（局面/选中/计时 + 课程步数）、合成触摸四项、单步时延与连走三着帧间隔、慢档正控 |
| `docs/design/acceptance.md` | 新增：阈值、方法、脚本形状、自证、RTM 增量、结果去向、风险 |
| `docs/design/architecture.md` | 文档地图加一行 |
| `test/RTM.md` | 响应式节换成 F4-3 / F4-4 / F4-5，新增性能节 F5-1 / F5-2 / F5-3，各带实现与复现命令 |

读数（`node scripts/acceptance.mjs --self-test`，本机 Edge 156，`npm run build && npm run preview`）：

| 项 | 读数 | 阈值 | 结论 |
|---|---|---|---|
| 格宽 | 72.0 / 59.5 / 40.0 px | ≥ 39.95 | 过 |
| 首屏请求 | 6 / 6 / 6 | ≤ 6 | 过 |
| 导航溢出 | 三档均无 | 无 | 过 |
| 首屏 LCP（4G 快档 + CPU 4×） | 1060 ms | < 2000 | 过 |
| CLS | 0.000 | < 0.05 | 过 |
| 缩放保状态 | 21 个采样点（1440 → 375 每步一读）：着法「1.兵九进一」、选中 1 枚、红钟 09:53 全程一致；课程步数文本不变 | 全保留 | 过 |
| 单步到画面（pointerup → 着法记录） | 5.1 ms | < 16 | 过 |
| 连走三着最大帧间隔 | 16.8 ms（采样 38 帧） | ≤ 32 | 过 |
| 正控（慢档 LCP） | 2916 ms，判负 | 必须判负 | 过 |

评审处置：三轮设计评审（#20 changes-required 2🔴/12🟡/2🔵 → #44 changes-required 2🔴/5🟡/1🔵 → #46 pass）。第三轮留了 #23（棋盘选择器不统一，取错会响亮报错，不静默判过）与 #24（函数名、逐视口请求口径、PATH 一行）作为 advisoryNote，未阻塞。

未决一条：合成触摸在棋盘上读不到选中态。证据——触点落在「红方兵，第 3 列第 7 行」中心、`pointerdown` 的 `pointerType` 为 `touch`、`setPointerCapture` 返回成功、无页面错误，之后 `.piece-selected` 仍为 0；同一坐标不启用触摸仿真时用鼠标点可选中并走子。触摸点「新局」与「规则」都生效。F4.4 的这一半记 unverified，`test/RTM.md` 的 F4-5 只声明按钮与导航。

## §6 验证与收口（父代理）

**收口（主 agent，2026-11-14）**

交付：发布前三端与性能的取数器与读数。新增 `scripts/acceptance.mjs`、`docs/design/acceptance.md`；改 `docs/design/architecture.md`（文档地图一行）与 `test/RTM.md`（响应式 3 行 + 性能 3 行）。

需求—落点对照：

| 需求 | 落点 | 读数 |
|---|---|---|
| F4.2 缩放不丢状态 | 21 点递减 + 课程页步数 | 着法、选中、时钟、课程步数全程一致 |
| F4.3 格宽 ≥ 40px | 三视口棋盘宽 / 9 | 72.0 / 59.5 / 40.0 |
| F4.4 触屏与鼠标同一套交互 | 合成触摸：新局、导航 | 两项生效；棋盘点选/拖动 unverified |
| F5.2 首屏 < 2s、请求 ≤ 6 | 4G 快档 + CPU 4× 的 LCP 与请求数 | 1060ms、6 个 |
| F5.3 走子到画面 < 16ms | pointerup → 着法记录 | 5.1ms；连走最大帧间隔 16.8ms |
| F5.4 CLS < 0.05 | 导航前注入的观察器 | 0.000 |

收口测试行：`npm run check` 退出码 0（单测 221 通过 / 0 失败，前端 10 文件 53 用例通过）。取数器自身：`node scripts/acceptance.mjs --self-test` 退出码 0，慢档正控 2916ms 判负。

遗留：

- F4.4 的棋盘点选与拖动未验（合成触摸读不到选中态，鼠标可选中；真机点一次可定案）。
- Lighthouse 手机档综合分未跑（本机无 CLI，不引依赖），替代口径为 LCP / CLS / 长任务 + 人工 DevTools 一次。
- 评审 #23（棋盘选择器不统一）与 #24（函数名、逐视口请求口径、PATH 一行）按 advisory 留档，未改。
