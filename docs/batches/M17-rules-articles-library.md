# 2026-11-14 · 规则页进阶阅读与棋谱库扩充
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14：「如何在对局中提升自己…以什么视角看待象棋对局…分两篇文章追加到规则项目下，同时追加棋谱库数量。此添加非单页文件中」，随后「按这个做」。
> 台账 = #21（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：🔄 进行中（…）
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

## 讨论

**用户原话**：「如何在对局中提升自己，详细叙述。以什么视角来看待象棋对局，能更好的的理解抓住其本质。分两篇文章追加到规则项目下，同时追加棋谱库数量。此添加非单页文件中」。

**拆成三件事**：

| 项 | 落点 | 用户要求 |
|---|---|---|
| 两篇文章 | 规则页底部「进阶阅读」，折叠 | 「追加到规则项目下」 |
| 棋谱库数量 | `content/games/index.json` 16 → 24 | 「追加棋谱库数量」 |
| 单文件版 | **不重打** `standalone/` | 「此添加非单页文件中」 |

**已确认的取舍**（用户回「按这个做」）：文章放规则页底部折叠而不是新开页面；棋谱库 +8 条（四类各 +2）。

**现状读数**（本轮实际查的）：

- `src/client/rules/content.ts` 原有三段：`MOVE_POINTS` / `PENALTY_TABLE` / `OUT_OF_SCOPE`，全是短条目。
- `content/games/index.json` 原来 16 条，四类各 4 条。
- `test/study.test.ts` 钉死数量（16、四类各 4）与每条的五条硬规则。
- `test/integration/study.test.tsx` 也按 16 / 4 断言。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

## 批次任务与设计

**交付目标**：规则页多两篇可展开的长文；棋谱库四类各 6 条；单文件版不含本次新增。

**设计档**：`docs/design/modules/pwa-rules.md` §4（规则页四段，第四段是进阶阅读）、`docs/design/modules/study-library.md`（24 条与分类规则）。

**文章结构**：

| 篇 | 八节 |
|---|---|
| 《对局中如何提升自己》 | 复盘三步法 / 每盘只定一个目标 / 计算力从三步起 / 残局基本功优先 / 定式记为什么 / 快棋靠模式慢棋靠计算 / 找强一点的对手 / 写下来才算学过 |
| 《看棋局的视角：把局面读成三笔账》 | 子力 / 位置 / 先手 / 让子无效而非吃子 / 交换看剩余局面 / 何时简化何时复杂化 / 将帅安全与主动权 / 接回胜率条 |

**棋谱库新增八条**：

| 类 | 条目 | 着数 |
|---|---|---|
| 开局 | 顺手炮·横车过宫 / 仙人指路·卒底炮 | 8 / 8 |
| 中局 | 中炮过河车·中路突破 / 飞相局·炮入卒林 | 8 / 8 |
| 终局 | 双车夺门 / 借帅使车 | 3 / 3 |
| 残局 | 海底捞月 / 车马借帅 | 3 / 5 |

**为什么中局的后半段由引擎自走**：手写 8 着记谱在中局容易写出不合法的一步，而这一步会让整条记录作废。改成「前缀手写定局面 + 后半段引擎自走」后，着法合法性由引擎保证，人只负责写讲解。

**受影响文件**：`src/client/rules/content.ts`、`src/client/pages/RulesPage.tsx`、`src/client/rules/rules.css`、`content/games/index.json`、`test/study.test.ts`、`test/integration/study.test.tsx`、`test/RTM.md`、`docs/design/modules/pwa-rules.md`、`docs/design/modules/study-library.md`。

**分档结论**：`content.ts` 从 55 行增到约 300 行、`index.json` 是数据文件，都不涉及单函数膨胀；其余文件都在 500 行内。**本批不需要拆分方案。**

**风险**：改数量断言会同时碰到两份测试与 RTM 的一行——三处必须一起改，改漏一处就红。已逐一改完并实跑。

## §3 设计评审（评审子代理）

### 轮次 1（评审子代理）

评审对象：`docs/design/modules/pwa-rules.md`、`docs/design/modules/study-library.md`（design 评审，object state 已实现，trigger 内容批次设计与实现一致性评审）。

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Document ownership（需求档与设计档同一验收数两说） | 🔴 | 数量这一验收口径在两份在用文档里各有一套：`docs/requirements/xiangqi.md` F1.9 的验收写「四类各有 4 条且能按类筛选」（合计 16），`docs/design/modules/study-library.md` §1 写「四类各 6 条、可按类筛选」、§3 写「数组，四类各 6 条，共 24 条。」，`test/RTM.md` F1-9 写「切到「棋谱库」看到四类共 24 条；按「残局」筛选只剩 6 条」。而 `docs/design/modules/study-library.md` §6 文件表把「`docs/requirements/xiangqi.md` | F1.9 一行」列为本批动作——实读需求档 F1.9 该句未被改。旁证：`test/study.test.ts` 的案名仍是「棋谱库共 16 条，四类各 4 条」，正文却断言「assert.equal(all.length, 24);」与每类 6。 | 数量只留一处说法：把 F1.9 的「四类各有 4 条」改成与实现/RTM 一致的 24 条（6/类），或把 §1/§3 改回 4 条并说明；两处不可并存。 |
| 2 | Branch provenance（criterion 6b） | 🔴 | `docs/design/modules/study-library.md` §2 明确加了两条分支却没有来源场景：「运行时仍然逐条过滤，一条坏的不拖垮整个列表；某类过滤后为空时，列表显示「这一类还没有棋谱」，不静默空白。」——既没有真实观测，也没有可复现失败路径；而按该档自己的 §3「四类各 6 条」加 `test/study.test.ts` 的「assert.equal(ofPhase(phase).length, 6, …)」，两类分支都不可能出现。实现侧确实建了分支：`src/client/study/StudyLibrary.tsx` 的「shown.length === 0 ? (」与 `src/client/study/content.ts` 的「if (record === null || seen.has(record.id)) continue;」。两份文档都没有解释它们应不应该存在。 | 给每个分支一个来源:真实观测（引用读数/日志/用户报告），或可复现失败路径（例如把 `content/games/index.json` 的一条记录改坏后重跑集成用例的命令与结果）；二者都给不出，就删掉空类文案与逐条丢弃这两段，别留无人删的分支。 |
| 3 | Requirements coverage / 验收 | 🟡 | 本批第一件交付「进阶阅读」在需求层没有落点：`docs/requirements/xiangqi.md` 全文检索「阅读」「长文」零命中；`docs/design/modules/pwa-rules.md` §5 验收对照里没有一行对应它（只在 F5.1「规则页三段正文（走法要点、八行判罚表、不在 v1 范围内）+ 一节默认收起的进阶阅读」里被顺带提到）；§6 只写「本批不改 RTM」，没说明这一节为什么不需要场景。 | 在需求档落一行（或明写它由哪条既有需求承接），并给一条可验的验收（两篇默认收起、展开后正文可见）；若不派集成行，在 §6 写明理由。 |
| 4 | Clarity（文档内自相矛盾） | 🟡 | `docs/design/modules/pwa-rules.md` §4 写「页面分三段：」，随后列了 1–4 四节，第 4 节是「4. **进阶阅读**：两篇长文，默认收起（`<details>`），点了才展开。」；同档 §5 又写「规则页三段正文（走法要点、八行判罚表、不在 v1 范围内）+ 一节默认收起的进阶阅读」。三段与四节的引导句不一致。 | 把 §4 引导句改成与 §5 同一口径（三段正文加一节），或把第 4 节从「三段」的计数里明确分开。 |
| 5 | Doc-state（现状描述过期） | 🟡 | `docs/design/modules/pwa-rules.md` §7 现有件检查用现在时写了三处与仓库现状相反的断言：「none found：`public/` 目录尚不存在（glob 零命中），需新建」——实读 `public/**/*` 返回 6 个文件（manifest、sw.js、四张图标）；「代码侧 `src/client/shell/routes.ts` 的 `Route` 联合尚无 `rules`，本批补上」——`src/client/shell/routes.ts` 已有「| { readonly name: 'rules' };」与 `#/rules` 拼装；「仓库内无同名先例（`grep` 零命中）」——`public/manifest.webmanifest`、`public/sw.js` 与 `src/client/main.tsx` 的注册点都已存在。 | 改成现状描述（这几个件已存在、`Route` 已含 `rules`），撤掉「本批补上」这类计划语：设计档只写现在是什么。 |
| 6 | Affected-file tier（criterion 8） | 🟡 | `docs/design/modules/pwa-rules.md` §7 的分档行「文件分档：表内文件均未跨 500 行档，无 300+ 行单函数；`src/client/app.css`（实测 1290 行，已越 800 行硬档）本批不动」带了两处毛病：一是实测数已过期（`src/client/app.css` 现 9 行，首行「@import './styles/base.css';」，拆分由 `docs/design/modules/ui-refresh.md`「`src/client/app.css` 实测 1451 行，过了 800 行硬上限，本批拆成上表八个样式文件」承担）；二是把实测行数与「（预估 40 行内）」这类尺寸预期写进了设计档，而分档条目要求只给结论。 | 换成结论句（哪些文件跨档、各自拆法，或一个都不跨），删掉实测行数与预估行数。 |
| 7 | Document ownership（同一批样的归属两处不同） | 🟡 | 棋谱库样式落在哪份文件，两份在用设计档说法不同：`docs/design/modules/study-library.md` §6 写「| `src/client/app.css` | 分栏、筛选、库列表与说明行的样式 |」，同档现有件检查再写「面板与棋盘的样式集中在 `src/client/app.css`」；`docs/design/modules/ui-refresh.md` 写「| `src/client/styles/replay.css` | 新增：棋谱页与棋谱库分栏 |」。实读 `src/client/styles/replay.css` 确有「/* 棋谱库分栏 */」与 `.study-filters`，而 `src/client/app.css` 只剩 `@import` 引入。 | 把文件表那行改成 `src/client/styles/replay.css`（或写明经 `app.css` 的 `@import` 落到 `replay.css`），与 `docs/design/modules/ui-refresh.md` 的说法统一。 |
| 8 | Clarity / scope | 🟡 | `docs/design/modules/study-library.md` §4 自相矛盾：一条写「`我的棋谱` 的分栏下保持现状，不改列表、回放与导入导出。」，下一条又写「`我的棋谱` 的表头（标题 + `导入`）吸在列表顶部（`position: sticky`…）」。表头粘性是对「我的棋谱」列表的改动，且与「内容 16→24」这一批主题无关（实现里 `src/client/styles/replay.css` 有「position: sticky;」）。 | 二选一：把粘性表头写进「保持现状」的例外里并说明它属于本批范围，或把它移出本批、退回原状。 |
| 9 | Doc-state（注册条件与代码不一致） | 🟡 | `docs/design/modules/pwa-rules.md` §3 写「只在 `import.meta.env.PROD` 下 `navigator.serviceWorker.register('/sw.js')`」；`src/client/main.tsx` 实为「if (import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1' && 'serviceWorker' in navigator) {」。多出的那道门（standalone 构建不注册）在档里没有交代。 | 把这层关系写进 §3（或 §7 的 `main.tsx` 行），让注册条件与代码一致。 |
| 10 | Closest-precedent（criterion 9） | 🟡 | 两份档的先例行完整度不同：`docs/design/modules/study-library.md` 给了「实现坐标是 `src/client/pages/ReplayPage.tsx` 与 `src/shared/record.ts`。」；`docs/design/modules/pwa-rules.md` 只有「Closest precedent: `docs/design/modules/app-shell.md` — 路由、导航与页面清单由它拥有；本模块只在它的路由表里加一行 `#/rules`、在导航里加一项，不另起一套壳。」，缺实现坐标（也未提先例批次）。 | 补实现坐标（`src/client/shell/routes.ts`、`src/client/App.tsx`）与先例批次，与 `docs/design/modules/study-library.md` 的先例行同形。 |
| 11 | Numeric drift | 🔵 | `docs/design/modules/study-library.md` §3 写「**当前四条**是由我按该谱杀法构造的排局，不是逐字转录原谱」，但残局现为 6 条，且六条的 `"source"` 全是「自编 · 仿《适情雅趣》杀法」。 | 改成与现数一致的一句（六条），或写成「现行各条」这类不随数量漂的表述。 |
| 12 | Criterion 12 口径 | 🔵 | `docs/design/modules/study-library.md` §7 验收=`node --test test/study.test.ts` 是变更面，正确；但随后一句「提交门见 `AGENTS.md`。」指向的 `npm run check` 是全量连跑，两句并排容易被实现轮当成验收口径。 | 把「验收」与「提交门」两句分开写清（验收只跑变更面文件）。 |

计数：🔴 2 · 🟡 8 · 🔵 2。

VERDICT: changes-required

## §4 用户批准（主 agent）
## §5 实施记录（实施者：主 agent ∥ coder）
## §6 验证与收口（父代理）
