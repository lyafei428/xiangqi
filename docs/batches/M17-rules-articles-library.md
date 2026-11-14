# 2026-11-14 · 规则页进阶阅读与棋谱库扩充
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户 2026-11-14：「如何在对局中提升自己…以什么视角看待象棋对局…分两篇文章追加到规则项目下，同时追加棋谱库数量。此添加非单页文件中」，随后「按这个做」。
> 台账 = #21（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-11-14
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
**状态行**：评审通过



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

### 轮次 2（评审子代理）

评审对象：`docs/design/modules/pwa-rules.md`、`docs/design/modules/study-library.md`、`docs/requirements/xiangqi.md`（design 评审 · 修复轮复审 · object state 已实现 · trigger：核第 1 轮 12 条是否处置到位）。文档地图：本轮无文档地图，归属按 `AGENTS.md`「文档」表判断。

第 1 轮 12 条处置核对：

| # | 轮 1 结论 | 本轮读数 | 判定 |
|---|---|---|---|
| 1 | 🔴 数量两说 | 需求档 F1.9 现为「四类各有 6 条且能按类筛选」，`test/RTM.md` F1-9「四类共 24 条」，`docs/design/modules/study-library.md` §3「共 24 条」——三处一致 | 已处置 |
| 2 | 🔴 分支无来源场景 | 代码侧已删（`src/client/study/content.ts`：「运行时不再逐条丢弃：内容坏了就是发布流程破了，」并「if (record === null) throw new Error」；`StudyLibrary.tsx` 无空态；「这一类还没有棋谱」在 `src/`、`test/` 零命中）；但设计档 §2「运行时仍然逐条过滤，一条坏的不拖垮整个列表；某类过滤后为空时，列表显示「这一类还没有棋谱」，不静默空白。」与 §6「`这一类还没有棋谱` 为新增文案」都还在 | 未处置（档面未动，且与代码相反） |
| 3 | 🟡 进阶阅读无需求落点 | 需求档已加 F5.8「规则页在判罚口径之下提供两篇长文」；`docs/design/modules/pwa-rules.md` §5 有 F5.8 行；但 §6 仍「本批不改 RTM」，无集成行、无豁免理由、无用例断言 | 部分处置 |
| 4 | 🟡 三段与四节不一致 | `docs/design/modules/pwa-rules.md` §4 已改为「页面由三段正文与一节进阶阅读组成：」 | 已处置 |
| 5 | 🟡 §7 现状描述过期 | §7 已是现状语气（`Route` 已含 `rules`、`public/` 现有 manifest 与四张图标） | 已处置（一项缺标签，见本轮 🔵） |
| 6 | 🟡 分档行带实测行数 | `docs/design/modules/pwa-rules.md` §7 只剩「文件分档结论：表内文件均未跨 500 行档」 | 已处置（`docs/design/modules/study-library.md` 的量测问题另见本轮 🟡） |
| 7 | 🟡 样式归属两说 | `docs/design/modules/study-library.md` §6 已改为「`src/client/styles/replay.css`」；实读该文件有「/* 棋谱库分栏 */」与 `.study-filters` | 已处置 |
| 8 | 🟡 表头吸顶与「保持现状」相矛盾 | `docs/design/modules/study-library.md` §4 已写「唯一的例外是表头吸顶（见下一条），它属于本批。」；`replay.css` 有「position: sticky;」 | 已处置 |
| 9 | 🟡 注册条件与代码不一致 | `docs/design/modules/pwa-rules.md` §3 已写「import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1'」；`src/client/main.tsx` 同款（还多一道 `'serviceWorker' in navigator`） | 已处置（余一道见本轮 🔵） |
| 10 | 🟡 先例行缺实现坐标 | `docs/design/modules/pwa-rules.md` 已补「实现坐标是 `src/client/shell/routes.ts` 的 `Route` 联合与 `src/client/App.tsx` 的导航数组」；两份档仍无先例批次 | 部分处置 |
| 11 | 🔵「当前四条」漂数 | 已改为「现行六条都是按该谱杀法构造的排局」 | 已处置 |
| 12 | 🔵 验收与提交门并排 | `docs/design/modules/study-library.md` §7 已拆出「提交门另算：`npm run check`（…）是提交前的闸门，不是本批的验收口径。」 | 已处置（同节又重复一句，见本轮 🔵） |

本轮发现：

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Branch provenance（criterion 6b）/ 文档状态 | 🔴 | `docs/design/modules/study-library.md` §2 仍写「运行时仍然逐条过滤，一条坏的不拖垮整个列表；某类过滤后为空时，列表显示「这一类还没有棋谱」，不静默空白。」，§6 仍把「`这一类还没有棋谱` 为新增文案」列为新增。实读实现两条分支都已不存在：`src/client/study/content.ts` 写「运行时不再逐条丢弃：内容坏了就是发布流程破了，」并「if (record === null) throw new Error(`棋谱库第 ${index + 1} 条解析失败：内容校验没过`);」，同文件另一处「if (seen.has(record.id)) throw new Error」；`src/client/study/StudyLibrary.tsx` 只有「{shown.map((record) => (」；全仓按 `**/*.{ts,tsx,json}` 检索「这一类还没有棋谱」零命中。第 1 轮只处置了代码侧，档面未动——设计档还在描述两条没有来源场景的分支，且与代码相反（`AGENTS.md`：设计文档只写「现在是什么」）。 | 档面二选一：删掉 §2 的「逐条过滤 / 空类文案」两句与 §6 的「`这一类还没有棋谱`」文案项，改成现状（坏记录当场抛错、没有空态分支）；或保留这两条分支并补真实观测或可复现失败路径（改坏一条记录后重跑的命令与结果）。二者都不做，这两句就是与代码相反的死描述。 |
| 2 | Integration-test design（criterion 12）/ 验收 | 🔴 | 本批第一件交付（两篇长文，需求 F5.8）在集成设计里没有行：`docs/design/modules/pwa-rules.md` §6 写「本批不改 RTM」，表内唯一一行 F4-2 的用户可见结果仍是「规则页列出八条判罚；「不在 v1 范围内」一节写明长捉与一将一闲」，不含长文；`test/RTM.md` 的 F4-2 行同口径（「导航点「规则」后八条判罚逐条可见，并写明长捉与一将一闲不在 v1 范围内」），全读该档也没有进阶阅读或 F5-8 的行。用例侧同样没有断言：`test/rules-content.test.ts` 的 import 为「import { MOVE_POINTS, OUT_OF_SCOPE, PENALTY_TABLE }」，无 ARTICLES；`test/integration/rules.test.tsx` 只断言八行判罚与那句声明。`docs/design/modules/pwa-rules.md` §5 只剩手工验收「打开页面 → 规则 → 点开任一篇」。criterion 12 唯一成立的豁免理由（本批不改变任何既有用例断言的业务结果、也不新增产品真需要的场景）没有写；而两篇长文恰是本批真需要的场景。 | 派一行：行号先在 `test/RTM.md` 定死（例如 F5-8），入口「打开页面 → 规则 → 点开第一篇」，业务结果「两篇默认收起，点开可见正文，正文不含着法编号」，并在 `test/rules-content.test.ts` 补 ARTICLES 结构断言（两篇、各八节、无数字着法引用）；若坚持不派，就把那条唯一成立的豁免理由写进 §6。 |
| 3 | Document ownership / 声明的档改未落地 | 🟡 | `docs/design/modules/study-library.md` §6 把「`docs/design/modules/replay.md` | §1 补 `positionAtMoves`；§4 补分栏与库内回放」列为动作。实读 `docs/design/modules/replay.md` §1 已有「内部委托 positionAtMoves(startFen, moves, step)」，但 §4 仍是「路由 `#/replay`（列表）与 `#/replay/<id>`（回放），导航第五项「棋谱」。」加列表、回放两段；该档全文检索「分栏」零命中——分栏与库内回放只写在 `docs/design/modules/study-library.md` §4，页面主人 `docs/design/modules/replay.md` 不知道这件事。 | 把 `docs/design/modules/replay.md` §4 补成现状（顶部两个分栏、棋谱库分栏与页内回放、我的棋谱表头吸顶），或删掉 §6 那半句动作，别把「本批要改」留在表里而没落到被改的档上。 |
| 4 | Affected-file tier（criterion 8） | 🟡 | `docs/design/modules/study-library.md` §6 的「分档：涉及文件均未跨 500 行档」与实测量不符：同一张表内的 `content/games/index.json` 实测 1139 行（首行 `[`），越过 800 行硬档；该档 §3 自己也写「数组，四类各 6 条，共 24 条」。其余抽查通过：`src/client/pages/ReplayPage.tsx` 412 行、`src/shared/study.ts` 143、`test/study.test.ts` 173、`test/integration/study.test.tsx` 76、`src/client/study/StudyLibrary.tsx` 67、`src/client/study/content.ts` 34；`docs/design/modules/pwa-rules.md` 表内 `src/client/App.tsx` 282、`src/client/rules/content.ts` 209、`src/client/shell/routes.ts` 91、`src/client/pages/RulesPage.tsx` 81，结论句成立。 | 给数据文件一个明确交代：要么写拆法（按四类拆成四个内容文件，或每类一个目录），要么写明分档判据只约束代码文件、内容数据不适用并给出理由。 |
| 5 | Clarity（分类规则写残） | 🟡 | `docs/design/modules/study-library.md` §3 中局一行写作「`startFen` 不是初始局面；不着法将死收尾；着法不少于 6 着」，「不着法将死收尾」不成句；实现与用例的口径是「不以将死收尾」（`test/study.test.ts` 案名「中局：非初始局面、至少 6 着、不以将死收尾」）。 | 改成「不以将死收尾」。 |
| 6 | Acceptance（变更面未全覆盖） | 🟡 | `docs/design/modules/study-library.md` §7 只给「内容自证：`node --test test/study.test.ts`」，但本批变更面还包括 `src/shared/record.ts`（§6 表：「抽出 `positionAtMoves(startFen, moves, step)`；`positionAt` 改为委托它；`notationsOf` 入参放宽为 `{ startFen, moves }`，库内回放直接复用」）。该文件的属主用例存在（`docs/design/modules/replay.md` 文件表：「| `test/record.test.ts` | 记录往返、校验边界、任意步重放。 |」）却没进验收命令：`positionAt` 改委托、`notationsOf` 放宽入参若有回归，本批验收跑不出来。 | 验收命令改成 `node --test test/study.test.ts test/record.test.ts`。 |
| 7 | Closest precedent（criterion 9） | 🟡 | 第 1 轮第 10 条只处置了一半：`docs/design/modules/pwa-rules.md` 已有实现坐标，两份档的对齐与偏离理由也都在；但两份都没有先例批次坐标（`docs/design/modules/pwa-rules.md` 只写「Closest precedent: `docs/design/modules/app-shell.md`」，`docs/design/modules/study-library.md` 只写「Closest precedent: `docs/design/modules/replay.md` §1（记录格式与 `positionAt` 契约）与 §4（回放页的列表 / 回放布局）」），仓里有 `docs/batches/M7-pwa-rules.md`、`docs/batches/M9-study-library.md` 可指。 | 两份档的先例行各补先例批次坐标（例如 `docs/batches/M7-pwa-rules.md`、`docs/batches/M9-study-library.md`）。 |
| 8 | Existing-piece（criterion 11） | 🔵 | `docs/design/modules/pwa-rules.md` §7 现有件检查里有一项没有三问形式，且指向本档自己：「`public/` 现有 manifest、`sw.js` 与四张图标；manifest 与图标的尺寸/用途写在 `docs/design/modules/pwa-rules.md` 的图标一节。」其余各项都有「existing —」或「none found：」前缀。 | 给它补 `existing：` 前缀，并删掉那句自指引（内容就在本档 §2）。 |
| 9 | Doc-state（注册条件仍缺一闸） | 🔵 | `docs/design/modules/pwa-rules.md` §3 写「只在生产构建且非单文件版时注册（`import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1'`）」，实读 `src/client/main.tsx` 的条件还多一道「&& 'serviceWorker' in navigator」。 | 把这半句补进括号里的表达式。 |
| 10 | Clarity（校验口径清单不全） | 🔵 | `docs/design/modules/study-library.md` §2 的「校验口径与 `parseRecord` 同源：…；`id` 非空且唯一；`notes.step` 落在 `0..moves.length`。」与 `src/shared/study.ts` 的实际口径有三处差：解析器不查 id 唯一（唯一性在 `src/client/study/content.ts` 的 `seen` 与用例里），同一步两条说明整条作废（「if (steps.has(note.step)) return null;」），另有一道「if (!Array.isArray(movesRaw) || movesRaw.length > MAX_MOVES) return null;」上限。 | 清单改成解析器的真实口径（id 非空、唯一性在加载层、step 范围、同 step 不重复、着数上限）。 |
| 11 | Doc hygiene | 🔵 | `docs/design/modules/study-library.md` §7 同一件事写了两遍：「提交门另算：`npm run check`（…）是提交前的闸门，不是本批的验收口径。」之后又有「提交门见 `AGENTS.md`。」 | 删掉后一条。 |
| 12 | Clarity（文件表职责过期） | 🔵 | `docs/design/modules/pwa-rules.md` §7 文件表仍写「| `src/client/rules/content.ts` | 判罚与走法要点常量。 |」，本批新增的两篇长文也在该文件里（实读「export const ARTICLES: readonly RuleArticle[] = [」，标题「对局中如何提升自己」「看棋局的视角：把局面读成三笔账」），该档 §4 也写「内容以 `src/client/rules/content.ts` 的常量数组承载」。 | 职责改成「判罚、走法要点与两篇长文常量」。 |
| 13 | Document map | 🔵 | 本轮没有文档地图（No document map found），归属只能按 `AGENTS.md`「文档」表的四层位置判断。就本批两份档看，各自落在 `docs/design/modules/` 对应模块内，没有为既有小节新开文件，也没有把需求档的话复制进设计档——结论成立，但缺地图这一层校验。 | 无需改动文档；在项目根补一份文档地图后再核一轮归属。 |

计数：🔴 2 · 🟡 5 · 🔵 6。

VERDICT: changes-required

### 轮次 3（评审子代理）

评审对象：`docs/design/modules/pwa-rules.md`、`docs/design/modules/study-library.md`、`docs/design/modules/replay.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`（design 评审 · 第 3 轮 · object state 已实现 · trigger：只核第 2 轮 13 条的修复声明）。文档地图：本轮仍无（项目根与 `docs/` 下 `**/README*.md` 零命中），归属按 `AGENTS.md`「文档」表判断。

第 2 轮 13 条处置核对：

| # | 轮 2 结论 | 本轮读数 | 判定 |
|---|---|---|---|
| 1 | 🔴 分支无来源场景、档面与代码相反 | `docs/design/modules/study-library.md` §2 已写「运行时不会再逐条丢弃」与「列表因此没有空态分支：四类各 6 条由用例钉死，筛选不可能筛出空集。」，§6 文案项现只列「`棋谱库`、`全部 / 开局 / 中局 / 终局 / 残局` 为新增文案。」；实现同款（`src/client/study/content.ts` 抛「棋谱库第 ${index + 1} 条解析失败：内容校验没过」，`src/client/study/StudyLibrary.tsx` 只有「{shown.map((record) => (」，无空态分支）；`docs/` 下「这一类还没有棋谱」只余批次记录内的引用 | 已处置 |
| 2 | 🔴 进阶阅读无集成行 | `test/RTM.md` 有 F5-8 行（业务结果「规则页判罚口径之下有「进阶阅读」一节，两篇长文默认收起；点开可见正文（每篇八节），正文不引用具体着法编号」，入口「打开页面 → 规则 → 点开第一篇」，需求 F5.8）；`docs/requirements/xiangqi.md` 有「F5.8 | 规则页进阶阅读 | 规则页在判罚口径之下提供两篇长文」；`test/rules-content.test.ts` 已断言 `ARTICLES`（「test('进阶阅读两篇，各有八节，标题不重复'」）；`docs/design/modules/pwa-rules.md` §6 有对应一行 | 已处置（尾巴见本轮 🟡） |
| 3 | 🟡 `docs/design/modules/replay.md` §4 未补分栏 | 该档 §4 已写「页面顶部是两个分栏：**我的棋谱**（本地存局，左列列表 + 右侧回放，表头吸在列表顶部）与**棋谱库**（随包内容，按开局 / 中局 / 终局 / 残局筛选，选中即在同一页内回放）。」；§1 有「内部委托 positionAtMoves(startFen, moves, step)」 | 已处置 |
| 4 | 🟡 分档结论与 `content/games/index.json` 实测不符 | `docs/design/modules/study-library.md` §6 现为「分档：涉及代码文件均未跨 500 行档（`content/games/index.json` 是数据文件，不按代码档判——它的形态由 §3 的数组结构约束）」；本轮实测该文件 1139 行 | 已处置（理由写法见本轮 🔵） |
| 5 | 🟡「不着法将死收尾」不成句 | 该档 §3 中局行现为「`startFen` 不是初始局面；不以将死收尾；着法不少于 6 着」 | 已处置 |
| 6 | 🟡 验收未含 `test/record.test.ts` | 该档 §7 现为「内容自证：`node --test test/study.test.ts test/record.test.ts`」；`test/record.test.ts` 在库内，且断言 `notationsOf` 与 `positionAt`（后者即委托 `positionAtMoves`） | 已处置 |
| 7 | 🟡 先例行缺先例批次 | `docs/design/modules/pwa-rules.md`「Closest precedent: `docs/design/modules/app-shell.md`（实现批次见 `docs/batches/M1-board-local-play.md`）」；`docs/design/modules/study-library.md`「实现批次见 `docs/batches/M9-study-library.md`」 | 已处置 |
| 8 | 🔵 现有件项缺前缀 | `docs/design/modules/pwa-rules.md` §7 该项已改为「- existing：`public/manifest.webmanifest`、`public/sw.js` 与四张图标都已在仓库里。」，自指引已删 | 已处置（重复项见本轮 🔵） |
| 9 | 🔵 注册条件缺一闸 | 该档 §3 现为「`import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1' && 'serviceWorker' in navigator`」，与 `src/client/main.tsx` 的「if (import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1' && 'serviceWorker' in navigator) {」同款 | 已处置 |
| 10 | 🔵 校验口径清单不全 | 该档 §2 现为「`id` 非空（唯一性在加载时校验）；`notes.step` 落在 `0..moves.length` 且同一条内不重复；着法数不超过 `MAX_MOVES`。」，与 `src/shared/study.ts` 的 `isString(id)`、`if (steps.has(note.step)) return null;`、`movesRaw.length > MAX_MOVES` 对得上 | 已处置 |
| 11 | 🔵 提交门两句并排 | 该档 §7 只剩一句「提交门另算：`npm run check`（typecheck + 全量单测 + 前端用例）是提交前的闸门，不是本批的验收口径。」 | 已处置 |
| 12 | 🔵 `src/client/rules/content.ts` 职责过期 | 该档 §7 现为「判罚、走法要点与两篇进阶阅读的常量。」；该文件确有 `ARTICLES`（`src/client/pages/RulesPage.tsx` 与 `test/rules-content.test.ts` 都 import 它） | 已处置 |
| 13 | 🔵 缺文档地图 | 本轮仍无地图 | 无档可改（重列为本轮 🔵） |

本轮发现：

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Integration-test design / 验收（第 2 轮第 2 条的尾巴） | 🟡 | `test/RTM.md` 的 F5-8 行业务结果含「两篇长文默认收起」，但没有任何用例验这一句：`test/integration/rules.test.tsx` 只断言八行判罚与那句声明（其首行注释「集成用例 F4-2：导航点「规则」进规则页，八条判罚与 v1 范围声明可见，再点「对弈」回得去。」）；`test/rules-content.test.ts` 只读常量（「test('进阶阅读两篇，各有八节，标题不重复'」「test('进阶阅读正文不引用具体着法编号'」），看不到 `open` 属性；`scripts/acceptance.mjs` 里「规则」只出现在一条注释（「规则页的「判罚口径」表就这么瞎过一次」），无 `summary` / `details` 断言；`test/RTM.md` 的 F5 一节实现行仍是「用例实现：`scripts/acceptance.mjs`；自证用 `node scripts/acceptance.mjs --self-test`。」，没点名 F5-8 的实现件。而 `docs/design/modules/pwa-rules.md` §6 写「进阶阅读的展开属于内容断言，放在 `test/rules-content.test.ts`，不再派集成行。」 | 二选一：在 `test/integration/rules.test.tsx` 补两句（进页面时两篇 `<details>` 无 `open`，点 summary 后有），并在 `test/RTM.md` 的 F5 用例实现行点名该件；或把 F5-8 的业务结果收敛为内容断言能验的部分（两篇、各八节、无着法编号），收起/展开一句删掉。 |
| 2 | Doc-state（跨档落位说法不一致） | 🔵 | `docs/design/modules/pwa-rules.md` §6 写「起点：`test/RTM.md` 的「页面壳」故事（F4-2 行已定，本批不动）加一行本批新增的 F5-8」，实读 `test/RTM.md` 的 F5-8 行在「## 性能（需求 F5）」一节。 | 把 §6 的起点句改成「性能（需求 F5）故事加一行 F5-8」，与 RTM 的落位一致。 |
| 3 | Affected-file tier（第 2 轮第 4 条的理由写法） | 🔵 | `docs/design/modules/study-library.md` §6 用「`content/games/index.json` 是数据文件，不按代码档判——它的形态由 §3 的数组结构约束」交代数据文件；括号里的理由说的是形态由 §3 约束，没说这条 800 行硬档为什么不适用于内容数据。本轮实测：该文件 1139 行（末行是 `]`）、`src/client/pages/ReplayPage.tsx` 412 行、`src/shared/study.ts` 143 行、`src/client/study/StudyLibrary.tsx` 67 行、`src/client/study/content.ts` 34 行，表内代码文件均在 500 行档内。 | 可选：把理由写成判据边界本身（内容数据是一记录一段的文档性数组、无控制流，不按代码档判），让读者看出这不是单个文件的豁免。 |
| 4 | Doc hygiene（第 2 轮第 8 条的尾巴） | 🔵 | `docs/design/modules/pwa-rules.md` §7 现有件检查里同一件事写了两遍：「- existing：`public/manifest.webmanifest`、`public/sw.js` 与四张图标都已在仓库里。」与「- existing：`public/manifest.webmanifest`、`public/sw.js` 与 `src/client/main.tsx` 的注册点都已在仓库内。」 | 合成一条：`public/manifest.webmanifest`、`public/sw.js`、四张图标与 `src/client/main.tsx` 的注册点都已在仓库里。 |
| 5 | Document map（第 2 轮第 13 条） | 🔵 | 本轮仍无文档地图（项目根与 `docs/` 下 `**/README*.md` 零命中），归属只能按 `AGENTS.md`「文档」表的四层位置判断；就本批两份档看，各自落在 `docs/design/modules/` 对应模块内，没有为既有小节新开文件，也没有把需求档的话整段复制进设计档。 | 无需改动文档；在项目根补一份文档地图后再核一轮归属。 |

计数：🔴 0 · 🟡 1 · 🔵 4。第 2 轮 13 条：已处置 13 条，无未处置项。

VERDICT: pass

## §4 用户批准（主 agent）

## 用户确认

- 2026-11-14 用户原话：「如何在对局中提升自己，详细叙述。以什么视角来看待象棋对局，能更好的的理解抓住其本质。分两篇文章追加到规则项目下，同时追加棋谱库数量。此添加非单页文件中」。
- 方案回报后用户回「按这个做」——确认三件：文章放规则页底部折叠（不新开页面）、棋谱库 +8 条（四类各 +2）、单文件版不重打。
- 三轮设计评审（1、2 轮修复后、3 轮通过）不在用户侧走审批：本轮为内容批次，用户已在「按这个做」里给出方向；评审结论记录在 §3。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成



## 实施记录

**结论**：本批交付两件事——规则页底部「进阶阅读」两篇长文、棋谱库 16 → 24 条。单文件版按用户要求未重打。

### 改动清单

| 文件 | 改了什么 |
|---|---|
| `src/client/rules/content.ts` | 新增 `RuleArticleSection` / `RuleArticle` 两个类型与 `ARTICLES` 常量（两篇，各八节） |
| `src/client/pages/RulesPage.tsx` | 底部新增「进阶阅读」一节，两篇用 `<details>` 渲染（默认收起） |
| `src/client/rules/rules.css` | `.rules-article` 系列样式，只用主题令牌 |
| `content/games/index.json` | 16 → 24 条，四类各 6 |
| `src/client/study/content.ts` | 逐条静默丢弃改为响亮失败（坏记录 / id 重复直接抛错） |
| `src/client/study/StudyLibrary.tsx` | 删掉不可达的空类提示分支 |
| `test/study.test.ts` | 数量断言 24 / 每类 6；案名同步 |
| `test/integration/study.test.tsx` | 24 条 / 残局 6 条 |
| `test/rules-content.test.ts` | 新增两条：ARTICLES 两篇各八节、正文不含「第 N 着」 |
| `test/integration/rules.test.tsx` | 新增一条：两篇默认收起、正文在 details 内、每篇八节 |
| `test/RTM.md` | 新增 F5-8 行；F5 一节点名 F5-8 的实现件 |
| `docs/requirements/xiangqi.md` | F1.9 数量改 6 条；新增 F5.8 |
| `docs/design/modules/pwa-rules.md`、`docs/design/modules/study-library.md`、`docs/design/modules/replay.md` | 按三轮评审逐条对齐实现 |

### 八条新棋谱

| 类 | 条目 | 着数 | 来源 |
|---|---|---|---|
| 开局 | 顺手炮·横车过宫 | 8 | 自编 |
| 开局 | 仙人指路·卒底炮 | 8 | 自编 |
| 中局 | 中炮过河车·中路突破 | 8 | 自编 |
| 中局 | 飞相局·炮入卒林 | 8 | 自编 |
| 终局 | 双车夺门 | 3 | 自编 |
| 终局 | 借帅使车 | 3 | 自编 |
| 残局 | 海底捞月 | 3 | 自编 · 仿《适情雅趣》杀法 |
| 残局 | 车马借帅 | 5 | 自编 · 仿《适情雅趣》杀法 |

终局与残局的杀着是搜出来的不是手写的：从给定局面做 1/3/5 半回合的强制将死搜索，取第一条全防守都挡不住的线。中局的后半段由引擎自走 8 着——手写记谱在中局太容易写出一着不合法，整条记录就废了。

### 三轮评审的处置

| 轮 | 结论 | 处置 |
|---|---|---|
| 1 | 2🔴 8🟡 2🔵 | 需求数量对齐、删两条不可达分支、文档现状与归属修正 |
| 2 | 2🔴 5🟡 6🔵 | 档面对齐实现（分支描述）、补 F5-8 集成行与自证断言、replay 档补分栏现状 |
| 3 | pass（0🔴 1🟡 4🔵） | F5-8 补集成结构断言、起点故事落位、重复项合并、档位理由写成判据边界 |

### 验证

```
npm run check
  typecheck         通过
  node --test       274 通过 / 0 失败
  vitest run        78 通过 / 0 失败（14 个文件）
```

单文件版：按用户「此添加非单页文件中」要求，**未重打** `standalone/index.html`，它仍是上一批的产物。

## §6 验证与收口（父代理）

## 验证与收口

**验证命令与结果**（本批最后一次全量）：

```
npm run check
  tsc --noEmit                     通过
  node --test test/**/*.test.ts    274 通过 / 0 失败
  vitest run                       78 通过 / 0 失败（14 个文件）
```

**本批新增的用例**

| 用例 | 验什么 |
|---|---|
| `test/rules-content.test.ts`：进阶阅读两篇，各有八节，标题不重复 | 两篇的结构与条目数 |
| `test/rules-content.test.ts`：进阶阅读正文不引用具体着法编号 | 需求 F5.8 的「不引用会漂的编号」 |
| `test/integration/rules.test.tsx`：进阶阅读两篇默认收起，正文在各自的 details 里 | RTM F5-8 的「默认收起」 |

**没做的**（如实记）：

- 单文件版未重打：用户明确要求「此添加非单页文件中」，`standalone/index.html` 仍是上一批产物，不含本批内容。
- 集成用例不模拟 `details` 的点击开合：jsdom 不实现该行为，验它等于验 jsdom；用例只钉「默认没有 `open` 属性」与「正文在这两个 `details` 里」，开合本身交给浏览器。

**关闭状态**：批次收口，台账 #21 结算。
