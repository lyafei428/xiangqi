# 记谱输入

面板上一个输入框：敲「炮二平五」回车，棋盘就走那一步。给键盘玩家与习惯记谱的人一条快路径。

Closest precedent: `src/shared/notation.ts` 的 `toChineseNotation`——记谱生成已经存在，棋谱、着法记录、练习题干共用它。

对齐它的输出形态与消歧口径：前/中/后、进/退/平、双方各自的数字写法。走子链路沿用 `docs/design/modules/local-play.md` §3 的既有流程。

本模块只加反向解析，不另写一套记谱文法。

Survey evidence: 已核对 `docs/design/rules-engine.md` §2/§3（类型与 FEN）、`docs/design/modules/board-ui.md` §3/§5/§7（键盘交互、三档布局、无障碍）、`docs/design/modules/local-play.md` §3/§5（面板与响应式）、`docs/requirements/xiangqi.md` §3 F1、`test/RTM.md`（对弈故事与用例标题口径）、`src/client/game/session.ts`（`play` 动作）。

相关：仓库里没有「文本命令 → 着法」的先例。

## 1. 口径

| 项 | 口径 |
|---|---|
| 输入 | 中文记谱，如 `炮二平五`、`前车进一`、`卒1进1` |
| 命中 | 与当前行棋方的全部合法着法逐条比对记谱字符串，命中即走 |
| 零命中 | 不落子，输入框下方提示「这步走不了：检查棋子、纵线和方向」+ 示例「如：炮二平五」，原文保留 |
| 空输入 | 纯空白按回车不提交、不提示，原文原样留着 |
| 只读时 | 终局、人机页 AI 回合：输入框置灰不可用 |
| 范围 | 只做对弈页与人机页（本地双人、人机）；联机页与观战本批不提供输入框 |

提示语不区分「写法看不懂」与「文法对但走不通」：两种情况对用户是同一件事——这步下不了。分成两句要用户先学会分辨错误类型，没有收益。

「一条输入对应多个着法」不作为一种状态处理：生成侧已用前/中/后与序号消歧，并要求单测证明同一局面下全部合法着法的记谱两两不同（见 §7）。不变量一旦破了，解析按零命中返回。

## 2. 归一化

用户手上不会只有一种写法，比对前两边都过同一张表：

| 输入可能写成 | 归一到 |
|---|---|
| 全角数字 `１`–`９` | 半角 |
| 繁体棋子字 `俥車`、`傌馬`、`砲`、`帥`、`將` | 记谱用的 `车`、`马`、`炮`、`帅`、`将` |
| `進` 等异体字 | `进` |
| 空格（半角与全角）、`、`、`，`、`,`、句号 | 全部删除 |

数字形态：`toChineseNotation` 对红方输出汉字数字（`炮二平五`），对黑方输出阿拉伯数字（`卒1进1`）。比对前把输入里的数字统一成当前行棋方的形态，于是红方敲 `炮2平5` 与黑方敲 `炮八平五` 都命中；形态之外一个字都不许差。

## 3. 界面

- 位置：面板里着法记录下方、「新局」按钮上方。输入框一行常驻；提示行仅在零命中时渲染，不常驻占位。
- 输入框空时以占位符显示示例「如：炮二平五」——用户不知道能敲什么时，空框需要一个引子；提交失败时示例仍随提示行出现，两处文案同源，不各写一句。
- 提示的行为：提示行自带 `role="status"`、`aria-live="polite"`，就在输入框下方。面板顶部的状态行文案不因提示改写——它继续说「红方走棋」或终局结果，两处不抢同一个播报位。
- 快捷键：页面上按 `/` 聚焦输入框。焦点已经在文本输入框里时不抢——用户在记谱框里敲 `/` 不该被打断，这也是唯一现在能遇到的场景（其余输入件是难度与阵营的 radio）。面板收起时先展开面板再聚焦——收起态下输入框不可达，这条验收才有意义。
- 提交：`Enter` 提交。成功后清空并保持焦点，连续输入不用再点；失败保留原文。
- 手机上不主动失焦：软键盘开着时棋盘可能被遮住，但提示与着法记录就在输入框旁边，用户看得见结果；要看棋盘点一下棋盘区即收起键盘（原生行为），不由我们判断「是不是手机」。
- 输入框的可访问名是「记谱输入」；提示由提示行自己的播报区负责，不复用面板顶部状态行那个播报区。
- 输入框里的按键不冒泡到棋盘，不改变 `docs/design/modules/board-ui.md` §7 的 Tab / 方向键 / Enter 语义。
- 面板新增的这一行只占一行高度；提示出现时抽屉态若总高不够，由面板体滚动承担（着法列表有 120px 保底，不被压缩），断点与棋盘尺寸公式不变。
- 这是新需求 F1.8 的必需控件，不是装饰：页面保持 `docs/requirements/xiangqi.md` F5.1 的「只保留完成该页任务必需的控件」。

## 4. 需求与落点

需求正文在 `docs/requirements/xiangqi.md` §3 F1.8，此处只留追溯表：

| 需求点 | 落点 |
|---|---|
| 记谱能走子 | `parseChineseNotation` 比对生成侧记谱，命中即 `dispatch({ type: 'play', move, now: Date.now() })`（时间随动作传入，与 `PlayPage` / `AiPage` 同形） |
| 看不懂不落子 | 零命中时提示且不改局面 |
| 只读态不可用 | `NotationInput` 的 `disabled` 由页面传入（终局 / AI 回合） |
| `/` 聚焦 | 页面级 keydown 监听；面板收起时先展开 |

## 5. 集成测试设计

起点：`test/RTM.md`「对弈」故事，行号先定死为 `F1-8`，用例标题按行号命名。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F1-8 | 记谱输入框 → `dispatch({ type: 'play', move })` → 棋盘与着法记录同时更新 | 输入「炮二平五」回车后，炮落到中路且着一行出现该步；输入「炮二平九」不落子并给出提示；终局时输入框置灰；`/` 聚焦输入框；人机页 AI 回合时输入框置灰 | 打开页面 → 对弈 / 人机 → 面板记谱框 | F1.8 |

不破坏、不冗余：F1-1（棋盘点选走子）从棋盘进入，本行从输入框进入，验的是不同入口。F4-4（格宽 ≥40）与 F4-5（触摸交互）因面板新增一行而复核一遍，棋盘的尺寸公式未变。

## 6. 文件划分

| 文件 | 动作 | 状态 |
|---|---|---|
| `src/shared/notation.ts` | 加 `normalizeNotation` 与 `parseChineseNotation`，纯函数、零依赖 | 已落地 |
| `src/client/panel/NotationInput.tsx` | 新增：输入框、提交、提示 | 已落地 |
| `src/client/panel/GamePanel.tsx` | 接入输入框，透传 `onPlay` 与禁用条件 | 已落地 |
| `src/client/pages/PlayPage.tsx`、`src/client/pages/AiPage.tsx` | 传 `onPlay`（`dispatch({ type: 'play', move, now: Date.now() })`）与禁用条件 | 已落地 |
| `test/notation-input.test.ts` | 新增：解析、归一化、零命中、空输入、记谱两两不同 | 已落地 |
| `test/integration/notation-input.test.tsx` | 新增：F1-8 | 已落地 |
| `docs/requirements/xiangqi.md` | F1.8 一行 | 已落地 |
| `test/RTM.md` | F1-8 行与「用例实现」条目 | 已落地 |
| `docs/design/modules/local-play.md` | §5 记谱输入行 | 已落地 |

两个新函数的契约（`src/shared/` 零依赖，不碰 DOM 与 Node）：

```ts
/** 把用户输入按当前行棋方的书写形态归一；只做字符级替换，不判合法性。 */
export function normalizeNotation(color: Color, text: string): string;

/** 比对全部合法着法的记谱，命中返回该着法；零命中或不止一条返回 null。 */
export function parseChineseNotation(position: Position, text: string): Move | null;
```

比对源固定为 `generateLegalMoves(position)`，与 `docs/design/modules/board-ui.md` §3「高亮一律用 `generateLegalMoves`」同一口径——不给送将着法留解析口子。

分档：涉及文件均未跨 500 行档，无需拆分。

现有件检查：

- existing —— `src/shared/notation.ts` 的生成函数与数字表；`src/client/game/session.ts` 的 `play` 动作；`docs/design/modules/local-play.md` §5 的面板响应式表；面板状态行的 `role="status"` 播报区。
- none found —— 「文本命令 → 着法」的先例：检索 `parse.*Notation|notation.*parse` 零命中。
- 文案：提示语与可访问名是本模块新增的用户可见文案，仓库内没有可复用的既有串。与 `docs/design/modules/local-play.md` §3「点不可落点 → 取消选中，不弹错误」不冲突：棋盘误点有棋盘本身当反馈，输入框里的错字没有别的反馈通路。
- 测试文件分档：`test/notation.test.ts` 已覆盖生成侧（含前后消歧），本批的反向解析另开 `test/notation-input.test.ts`——两侧分开，用例失败时一眼看得出是生成还是解析出了问题；两个文件都远低于 500 行档。

## 7. 验收

- 单测：`node --test test/notation-input.test.ts`，覆盖解析、归一化、零命中，以及「同一局面下全部合法着法的记谱两两不同」。
- 集成用例 F1-8 的那一半在收口行报告（`test/integration/notation-input.test.tsx`），不写进本模块验收。
- 提交门见 `AGENTS.md`（`npm run check`），不是本模块的验收口径。

## 8. 风险

- 记谱有歧义写法（同线两兵）：生成侧用前/中/后消歧，输入照抄它的输出；输错就是走不了，不猜。
- 输入框与棋盘共用 `Enter`：靠焦点隔离，不做全局拦截。
