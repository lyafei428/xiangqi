# 2026-11-14 · M12 DeepSeek 深色主题
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户指令「UI颜色布局参考deepseek app」，并选定方案 A（深色界面 + 浅色棋盘）。
> 台账 = #17（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
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

## §4 用户批准（主 agent）
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
