# 棋谱库

棋谱页多一个分栏：分类浏览现成的棋谱，开局 / 中局 / 终局 / 残局四类，点开就能逐步回放。

Closest precedent: `docs/design/modules/replay.md` §1（记录格式与 `positionAt` 契约）与 §4（回放页的列表 / 回放布局）——回放已存在；实现坐标是 `src/client/pages/ReplayPage.tsx` 与 `src/shared/record.ts`。

对齐它：回放方式、记谱显示、`positionAt` 的夹取与抛错契约、页面的两区块切分。

偏差一处：数据来源从「localStorage 里的存局」扩成「随包只读棋谱 + 本地存局」两路。理由：内容要随版本发布，不能依赖用户本地存储。

Survey evidence: 已核对 `docs/design/modules/replay.md`（记录格式、页面、分档）、`docs/design/modules/lessons.md` §1/§7（内容按需加载与内容自证写法）、`docs/requirements/xiangqi.md` §3 F1.6/F1.9、`test/RTM.md` 对弈故事 F1-5 行、`src/client/missions/schema.ts`（内容校验既有写法）。

相关：仓库里没有「随包发布的棋谱内容」先例（检索 `content/` 只有课程、对弈题与练习题）。

## 1. 需求与落点

需求正文在 `docs/requirements/xiangqi.md` §3 F1.9，此处只留追溯：

| 需求点 | 落点 |
|---|---|
| 两个分栏 | `ReplayPage` 顶部一组切换，`我的棋谱` 走原逻辑，`棋谱库` 走新增的 `StudyLibrary` |
| 四类各 4 条、可按类筛选 | `content/games/index.json` 16 条 + `StudyLibrary` 的筛选行 |
| 任意步回放、棋盘与记谱同步 | 复用现有回放组件；步进与记谱由 `positionAtMoves` 与 `notationsOf` 提供 |
| 关键步说明可见 | `notes` 中 `step` 等于当前步时显示该条 |
| 内容自证 | `test/study.test.ts` 逐条解析、逐着合法、分类计数 |

## 2. 数据

`src/shared/study.ts`，纯类型与纯校验，零依赖：

```ts
export type StudyPhase = 'opening' | 'middlegame' | 'ending' | 'endgame';

export interface StudyRecord {
  readonly id: string;            // 例：'endgame-juzhongmi-1'
  readonly title: string;
  readonly phase: StudyPhase;
  readonly source: string;        // '自编' 或古谱名（《…》）
  readonly startFen: string;
  readonly moves: readonly { readonly from: number; readonly to: number }[];
  readonly result: GameResult | null;
  readonly notes: readonly { readonly step: number; readonly text: string }[];
}

export function parseStudyRecord(value: unknown): StudyRecord | null;
```

着法与 `src/shared/record.ts` 的记录同形（内联 `{ from, to }`），不引入第二种坐标形状。

校验口径与 `parseRecord` 同源：局面用 `parseFen`，每一着用 `playMove` 逐着验，走不通整条作废；`phase` 只认四个值；`id` 非空且唯一；`notes.step` 落在 `0..moves.length`。

**为什么内容只用一道校验**：本地存局是用户文件，必须拆成「结构」与「走法」两道并在回放页给出「这条棋谱无法回放」；随包内容在发布前由 `test/study.test.ts` 全量验过，运行时不合法即说明发布流程破了。运行时仍然逐条过滤，一条坏的不拖垮整个列表；某类过滤后为空时，列表显示「这一类还没有棋谱」，不静默空白。

## 3. 内容与分类口径

`content/games/index.json`：数组，四类各 4 条，共 16 条。分类由作者标注，并由自证测试按下列可判规则核对：

| 类别 | 可判规则 |
|---|---|
| 开局 | `startFen` 是初始局面；着法不超过 16 着 |
| 中局 | `startFen` 不是初始局面；不着法将死收尾；着法不少于 6 着 |
| 终局 | 自编；`statusOf` 走到末着为将死；起始局面双方子力各不少于 4 枚 |
| 残局 | 来源写明出处（古谱名，或明标为「仿……杀法」的自编排局）；起始局面双方子力各不超过 6 枚；以将死或和棋收尾 |

内容来源：残局为少子排局，杀法取自《橘中秘》《适情雅趣》一类古谱，但**当前四条是由我按该谱杀法构造的排局，不是逐字转录原谱**，所以 `source` 写成「自编 · 仿《…》杀法」——标谱名不给原谱坐实就是署名失真；若日后拿到可核的原谱着法表，再换成真转录。其余三类自编。**每条的着法都由引擎逐着复核**，复核不过的不收。

`notes` 每条 1–3 则，写关键着法的用意（为什么这一步，而不是复述走法）。

## 4. 界面

- 棋谱页顶部两个分栏按钮：`我的棋谱` / `棋谱库`；`我的棋谱` 的分栏下保持现状，不改列表、回放与导入导出。
- `棋谱库` 分栏：一排分类筛选（全部 / 开局 / 中局 / 终局 / 残局）+ 条目列表（标题、类别、来源、步数）。
- 点开条目进入页内回放：复用现有棋盘与步进控件，记谱列表同源；`notes` 命中当前步时在棋盘下方显示一条说明。
- 库内回放是**页内状态**，不新增地址：沿用 `#/replay` 一页，切分栏或重进页面回到列表。深链接到某条库内棋谱本批不做，`src/client/shell/routes.ts` 与 `docs/design/modules/app-shell.md` 因此无需改动。
- 库内棋谱只读：不可编辑、不可导出、不可删除。
- 窄屏（<768px，与面板同档）：分栏按钮与筛选行各占一行可横向滚动，列表在棋盘上方；棋盘尺寸公式不变，`docs/design/modules/board-ui.md` §5 的三档规则照旧。

## 5. 集成测试设计

起点：`test/RTM.md` 对弈故事，新行 `F1-9`，案名按行号命名。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-9 | 棋谱页分栏 → 内容库 → 回放器（棋盘 + 步进条） | 切到「棋谱库」看到四类共 16 条；按「残局」筛选只剩 4 条；点开一条能走到末步，棋盘跟着变，记谱条数等于步数；走到带说明的那一步，说明出现在棋盘下方 | 打开页面 → 棋谱 → 棋谱库 | F1.9 |

不破坏、不冗余：F1-5 验的是本地存局那一路（列表、导入导出、续局），本行验内容那一路；两路共用回放器，回放器自身的步进断言不重复。

## 6. 文件划分

| 文件 | 动作 |
|---|---|
| `src/shared/study.ts` | 新增：类型与 `parseStudyRecord` |
| `src/shared/record.ts` | 抽出 `positionAtMoves(startFen, moves, step)`；`positionAt` 改为委托它 |
| `src/client/study/content.ts` | 新增：`import` 内容 JSON，导出逐条 `parseStudyRecord` 后的列表 |
| `src/client/study/StudyLibrary.tsx` | 新增：分栏内的筛选与列表 |
| `src/client/pages/ReplayPage.tsx` | 加分栏切换、库内回放状态与说明行 |
| `src/client/app.css` | 分栏、筛选、库列表与说明行的样式 |
| `content/games/index.json` | 新增：16 条棋谱 |
| `test/study.test.ts` | 新增：内容自证 |
| `test/integration/study.test.tsx` | 新增：F1-9 |
| `docs/requirements/xiangqi.md` | F1.9 一行 |
| `test/RTM.md` | F1-9 行与用例实现条目 |
| `docs/design/modules/replay.md` | §1 补 `positionAtMoves`；§4 补分栏与库内回放 |

内容加载：单文件约十几 KB，`import` 进主包、不额外发请求；与课程不同（22 课体积大才按课切 chunk）。`test/study.test.ts` 用 `readFileSync` 读同一份 JSON，与运行时读同一个文件。

分档：涉及文件均未跨 500 行档；`ReplayPage.tsx` 现在按「列表」「回放」两区块切分，本批把库列表放进独立的 `src/client/study/StudyLibrary.tsx`，页内只多一层分栏与回放态切换，不新增 300 行以上单函数。

现有件检查：

- existing —— `src/shared/record.ts` 的 `parseRecord` / `positionAt` / `isReplayable` / `notationsOf` / `recordText`；`src/client/pages/ReplayPage.tsx` 的列表与回放布局；面板与棋盘的样式集中在 `src/client/app.css`。
- none found —— 新名字 `StudyRecord`、`StudyPhase`、`parseStudyRecord`、`positionAtMoves`、`StudyLibrary`、`src/client/study/content.ts` 项目内均无同名先例（检索 `study|Study` 零命中）；「随包棋谱内容」亦无先例。
- 文案：`我的棋谱` 是 `src/client/pages/ReplayPage.tsx` 里现状列表的标题（本批沿用）；`棋谱库`、`全部 / 开局 / 中局 / 终局 / 残局`、`这一类还没有棋谱` 为新增文案。

## 7. 验收

- 内容自证：`node --test test/study.test.ts`，覆盖逐条解析、逐着合法、四类各 4 条、分类规则可判、`id` 唯一、`notes.step` 在范围。
- 集成用例 F1-9 的那一半在收口行报告（`test/integration/study.test.tsx`），不写进本模块验收。
- 提交门见 `AGENTS.md`。

## 8. 风险

- **内容正确性是这批的主要风险**：古谱着法按引擎逐着复核，复核不过的不收；宁可少收一条，不塞一条错的。
- 版权：只用公有领域古谱与自编，`source` 逐条写明来源；不抄现代棋书与解说。
- 页内回放不深链：用户刷新会回列表，这是本批接受的取舍。
