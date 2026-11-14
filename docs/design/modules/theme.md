# 主题：DeepSeek 深色界面 + 浅色棋盘

界面换成深色（近黑底、蓝色强调、描边分层），棋盘保持浅色像一张纸放在深色桌面上。

Closest precedent: `docs/design/modules/ui-refresh.md`（本模块沿用它的变量层结构、对局专注结构与手机一屏几何，只换取值与分层方式）。偏离两处：①深色下阴影看不见，分层改用 1px 描边 + 面板底色一档之差，`--raise` 随之重定义；②色值按「落在浅色棋盘上」与「落在深色界面上」拆成两组，同一个 `--red` 同时当棋盘标记与面板文字会在深底上掉到 2.6:1。

Survey evidence: 已用浏览器实读 `https://chat.deepseek.com` 登录页（截图 + `getComputedStyle`）。逐层读数：

- 页面底 `rgb(21,21,23)`
- 卡面 `rgb(27,27,28)`
- 主文字 `rgb(249,250,251)`
- 次文字 `rgb(173,178,184)` 与 `rgb(129,133,140)`
- 强调蓝 `rgb(86,134,254)`
- 描边 `rgba(255,255,255,0.12)`
- 圆角：按钮 10–12px、卡片 14px；字体栈含 `Inter, system-ui, -apple-system`

对比度按 WCAG 2.1 的相对亮度与对比度公式算（`(L1+0.05)/(L2+0.05)`，sRGB 分量先线性化）。除站点实读外未查其他文档来源；公式属通行定义，不依赖具体文档版本。

## 1. 需求

需求口径在 `docs/requirements/xiangqi.md`（F5.5 视觉基准、F5.1 界面简约）。本档只记落点，不抄需求正文。

F5.5 对实现的三个约束，逐条对应到本档：分色（§2）、对比度（§3）、无图片与纹理与渐变（§7 的读数）。

## 2. 取值

同一个颜色的两种用途分开：**棋盘色**只落在浅色棋盘上，**界面文字色**落在深底上。混用会在深底上掉到 2.6:1 以下（见 §3 的「禁止组合」）。

| 变量 | 深色档取值 | 用途与来源 |
|---|---|---|---|
| `--page-bg` | `#151517` | 页面底（DeepSeek 实测） |
| `--panel-bg` | `#232324` | 卡片、面板、抽屉（DeepSeek `bg-layer-1` 深色值） |
| `--raise-bg` | `#2c2c2e` | 可按的浅面，如按钮底（`bg-layer-2`） |
| `--sunken-bg` | `#353638` | 悬停与选中（`bg-layer-3`；深色下悬停是提一档） |
| `--line` | `rgba(255,255,255,0.12)` | 分隔线与描边（实测） |
| `--text` | `#f9fafb` | 正文（实测） |
| `--muted` | `#adb2b8` | 次要文字（实测） |
| `--muted-2` | `#8f939a` | 第三档灰：元信息、占位符。站点原值 `#81858c` 在按钮面上只有 3.26:1，提亮到 4.52:1 |
| `--accent` | `#5686FE` | 链接、描边、聚焦环（实测）。**不作填充底** |
| `--accent-strong` | `#3964fe` | 填充按钮底（站点 `deepseek-500`）：白字 4.74:1；`--accent` 上只有 3.37:1 |
| `--on-accent` | `#ffffff` | 填充按钮上的字：在 `--accent-strong` 上 4.74:1 |
| `--low` | `#f25a5a` | 时钟低时、错误态文字（站点 `state-error-primary` 深色值） |
| `--red-text` | `#f27b6e` | **界面上的红方文字**（时钟、行棋方、红方标记） |
| `--black-text` | `#cfd3d6` | **界面上的黑方文字**：深底上不能写黑字，改用 `label-secondary` |
| `--target-text` | `#4ed17e` | **界面上的提示绿文字**（站点 `state-success-secondary`） |
| `--radius` | `12px` | 按钮、输入框 |
| `--radius-lg` | `14px` | 卡片 |
| `--board-bg` | 不变 | 棋盘底：它是「纸」 |
| `--board-line` | 不变 | 盘线 |
| `--piece-face` | 不变 | 棋子面 |
| `--piece-edge` | 不变 | 棋子描边 |
| `--red` | 不变 | **只在棋盘上**：棋子与标记的填充 |
| `--black` | 不变 | **只在棋盘上**：棋子填充 |
| `--target` | 不变 | **只在棋盘上**：可走点与选中框的描边与填充 |
| `--board-ink` | `#846340` | **只在棋盘上**：河界字样。原值在盘面上 4.45:1，压深一档到 4.90:1 |
| `--raise` | `0 0 0 1px rgba(255,255,255,.08) inset` | 深底上投影看不出来，改成内描边，分层靠线 + 底色差 |
| `--raise-flat` | `0 0 0 1px rgba(255,255,255,.06) inset` | 同上，更轻的一档 |
| `--board-shadow` | `0 2px 6px rgba(0,0,0,.28), 0 14px 40px rgba(0,0,0,.32)` | 全站唯一的外投影；深色桌面上把棋盘读成一张纸 |
| `--font-ui` | 前置 `Inter` | 站点字体栈以 Inter 打头，中文仍落到系统字体；**只做栈前置、不引外链**——引了会计入需求 F5.2 的「请求数 ≤ 6」，机器上没装 Inter 时整栈静默回退到 system-ui |
| `--font-board` | 不变 | 棋盘字体 |


### 浅色

界面右上角有三档开关：跟随系统 / 浅色 / 深色，存 `localStorage`（`xiangqi.theme.v1`），默认跟随系统。

落地方式：JS 把「跟随系统」解析成具体一档，写到 `<html data-theme="light|dark">`；CSS 只认这一个属性（`:root[data-theme='light']`），令牌因此只写一份，不必给媒体查询再抄一遍。`main.tsx` 在首屏渲染前先落一次，避免深色机器先闪一帧浅色。

下表是浅色的取值；没列出的沿用深色取值。页面与卡面都是白，层次靠 1px 描边——与站点浅色一致。

| 变量 | 浅色取值 | 与站点的关系 |
|---|---|---|
| `--page-bg` | `#ffffff` | 站点 `bg-base` 浅色值 |
| `--panel-bg` | `#ffffff` | 站点浅色各层都是白，靠描边分层 |
| `--raise-bg` | `#f5f6f7` | 按钮面一档灰（站点 `bg-module-platform`） |
| `--sunken-bg` | `#eceef0` | 悬停与选中 |
| `--line` | `rgba(0, 0, 0, 0.1)` | 站点 `border-l2` 浅色值 |
| `--text` | `#0f1115` | 站点 `label-primary` 浅色值 |
| `--muted` | `#61666b` | 站点 `label-secondary` 浅色值 |
| `--muted-2` | `#6a6e74` | 站点 caption 是 `#adb2b8`，白底上只有 2.3:1；压到 5.1 |
| `--accent` | `#3358e0` | 站点 brand 是 `#3964fe`，在按钮灰面上只有 4.46；压一档到三种面都过 |
| `--accent-strong` | `#3964fe` | 站点 `brand-primary`；白字 4.74:1 |
| `--on-accent` | `#ffffff` | 同上 |
| `--low` | `#d81b1b` | 站点 `state-error-primary` 浅色值偏浅（4.50），压一档到 4.57 以上 |
| `--red-text` | `#b3261e` | 与棋子红同色，白底上 6.54:1 |
| `--black-text` | `#22262b` | 与棋子黑同色，白底上 15.22:1 |
| `--target-text` | `#2f6f4f` | 与棋盘提示绿同色，5.99:1 |
| `--raise` / `--raise-flat` | `0 1px 0 rgba(255,255,255,.9) inset, 0 1px 2px rgba(16,24,40,.06)[, 0 8px 24px rgba(16,24,40,.06)]` | 浅色下投影看得见，回到「轻浮雕」；方括号里那一层只有 `--raise` 有 |
| `--board-shadow` | `0 2px 6px rgba(16,24,40,.06), 0 14px 40px rgba(16,24,40,.08)` | 白底上重投影会像脏印 |
| `color-scheme` | `light` | 让原生控件跟着变 |

棋盘与棋子色两套完全一样：棋盘不跟着界面明暗走，这是 §2 的固定项。

### 结果着色

终局结果（状态行与放大提示）按胜方上色：红胜 `--red-text`、黑胜 `--black-text`、和棋 `--accent`。归属由 `resultTone` 一处判定，面板状态行、放大提示、联机页状态行三处共用同一个类名。

和棋用 `--accent` 而不是 `--accent-strong`：后者是填充按钮底（配白字 4.74:1），当文字压在 `--panel-bg` 上只有 3.31:1。`--accent` 本来就是文字与描边那一档，`--panel-bg` 上 4.66:1（浅色 5.81:1），已在本节断言集内。

不许用棋盘色 `--red` / `--black`：它们在深色面板上只有 2.6:1 与 1.0:1，验收脚本会拦。

两条固定项，后续改主题时不许动：

- **棋盘色不跟着界面变深**。`--red`／`--black`／`--target` 与棋盘四色只在浅底上使用；界面上要红色或黑色文字时用 `--red-text`／`--black-text`／`--target-text`。
- **深色档只此一处投影**：棋盘的外投影是分层手段，不是装饰——深色桌面上要让它被读成一张纸；卡片与按钮在深色档不投影。浅色档另当别论：`--raise` / `--raise-flat` 回到「轻浮雕」（内高光 + 1–2px 的近层阴影），只压在按钮与可按的浅面上，卡片仍不投影。`docs/requirements/xiangqi.md` F5.1 的「无装饰性元素」按这两句读。

## 3. 对比度

按 §2 的取值算，脚本按同一公式复算（`scripts/acceptance.mjs` 的 F5-4 读数）。**断言集**是断言列为「过」的十八行；「禁止」开头的三行只作为不许出现的证据，它们不达标本就就不该被用来写字。

| 前景 | 背景 | 比 | 断言 |
|---|---|---|---|
| `--text` #f9fafb | `--page-bg` #151517 | 17.45 | 过 |
| `--text` #f9fafb | `--panel-bg` #232324 | 15.03 | 过 |
| `--muted` #adb2b8 | `--page-bg` | 8.54 | 过 |
| `--muted` #adb2b8 | `--panel-bg` | 7.36 | 过 |
| `--muted-2` #8f939a | `--page-bg` | 5.91 | 过 |
| `--muted-2` #8f939a | `--panel-bg` | 5.09 | 过 |
| `--muted-2` #8f939a | `--raise-bg` #2c2c2e | 4.52 | 过（余量最小的一行） |
| `--accent` #5686fe | `--page-bg` | 5.42 | 过（链接文字） |
| `--accent` #5686fe | `--panel-bg` | 4.66 | 过 |
| `--accent` #5686fe | `--raise-bg` | 4.14 | **不过**：链接与错误文字因此不落在按钮面上（见下条约束） |
| `--low` #f25a5a | `--panel-bg` | 4.77 | 过 |
| `--red-text` #f27b6e | `--panel-bg` | 5.86 | 过 |
| `--black-text` #cfd3d6 | `--panel-bg` | 10.42 | 过 |
| `--target-text` #4ed17e | `--panel-bg` | 8.03 | 过 |
| `--on-accent` #ffffff | `--accent-strong` #3964fe | 4.74 | 过（填充按钮标签） |
| 棋子红 #b3261e | 棋盘底 #f7f2e6 | 5.85 | 过 |
| 棋子黑 #22262b | 棋盘底 #f7f2e6 | 13.62 | 过 |
| 提示绿 #2f6f4f | 棋盘底 #f7f2e6 | 5.36 | 过（棋盘上的可走点） |
| `--board-ink` #846340 | 棋盘底 #f7f2e6 | 4.90 | 过（河界字样） |
| **禁止**：`--on-accent` | `--accent` #5686fe | 3.37 | 不达标，不得作填充底 |
| **禁止**：`--red` #b3261e | `--panel-bg` | 2.40 | 不达标，界面红字必须用 `--red-text` |
| **禁止**：`--black` #22262b | `--panel-bg` | 1.03 | 不达标，界面黑字必须用 `--black-text` |

约束：`--accent` 只作文字压在 `--page-bg` / `--panel-bg` 上，不落在 `--raise-bg`（按钮面）与 `--sunken-bg`（悬停面）上——那两处它只有 4.14:1，低于 F5.5 的 4.5。要在按钮或悬停面上写可点的字，用 `--accent-strong` 作填充底配白字，或改用 `--text`。

`--accent` 与 `--accent-strong` 的分工由 §7 的一条断言守，不靠注释。

### 浅色读数（同一脚本，切 `prefers-color-scheme` 各量一遍）

| 前景 | 背景 | 比 |
|---|---|---|
| `--text` #0f1115 | `--page-bg` #ffffff | 18.90 |
| `--muted` #61666b | `--page-bg` | 5.80 |
| `--muted-2` #6a6e74 | `--page-bg` | 5.13 |
| `--muted-2` #6a6e74 | `--raise-bg` #f5f6f7 | 4.83 |
| `--accent` #3358e0 | `--page-bg` | 5.81 |
| `--accent` #3358e0 | `--raise-bg` | 5.47 |
| `--low` #d81b1b | `--page-bg` | 5.13 |
| `--red-text` #b3261e | `--page-bg` | 6.54 |
| `--black-text` #22262b | `--page-bg` | 15.22 |
| `--target-text` #2f6f4f | `--page-bg` | 5.99 |
| `--on-accent` #ffffff | `--accent-strong` #3964fe | 4.74 |

深色那张表的禁止组合（拿棋盘色当界面文字）在浅色下不再成立——白底上黑字本来就该看得清。所以那一组不再按对比度断言，改由 §7 的静态检查守：样式表里不许出现 `color: var(--red|--black|--target)` 与 `background: var(--red|--black|--accent)`。



## 4. 布局

| 项 | 口径 |
|---|---|
| 顶栏 | 保持现状高度，不新设定值；深色底 + 底部 1px `--line`；手机档仍隐品牌名、七项单行 |
| 卡片 | `--panel-bg` + 1px `--line` + `--radius-lg`；不加外投影 |
| 主操作 | 每个视图一个填充蓝按钮，位置不变，不新造按钮 |
| 棋盘 | 浅色纸：`--board-bg` + 1px `--line` + 一圈柔和外投影（唯一的投影） |
| 间距 | ≥768 档页内边距 16px、卡片内 16px、控件间距 12px；**<768 档页内边距保持 8px**（面板与常驻条用；棋盘舞台左右为 0，见 `docs/design/modules/board-ui.md` §5，棋盘按整屏宽排，375 上格宽 41.7、360 上 40.0） |
| 字体 | 沿用现有栈；数字仍 `tabular-nums`。字号：导航 16px（手机档 14）、页标题 26px（手机档 22）、副标题 14px（手机档 13）、面板与胶囊按钮 13px |

## 5. 集成测试设计

起点：`test/RTM.md`。本批新增一行 F5-4（视觉基准的对比度），复核 F4-6（手机一屏）与 F1-10（对局专注）不破——本批只改取值与内边距，不动它们的断言；F4-6 的几何改动归 `docs/design/modules/board-ui.md` §5 与 UI 档，本节只复核结果不变。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 | 实现 |
|---|---|---|---|---|---|
| F5-4 | 两套令牌层 → 页面与卡面上的正文、次要文字、链接、按钮文字、双方文字、提示绿；配色开关 → 页面底色 | 深浅两套各自：上列每一对 ≥ 4.5:1、白字不作 `--accent` 填充底；两套的 `--page-bg` 不同（相同即配色没接上）；棋盘在两套下都是浅色；样式表无渐变、无 `url(` | 打开页面（任意页）→ 右上角切三档 | F5.5 | `scripts/acceptance.mjs` |
| F4-6 | 375×667 一屏 | 棋盘完整可见、无元素越界 | 对弈（375） | F4.6 | `scripts/acceptance.mjs`（复核，不改断言） |
| F1-10 | 对局专注 | 常驻条不变；着法区按存储值决定进入态（首次收起） | 对弈 / 人机 | F1.10 | jsdom 用例（不涉及样式，不改） |

## 6. 文件划分

| 文件 | 动作 |
|---|---|
| `src/client/storage/prefs.ts` | 三档偏好（`xiangqi.theme.v1`）与音效开关的读写；存储不可用时退缺省 |
| `src/client/main.tsx` | 首屏渲染前把配色落到 `<html data-theme>` |
| `src/client/App.tsx` | 顶栏「设置」浮层里的配色下拉；跟随系统时监听 `matchMedia` 变化 |
| `test/prefs.test.ts` | 偏好读写与「存储抛错」失败路径 |
| `src/client/styles/base.css` | 换取值；新增 `--muted-2`、`--red-text`、`--black-text`、`--target-text`、`--radius-lg`；重定义 `--raise`、`--raise-flat` |
| `src/client/styles/shell.css`、`panel.css`、`play.css`、`learn.css`、`drill.css`、`replay.css`、`responsive.css` | 残留字面色值换成变量；界面上的红/黑/绿文字改指向 `--red-text`／`--black-text`／`--target-text`；棋盘加外投影 |
| `scripts/acceptance.mjs` | 新增 F5-4 对比度读数：从 `:root` 取变量值，按 WCAG 公式逐对算并断言 |
| `test/RTM.md` | 新增 F5-4 一行（行号先定，用例后写） |
| `docs/design/modules/ui-refresh.md` | §2 的取值表已改为指向本档；§7 第①条的对比度口径一并改为指向本档 §3／§7，避免两处各写一份 |

分档结论：样式表最大 `play.css` 419 行、`measures` 393 行，都在 500 行内；`scripts/acceptance.mjs` 已按「按页拆」的口径拆成 `scripts/acceptance/support.mjs`（196 行）与 `scripts/acceptance/measures.mjs`（393 行），主档 249 行——三份都离开 800 行硬上限有距离。**本批不需要拆分方案。**

现有件检查：

- existing —— `docs/design/modules/ui-refresh.md` 的变量层与分层结构、`scripts/acceptance.mjs` 的 CDP 读数通道、M10 已验证的手机一屏几何。
- existing —— `--red`／`--black`／`--target` 的棋盘用法（`play.css` 的 `fill`／`stroke`），本批不改，只把界面文字那几处切到 `--*-text`。
- none found —— 深色主题：仓库里没有任何深色取值或 `prefers-color-scheme` 分支。
- 文案：本批新增三处可见文案——配色开关的「跟随系统 / 浅色 / 深色」三个选项；其余沿用「中国象棋」「红方走棋」「着法」「新局」「认输」等既有文案。

## 7. 验收

- **对比度**：`node scripts/acceptance.mjs` 切两次 `prefers-color-scheme`（dark / light），各自打印 §3 的断言集并逐行断言 ≥ 4.5；两套的 `--page-bg` 必须不同，相同就说明配色没接上。
- **开关**：界面右上角三档（跟随系统 / 浅色 / 深色），切换后 `<html data-theme>` 与实际背景色同时变；选择写进 `localStorage`，刷新后保持。
- **无图片与渐变**：同一脚本里 grep 样式表，断言不含 `linear-gradient`／`radial-gradient`／`url(`。
- **棋盘色不外溢**：同一脚本静态检查样式表——不许有 `color: var(--red|--black|--target)`，也不许有 `background: var(--red|--black|--accent)`。这条与配色方案无关，所以查源码而不是查对比度。
- **一屏**：375×667 下棋盘完整、无元素越界（沿用 M10 的断言）。
- **实机目视**：1440 桌面（对局页收起 / 展开）与 375×667 手机各一张截图。
- 提交门见 `AGENTS.md`。

## 8. 风险

- 棋盘色与界面文字色混用是这条主题最容易被后人改坏的地方：`--red` 一旦被拿去当面板文字，对比度从 6.4 掉到 2.6。§2 的两条固定项 + §3 的禁止组合共同守这一条。
- `--muted-2` 余量最小（`--raise-bg` 上 4.52），只准用于元信息与占位符，不用于正文或按钮。
- 深色让投影失效；只换颜色不改 `--raise`／`--raise-flat`，卡片会糊成一片。
- 两套配色共用一份令牌名：新增颜色时两处都要给值，漏一处就会出现「深色下能读、浅色下一片糊」。
- 「跟随系统」靠 `matchMedia` 的 change 事件跟随；jsdom 没有 `matchMedia`，App 里做了守卫——少了它整套集成用例会在挂载时全红（踩过一次）。
