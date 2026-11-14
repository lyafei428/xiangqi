# 2026-11-14 · M8 记谱输入
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户选 A：要给键盘玩家一条比方向键更快的路——输入中文记谱直接走子。
> 台账 = #11（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户问「有没有必要给棋盘加键盘输入，四位数字或更少就能走」。我评估后给了三个选项（A 记谱输入 / B 只补键盘可见性 / C 不做），说明四位坐标不划算：棋盘上没有坐标标注、象棋的原生输入是记谱不是坐标。用户选了 A。

为什么值得做：现在的键盘路径（Tab → 方向键 → Enter）能下完一整局，但一步要按好几次键。会下棋的人心里本来就有「炮二平五」这个句子，直接敲出来是唯一真能提速的输入形态。

做法：不新写一套记谱文法——生成侧 `toChineseNotation` 已经会写，解析就反过来「把所有合法着法写成记谱，跟输入比对」。输入先过一张归一化表（全角、繁体字、异体动词、分隔符）。

范围外：联机页（它的面板与回合归属另算）、语音、UCI/坐标输入。

设计评审走了两轮，两轮都是 `changes-required`，第三轮待跑。

第二轮评审的处置（评审子代理自己写 §3 时被 doc-check gate 拒写，理由是设计档里那句 Survey 段落过长，所以本轮记录落在 §1，不落 §3）：

- 验收里写了 `npm run check` 全量套跑 —— 已删，改成「提交门按 AGENTS.md 执行，不属于本模块验收」；验收只留改动面单测，集成那一半在收口行报告。
- 文件划分里两条文档动作（需求档 F1.8、RTM 的 F1-8）与 local-play 的一行早已落地 —— 已标「已落地」，免得执行轮写第二遍出重复行。
- §4 抄了整条 F1.8 需求行 —— 已改成指向需求档 §3 F1.8 的一行引用，只留「需求点 → 落点」追溯表。
- `/` 与面板收起态没对齐 —— 已定：收起时先展开再聚焦。
- 提交成功后「保持焦点」与「手机失焦」两套互斥行为 —— 已删失焦那条，只留保持焦点，并写明「要棋盘就点棋盘区收起键盘」。
- 新输入框与提示没有无障碍口径 —— 已补可访问名「记谱输入」与提示进面板 `role="status"` 播报区。
- F1.8 四条验收只验两条、人机页无入口 —— 已把置灰与 `/` 聚焦写进 RTM 的 F1-8 业务结果，入口改成「对弈 / 人机」。
- 「多命中」状态无观测无双复现 —— 改成不变量：单测证明同局面全部合法着法记谱两两不同。
- 其余三条 🔵（契约签名、提示语盖两种情形、归一化表 4 对 3）已按建议落地。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

对弈页与人机页的面板加一行记谱输入：敲「炮二平五」回车即走该步；看不懂就不落子并给提示。需求侧新增 F1.8。

**设计**

`docs/design/modules/notation-input.md`：口径、归一化表、界面、集成测试增量、文件划分、风险。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `src/shared/notation.ts` | 加 `normalizeNotation` / `parseChineseNotation` |
| `src/client/panel/NotationInput.tsx` | 新增 |
| `src/client/panel/GamePanel.tsx` | 接入输入框与 `onPlay` |
| `src/client/pages/PlayPage.tsx`、`AiPage.tsx` | 传 `onPlay` 与禁用条件 |
| `docs/requirements/xiangqi.md` | 加 F1.8 |
| `test/RTM.md` | 加 F1-8 行 |

**边界**

不改棋盘的键盘路径；不碰联机页与观战；解析只认生成侧写出来的记谱形态，不做模糊匹配。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

设计评审（记谱输入：敲「炮二平五」直接走子 · F1.8 · 首轮）— 对象 = `docs/design/modules/notation-input.md`，同批判 `docs/design/modules/board-ui.md`、`docs/design/modules/app-shell.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Branch provenance (6b) | 🔴 | `docs/design/modules/notation-input.md` §1 口径 新增「多条命中」分支，其自身文字即写「列出候选（正常不会发生：序号消歧已在生成侧做好）」——既没有真实观察（无日志/数据/用户报告可引），也没有可复现的失败路径 ⇒ 这个分支防的是一个没发生过的场景，却自带候选列表文案、UI 形态与测试物料，事后没人敢删。 | 删掉该行（直接落到「看不懂这步记谱」的未命中口径）；若坚持留作防御，就写出复现路径：哪个局面、哪两枚不同合法着法经 `toChineseNotation` 得到同一字符串、以及复现它的测试——防御有复现路径就能站住。 |
| 2 | Requirements | 🟡 | §5 文件划分 计划「加 F1.8 一行」到 `docs/requirements/xiangqi.md`，但全篇没有写出这一行：F1.8 的「需求」与「验收」措辞均缺；也没有 `docs/design/modules/app-shell.md` §5 那种「| 需求 | 落点 |」验收对照表 ⇒ 本次设计本来要满足的那条需求，在整套文档里没有可核对的陈述。 | 在设计中按需求层口径写死 F1.8 的「需求」与「验收」两栏（可观察结果：走子生效、未命中的提示、只读态不可用），并补一张验收对照表（需求 → 落点）。 |
| 3 | Requirements coverage | 🟡 | §1 口径 把观战列为禁用态——「终局、AI 回合、观战：输入框禁用」——但 §5 文件划分 只把输入框接进「`src/client/pages/PlayPage.tsx` / `AiPage.tsx`」；`docs/design/modules/app-shell.md` §4 的「`src/client/pages/OnlinePage.tsx` | 联机大厅与房间。」与「联机页内部（token 在 sessionStorage）」说明联机面自成会话，该页没有输入框可禁用。 | 二选一写清：要么把 `OnlinePage.tsx` 加进文件划分（联机会话 dispatch + 观战禁用），要么从 §1 删掉观战并声明本批联机面不提供记谱输入。 |
| 4 | Clarity | 🟡 | §2 归一化 只定下全角数字、繁体棋子字、`進`/`退`/`平`、标点删除这一层，没有定「汉字数字 ↔ 阿拉伯数字」的等价；而 §1 自身示例混用两种写法——「中文记谱，如 `炮二平五`、`前车进一`、`卒1进1`」——§6 又明确拒绝猜测（「输错就是看不懂，而不是猜」）⇒ 红方把着法敲成 `炮2平5` 是命中还是未命中，未定，验收会随实现翻转。 | 写明 `toChineseNotation` 对红/黑各输出哪种数字形态，并逐条声明跨形态输入是「归一」还是「未命中」，把选定的那条补进 §2 的表。 |
| 5 | Feasibility / responsive | 🟡 | §3 界面 把输入框定在「着法记录下方、「新局」按钮上方」，全文无响应式说明；但 `docs/design/modules/board-ui.md` §5 规定「<768px 在底部抽屉上方。」，而「成功清空并保持焦点，连续输入不用再点」在手机上等于软键盘常开，用户要看的棋盘正在被键盘占掉；F4.1 / F4.4 对这个新控件没有交代。 | 补一段响应式口径：抽屉里输入框的位置、键盘弹起时棋盘如何仍可见（或为何不必），以及面板新增一行可能动到哪些 RTM 响应式行（F4-4 / F4-5）。 |
| 6 | Acceptance | 🟡 | §4 只给了实现文件名——「实现：`test/notation-input.test.ts`（解析，纯函数）、`test/integration/notation-input.test.tsx`（输入框到棋盘）。」——没有验收运行：无命令、无通过判据，实施轮拿到的是文件清单而不是门。 | 明写改面验收（单测文件走 `node --test`、集成文件走 `npm run test:ui`），让验收是可跑的一条，而不是文件名。 |
| 7 | Affected files | 🟡 | §5 文件划分 漏了 `test/RTM.md` 与两个测试文件，尽管 §4 声明「本批新增 F1-8 一行」，而 `test/RTM.md` 头部要求「行号在写用例标题前定死，用例标题按行号命名。」，「对弈」故事下的「用例实现：」清单也必须加上新的集成文件。 | 把 `test/RTM.md`、`test/notation-input.test.ts`、`test/integration/notation-input.test.tsx` 补进 §5，并写明各自动作（加 F1-8 行 + 用例实现条目 / 新建文件）。 |
| 8 | Affected-file tier check | 🟡 | §5 的分档行把预测行数写进了设计文档——「分档：没有既有文件越档；`NotationInput.tsx` 预计 80 行以内，解析函数 60 行以内。」——档位判断留在文档里的应当只是结论（哪些文件越档、各自拆分方案，或都不越档），不是预估尺寸。 | 只留结论一句（无文件越档），把行数预估移出文档。 |
| 9 | Existing-piece / copy | 🟡 | 现有件检查回答了函数与动作（「existing — `src/shared/notation.ts` 的生成函数与数字表」、「none found：仓库里没有「文本命令 → 着法」的先例（检索 `parse.*Notation|notation.*parse` 零命中）」），但没有覆盖本次新增的用户可见文案（「看不懂这步记谱」、「如：炮二平五」）；且报错策略与 `docs/design/modules/board-ui.md` §3 的「| 点不可落点 | 取消选中，不弹错误提示 |」相反，未说明为何两处不同。 | 给这两串文案补三问答（existing / none found / existing but unusable），并用一句话说明文本命令为何给提示、棋盘误点为何静默（打字没有别的反馈通路）。 |
| 10 | Document ownership | 🟡 | 设计改 `GamePanel.tsx` 并把面板行只写在新模块文档里；`docs/design/modules/app-shell.md` §4 称对弈页为「对弈页（M1 的棋盘 + 面板）」，即面板内容的归属文档是 M1 的模块文档，而它不在本轮评审范围，故「归属文档是否同步修订」在本轮标为 `unverified`。 | 指名面板布局的归属文档（M1 模块文档 ∥ 本模块），并声明是否随之修订，让面板新增一行只有一个 owner。 |
| 11 | Integration-test design | 🔵 | F1-8 行的「验的交互」格写的是 UI 路径「对弈页 → 面板输入记谱 → 回车」，而非该用例评估的组件交互（输入框 → `dispatch({ type: 'play', move })` → 棋盘与着法记录），后者只出现在表格上方的正文；同时未写用例标题形态，而 `test/RTM.md` 要求「用例标题按行号命名。」 | 格子里直接写组件交互，并按行号定死标题 `F1-8 …`，让行与用例按编号对齐。 |
| 12 | Survey / precedent evidence | 🔵 | Survey 行核对了 rules-engine / board-ui / app-shell / session，却没有列它据以设计并要修改的两份文档——`test/RTM.md`（§4 的起点）与 `docs/requirements/xiangqi.md`（§5 的「加 F1.8 一行」）；Closest precedent 行给了实现坐标与对齐理由（「本模块只加反向解析，不另写一套记谱文法」），缺设计文档节 ∥ 批次的坐标。 | 把 RTM 与需求文档补进 Survey 行；precedent 行补上设计文档节 ∥ 批次坐标，使该行对本项目自有的格式是完整的。 |
| 13 | Tier spot-check（评审侧限制） | 🔵 | 文件划分里的 `src/shared/notation.ts`、`src/client/panel/GamePanel.tsx`、`PlayPage.tsx`、`AiPage.tsx` 都在本轮声明的评审范围之外，无法对其做实测，故「没有既有文件越档」这句在本轮为 `unverified`。 | 实施时以一次新鲜实测复核该结论（实测是判据，预估不是）。 |
| 14 | Scope | 🔵 | §3 界面 加了页面级快捷键——「快捷键：页面上按 `/` 聚焦输入框（焦点已在输入类元素里时不抢）。」——F1.8 的验收并不需要它；且设计全文未回应 `docs/requirements/xiangqi.md` F5.1「每页只保留完成该页任务必需的控件；无装饰性元素」与这个新增控件的关系。 | 说明该快捷键属于 F1.8 的验收（或本批不做），并补一句该控件在 F5.1 下为何是「必需」的。 |

计数：🔴 1 · 🟡 9 · 🔵 4

VERDICT: changes-required

### 轮次 2（评审子代理）

### 设计评审（第三轮，独立评审子代理）

评审对象：`docs/design/modules/notation-input.md`（状态「待评审」）。
配套读：`docs/design/modules/local-play.md`、`docs/design/modules/board-ui.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。

**文档归属判据的说明**：评审上下文未提供 Document Map（声明「No document map found」），故归属只按 `AGENTS.md` 的分层判断。
本设计把「记谱输入」作为新的模块主题落在 `docs/design/modules/notation-input.md`。
`docs/design/modules/local-play.md` §5 只留一行指针，未把细则塞进该档已有小节——合规，不构成拆分既有小节。

**已核验通过（不计入发现）**：

- 最接近先例行在位，引用准确：`src/shared/notation.ts` 的 `toChineseNotation` 确实已存在，被 `src/shared/record.ts`、`src/client/game/session.ts` 共用。
- 调研证据行在位，列了 `docs/design/rules-engine.md`、`docs/design/modules/board-ui.md`、`docs/design/modules/local-play.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`、`src/client/game/session.ts`。
- 现有件检查三种形态齐备：existing / none found / 文案。
- 「文本命令 → 着法零命中」复现属实：`src/` 内只有 `toChineseNotation` 及其调用点。
- 分档塔位自查属实。本轮重新量过：`src/shared/notation.ts` 103 行、`src/client/panel/GamePanel.tsx` 144 行、`src/client/pages/PlayPage.tsx` 63 行、`src/client/pages/AiPage.tsx` 261 行，均未跨 500 行档，也没有 300+ 行的单函数，故「涉及文件均未跨 500 行档，无需拆分。」成立。
- `src/shared/index.ts` 是 `export * from './notation.ts';`，新增导出不必动它，§6 文件表未漏项。
- 不成环：`src/shared/notation.ts` 加 `import ... from './rules.ts'` 后，`rules.ts` 只依赖 `moves.ts` / `fen.ts` / `board.ts`，无一回到 `notation.ts`，可行性无阻断。
- 集成测试设计以 `test/RTM.md` 的 F1-8 行为起点，行号先定死，四列（交互链 / 用户可见结果 / 入口 / 追溯需求）齐备。
- 用例标题按行号命名的写法与既有一致，如 `test/integration/local-play.test.tsx` 的 `describe('F1-1 本地双人走完一局并判和'`。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|------|--------|------|------|
| 1 | 清晰度 | 🟡 | 提示的落点在文内有两处说法。§1 口径表写「不落子，输入框下方提示「这步走不了：检查棋子、纵线和方向」」；§3 写「提示放在面板已有的播报区里（`role="status"`、`aria-live="polite"`），与状态行共用同一套播报口径。」面板已有的播报区是 `src/client/panel/GamePanel.tsx` 的 `.status-line`，里面只有 `aria-hidden` 圆点加唯一一处 `{statusText(session)}`（「红方走棋」/「黑方胜 · 超时」），没有第二个承载提示的格子。实现者无法判断：提示行自己就是 live region（那就不是「已有的」），还是把提示插进状态行（那就顶掉行棋方播报，与 `docs/design/modules/local-play.md` §4「将军与胜负写进 `aria-live="polite"` 的状态区」的同一处展示打架）。 | 在 §3 把 DOM 定死：提示行自带 `role="status"`，视觉位置就在输入框下方，并写明状态行文案不因提示改写。若坚持共用状态区，写出状态行如何同时承载行棋方与提示（两段？谁先播？）以及提示的清除时机。 |
| 2 | 清晰度 | 🟡 | 面板到底多几行没有定死。§3 同时写「一行输入框 + 一行提示。」与「面板新增这一行只占一行高度，不改三档布局的断点与棋盘尺寸公式。」，而 `docs/design/modules/local-play.md` §5 只承认「记谱输入占着法记录下方一行」。提示行是常驻占位还是仅零命中时渲染，文中没说。若非常驻，提示出现时面板内部从 1 行变 2 行，抽屉高度固定（同档 §5「底部抽屉 42dvh（不超过 50dvh），可收」），着法列表让出空间这一段没人认领，F4.3 缩放不丢状态与 F5.4 CLS 都未覆盖。 | 明确提示行「常驻占位」或「仅零命中时渲染」，并指出面板内哪一块让出高度。再把 `docs/design/modules/local-play.md` §5 的「一行」与所选方案对齐；若确为两行，改写成「输入框与提示各一行」。 |
| 3 | 分支来源 | 🟡 | §6 契约写「比对全部合法着法的记谱，命中返回该着法；零命中或不止一条返回 null。」，§1 又说「「一条输入对应多个着法」不作为一种状态处理」，靠 §7 单测守住记谱两两不同。于是「不止一条」是一支设计自认不可能发生的分支，§7 的测试清单（解析、归一化、零命中、两两不同）里也没有它的用例。不判 🔴 的理由：它给出了消歧来源与不变量测试这条验证路径，且不带提示文案、不带跨端一致性，代价只有一行返回。 | 二选一。删掉「不止一条」，只留零命中；或在 §1 注明它只是 `length !== 1` 的同一行返回、不产生任何提示分支，§7 因此不单列用例。别让它以「一种状态」的措辞留在契约里。 |
| 4 | 分支来源 | 🔵 | §3 写「快捷键：页面上按 `/` 聚焦输入框。焦点已在输入类元素里时不抢。」这一支守的场景没有命名。对弈页与人机页上唯一的文本输入框就是这个记谱框本身，页面其余输入件是 `src/client/pages/AiPage.tsx` 的难度与阵营 radio，`/` 在那里被抢或不抢都没有可观察差别。 | 要么点名场景（用户在记谱框内敲 `/` 不应打断输入，或为将来含文本输入的页面预留），要么删掉这半句，只留「按 `/` 聚焦输入框」。 |
| 5 | 验收 | 🟡 | §7 第三条把全量套件写进了「验收」小节：「提交门 `npm run check` 按 `AGENTS.md` 执行，不属于本模块的验收。」本条自己声明了它不是验收，第一条也已是改动面单测「单测：`node --test test/notation-input.test.ts`」，所以不构成把全量套件当验收口径。但下一轮实现者读到的仍是「§7 验收里有一条要跑 check」，与验收只认改动面单测的口径混在一起。 | 把这一条移出 §7：并入 §8 风险，或单列一行「提交门见 `AGENTS.md`」。§7 只留 `node --test test/notation-input.test.ts` 这条可执行口径，并保留「F1-8 的集成那一半在收口行报告」这句。 |
| 6 | 一致性 | 🔵 | §4 追溯表写「命中即 `dispatch({ type: 'play', move })`」，而 `docs/design/modules/local-play.md` §3 的口径是「时间由页面随动作传入，会话本身不读墙钟。」两个现有调用点都显式传时间：`src/client/pages/PlayPage.tsx` 的 `dispatch({ type: 'resign', now: Date.now() })`、`src/client/pages/AiPage.tsx` 的 `dispatch({ type: 'play', move, now: Date.now() });`。漏传不会算错（reducer 里 `const now = action.now ?? Date.now();`），但新代码会与既有口径分叉。 | 追溯表写成 `dispatch({ type: 'play', move, now: Date.now() })`，与两个页面同形。 |
| 7 | 验收 | 🔵 | 空输入没有口径。§2 归一化把「空格（半角与全角）、`、`、`，`、句号」全部删除，纯空格或误按回车得到空串，落进零命中分支，弹「这步走不了：检查棋子、纵线和方向」。用户只是误按了回车，却被告知这步走不了。 | §1 增一行「空输入：不提交、不提示」，并在 §7 单测里定一条空串行为，免得实现者各自决定。 |
| 8 | 清晰度 | 🔵 | `test/notation.test.ts` 已存在，且通篇测的就是 `src/shared/notation.ts` 的生成侧（含「同纵线两个车用前后消歧」「同纵线四个以上按前到后编号」）。§6 又新增 `test/notation-input.test.ts` 测同一模块的反向侧，两份文件同模块并存而分工未写明。 | 要么把解析与归一化用例并入 `test/notation.test.ts`（同模块同文件，离 500 行档很远），要么在 §6 写明分档理由（生成侧 / 反向侧各一份），避免后续两边各写一半。 |

计数：🔴 0 · 🟡 4 · 🔵 4。

VERDICT: pass

## §4 用户批准（主 agent）

用户原话：「收口」。

批前已交付：M8 记谱输入的实现、两个测试文件与文档同步，提交 `899a091`；`npm run check` 241 单测 / 60 前端用例全绿；代码评审 #73 通过，7 条意见全部处置并复跑全绿。

## §5 实施记录（实施者：主 agent ∥ coder）

实施者：coder（M8 记谱输入）。按已评审通过的设计档 `docs/design/modules/notation-input.md` 落地。

**改动的文件与落点**

| 文件 | 改法 |
|---|---|
| `src/shared/notation.ts` | 追加 `normalizeNotation(color, text)` 与 `parseChineseNotation(position, text)`，新增对 `./rules.ts` 的 `generateLegalMoves` 引用（不成环）。归一化表：全角数字与半角统一、汉字/阿拉伯数字统一到行棋方形态、繁体棋子字与 `進` 换字、空白与 `、，。` 删除。解析遍历全部合法着法的 `toChineseNotation`，两边过同一张表；不止一条命中按零命中返回 null。 |
| `src/client/panel/NotationInput.tsx`（新） | 输入框与提示行。`Enter` 提交；成功清空并保持焦点，失败保留原文；纯空白按回车不提交、不提示；提示行自带 `role="status"` 与 `aria-live="polite"`，文案「这步走不了：检查棋子、纵线和方向」+「如：炮二平五」；可访问名「记谱输入」；`focusSignal` 变化时把焦点交回输入框。 |
| `src/client/panel/GamePanel.tsx` | 着法记录与「新局」之间接入输入框；新增可选 props `onPlay` / `notationDisabled` / `onRequestExpand`（`onPlay` 不传则不渲染输入框，组件级用例不必改）。`/` 用 window keydown 监听：焦点在文本输入件时不抢；面板收起时先 `onRequestExpand()`，等 `open` 变 true 后再递增聚焦计数。置灰 = `session.result !== null || notationDisabled`，终局在面板兜底。 |
| `src/client/pages/PlayPage.tsx` | 传 `onPlay`（`dispatch({ type: 'play', move, now: Date.now() })`）、`notationDisabled={over}`、`onRequestExpand={() => setPanelOpen(true)}`。 |
| `src/client/pages/AiPage.tsx` | 同上，`notationDisabled={!canPlay}`（终局 / AI 回合 / 思考中都置灰）。 |
| `src/client/app.css` | 新增 `.notation`、`.notation-input`、`.notation-error`、`.notation-example`；示例整句不拆行（`white-space: nowrap`）。 |
| `test/notation-input.test.ts`（新） | 12 条：红方「炮二平五」、黑方「炮8平5」与「炮八平五」、红方「炮2平5」、全角数字、繁体棋子字、`進`、空白与句读、零命中、空输入、初始与拥挤局面的记谱两两不同、生成→解析往返。 |
| `test/integration/notation-input.test.tsx`（新） | 5 条 F1-8：走子成功（棋盘 + 着法记录 + 清空并保持焦点）、零命中不落子并出提示、终局置灰、`/` 聚焦（含收起先展开）、人机页 AI 回合置灰。 |

**关键决策（实施层）**

- 只做「生成侧清单比对」：`parseChineseNotation` 遍历 `generateLegalMoves(position)`，唯一命中才返回；多于一条按零命中，不替用户挑一条。
- 归一化两边都过：生成侧输出再过一次表是空操作，但保证红方敲 `炮2平5`、黑方敲 `炮八平五` 与繁体写法都命中。
- `/` 监听放在面板：面板展开状态由页面持有，收起时只发「请求展开」，等 `open` 变 true 后再交焦点，避免对 `display: none` 的输入框调 focus 无效。
- 空输入按纯空白判定（`trim()`），此时既不调解析也不提示；只有分隔符的输入归一后为空，解析返回 null，按零命中提示。
- `onPlay` 设为可选：既有 `test/game-panel.test.tsx` 直接构造面板、没有页面可回调；不传时不渲染输入框，既有「唯一 role=status」断言不受影响。
- 提示出现时由 `.moves`（flex 增长项）让出高度，抽屉断点与棋盘尺寸公式未动。

**偏差**：无（设计档 §1 / §2 / §3 逐条对齐）。

**验证读数**

- `npm run typecheck` → 退出码 0。
- `node --test test/notation-input.test.ts` → 12 通过 / 0 失败。
- `npx vitest run test/integration/notation-input.test.tsx` → 5 通过 / 0 失败。
- `npm run check` → 退出码 0；`node --test` 241 通过 / 0 失败（基线 229，新增 12）；vitest 11 文件 59 用例通过（基线 54，新增 5）。
- `npm run build` → 退出码 0（`✓ built in 1.25s`）。
- 浏览器实跑（`npm run preview` + 内置浏览器，视口约 1400×800）：输入「炮二平五」回车 → 炮落中路、着法记录出现该步、输入清空且保持焦点；输入「炮二平九」→ 不落子、提示出现且原文保留；点「认输」→ 输入框置灰；人机页点「执黑」→ AI 回合输入框置灰；棋盘棋子聚焦时按 `/` → 焦点落到记谱输入框。

**未做（设计未要求）**：输入框未加 placeholder——设计档只定了提示行与可访问名，未定占位文案。实机截图里空输入框没有可见文字，是否补一句占位示例待父代理定。

## §6 验证与收口（父代理）

**收口判定**：交付完整，需求 F1.8 四条验收逐条落位，无简化、无未做项。

**需求对照**

| 需求点 | 落点 | 状态 |
|---|---|---|
| 对弈页与人机页可输入中文记谱直接走子 | `src/shared/notation.ts` 的 `parseChineseNotation` + `src/client/panel/NotationInput.tsx` + 两个页面的 `onPlay` | 完成 |
| 看不懂的串不落子并给提示 | 零命中返回 null，提示行 `role="status"` | 完成 |
| 终局与 AI 回合输入框不可用 | `notationDisabled` 由页面传入，面板再用 `session.result` 兜底 | 完成 |
| `/` 聚焦、面板收起先展开 | `GamePanel` 的 window keydown + `onRequestExpand` | 完成 |

**评审链**

设计评审三轮（首轮 14 条 → 二轮 12 条 → 三轮 8 条，第三轮 `VERDICT: pass`）；代码评审 #73 一轮通过（🔴 0 · 🟡 2 · 🔵 5），7 条意见全部处置：输入法合成态 Enter 不提交、半角逗号并入分隔符、占位示例补进设计档、内联回调引起监听重挂写进注释、局面变化清陈旧提示、状态行断言改用 class 定位、抽屉态让位口径改成实际行为。

**验证读数（收口行）**

- `npm run check`：`node --test` 241 通过 / 0 失败；`vitest` 11 文件 60 用例通过 / 0 失败。
- 改动面单测：`node --test test/notation-input.test.ts` 12 通过。
- 集成那一半（F1-8）：`npx vitest run test/integration/notation-input.test.tsx` 6 通过。
- `npm run typecheck` 与 `npm run build` 均退出码 0。

**遗留（不入本批）**

- 桌面实跑只覆盖 1400×800；抽屉态下让位由面板体滚动承担，设计档已按实际行为改写，未另做真机读数。
- 联机页的记谱输入不在本批范围（设计档 §1 已声明）。
