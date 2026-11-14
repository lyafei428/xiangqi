# 2026-11-14 · 胜率条移到常驻区
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14：「胜率出现在各个对局中，目前只看到在棋谱中有，同时红黑双方概率在两边，星条在中间」。
> 台账 = #22（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

## 讨论

**用户原话**：「胜率出现在各个对局中，目前只看到在棋谱中有，同时红黑双方概率在两边，星条在中间」。

**实测到的原因**（dev 服务器，`#/play`）：

- `.eval-bar` 在 DOM 里存在，但 `getBoundingClientRect()` 是 `0×0`、`top: 0` —— 它躺在 `hidden` 的 `.panel-body`（着法抽屉）里。
- 点开「着法」后同一元素变成 287×20 —— 证明确实只是被抽屉藏起来了。
- 棋谱页（回放）的条在滑条与记谱之间，一直在可见区，所以「只在棋谱里有」。

**这是上一版的设计选择，不是回归**：`docs/design/modules/ai.md` §9 当时写的是「放在可收起的着法区里、不占常驻条」，理由是需求 F1.10 把对弈/人机页的默认可见集列成了「棋盘、行棋方、双方计时、新局、认输」。用户本轮的话推翻了那个选择——**F1.10 的列举随之改写**。

**拆成两件事**：①条要在四个棋局页的常驻区看得见；②布局改成「红 % / 条 / 黑 %」。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 批次任务与设计

**交付目标**：胜率条在四个棋局页的常驻区可见；布局为左「红 x%」、中概率条、右「黑 y%」。

**设计档**：`docs/design/modules/ai.md` §9（位置表）；连带 `docs/design/modules/online.md`、`docs/design/modules/replay.md`、`docs/requirements/xiangqi.md` F1.10。

**改动**：

| 文件 | 改了什么 |
|---|---|
| `src/client/panel/EvalBar.tsx` | 三段布局：`红 x%` / `.eval-track` / `黑 y%`；去掉 `.eval-numbers` 包裹 |
| `src/client/styles/panel.css` | `.eval-bar` 改注释与间距；`.eval-numbers`/`.eval-red-text`/`.eval-black-text`/`.eval-sep` 换成 `.eval-num`/`.eval-num-red`/`.eval-num-black` |
| `src/client/panel/GamePanel.tsx` | 条从 `panel-body` 移到 `panel-focus`（计时行与按钮行之间） |
| `src/client/pages/OnlinePage.tsx` | 同上，移到 `panel-focus`（房间行与按钮行之间） |
| `test/integration/eval.test.tsx` | `.eval-numbers` 断言改整条 `.eval-bar` 文本 |

**为什么放常驻而不是抽屉**：抽屉在对弈/人机/联机三页默认收起，条放里面等于没有——这正是用户看到的现象。

**风险**：F1.10 的默认可见集多了一项。已在需求档改写，避免两份档说法打架。

**分档结论**：改动都落在既有文件内，`EvalBar.tsx`、`panel.css` 均在 500 行档内，无新增 300 行以上单函数——**不需要拆分方案**。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

**设计评审：胜率条移到常驻区 + 三段布局**（`docs/design/modules/ai.md` §9 对照 `docs/requirements/xiangqi.md` F1.10 / F5.7；对象状态：已实现）

| # | 类别 | 严重度 | 问题 | 建议 |
|---|------|--------|------|------|
| 1 | Document ownership | 🔴 | `docs/design/modules/ai.md` 对同一机制给出两处互斥描述：显示表写「放在常驻区而不是可收起的着法区」，文件表却写「着法区顶部插 `EvalBar`」。两处都是现行行文，读者无从判断哪一处权威——而这正是本次改动要消灭的旧落点。 | 两处收敛到同一落点：文件表那一行改为常驻区，并写明插入锚点（计时行与按钮行之间），与显示表逐字对齐；落点只保留一处描述。 |
| 2 | Acceptance | 🟡 | 验收表的显示行只断言「两格都有百分比、条上的数字与末格一致」，没有一条断言三段条在着法区收起时仍可见——而需求 F1.10 的首屏口径正是「首次进入对局页看不到着法记录与记谱框」。改动的核心（搬进常驻区）因此没有对应验收。 | 在 F5-7 集成行补一条：着法区收起（首次进入）时三段条仍在，红/黑两个数字可读。 |
| 3 | Integration-test design | 🟡 | 「破坏」一行只判了 `test/integration/navigation.test.tsx` 对 `.move-red` / `.move-black` 的整段文本断言；本次落点从着法区改到常驻区，既有 F1.10 收起态用例是否观察到条的宿主，未作判断。 | 在破坏格补一句：确认无既有用例依赖条的落点，或列出需同批改的断言。 |
| 4 | Clarity | 🟡 | `EvalBar` 在联机页与回放页的记录只写「插 `EvalBar`」，没给宿主锚点；显示表给的锚点是按面板行描述的（状态行与计时行之下、按钮行之上）。 | 逐页写明宿主元素与插入位置。 |
| 5 | Requirements fit | 🟡 | 手机档新增「概率条占一行 20px」，而 F4.6 要求「375×667 视口下棋盘第 10 行完整可见，页面无纵向滚动」；设计未交代这 20px 从何处让出、该约束是否仍成立。 | 补一行垂直预算结论（20px 由何处让出，或棋盘适配不变）。 |
| 6 | Existing-piece check | 🟡 | 本次新增的用户可见文案「红 62%」「黑 38%」与 aria-label「红方胜率 62%」没有三问答复行；命名与文件表里只给了「胜率 开/关」一行。 | 补两行三问答复（所在页面 / 逐字文案 / 归属档）。 |
| 7 | Affected-file tier | 🔵 | 分档结论写的是预测值（「预计 +20 行」），对象状态已是已实现，读者无法据此判断 `src/client/pages/OnlinePage.tsx` 是否真的越过 500 行；且档位判定把行数与预期增量写进了设计档（准则要求只落结论）。评审侧未做实测抽样——本次评审范围限定在这两份文档（已声明限制）。 | 结论改成实测事实（越过 / 未越过），行数与增量移到批次记录。 |
| 8 | Clarity | 🔵 | `useMoveEvals` / `useEvalPoint` 的落点写作「新增 hook，同上文件」，而上一行是存储键（住 `src/client/storage/prefs.ts`）；文件表只列 `useEvalEnabled` 在 `src/client/panel/useEval.ts`。 | 两个 hook 的所在文件写进文件变更表。 |
| 9 | Closest precedent | 🔵 | §9 的先例行覆盖的是概率模型与记谱两列；本次落点改动（常驻区三段条）没有先例坐标，理由只有用户裁定那一句。 | 点名面板常驻行的先例，或声明该处无先例。 |

计数：🔴 1 · 🟡 5 · 🔵 3。无 Document Map，文档归属判据按降级口径（对照 AGENTS.md 的文档分层）执行。

VERDICT: changes-required

### 轮次 2（评审子代理）

**第 2 轮（修复轮）—— 只核第 1 轮 1🔴 5🟡 3🔵 的处置**（对象：胜率条移到常驻区 + 三段布局 · 已实现 · 范围：`docs/design/modules/ai.md` §9、`docs/requirements/xiangqi.md`）

| # | Orig# | File | Severity | Status | Notes |
|---|-------|------|----------|--------|-------|
| 1 | 1 | docs/design/modules/ai.md | 🔴 | Fixed | 落点矛盾消解：显示表「放在常驻区而不是可收起的着法区」，文件表改为「`EvalBar` 插在常驻区——`.clock-row` 之后、`.panel-actions` 之前」，两处同一落点、同一锚点。 |
| 2 | 2 | docs/design/modules/ai.md | 🟡 | Fixed | 验收显示行补上核心断言：「首次进入对弈页（着法区收起）三段条仍在、红黑两个数字可读」。 |
| 3 | 3 | docs/design/modules/ai.md | 🟡 | Fixed | 破坏格补了结论：「条从着法区搬到常驻区这一改**不破坏任何既有用例**：现存用例只断言着法区里的记谱与记谱框，不观察 `.eval-bar` 的宿主位置」。 |
| 4 | 4 | docs/design/modules/ai.md | 🟡 | Fixed | 逐页锚点已给：联机「`EvalBar` 插在常驻区——房间行之后、`.panel-actions` 之前」；回放「`EvalBar` 插在回放控制区内——`.replay-range` 与 `.replay-moves` 之间」。备注：回放一处按字面读是「回放控制区」而非显示表的「常驻区」，另两页的宿主已由显示表覆盖，属精度措辞、不另立条目。 |
| 5 | 5 | docs/design/modules/ai.md | 🟡 | Unfixed | 手机档仍只写「| 手机档 | 概率条占一行 20px，数字与条同行；记谱字不因此缩小。 |」，未交代 F4.6「375×667 视口下棋盘第 10 行完整可见，页面无纵向滚动」的垂直预算；本轮无任何处置说明（零理由）。 |
| 6 | 6 | docs/design/modules/ai.md | 🟡 | Fixed | 补了两行三问答复：「| 「红 62%」/「黑 38%」 | `none found`：新文案，由 `EvalBar` 渲染，四页共用同一组件因此同一处文案。 |」与 aria-label 一行（数字取整同源于 `percentText`）。 |
| 7 | 7 | docs/design/modules/ai.md | 🔵 | Fixed | 分档结论不再是预测值：「分档结论：本批落地的文件都不跨 500 行档，也没有 300 行以上的单函数，**不需要拆分方案**。」——行数与预期增量已移出设计档。备注：行数实测不在本轮评审范围，未复核。 |
| 8 | 8 | docs/design/modules/ai.md | 🔵 | Fixed | 文件表已把三个 hook 归位：「| `src/client/panel/useEval.ts` | 新增：`useEvalEnabled`（`useSyncExternalStore` + 模块级 store）、`useMoveEvals`（前缀缓存，给记谱逐格）、`useEvalPoint`（给条上的数字） |」。命名行「新增 hook，同上文件」措辞未改（上一行是 `prefs.ts`），但落点已由文件表兜住。 |
| 9 | 9 | docs/design/modules/ai.md | 🔵 | Unfixed | 先例行仍只覆盖概率模型与记谱：「对齐：概率就是评估值的一次单调映射，不另立第二套局面判断；显示挂在既有的记谱区与面板顶部，不新开一栏。」——本次落点（常驻区三段条）仍无先例坐标；本轮无处置说明（零理由）。 |
| N1 | (new) | docs/design/modules/ai.md | 🟡 | New: 第 2 条的修复只落到「验收」一侧 | 验收显示行加了首屏断言，但集成测试设计的「缺失」行仍是旧描述：「一行：F5-7 的集成行——对弈页走两着，断言「两格都有百分比」「概率条数字与末格一致」…」，「着法区收起时条仍在」这条没进该行；照「缺失」一行写用例会漏掉本次改动的核心断言。建议给该行加一句。 |
| N2 | (new) | docs/design/modules/ai.md | 🔵 | New: 既有计数漂移（非本次修复引入） | 「`EvalBar` | `none found`：新增组件，住在 `src/client/panel/EvalBar.tsx`；三个页面共用。」与「四页共用同一组件因此同一处文案」对不上（三 vs 四）。R7c 数值漂移。 |

计数：已修 7（含唯一 🔴）· Unfixed 2（🟡1 · 🔵1）· New 2（🟡1 · 🔵1）。唯一 Critical（条落点两处互斥）已消解，其余为 🟡/🔵 建议项，不阻断本轮。

VERDICT: pass

## §4 用户批准（主 agent）

## 用户确认

- 2026-11-14 用户原话：「胜率出现在各个对局中，目前只看到在棋谱中有，同时红黑双方概率在两边，星条在中间」。
- 这是一条直接改动令：条要在各对局可见、布局改成红 / 条 / 黑。按此实施，未再走方案确认。
- 需求 F1.10 的默认可见集因此改写（加入「胜率条」），属用户本轮指令的直接后果，已在 `docs/requirements/xiangqi.md` 落档。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



## 实施记录

**改了什么**

| 文件 | 改动 |
|---|---|
| `src/client/panel/EvalBar.tsx` | 三段布局：`红 x%` / `.eval-track` / `黑 y%`；去掉 `.eval-numbers` 包裹 |
| `src/client/styles/panel.css` | `.eval-bar` 注释与间距；`.eval-num` / `.eval-num-red` / `.eval-num-black` 取代旧的四个类 |
| `src/client/panel/GamePanel.tsx` | 条从 `panel-body` 移到 `panel-focus`（`.clock-row` 与 `.panel-actions` 之间） |
| `src/client/pages/OnlinePage.tsx` | 同上（房间行与 `.panel-actions` 之间） |
| `test/integration/eval.test.tsx` | 新增断言：首屏着法区收起时条仍在、且不在 `.panel-body` 内；`.eval-numbers` 断言改整条 `.eval-bar` 文本 |
| `docs/requirements/xiangqi.md` | F1.10 默认可见集加入「胜率条」 |
| `docs/design/modules/{ai,online,replay}.md` | 落点、锚点、验收、先例、文案三问逐条对齐 |

**实测读数**

- `#/play`（着法区收起）：`.eval-bar` 父节点 `panel-focus`，尺寸 287×20；三段横坐标 红 1111 / 条 1161（宽 186）/ 黑 1358。
- `#/ai`：同样落在 `panel-focus`。
- `#/replay`：仍在滑条与记谱之间。
- `scripts/acceptance.mjs`「手机一屏（375×667，F4.6）」：`boardBottom` 512 ≤ 667，`navClipped` / `boardClipped` 均为 no——加条后一屏仍装得下。

**验证**：`npm run check` → tsc 通过、274 单测 0 失败、78 前端用例 0 失败；`node scripts/acceptance.mjs` 全阈值通过。

**没做的**：单文件版未重打（等用户口径）。

## §6 验证与收口（父代理）

## 验证与收口

```
npm run check
  tsc --noEmit                     通过
  node --test                      274 通过 / 0 失败
  vitest run                       78 通过 / 0 失败（14 个文件）

node scripts/acceptance.mjs
  全部阈值通过（手机一屏 375×667：boardBottom 512 ≤ 667）
```

**本批新增/改写的用例**：`test/integration/eval.test.tsx` 的第一条——首屏着法区收起时断言三段条在 `.panel-focus` 内、不在 `.panel-body` 内，红黑两个数字可读；再走两着断言逐格百分比与条上数字同源。

**没做的**：单文件版 `standalone/index.html` 未重打——用户的要求仍是「此添加非单页文件中」，重打与否等其确认。
