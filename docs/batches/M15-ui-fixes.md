# 2026-11-14 · 界面与交互修整
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14 连续反馈：手机端棋盘不见、身份挡住棋盘、卡片式、房间号、字号、控件占位、对坐摆字、表头吸顶、着色等。
> 台账 = #19（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>
## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 任务

把这一轮用户逐条指出的界面与交互问题一次修完，且不偏离既有的令牌与几何规则。

## 覆盖的条目（按用户原话归类）

| 用户反馈 | 落地 |
|---|---|
| 手机端课程/练习/联机没有棋盘 | 舞台高度改为实测盒子（`useStageSize` 每次渲染重看元素）；三页棋盘现在都完整可见 |
| 联机「你是红方」挡住棋盘、不能收起 | 联机面板重构为 `.panel-focus` 常驻条 + 可收起着法抽屉 |
| 卡片式界面 | 联机大厅拆两张卡（创建 / 加入），桌面并排、手机上下摞 |
| 手机端看不到房间号 | 房间码移进常驻条，不随「对手是否已加入」消失 |
| 记住房间 | 房间与 token 改存 `localStorage`（兼容旧 `sessionStorage`），房间被回收时清记忆并把码填回输入框 |
| 房间码手动加入 | 大厅第二张卡：六位码输入 + 加入 |
| 字号与占位 | 导航 16px（手机 14）、页标题 26px（手机 22）；难度/阵营压成一行 29px，手机档藏标签与圆点、用竖线分组、选中态靠加粗与底色 |
| 面板胶囊按钮字号不一致 | `.new-game` 补 13px，与 `.panel-toggle` / `.resign` 同档 |
| 开始与认输要合成一个按钮 | 同一个 `.resign`，开表前显示「开始」、开表后「认输」，换字 200ms 淡入位移，尺寸位置不变 |
| 对坐下棋字形 | 对弈页黑方棋子与「楚河」转 180°，各读各的正字；开关默认开 |
| 棋谱分栏字被挡 | 选中态字色改 `--on-accent`；选中态自己接住 `:hover`，不再被通用规则换成浅灰底 |
| 表头不随下拉 | 「我的棋谱 / 导入」`position: sticky` |
| 着色 | 身份红/黑字色，在线绿、离线灰，两方名字各带字色 |

## 关键判据

- 令牌唯一来源 `docs/design/modules/theme.md` §2；颜色只活在 `base.css`，其他样式表出现十六进制会被 acceptance 判失败。
- 棋盘宽度永不超过可用宽；手机档左右无页边距。
- 常驻条不可设 `overflow` 滚动（着法抽屉是绝对定位贴在它上沿之上，一开滚动就被裁掉）。
- 联机时钟建房间时 `running: null`，第二人就座才开表。

## 受影响文件

`OnlinePage.tsx`、`PlayPage.tsx`、`AiPage.tsx`、`GamePanel.tsx`、`Board.tsx`、`layers.tsx`、`useFaceOff.ts`、`useMoveTrail.ts`、`socket.ts`、`server/room.ts`、`styles/*.css`、`storage/prefs.ts`。

## 验收对照

`test/RTM.md` F1-2 / F1-3 / F1-10 各行；`scripts/acceptance.mjs` 的手机一屏与对比度阈值。

## §3 设计评审（评审子代理）

### 轮次 1（评审子代理）

评审对象：M15 界面与交互修整。
声明的主题六个：手机棋盘、卡片大厅、字号与控件、对坐摆字、表头吸顶、着色。
受评文档 7 份全部通读，未取 git diff。
文件行数以 read 实测，只取行数，不读实现。

文档地图缺失：ownership 只能按 AGENTS.md 的层次（`docs/requirements/` 与 `docs/design/modules/`）判。
与未提供地图里的既有章节是否重复，本次无法核。

受评清单：`docs/design/modules/ui-refresh.md`、`docs/design/modules/board-ui.md`、`docs/design/modules/theme.md`、`docs/design/modules/online.md`、`docs/design/modules/ai.md`、`docs/design/modules/replay.md`、`docs/requirements/xiangqi.md`。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Affected-file tier | 🔴 | `scripts/acceptance.mjs` 实测 807 行，越过 800 行硬上限（该档无豁免通道），而两份设计档都把它记成 596 行并把拆分推后：`docs/design/modules/ui-refresh.md` §6「`scripts/acceptance.mjs` 实测 596 行，过了 500 行的主动复核档。本批只在它既有读数器旁加一段 F4-6 读数（约 30 行），按页拆开放到下一批。」；`docs/design/modules/theme.md` §6「`scripts/acceptance.mjs` 现 596 行，已过「500 行主动复核」档——本批只加一小段读数，不拆分，拆分单独排一批」。结论行与磁盘现状相反。 | 结论行改成实测 807 行，并按 `docs/design/modules/theme.md` §6 已写下的口径（「按页拆 `measureX` 到 `scripts/acceptance/`」）在本批落地拆分；同时复量单函数长度（300 行档）后一并写进结论行。 |
| 2 | Document ownership | 🔴 | 投影政策这一条机制在同一档里两处互斥：`docs/design/modules/theme.md` §2 固定项写「全站只此一处投影，卡片与按钮都不投影（`docs/requirements/xiangqi.md` F5.1 的「无装饰性元素」按此读）」，同档「浅色」表却给 `--raise` / `--raise-flat` 取值「`0 1px 0 rgba(255,255,255,.9) inset, 0 1px 2px rgba(16,24,40,.06)[, 0 8px 24px rgba(16,24,40,.06)]`」并注「浅色下投影看得见，回到「轻浮雕」」，§4 布局又写卡片「不加外投影」。浅色下按钮与卡片到底有没有外投影，读者拿不到唯一答案。 | 固定项改成按档表述（深色档只此一处投影；浅色档 `--raise` 带投影），并让 §4 卡片行与之一致——同一句只留一个可执行答案。 |
| 3 | Integration-test design | 🟡 | `docs/design/modules/ui-refresh.md` §5 的表新增三行（F4-6、F1-10 两条、F1-11：「｜ F1-11 ｜ 终局 → 结果放大提示 → 面板状态行 ｜ … ｜ F1.11 ｜ `test/integration/local-play.test.tsx` ｜」），但同档 §6 的登记行只写「｜ `test/RTM.md` ｜ F4-6、F1-10 两行 + 受影响行改写 + 用例实现 ｜」——F1-11 没进 RTM 行登记。 | §6 那一行改成三行（F4-6、F1-10、F1-11），与 §5 逐行对齐。 |
| 4 | Requirements coverage | 🟡 | 声明的六个主题里两项在受评文档中无落点：受评各档全文无「吸顶 / sticky / 字号」，`docs/design/modules/theme.md` §4 关于字体只有「字体 ｜ 沿用现有栈；数字仍 `tabular-nums`」，不含字号值。表头吸顶的落点在 `docs/design/modules/study-library.md`（「`我的棋谱` 的表头（标题 + `导入`）吸在列表顶部（`position: sticky`，底色与页面一致 + 一条分隔线）」），该档不在本次受评范围，本次评审无法替它出结论。第三项「卡片大厅」只有 `docs/design/modules/online.md` §5 一句「大厅是两张卡：左边「创建房间」，右边「加入房间」（六位码手动输入）。这是卡片式的落点」，受评各档没有它的受影响文件行与用例行。 | 评审范围补入 `docs/design/modules/study-library.md` 与字号所在档；卡片大厅补一行受影响文件（`src/client/pages/OnlinePage.tsx` 与它落在哪张分样式表）加一条验收读数。 |
| 5 | Requirements coverage | 🟡 | `docs/design/modules/board-ui.md` §3 一次定了两个开关——「默认开，设置里可关（`xiangqi.trail.v1`）」与「开关是 `xiangqi.faceoff.v1`，默认开，设置浮层里「对坐下棋」可关」——受评各档没有它们的 UI 落点（`docs/design/modules/theme.md` §6 的 `App.tsx` 行只写「顶栏「设置」浮层里的配色下拉」）、没有用例行、没有验收读数；F5.6 侧同样只有偏好读写（`docs/design/modules/ui-refresh.md` §6「音效开关的读写」、`docs/design/modules/theme.md` §6「与音效开关的读写」），受评档里没有四种声音与静音开关的设计。 | 设置浮层的同一条文件行列出三个开关（trail / faceoff / 静音），各给一条可跑读数（切换后存储键与可见行为同时变）。 |
| 6 | Document ownership | 🟡 | 终局结果着色这一条机制写了两份：`docs/design/modules/ui-refresh.md` §3「终局结果按胜方着色：红胜红字、黑胜黑字、和棋留蓝。红黑用 `*_text` 那组（`--red-text`／`--black-text`），和棋用 `--accent`」与 `docs/design/modules/theme.md` §2「### 结果着色」整节重复；而后者 §6 自称去重只做了两处（「§2 的取值表已改为指向本档；§7 第①条的对比度口径一并改为指向本档 §3／§7，避免两处各写一份」），§3 未收口。 | 保留 `docs/design/modules/theme.md` 那一节为唯一出处，`docs/design/modules/ui-refresh.md` §3 改指路；`resultTone`「一处判定、三处共用」只留一份措辞。 |
| 7 | Acceptance | 🟡 | 深色断言集缺一对读数：`docs/design/modules/theme.md` §3 深色表有「`--accent` #5686fe ｜ `--panel-bg` ｜ 4.66 ｜ 过」，没有 `--raise-bg` 那一行；按同档 §3 声明的公式与 §2 的取值复算，该对为 4.14:1，低于 F5.5 的 4.5（浅色表反而断言了这一对：「`--accent` #3358e0 ｜ `--raise-bg` ｜ 5.47」）。同一缺口下 `--low` 压在 `--raise-bg` 上是 4.24:1。 | 补上这一对并给结论（提 `--accent`／`--raise-bg` 取值，或声明链接与错误文字不落在按钮面上）；深浅两套断言集保持同一组。 |
| 8 | Doc hygiene | 🟡 | 规范面留着修订式表达：`docs/design/modules/theme.md` §2 的取值表保留「现在（浅色批）」整列旧值（`#f4f5f7`、`#b0742a` 等），§6 写「§2 的取值表已改为指向本档」；`docs/design/modules/ui-refresh.md` §4 写「改前的现状：<768px 上面板占 40dvh 并与棋盘争高度…改后该表在 375×667 与 360×740 两档都给出「棋盘完整可见、无纵向滚动」」。AGENTS.md 的口径是「需求与设计文档只写"现在是什么"，不写历史」。 | 删掉「现在（浅色批）」列与「改前 / 改后」「已改为」叙述，只留当前取值与当前几何；历史留 git 与批次记录。 |
| 9 | Clarity | 🔵 | `docs/design/modules/ui-refresh.md` §3 的复算出序：「它压在浅色棋盘上，直接裸字会让 `--red-text` 只剩 2.40:1、`--black-text` 只剩 0.74:1（同一公式复算）」——按 `docs/design/modules/theme.md` §3 的公式与 §2 取值（#cfd3d6 压 #f7f2e6）复算是 1.35:1；0.74 是没把较亮一侧放分子的商（0.697/0.940）。结论（需要自带底色）不变。 | 0.74 改成 1.35；`--red-text` 的 2.40 复算无误，保留。 |
| 10 | Affected-file tier | 🔵 | 行数读数与磁盘现状不一致，且结论行没覆盖表里全部文件：`docs/design/modules/theme.md` §6「`base.css` 现 121 行、`responsive.css` 296 行、其余分表最大 312 行」对现状是 108 / 291 / 419（`src/client/styles/play.css`）；`docs/design/modules/ui-refresh.md` §6「`src/client/pages/AiPage.tsx` 265 行、`src/client/panel/GamePanel.tsx` 218 行、`src/client/pages/PlayPage.tsx` 67 行」对现状是 358 / 244 / 87；`src/client/App.tsx`、`src/client/main.tsx`、`src/client/storage/prefs.ts`、`test/integration/local-play.test.tsx`（322）、`test/integration/ai.test.tsx`（393）未给读数。结论（都在 500 行内）成立。 | 换成实测值并把缺的文件并入同一行；`src/client/styles/play.css` 已 419 行，余量该记下来。 |
| 11 | Clarity | 🔵 | `docs/design/modules/board-ui.md` §3 只把河界左半边转过来：「黑方棋子 `rotate(180)`、河界左半边「楚河」同时转过来，坐在对面的那位读到的也是正字」，另一半「汉界」对对面那位仍是倒字；同档 §2 又把「马腿与河界要一眼读准」列为材质取舍的理由，两处标准不一致。 | 写明转身的字形集合与理由；若目标是「各读各的正字」，两半都该按各自读者的方向排。 |
| 12 | Clarity | 🔵 | `docs/design/modules/ai.md` §4 手机档藏掉圆点：「手机档藏掉「难度 / 阵营」两个视觉标签与圆形单选钮（`radiogroup` 自带 `aria-label`，选中项靠 `is-chosen` 的加粗与底色表达，读屏与键盘仍可操作）」，但没给 `:focus-visible` 的表现——原生圆点被藏后，键盘用户只剩加粗与底色，看不出焦点在哪个控件上。 | 控件规格里补一条焦点环（用 `--accent` 描边）及其读数。 |

计数：🔴 2 · 🟡 6 · 🔵 4 · 合计 12。

VERDICT: changes-required

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
## §6 验证与收口（父代理）
