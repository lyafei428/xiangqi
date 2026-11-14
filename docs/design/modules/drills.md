# 判定题生成与练习模块

四类判定题由引擎生成答案，界面只负责作答与判分。题目不是手写题库：同一生成器换一个种子就是一道新题。

Closest precedent: `docs/design/modules/local-play.md` — 棋盘尺寸、三档布局与对局状态机已由该模块定下。练习页复用同一棋盘与尺寸规则，只把对局 reducer 换成练习会话。

Survey evidence: 已核对 `docs/requirements/xiangqi.md`（F3.1 四类判定题、F3.3 答案由引擎生成、F3.4 错两次提示与三次答案）、`docs/design/modules/board-ui.md`（`drill` 模式与对错标记）、`src/shared/rules.ts` 与 `src/shared/notation.ts`（`generateLegalMoves` / `isLegal` / `isInCheck` / `statusOf` / `toChineseNotation`）。未发现与 M2 冲突的既有设计。

## 1. 题型

| 题型 | 提问 | 作答 | 答案来源 |
|---|---|---|---|
| `move-pattern` 走法题 | 把标记棋子的合法落点都点出来 | 点选多个格子后提交 | `generateLegalMoves` 过滤该起点 |
| `legality` 合法性题 | 这步棋合法吗 | 合法 / 不合法 | `isLegal` |
| `position` 局面题 | 轮到的一方被将军了吗 / 还有合法着法吗 | 二选一 | `isInCheck` / `generateLegalMoves` |
| `notation` 记谱题 | 这步棋怎么记 | 四选一 | `toChineseNotation` |

- 走法题用多选；其余三类用单选。答案一律由引擎现算，题库里没有写死的对错。
- 干扰项只是选项标签：记谱题的三个错项取自同一局面其他伪合法着法的记谱，且与正确记谱、彼此都不同；生成器在合法着法里挑第一个能凑够 3 个不同记谱的着法，凑不够就报错（现有种子集未触发）。干扰项绝不参与判定。
- F3.2 对弈型练习见 `docs/design/modules/missions.md`；本模块只做四类判定题。

### 配置

```json
{
  "kinds": ["move-pattern", "legality", "position", "notation"],
  "plies": { "min": 6, "max": 24 },
  "attempts": { "hint": 2, "reveal": 3 }
}
```

```ts
interface DrillConfig {
  kinds: DrillKind[];
  plies: { min: number; max: number };        // 随机局面步数
  attempts: { hint: number; reveal: number }; // 第几次错给提示 / 给答案
}
```

## 2. 题目对象

```ts
interface Drill {
  kind: 'move-pattern' | 'legality' | 'position' | 'notation';
  variant: string;                 // 局面题的子问法，测试与文案用
  seed: number;
  fen: string;
  question: string;
  options: { id: string; label: string }[];
  answer: { kind: 'targets'; targets: number[] } | { kind: 'choice'; optionId: string };
  hint: string;
  explanation: string;
  highlight: { from: number; to: number } | null;  // 90 格下标；合法性题与记谱题标出这一步
  markedSquare: number | null;                     // 90 格下标；走法题标出要走的子
}
```

## 3. 生成器

- 种子随机数用 mulberry32；`generateDrill(kind, seed, config)` 的 `config` 是 §1 的 `DrillConfig`，输出完全确定，测试可复现。
- 局面从初始局面随机走 `config.plies.min`–`max` 着合法着法得到；走到将死或困毙就重抽。
- 走法题优先挑合法落点 ≥ 2 的棋子、记谱题挑有 ≥ 3 个其他不同记谱的着法：这两个下限是生成器常量，不进 config（改动会改变题目难度，应与题型一起评审）。
- 生成器不产生非法 FEN，也不手写坐标：所有局面都由引擎走出来。

## 4. 练习会话

```ts
interface DrillSession {
  drill: Drill;
  selected: number[];          // 走法题已点选的格子
  choice: string | null;       // 单选题已选项
  wrongAttempts: number;
  status: 'answering' | 'correct' | 'revealed';
  hintShown: boolean;
}
```

动作 `toggle(square)` / `choose(optionId)` / `submit` / `next(drill)`。

- `wrongAttempts > 0` 即最近一次提交判错（作答中仍可改答）；`hintShown` 在第二次错时为真；第三次错进入 `revealed`。

- 提交正确：`status = correct`，面板显示解释。
- 第一次错：只提示「再试一次」；第二次错：显示提示；第三次错：显示答案并把正确落点/选项标在界面上（`revealed`）。
- 走法题判分用集合相等，顺序无关；漏选、多选都算错。

## 5. 页面

- 题目区：提问、选项按钮或「提交」；走法题在棋盘上点选，选中的格子加标记。
- 判分后显示正确/错误、提示或解释与「下一题」。
- 棋盘处于 `drill` 模式；模式规则见 `docs/design/modules/board-ui.md` §4，练习页只负责题目、作答与判分。
- 手机档棋盘舞台高度 `min(58vh, 460px)`：宽屏是左右分栏、棋盘占左半边；窄屏改块级排布后若不给确定高度，舞台会塌成 2px（棋盘跟着缩成 2×2）——与课程页同一个坑，规则见 `docs/design/modules/board-ui.md` §5。

## 6. 自证

`test/drills.test.ts` 对四类题各跑固定种子集：

| 题型 | 断言 |
|---|---|
| 走法题 | `answer.targets` 与 `generateLegalMoves` 过滤结果逐项相等 |
| 合法性题 | 选项答案与 `isLegal` 相等 |
| 局面题 | 选项答案与 `isInCheck` / 合法着法数相等 |
| 记谱题 | 正确选项文案与 `toChineseNotation` 相等，且四个选项互不相同 |

题目生成失败（局面走不出合法着法）时抛错，不返回空题。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `src/client/drills/generator.ts` | 种子随机、局面生成、四类题与答案。纯函数。 |
| `src/client/drills/session.ts` | 练习会话 reducer：作答、判分、提示、揭晓。纯函数。 |
| `src/client/pages/DrillPage.tsx` | 练习页：棋盘、题目、判分与下一题。 |

命名：`generateDrill`、`DrillPage` 为新增名字，项目内无同名先例（checked, none found）。

文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。

## 8. 验收对照

| 需求 | 落点 |
|---|---|
| F3.1 四类判定题可作答并判分 | 练习页 + `test/integration/drill.test.tsx` |
| F3.3 答案由引擎生成，不手写 | `test/drills.test.ts` 逐题回算 |
| F3.4 错两次提示、三次答案并演示 | 揭晓时在棋盘上高亮正确着法的起止格 / 标出正确落点，即演示；判定题只涉及一着，不播放逐步动画（避免为一次判定再加一套播放状态机） |

F3.2 对弈型练习由 `docs/design/modules/missions.md` 承接；与四类判定题共用棋盘与练习页骨架，但题目从「判定」变成「在棋盘上达成目标」。

## 9. 集成测试设计

起点：`test/RTM.md` 的「练习」故事。本批新增 F3-1 一行；此前无练习行，不破坏、不冗余。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F3-1 | 练习页 → 棋盘/选项 → 判分 | 作答后显示对错；错三次给出答案并标记 | 打开页面 → 练习 | F3.1 / F3.4 |

实现：`test/integration/drill.test.tsx`；生成器自证 `test/drills.test.ts` 是单元级回算，不进 RTM。
