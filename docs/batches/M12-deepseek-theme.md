# 2026-11-14 · M12 DeepSeek 深色主题
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户指令「UI颜色布局参考deepseek app」，并选定方案 A（深色界面 + 浅色棋盘）。
> 台账 = #17（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户原话：「UI颜色布局参考deepseek app」；随后选「a」= 深色界面 + 浅色棋盘。

为什么不是照抄：DeepSeek 是聊天界面，布局结构（输入框居中、消息流）搬不到棋盘上。能照的是取值与分层比例——近黑底、蓝色强调、头发丝描边、卡片圆角。

棋盘必须保持浅色：红黑棋子压在近黑底上，对比会掉到 3:1 以下，长局看不清。所以「深色桌 + 浅色纸」是这版的核心。

取值范围是实测的：`https://chat.deepseek.com` 登录页用浏览器读了 `getComputedStyle`。页面 21,21,23；卡面 27,27,28；主字 249,250,251；次字 173,178,184 与 129,133,140；强调蓝 86,134,254；描边 rgba(255,255,255,.12)。

一处与 DeepSeek 不同的处理：`--accent` 直接当按钮底时白字只有 3.4:1（DeepSeek 自己也这样）。我们按 4.5:1 的门槛把它拆两个 token：`--accent` 只做描边与链接，`--accent-strong` 做填充按钮底。

范围：只动令牌层与各分表的字面色值、棋盘外投影、验收脚本。不动布局结构、不动对局专注、不动手机一屏几何。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

把界面换成深色（近黑底 + 蓝强调 + 描边分层），棋盘保持浅色。

**设计**

`docs/design/modules/theme.md`：取值表（全部来自实测）、对比度表、布局比例、验收与风险。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `src/client/styles/base.css` | 换取值；新增 `--muted-2`、`--radius-lg`；重定义 `--raise` |
| `src/client/styles/{shell,panel,play,learn,drill,replay}.css` | 残留字面色值换变量；棋盘加外投影 |
| `scripts/acceptance.mjs` | 新增 F5.5 对比度读数（从 `:root` 取变量，按 WCAG 公式算） |
| `docs/requirements/xiangqi.md` | 改写 F5.5（等 M11 冻结窗口结束） |
| `docs/design/modules/ui-refresh.md` | 取值表改为指向 `docs/design/modules/theme.md`，避免两处各写一份 |

**边界**

不动布局结构、对局专注、手机一屏几何；只做深色一套，不做 `prefers-color-scheme` 分支、不做主题开关。

**批内接续（本批进行中用户追加的指令，逐条落在原范围之外）**

原范围写的是「只做深色一套」（见上方边界）。批内用户先后给了八条指令，都做了、都留了文档落点；本节按「类别 ∥ 来源 ∥ 落地坐标 ∥ 文档归位」记，不合并进原设计段落——原段是当时的判断，改它等于改写历史。

| # | 类别 | 来源（用户原话） | 落地坐标 | 文档归位 |
|---|---|---|---|---|
| 1 | 交互 | 「按钮形状对齐 DeepSeek」 | `src/client/styles/base.css` 新增 `--radius-pill: 4096px`；`src/client/styles/shell.css` 按钮胶囊 + 字重 500 | `docs/design/modules/theme.md` §2 取值表 |
| 2 | 交互 | 「难度和阵营选择后鼠标移开消失，除非重开局」 | `src/client/pages/AiPage.tsx` 的 `picked`／`collapsedByLeave`／全局 `pointermove`+`pointerdown` 收起；新局复位 | `docs/design/modules/ai.md` §4、`docs/design/modules/ui-refresh.md` §3 |
| 3 | 功能 | 「DeepSeek 界面是浅色，增加浅色样式」+「浅色主题也没有看到」 | `src/client/styles/base.css` 的 `:root[data-theme='light']` 令牌块；`src/client/storage/prefs.ts` 三档偏好；`src/client/App.tsx` 导航开关；`src/client/main.tsx` 首屏前落档 | `docs/design/modules/theme.md` §2 浅色段与 §3 浅色读数、`docs/requirements/xiangqi.md` F5.5、`test/RTM.md` F5-4 |
| 4 | 修复 | 「每走一步显示 AI 思考中，导致棋盘被挤压」 | `src/client/pages/AiPage.tsx` 的 `.ai-status` 常驻状态行；`src/client/styles/play.css` 的 `min-height: 20px` | `docs/design/modules/ai.md` §4 |
| 5 | 功能 | 「最后胜利者文字放大到棋盘中央，2s（后改 3s）缩小到正常字体，原先位置」 | `src/client/panel/ResultPop.tsx`（FLIP 飞行）；`src/client/styles/panel.css` 的 `.result-pop`；`src/client/panel/result-text.ts` 的 `resultTone` | `docs/requirements/xiangqi.md` F1.11、`docs/design/modules/ui-refresh.md` §3 |
| 6 | 交互 | 「红方胜显示红字」 | 状态行与放大提示按 `resultTone` 上色；`src/client/styles/panel.css` 的 `.is-red`／`.is-black` | `docs/design/modules/theme.md` §2 结果着色 |
| 7 | 修复 | 「棋盘在手机上不能显示全部」 | `src/client/board/geometry.ts` 棋盘宽度不再超过可用宽；`src/client/styles/responsive.css` 手机档棋盘吃满整屏宽、导航不换行 | `docs/requirements/xiangqi.md` F4.3、`docs/design/modules/board-ui.md` §5、`scripts/acceptance.mjs` 溢出断言 |
| 8 | 参数 | 「高手增加时间」「深度上限 8」「15 分钟」 | `src/shared/ai/levels.ts`（高手 3000ms／深度 8）；`src/shared/clock.ts` 的 `CLOCK_MS = 900_000`；`src/shared/record.ts` 上限同步 | `docs/requirements/xiangqi.md` F1.3／F1.4、`docs/design/modules/ai.md` §2 表 |

**验证口径变更**

`test/RTM.md` 的 F5-4 从「界面上没有图片与渐变」扩成「深浅两套各量 17 对，且两套 `--page-bg` 不同」；新增 F1-11 一行（终局放大提示）。第 7 条另加两条会失败的断言：棋盘不得超出视口、不得比棋盘舞台大。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

评审对象：深色令牌层 + 浅色棋盘 + 对比度验收（台账 #17）｜对象状态：待评审｜类型：设计首轮评审
已读全文：docs/design/modules/theme.md、docs/design/modules/ui-refresh.md、docs/design/modules/board-ui.md、docs/requirements/xiangqi.md、test/RTM.md。
范围限制两条：①无 document map，文档归属按 AGENTS.md 的文档表核；②评审范围只含文档，源文件行数未自行度量，分档按两份设计中记录的行数核。

| # | Category | Severity | Issue | Suggestion |
|---|---|---|---|---|
| 1 | 集成测试设计 | 🔴 | docs/design/modules/theme.md §5 写「起点：`test/RTM.md` 的响应式故事与 F5-5 的读数行」，表内一行写「F5-5｜现有行只量 CLS｜加一条对比度读数，不新造行」；但 test/RTM.md 的「性能（需求 F5）」只有 F5-1、F5-2、F5-3，量 CLS 的是 F5-3，没有 F5-5 行。RTM 自述「每个业务故事一节，每个集成用例一行」，本批新增的对比度读数落进 scripts/acceptance.mjs，却声明不新增行，§6 文件表里也没有 test/RTM.md | 先在 RTM 的「性能（需求 F5）」节定行号（如 F5-4）再写用例：交互＝深色令牌层 → 页面与卡面上的正文／次要文字／链接／按钮文字；业务结果＝对比度均 ≥ 4.5:1；入口＝打开页面；需求＝F5.5；实现＝scripts/acceptance.mjs。同时把 test/RTM.md 补进 §6 文件表，§5 的 F5-5 引用改为「需求 F5.5 + 新行 F5-4」。若判定确实不新增行，按 criterion 原句写明「本批不改变任何现有用例断言的业务结果、也不新增产品真正需要的场景」并给出理由 |
| 2 | 验收 | 🟡 | docs/design/modules/theme.md §7 写「断言每行 ≥ 4.5」，而 §3 表里有一行判定为不过（「白字 `#ffffff`｜`--accent` #5686FE｜≈ 3.4:1｜**不过**」）；哪些行参与断言、「`--muted-2` 与链接按各自用途卡」具体怎么卡，没有列清 | 把断言集逐行点名（正文／次要文字／链接／填充按钮标签／棋子红黑），并把 --accent 作填充底那一行明确标为「禁止组合，不参与断言」，使脚本断言集与表一一对应 |
| 3 | 验收 | 🟡 | docs/design/modules/theme.md §3 声明「按取值算，验收就拿这张表核」，但按 WCAG 相对亮度公式用 §2 的十六进制值手算，四行与表不符：--muted-2 ≈4.9（表 4.7）、白字/--accent-strong ≈5.3（表 4.5）、棋子红 ≈6.4（表 5.7）、棋子黑 ≈14.8（表 17）；§2 的「3.37:1」与 §3 的「≈ 3.4:1」也不一致 | 用与脚本同一份实现重算并统一数值；漂移方向虽都在安全侧、判定不翻，但这张表是验收基准，读数与表不一致时实施轮无法判断谁错 |
| 4 | 需求覆盖 | 🟡 | docs/design/modules/theme.md §3 只量 --page-bg 上的配对；§4 定的主要正文面是「卡片｜`--panel-bg` + 1px `--line`」，而 docs/requirements/xiangqi.md F5.5 要求「正文、次要文字、链接与按钮文字的对比度均不低于 4.5:1」；`--low` 没有任何配对行。手算 --muted-2 在 --panel-bg 上 ≈4.65，是本批最薄的余量，却没被量 | 按实际配对补行：--text／--muted／--muted-2／--accent／--low × --page-bg／--panel-bg／--raise-bg，并据此定断言集 |
| 5 | 文档归属 | 🟡 | 对比度验收这条口径现由 docs/design/modules/ui-refresh.md §7 占着（「①用脚本按变量表算 `--text`、`--muted` 在 `--page-bg`／`--panel-bg` 上的对比度（须 ≥ 4.5:1）」），docs/design/modules/theme.md §6 只把 ui-refresh §2 的取值表改指向本档，§7 的旧口径留在原地：同一机制两份不等价描述，旧的那份配对更宽 | §6 把 docs/design/modules/ui-refresh.md §7 第①条一并纳入动作（改为指向 docs/design/modules/theme.md §3／§7 的验收），全仓只留一处口径 |
| 6 | 可行性 | 🟡 | docs/design/modules/theme.md §4 定「页内边距 16px」，而 docs/design/modules/board-ui.md §5 定「容器宽不足 360px 时棋盘保持 360px，由棋盘舞台横向滚动，不继续压小」；375 视口扣两侧 16px 只剩 343 < 360，棋盘进入横向滚动，§7 的「无元素越界」当场不成立。设计没说 <768 档棋盘舞台是否避开页内边距 | 写明 <768 档棋盘舞台不吃页内边距（或该档内边距另取值），并给一条可核读数：375 视口下棋盘渲染宽与舞台宽 |
| 7 | 验收 | 🟡 | docs/design/modules/theme.md §6 的字面色值清扫只点 `shell.css`、`panel.css`、`play.css`、`learn.css`、`drill.css`、`replay.css`，漏掉 docs/design/modules/ui-refresh.md §6 里承载「全部媒体查询」的 responsive.css；「本批再扫一遍」也没有可核读数，F5.5 的「无装饰性图片与纹理、无渐变」在当前验收里同样没有读数 | 把 responsive.css 补进清扫清单，并给一条会失败的读数（无十六进制/rgb 字面色值、无 linear-gradient／radial-gradient／url( 引用），归入 §7 验收项 |
| 8 | 文档卫生 | 🟡 | docs/design/modules/theme.md §1 把 F5.5 整句抄了一份，并复述被替换的旧句（「旧句写「灰白为底色」，与本批方向相反，一并换掉；「轻浮雕」改为「描边分层」」）。需求正文已由 docs/requirements/xiangqi.md 持有，设计面留了第二份抄本加一段改动史 | 照 docs/design/modules/ui-refresh.md §1 的写法只留指路句，删掉抄本与改动史，历史留在 git |
| 9 | 文档卫生 | 🟡 | 变量层清册三处不一致：docs/design/modules/theme.md §2「浅色批（现在）」列把 --muted-2／--radius-lg 标为「—」、§6 写「新增」，而 docs/design/modules/ui-refresh.md §2 已把它们列进自己那批的「新增」；--accent-strong 在 §2 有现值却不在 ui-refresh §2 的既有名字或新增名单里；docs/design/modules/ui-refresh.md 相关段列出的既有变量 `--target` 在本批取值表里没有出现（既非改值，也不在「不变」行） | 实测 base.css 后把变量清册定一份为真，改掉另一处；补上 --accent-strong 与 --target（后者若不变，就写进 §2 的固定项并说明它落在浅色棋盘上） |
| 10 | 分档 | 🟡 | docs/design/modules/theme.md §6 的分档句只覆盖样式表（「`base.css` 现 121 行、其余分表最大 312 行，全部在档内」），同一张表里的 scripts/acceptance.mjs 没有分档结论；docs/design/modules/ui-refresh.md §6 记它「实测 596 行，过了 500 行的主动复核档」并写「按页拆开放到下一批」，本批是否就是那一批没有交代 | 在 §6 补一句分档结论：acceptance.mjs 约 596 行（+本批读数）属主动复核档，写明本批不拆的理由与拆档批次，或把拆分并入本批 |
| 11 | 文档卫生 | 🔵 | docs/design/modules/theme.md §6 仍写「`docs/requirements/xiangqi.md`｜改写 F5.5（等 M11 冻结窗口结束）」，与 §1「F5.5 已按本批改写」及 docs/requirements/xiangqi.md 现行 F5.5 深色口径矛盾，是一条未勾掉的待办 | 该行改为已完成或删除，避免实施轮重复改需求 |
| 12 | 调研证据 | 🔵 | Survey evidence 记的是站点实读（截图 + getComputedStyle），没有「查了哪些公开来源文档、是否相关」一项；而 docs/design/modules/theme.md §3／§7 的判定依赖 WCAG 对比度公式 | 在调研行补公式出处，或写明「未查文档来源，仅实读站点」 |
| 13 | 需求贴合 | 🔵 | docs/design/modules/theme.md §4 给棋盘加「一圈柔和外投影」，与 docs/requirements/xiangqi.md F5.1「界面简约…无装饰性元素」的关系没写明；设计自己说它是「深色桌面上这是唯一该有投影的东西」 | 在 §2 的固定项里写清投影属分层手段而非装饰，且只出现在棋盘这一处，使 F5.1 与 F5.5 读法一致 |
| 14 | 验收 | 🔵 | 「`--accent` 与 `--accent-strong` 分工固定」靠「这条分工写进 `base.css` 的注释」守，没有一条会失败的读数 | 在 acceptance.mjs 加可失败断言（填充按钮底只用 --accent-strong、链接与描边只用 --accent），取代注释 |

计数：🔴 1 · 🟡 9 · 🔵 4（共 14 条）。

VERDICT: changes-required

### 轮次 2（评审子代理）

评审：深色令牌层 + 浅色棋盘 + 对比度验收（台账 #17）第三轮复核
范围：docs/design/modules/theme.md、docs/design/modules/ui-refresh.md、docs/design/modules/board-ui.md、docs/requirements/xiangqi.md、test/RTM.md
做法：五份本轮全部重读；不以快照判修没修；第三轮不开新问题链。

| # | Orig# | File | Severity | Status | Notes |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/modules/theme.md | 🔴 | Fixed | §5 起点回到 test/RTM.md，新增 F5-4；§6 文件表已列入 test/RTM.md |
| 2 | 2 | docs/design/modules/theme.md | 🟡 | Fixed | §3 断言集改为「断言列为「过」的十七行」，禁止三行只作证据；表内数过确为 17 行 |
| 3 | 3 | docs/design/modules/theme.md | 🟡 | Fixed | 20 行读数与前轮逐条复算结果一致：17.45／16.47／8.54／8.06／5.33 |
| 4 | 3 | docs/design/modules/theme.md | 🟡 | Fixed | 续：5.03／4.59／5.42／5.11／6.20／6.42／10.89／5.20／5.27 |
| 5 | 3 | docs/design/modules/theme.md | 🟡 | Fixed | 续：5.85／13.62／5.36／3.37／2.63／1.13；§2 的 3.37 与 5.27 同表一致 |
| 6 | 4 | docs/design/modules/theme.md | 🟡 | Fixed | 补齐 --panel-bg 各配对与 --raise-bg 上 4.59（最薄余量） |
| 7 | 5 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | §7 第①条指向 docs/design/modules/theme.md §3 的断言集；取值表只此一处维护 |
| 8 | 6 | docs/design/modules/theme.md | 🟡 | Fixed | §4 写明 <768 档保持 8px，并给出 359 与 343 两个读数，算术已自洽 |
| 9 | 7 | docs/design/modules/theme.md | 🟡 | Fixed | §6 清扫清单含 responsive.css；§7 有渐变与 url( 的可失败读数 |
| 10 | 8 | docs/design/modules/theme.md | 🟡 | Fixed | §1 只留指路句，旧句叙述与本档改动史已删 |
| 11 | 9 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | §2 改为只新增四个，并把 --muted-2／--radius-lg 等五个明确归 docs/design/modules/theme.md 那批 |
| 12 | 10 | docs/design/modules/theme.md | 🟡 | Fixed | §6 分档含 scripts/acceptance.mjs 596 行、不拆理由与拆档计划 |
| 13 | 11 | docs/design/modules/theme.md | 🔵 | Fixed | §6 不再有待办行 |
| 14 | 12 | docs/design/modules/theme.md | 🔵 | Fixed | 补了 WCAG 公式与「除站点实读外未查其他文档来源」 |
| 15 | 13 | docs/design/modules/theme.md | 🔵 | Fixed | §2 固定项写明投影属分层手段并引 F5.1 |
| 16 | 14 | docs/design/modules/theme.md | 🔵 | Fixed | 分工改由 §7 的一条断言守 |
| 17 | 新增 | docs/design/modules/theme.md | 🟡 | Fixed | 「禁止」改为三行，与表内三行一致，不会漏进 1.13 那行 |
| 18 | 新增 | docs/design/modules/theme.md | 🔵 | Fixed | §4 算据改为 375 − 16 = 359；343 只作 16px 那档的反例 |
| 19 | 新增 | test/RTM.md | 🔵 | Fixed | F5-4 结果改为「界面上没有图片与渐变」，并补「提示绿」 |
| 20 | 新增 | docs/design/modules/ui-refresh.md | 🔵 | Fixed | 变量清册拆成四组短行，机检门不再拦 |

计数：🔴 0 · 🟡 0 · 🔵 0（前轮 20 条全部 Fixed，本轮无新增）。
备注：前轮唯一 🔴 已修实；余留项无遗留，批准通过。

VERDICT: pass

### 轮次 3（评审子代理）

> 状态行重置：第 3 轮打回（changes-required）· 上一轮状态行 = 评审通过 → 进行中 · 2026-11-14

**复核对象**：M12 落地文档（`docs/design/modules/theme.md`、`docs/design/modules/ui-refresh.md`、`docs/design/modules/ai.md`、`docs/design/modules/board-ui.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`），状态「已实现」，本文为这批档的独立复核。范围限定六份文档；Document Map 未提供，文档归属只按 `AGENTS.md` 的层表判断；源码文件未取新读数（见第 17 条）。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | 需求覆盖 | 🔴 | `docs/design/modules/theme.md` §2「红胜 `--red-text`、黑胜 `--black-text`、和棋 `--accent-strong`」把填充令牌当文字色：深色值 `#3964fe` 落在 `--panel-bg #232324` 上，按本档同一 WCAG 公式为 3.31:1，低于 `docs/requirements/xiangqi.md` F5.5 与 `test/RTM.md` F5-4 的 4.5:1；这一对不在 §3 断言表内，而 §3 的禁止块把 3.37:1 判为「不达标，不得作填充底」。`docs/design/modules/ui-refresh.md` §3 又写「和棋留蓝（状态行与放大提示同色，用 `*_text` 那组令牌）」，而 `--accent-strong` 不属于 `*_text` 组——同一归属两处给出不同答案。 | 和棋给一个文字档的蓝（新令牌或重取值），使其在 `--panel-bg` 上 ≥ 4.5:1；把该对写进 §3 断言表与该脚本的 F5-4 读数；`docs/design/modules/ui-refresh.md` §3 的令牌组表述与 `docs/design/modules/theme.md` 对齐。 |
| 2 | 需求覆盖 / 文档归属 | 🔴 | `docs/requirements/xiangqi.md` F1.10「进入对局页看不到着法记录与记谱框」与 `test/RTM.md` F1-10「进入对弈页看不到着法记录与记谱框」对「进入时的状态」只给一个答案，而 `docs/design/modules/ui-refresh.md` §3 写「只有第一次进来是收起的」并把选择存进 `xiangqi.panel-open.v1`：上次留在展开态的回头用户一进页就看到两者，需求验收与 RTM 断言同时落空，RTM 该行还变成依赖上一用例残留存储的条件用例。 | 二选一并在三处同改：去掉持久化（按需求验收读数），或把 F1.10 与 RTM F1-10 改写成「按存储值决定进入态」并各给一条断言（新态 / 已展开态）。 |
| 3 | 分支溯源（6b） | 🔴 | `docs/design/modules/ui-refresh.md` §3「存储不可用（隐私模式、配额满）时按「未展开」处理，不报错。」是一条新分支，但既无实读或用户报告的引文，也无复现路径；同批 `docs/design/modules/ai.md` §3 的 Worker 崩溃分支则带了「复现：把 `new Worker(new URL('./worker.ts', …))` 的路径改成不存在的文件」。 | 给这条分支一个场景（触发手段 + 观察到的行为 + 断言），或删掉它、让读写走同一条失败路径。 |
| 4 | 文档归属 | 🟡 | `docs/design/modules/ai.md` §4「每人 10 分钟包干，AI 思考耗时计在它自己那份里」对 `docs/requirements/xiangqi.md` F1.4「计时对局：每方 15 分钟包干，走子后切给对方；己方归零判负」：同一时钟机制两处取值不同，且无一处说明人机局是例外。 | 明确哪个值管人机局及其理由（若为特例，写成一句「人机局 X 分钟，其余 15 分钟」），否则把数对齐。 |
| 5 | 清晰度 | 🟡 | `docs/design/modules/theme.md` §4 的算术与 `docs/design/modules/board-ui.md` §5 的几何互斥：前者「**<768 档页内边距保持现状 8px**（375 − 16 = 359」把棋盘算进有 8px 内边距的列里（359/9 = 39.9，低于 `test/RTM.md` F4-4 的「格宽不低于 40px」），后者写「手机档（<768px）棋盘左右不留页边距，按整屏宽排」（375/9 = 41.7）；`docs/design/modules/theme.md` 还把 360 称作「§5 的 360px 下限」，而 `docs/design/modules/board-ui.md` §5 写的是「屏幕窄于 360 时格宽随宽度同缩」。 | 指明 8px 内边距作用在哪个容器（外壳 / 棋盘舞台），让手机档棋盘宽单值化；并修正或删掉「360px 下限」这处引用。 |
| 6 | 清晰度 | 🟡 | 两个令牌缺可用取值、深色还缺一项：`docs/design/modules/theme.md` 浅色表 `--raise` / `--raise-flat` 写「内高光 + 两层柔和投影」、`--board-shadow` 写「更轻的一档」（都是描述不是值）；深色表完全没有 `--board-shadow`，而 §2 固定项说「棋盘的外投影是分层手段，不是装饰」、§4 说棋盘带「一圈柔和外投影（唯一的投影）」。 | 两个令牌在两套配色下各给具体值（深色含 `--board-shadow`），使落地档记下已发布的形态。 |
| 7 | 清晰度 | 🟡 | 放大提示自身的表面没有一份档写明：`docs/design/modules/ui-refresh.md` §3 只写「结果文字放大到棋盘中央停 3 秒」。若它直接落在棋盘上，所选 `*_text` 值对 `--board-bg #f7f2e6` 分别只有 2.40:1（`--red-text` #f27b6e）与 0.74:1（`--black-text` #cfd3d6），同公式计算。 | 写明放大提示的底（建议一枚 `--panel-bg` 的承载面），使 `*_text` 落在 §3 已断言的背景上。 |
| 8 | 验收 / 集成设计 | 🟡 | `test/RTM.md` F5-4 断言四件事（可切换 / 棋盘两套皆浅 / 对比度 / 无图片与渐变），`docs/design/modules/theme.md` §5 的 F5-4 行只断言「上列每一对的对比度均 ≥ 4.5:1；白字不作 `--accent` 填充底」；三档开关这条交互在该节没有行承载，只在 §7 以无跑法的条目出现。 | 把 §5 的 F5-4 行补到 RTM 的四条业务结果，或为三档开关单开一行（交互 / 结果 / 入口 / 需求 / 跑法）。 |
| 9 | 集成设计 delta | 🟡 | `docs/design/modules/ui-refresh.md` §3 设计 ResultPop，`test/RTM.md` 已有「终局提示放大后缩回」这一行，但 §5 的两张表（新增三行 + 受影响行五条）都不提 F1-11：既不记为新增，也不记为受影响。 | 在 §5 补 F1-11 一行：放大提示 ↔ 状态行／棋盘的交互、业务结果（放大 → 3 秒收回 → 状态行仍在）、入口、需求、实现文件。 |
| 10 | 文档归属 | 🟡 | 覆盖式抽屉几何同时写在 `docs/design/modules/board-ui.md` §5（「面板为覆盖式底部抽屉：`position: fixed` 贴底、`max-height: 50dvh`、自身纵向滚动」）与 `docs/design/modules/local-play.md` §5（`docs/design/modules/ui-refresh.md` §6 记该行「改为覆盖式」，而它的 Closest precedent 又说面板三档高度表归 `docs/design/modules/local-play.md` §5）。Document Map 缺失，此处只按层表判断归属。 | 保留一份权威几何（`docs/design/modules/local-play.md` §5），`docs/design/modules/board-ui.md` §5 只留「可用高不含面板」这一句并指向它。 |
| 11 | 最近先例 | 🟡 | `docs/design/modules/board-ui.md` 的先例行仍写「本模块只把入参收口成 `BoardMode`，不改变 M1 的棋盘几何与视觉。」，而本批改了它 §2（「可加一圈 1px 内阴影表现厚度」）与 §5 的 <768 几何（`docs/design/modules/ui-refresh.md` §6 已登记这两处改写）。 | 更新该先例行：写出改动的两处与「为什么原形不适用」。 |
| 12 | 现有件 | 🟡 | `docs/design/modules/theme.md` §6「文案：本批不新增用户可见文案。」与 §2「界面右上角有三档开关：跟随系统 / 浅色 / 深色」矛盾；且 `resultTone`（`docs/design/modules/theme.md` §2）与 `ResultPop`（`docs/design/modules/ui-refresh.md` §3）两个新名字在两份档的现有件检查里都没有三问答案（existing / none found / existing but unusable）。 | 改写那句文案结论（列出三档开关的标签），并给 `resultTone`、`ResultPop` 各补一条检查结论。 |
| 13 | 文档归属 | 🟡 | `docs/design/modules/theme.md` §2「归属由 `resultTone` 一处判定，三处显示（面板、放大提示、联机页）共用，不各判一次。」与 `docs/design/modules/ui-refresh.md` §3「观战、联机、棋谱、课程、练习页不在本批改动范围。」冲突：同一批一处说改、一处说不改。 | 二选一：把联机页从「三处」里去掉，或在文件划分里补上它改到的文件。 |
| 14 | 文档卫生 | 🟡 | `docs/design/modules/ui-refresh.md` §4 仍留着执行期指令：「执行前先跑 `node scripts/acceptance.mjs` 取现读数（棋盘底边与滚动高度），把数写进批次实施记录；读数与「棋盘完整可见」不符时，以读数为准修正本节。」档面在已实现态下读起来仍是待办，本节也没有落到一个确定的读数。 | 把已取得的读数写进批次实施记录，并在本节把「执行前先跑…不符时修正」改成现在成立的几何陈述。 |
| 15 | 文档卫生 | 🔵 | 同档两处数值互不一：`docs/design/modules/theme.md` §3「**断言集**是断言列为「过」的十七行」，而表中标「过」的是 18 行；§8「`--muted-2` 余量最小（`--raise-bg` 上 4.59）」与 §3 的 4.52（按同公式复算也是 4.52）不符。 | 改「十七行」为实际行数；§8 的 4.59 改成 4.52。 |
| 16 | 清晰度 | 🔵 | `docs/design/modules/theme.md` §2 只写「前置 `Inter`」，没写 Inter 从哪来：不随包则整栈静默回退（等于没改动），改为外链则计入 `docs/requirements/xiangqi.md` F5.2「请求数 ≤ 6」。 | 补一句「仅栈前置，不引请求」，或写明随包方式与代价。 |
| 17 | 分档抽查 | 🔵 | 本次范围限定六份文档，未对 §6 表内源码文件取新读数，故 `docs/design/modules/theme.md`「`base.css` 现 121 行、`responsive.css` 296 行、其余分表最大 312 行」与 `docs/design/modules/ai.md`「无文件跨 500 行档」两处结论标为 unverified。`scripts/acceptance.mjs` 596 行在两份档中一致，按页拆到 `scripts/acceptance/` 的方案已写，但连续两批顺延，属记录性债务。 | 收口时补一次实测行数；拆分批次写进批次记录，别只写在设计档里。 |

计数：🔴 3 · 🟡 11 · 🔵 3（共 17 条）。

VERDICT: changes-required

### 轮次 4（评审子代理）

**第二轮复核（M12 落地文档 · 已实现态）**：逐条核验上一轮 17 条处置，并只看修复引入的新问题。六份文档本轮全部重读，对比度按 `docs/design/modules/theme.md` 自引公式由档内 hex 复算。

| # | 原# | 文件 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|---|
| 1 | 1 | docs/design/modules/theme.md | 🔴 | Fixed | 和棋改 `--accent`：§2 结果着色写「和棋 `--accent`」，下一段补取舍「和棋用 `--accent` 而不是 `--accent-strong`：…当文字压在 `--panel-bg` 上只有 3.31:1」；4.66（深）与 5.81（浅）都在断言/读数表内。`docs/design/modules/ui-refresh.md` §3 同口径：「和棋用 `--accent`——它是文字与描边那一档」。 |
| 2 | 2 | docs/requirements/xiangqi.md · test/RTM.md · docs/design/modules/ui-refresh.md | 🔴 | Fixed | 三处同改：F1.10「首次进入对局页看不到着法记录与记谱框（展开过就记住，之后进入保持展开）」；RTM F1-10「首次进入…展开过一次则之后进入即展开（选择记在本地）」；`docs/design/modules/ui-refresh.md` §5「首次进入看不到着法记录与记谱框…展开过一次则之后进入即展开（存 `xiangqi.panel-open.v1`）」。 |
| 3 | 3 | docs/design/modules/ui-refresh.md | 🔴 | Fixed | 分支复现已落地：本轮 grep 实见 `import { applyTheme, readPanelOpen, readSound, readTheme, writePanelOpen, writeSound, writeTheme } from '../src/client/storage/prefs.ts';`（store 可注入即抛错 store 的接缝）。测试体未读（超范围，unverified）。残留见 20。 |
| 4 | 4 | docs/design/modules/ai.md | 🟡 | Fixed | §4 已改「每方 15 分钟包干（与需求 F1.4 同一个 `CLOCK_MS`，不是另设一个值）」，与 F1.4「每方 15 分钟包干」一致。 |
| 5 | 5 | docs/design/modules/theme.md | 🟡 | Fixed | §4 改为「<768 档页内边距保持 8px（面板与常驻条用；棋盘舞台左右为 0…375 上格宽 41.7、360 上 40.0）」，「360px 下限」错引已删；375/9=41.7、360/9=40.0 复算成立。残留见 19。 |
| 6 | 6 | docs/design/modules/theme.md | 🟡 | Fixed | 深色 `--board-shadow` 给出 `0 2px 6px rgba(0,0,0,.28), 0 14px 40px rgba(0,0,0,.32)`；浅色 `--raise`／`--raise-flat`／`--board-shadow` 均为具体 box-shadow。 |
| 7 | 7 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | §3 写明「提示自带一枚 `--panel-bg` 底（见 `ResultPop` 的 `.result-pop`）」，并把 2.40／0.74 写进理由，与复算一致。 |
| 8 | 8 | docs/design/modules/theme.md | 🟡 | Fixed | §5 F5-4 行已含四条业务结果（逐对 ≥4.5、白字不作 `--accent` 底、两套 `--page-bg` 不同、棋盘皆浅、无渐变与 `url(`）与「右上角切三档」入口。 |
| 9 | 9 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | §5 已有 F1-11 行（交互/结果/入口/需求/实现）。该行的渲染问题见 18。 |
| 10 | 10 | docs/design/modules/board-ui.md | 🟡 | Fixed | §5 把抽屉几何的「唯一出处」让给 `docs/design/modules/local-play.md` §5，本节只留「覆盖式不占棋盘高度」结论；指针问题见 19。 |
| 11 | 11 | docs/design/modules/board-ui.md | 🟡 | Fixed | 先例行改为「偏离一／偏离二」并各给理由；原「不改变 M1 的棋盘几何与视觉」已删。 |
| 12 | 12 | docs/design/modules/theme.md · docs/design/modules/ui-refresh.md | 🟡 | Fixed | 文案结论改为「本批新增三处可见文案——配色开关的「跟随系统 / 浅色 / 深色」三个选项」；`resultTone`（GamePanel 行）与 `ResultPop.tsx` 在 `docs/design/modules/ui-refresh.md` §6 表内各有职责行。`现有件检查` 仍缺这两个名字的 none-found 行（🔵，不阻断）。 |
| 13 | 13 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | 「联机页只共用面板状态行那套样式…本批没有为它新增文件」与 `docs/design/modules/theme.md` §2「三处共用同一个类名」口径一致。 |
| 14 | 14 | docs/design/modules/ui-refresh.md | 🟡 | Fixed | §4 改为已成立的陈述「读数见批次记录的 F4-6 一行…改后该表在 375×667 与 360×740 两档都给出…」，执行期指令已删。 |
| 15 | 15 | docs/design/modules/theme.md | 🔵 | Fixed | §3 改「**断言集**是断言列为「过」的十八行」（表内标「过」确为 18 行）；§8 改「`--muted-2` 余量最小（`--raise-bg` 上 4.52）」。 |
| 16 | 16 | docs/design/modules/theme.md | 🔵 | Fixed | `--font-ui` 行补「**只做栈前置、不引外链**」及其与需求 F5.2 的关系。 |
| 17 | 17 | docs/design/modules/theme.md · docs/design/modules/ai.md | 🔵 | Accepted | 分档抽查仍无实测：理由（本次范围限六份文档）成立，收口时记一次实测行数；`acceptance.mjs` 596 行的按页拆分仍为记录性债务。 |
| 18 | (new) | docs/design/modules/ui-refresh.md | 🔵 | New | F1-11 行与表头之间被空行隔断，成为无表头、无分隔行的孤立行：「| F1-11 | 终局 → 结果放大提示 → 面板状态行 | 任一终局在棋盘中央放大显示结果，停 3 秒后缩回原处；同一句话仍留在状态行 | 打开页面 → 对弈 → 认输 | F1.11 | `test/integration/local-play.test.tsx` |」——不渲染为该表的一部分。修法：删掉两处空行，接在第二条 F1-10 行之后。 |
| 19 | (new) | docs/design/modules/ui-refresh.md | 🔵 | New | 指针两跳 + 旧错引残留：「（几何写进 `docs/design/modules/board-ui.md` §5）」与「公式、720 上限与 360 下限全部按 `docs/design/modules/board-ui.md` §5 不变」，而 `docs/design/modules/board-ui.md` §5 已写「以 `docs/design/modules/local-play.md` §5 为唯一出处」，其正文是「屏幕窄于 360 时格宽随宽度同缩，完整可见优先。」（与需求 F4.3「格宽允许略小」一致，360 不是下限）。 |
| 20 | (new) | docs/design/modules/theme.md · docs/design/modules/ui-refresh.md | 🟡 | New | 偏好落地的文件不在任何文件表里：两份档都设计 localStorage（`xiangqi.theme.v1`、`xiangqi.panel-open.v1`），但 `docs/design/modules/theme.md` §6 表未列正文已引用的 `main.tsx` 与三档开关所在文件，`docs/design/modules/ui-refresh.md` §6／§7 未列 `src/client/storage/prefs.ts` 与 `test/prefs.test.ts`（两份文件均存在，见 3 的 grep）。落地档因此没记下开关与读写归属。 |
| 21 | (new) | docs/design/modules/theme.md | 🔵 | New | §5 两处措辞与改动后的正文不一致：「配色不改变几何与结构，它们的断言不动」vs §4 设了 16／8px 内边距与棋盘舞台 0；「| F1-10 | 对局专注 | 默认收起与常驻条不变 |」vs F1.10 的「首次进入…收起」。 |
| 22 | (new) | docs/design/modules/ui-refresh.md | 🔵 | New | §5 的 F1-10 行未写用例如何进入「首次」态：「首次进入看不到着法记录与记谱框；…展开过一次则之后进入即展开（存 `xiangqi.panel-open.v1`）」——两条断言共用一份 localStorage，单进程里需在用例内清键或分文件，否则互相污染。 |

计数：上一轮 17 条 = 16 Fixed + 1 Accepted（无遗留 🔴）；本轮新增 5 条 = 🔴 0 · 🟡 1 · 🔵 4。

VERDICT: pass

## §4 用户批准（主 agent）

**用户批准**

用户在 2026-11-14 的指令里直接点了「收口」（原话见 §1 的批内接续来源），准予把本批（深色主题 + 批内追加的浅色、按钮形状、难度收起、终局提示、手机棋盘、高手档参数、15 分钟计时）一并收口。

收口前的事实依据：

- 设计评审两轮：第 1 轮 17 条（🔴3/🟡11/🔵3）→ 全部处置；第 2 轮复核 17 条全部落地、新增 5 条非阻断（🟡1/🔵4）→ 当场处置。
- 用户实机确认：音效可闻（「有声音」）、手机整盘可见、深浅两套配色可切。
- 读数：`npm run check` 262 单测 / 71 前端用例全绿；`npm run build` 通过；`node scripts/acceptance.mjs` 全部阈值通过。

## §5 实施记录（实施者：主 agent ∥ coder）

**实现**

| 文件 | 改动 |
|---|---|
| `src/client/styles/base.css` | 令牌换深色取值；新增 `--muted-2`、`--red-text`、`--black-text`、`--target-text`、`--board-ink`、`--on-accent`、`--radius-lg`；`--raise`／`--raise-flat` 改成内描边；加 `color-scheme: dark` |
| `src/client/styles/shell.css` | 导航当前项与按钮悬停改用 `--raise-bg`／`--sunken-bg`；主按钮文字改 `--on-accent`（原为 `--panel-bg`，深色下会变成深字压蓝底）；主按钮悬停改 `filter: brightness(1.12)`——改底色就要重算白字对比度 |
| `src/client/styles/panel.css` | 行棋方圆点、双方时钟文字改 `--red-text`／`--black-text` |
| `src/client/styles/drill.css`、`learn.css` | 对/错底色改低透明度同色；答对提示绿改 `--target-text` |
| `src/client/styles/play.css` | 棋盘加全站唯一的外投影；河界字样改 `--board-ink` |
| `src/client/styles/replay.css` | 选中态底色与悬停同 shell |
| `scripts/acceptance.mjs` | 新增 F5-4 读数：从 `:root` 取令牌按 WCAG 公式算 17 对；三条禁止组合只作证据；另扫样式表无渐变、无 `url(`，并断言填充按钮不含 `--accent` |

**落地时发现的三处，评审没看到**

1. **主按钮原来写 `color: var(--panel-bg)`**——浅色批里它等于白字，深色批里变成近黑字压蓝底。改成 `--on-accent`。
2. **河界字样 `#8a6a45` 在盘面上只有 4.45:1**，压深到 `#846340`（4.90）。顺带把它提成 `--board-ink`，样式表里再无字面色值。
3. **对/错底色 `#eef6ee`／`#fbeceb` 是浅色毯**，深底下会糊成白块；改成同色 16% 透明度。

**验证**

- `npm run check`：253 单测 / 68 前端用例，0 失败；类型检查通过。
- `npm run build` + `node scripts/acceptance.mjs`：全部阈值通过，F5-4 打印 17 对读数（17.45 / 16.47 / 8.54 / 8.06 / 5.33 / 5.03 / 4.59 / 5.42 / 5.11 / 6.20 / 6.42 / 10.89 / 5.20 / 5.27 / 5.85 / 13.62 / 4.90），三条禁止组合如预期不达标。
- F4-6 复核未破：375×667 棋盘仍 102→502，抽屉展开 332→556，常驻条不动。
- 实机目视：1440 桌面收起 / 展开、375×667 手机各一张截图，棋盘读成「纸」，红黑双方文字都清楚。

## §6 验证与收口（父代理）

**收口记录**

本批交付：深色与浅色两套界面（跟随系统 / 浅色 / 深色三档开关）、胶囊按钮、人机页难度与阵营的收起、终局放大提示与胜方着色、手机棋盘整屏可见、高手档 3000ms / 深度 8、每方 15 分钟。逐条来源与落地坐标见 §2 的「批内接续」表。

**收口测试行**

- `npm run check`：262 单测 / 71 前端用例，0 失败（提交 `f6db791` 上复跑）。
- `npm run build`：通过。
- `node scripts/acceptance.mjs`：全部阈值通过——三视口 + 360 档格宽 72 / 72 / 41.7 / 40.0、棋盘与导航均无溢出、深浅两套各 17 对对比度 ≥ 4.5、无渐变与 `url(`、无写死颜色。
- 设计评审：两轮，`VERDICT: pass`（§3 轮次 4）。

**遗留（不阻断收口，已各自记账）**

- `scripts/acceptance.mjs` 已 596 行、跨 500 行档：按页拆到 `scripts/acceptance/`，连续两批顺延，仍未排期。
- 分档抽查的实测行数未在评审范围内取（评审只读六份文档）；本批以 `npm run check` 与构建产物为准，行数读数留待拆分那一批一并记录。

**台账**：`#17` 收口核销（见台账行 evidence）。
