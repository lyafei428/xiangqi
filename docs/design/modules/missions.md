# 对弈型练习（杀法题）

在棋盘上走子的练习：找杀、攻杀、防守。目标是否达成由引擎判，不靠题库里的对错标记。

Closest precedent: `docs/design/modules/drills.md` — 练习会话的作答/判分/提示状态机、棋盘 `drill` 模式与页面骨架已由该模块定下。本模块沿用同一棋盘与页面骨架，把「点选选项」换成「在棋盘上走子」。

Survey evidence: 已核对以下文档与代码：

- `docs/requirements/xiangqi.md`：F3.2 三类对弈题、F3.3 答案由引擎生成、F3.4 提示与答案。
- `docs/design/architecture.md` §8：M3 验收。
- `docs/design/modules/drills.md`：练习页结构。
- `src/shared/rules.ts`：`generateLegalMoves` / `isInCheck` / `statusOf` / `applyMove`。
- `src/client/game/session.ts`：可自定义起始局面。

未发现与 M3 冲突的既有设计。

## 1. 题型

| 类型 | 目标 | 判定 |
|---|---|---|
| `find-mate` 找杀 | 找出一步将死 | 玩家这一着走完是 `checkmate` |
| `attack` 攻杀 | 在 `plies` 着内将死 | 玩家着数用尽前出现 `checkmate`；玩家每走一着，引擎应一着 |
| `defense` 防守 | 对手下一着就能将死你，走一步化解 | 走完后对手不再有「一着杀」；若没化解，引擎直接走出杀着判失败 |

- 「一着杀」由判杀器按「对手先走」的局面回算，不是题库里写死的。
- 威胁判定先看对手是否正被将军：被将时直接返回 `false`（对手只能应将），不翻转局面。
- 攻杀题的「强制」由判杀器保证：题目自证时检查玩家存在一条线，且对手**所有**合法应着之后玩家仍能将死。

## 2. 数据

`content/missions/index.json`：一个数组，8 道题（每课一题）。

```ts
interface Mission {
  id: string;
  type: 'find-mate' | 'attack' | 'defense';
  lesson: string;        // 关联课 id
  title: string;
  fen: string;
  plies: number;         // find-mate = 1；attack = 允许的玩家着数；defense = 1
  source: string;
  hint: string;
}
```

- 局面是人工构造的，**答案不是**：将死着法与防守着法都由判杀器现算，内容测试逐题回算。
- 题量小，一次全量加载，不做分片。

## 3. 判杀器

`src/client/missions/mate.ts`，纯函数，不做随机生成：

```ts
findMatingMoves(position): Move[]        // 一步将死的所有着法
hasMateIn(position, plies): boolean      // 当前行棋方在 plies 着内强制将死
findForcingMoves(position, plies): Move[] // 强制杀的见证着法（排序后）
findDefenseMoves(position, defender): Move[] // 化解「一着杀」的着法（排序后）
hasMateInOneThreat(position, defender): boolean // 若对手先走，是否有一着杀
withTurn(position, color): Position      // 只换行棋方，供威胁判定
```

- `hasMateIn(pos, 2)`：存在玩家着法 M，使对手**任意**合法应着 R 之后，玩家仍有一步将死。
- 只接受 `plies` 1 或 2；更深的搜索不进 v1。
- 威胁判定不直接翻转被将局面：翻转后「不走棋的一方被将军」不是合法局面。防守题自证要求开局玩家不在被将状态。
- 走子后的复查用相对行棋方的 `hasMateIn(position, 1)`，不再翻转一次。
- 开销：`plies = 2` 只在内容自证与题目加载时跑一次，按题缓存；页面上不做实时深搜。

## 4. 会话

```ts
type MissionStatus = 'playing' | 'success' | 'failed';

interface MissionSession {
  mission: Mission;
  player: Color;
  game: GameSession;            // 复用对弈会话：局面、历史、记谱、选中
  playerMoves: number;
  status: MissionStatus;
  message: string;
  attempts: number;
  failures: number;
  answerText: string | null;
}
```

动作：`select(square)` / `tap(square)` / `retry`。

- 玩家走子走与对弈页相同的选子两段式；落子用 `playMove`。
- 玩家一着走完：
  - `checkmate` 且赢家是玩家 → `success`。
  - `find-mate` 未将死 → `failed`（可重试）。
  - `attack` 未将死且玩家着数用尽 → `failed`；否则引擎应一着（取排序后的第一个合法着法，保证可复现）。
  - `defense` 走完后对手无一着杀 → `success`；玩家这一着将了对手的军时，对手只能应将，同样按成功处理；否则引擎走出那一着，`failed`。
- 重试把局面恢复到题目 FEN，`attempts + 1`，失败次数保留。
- 错两次显示提示（`mission.hint`）；第三次把正确第一着走到棋盘上并给出记谱（`answerText`）。找杀 / 攻杀取 `findMatingMoves` 或 `findForcingMoves` 的排序首项，防守取 `findDefenseMoves` 的排序首项；记谱用 `toChineseNotation`。失败次数累计，重试不清零。
- 会话放在题目页内部；离开题目页即复位。

## 5. 页面与路由

| 路由 | 页面 |
|---|---|
| `#/missions` | 对弈题列表，按课分组 |
| `#/mission/<id>` | 单题：棋盘 + 目标、提示、重试、结果 |

- 棋盘用 `play` 模式并按玩家一方限权（`side = player`），复用对弈页的选子与可落点规则；不复用 `drill` 模式的点选作答。
- 课程页第三章的课直链对应题目；练习页加「对弈题」入口。
- 结果就地显示，不弹模态框；成功后给「下一题」与「回课程」。
- 面板显示「第 N 次尝试」（`attempts + 1`）与当前题型的提示 / 答案。

## 6. 文件划分

| 文件 | 职责 |
|---|---|
| `src/client/missions/mate.ts` | 判杀器：一步杀、强制杀、一着杀威胁。纯函数。 |
| `src/client/missions/schema.ts` | 题目校验与自证（调判杀器）。 |
| `src/client/missions/session.ts` | 练习会话：选子、走子、引擎应着、判定、重试。纯函数。 |
| `src/client/missions/content.ts` | 题库加载：一次全量读取并逐题自证。 |
| `src/client/pages/MissionsPage.tsx` | 题目列表。 |
| `src/client/pages/MissionPage.tsx` | 单题棋盘与面板。 |

命名：`MissionPage`、`MissionsPage`、`findMatingMoves`、`findForcingMoves`、`findDefenseMoves`、`hasMateIn`、`hasMateInOneThreat`、`withTurn` 与文案「对弈题」为新增名字，项目内无同名先例（checked, none found）。

文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。

## 7. 验收对照

| 需求 | 落点 |
|---|---|
| F3.2 攻杀 / 防守 / 找杀达成目标即通过 | 三类题目 + 判杀器判定 |
| F3.3 答案由引擎生成，不手写 | `test/missions.test.ts` 逐题回算将死与防守 |
| F3.4 错两次提示、三次答案 | 错两次显示提示；第三次把正确第一着走到棋盘上并给出记谱 |

## 8. 集成测试设计

起点：`test/RTM.md` 的「对弈题」故事。本批新增 F3-2 一行；既有 F1-1 / F2-1 / F3-1 / F4-1 不破坏，不冗余。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F3-2 | 题目列表 → 单题棋盘 → 走子判定 | 走进将死着 / 走出化解着显示通过；走错显示未达成并可重试 | 打开页面 → 练习 → 对弈题 | F3.2 |

实现：`test/integration/mission.test.tsx`。判杀器与题目自证是单元级，不进 RTM。
