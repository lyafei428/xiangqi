# 棋盘组件规格

一套组件，三种模式。对弈、教学、练习共用，不各写一份。

Closest precedent: `docs/design/modules/local-play.md` — 棋盘的尺寸测量、三档布局与对弈模式的行为已由该模块定下；落点对齐它的 §5 三档表与 `BoardMode` 收口。

偏离一：棋子材质允许描边内 1px 内阴影（§2）——M1 的「平涂棋子」在浅色棋盘上够用，深色桌面下棋子与盘面同属浅色，需要一点厚度才不糊成一片。
偏离二：<768px 的棋盘舞台左右不再留页边距、可用高不含面板（§5）——M1 的 40px 格宽下限是按「有页边距」写的，实机 360px 宽会把棋盘顶出屏幕；改成按整屏宽排后 360 上仍是 40px。抽屉几何不在这里定义，归 `docs/design/modules/local-play.md` §5。

Survey evidence: 已核对 `docs/requirements/xiangqi.md`（F1.2 棋盘交互、F2.1 演示、F3.1 判定题）、`docs/design/modules/local-play.md`（尺寸与对局交互）、`src/shared/` 的 `generateLegalMoves` / `playMove` 契约。未发现与 M2 冲突的既有设计。

## 1. 几何

棋盘为 9 列 × 10 行的交叉点布局，棋子落在交叉点上，不是格子里。

```text
viewBox="0 0 900 1000"
列间距 100，行间距 100
首列首行交叉点中心：(50, 50)
末列末行交叉点中心：(850, 950)
棋盘线范围：x ∈ [50, 850]，y ∈ [50, 950]
```

换算：

```text
screenX = (px / rect.width)  * 900
screenY = (px / rect.height) * 1000
col = round((screenX - 50) / 100)    // 0..8
row = round((screenY - 50) / 100)    // 0..9
```

- 用 `getBoundingClientRect()` 现算缩放，不在组件里缓存尺寸。
- 命中半径：交叉点为中心、半径 45（棋盘坐标系）内视为命中该点。相邻点间距 100，半径 45 不会误命中邻点。
- **不把 CSS 像素写进任何逻辑**。所有换算都在棋盘坐标系里做完再交给 SVG。

## 2. 渲染层次（由下到上）

```text
1  棋盘底色（单色，不做纹理图）
2  棋盘线（9 竖 + 10 横）
3  九宫斜线（两个 X）
4  兵炮位标记（十字记号）
5  河界文字「楚河　汉界」
6  走法提示点 / 上一步标记
7  棋子（32 个）
8  选中框 / 将军高亮
```

- 每枚棋子是一个 `<g>`，按交叉点 keyed 渲染，`transform="translate(x,y)"` 定位。走子只重绘起点与终点两枚棋子，不改 viewBox。
- 棋子用圆形底 + 单字，红黑两色加中性描边，可加一圈 1px 内阴影表现厚度；**不做外投影、不做渐变、不加纹理**——马腿与河界要一眼读准，厚度只做在描边以内。
- 单字按传统实体棋的写法：红方俥傌炮兵相仕帥，黑方車馬砲卒象士將。棋谱仍用常见字（车马炮），两者不混：棋子是给人看的字形，记谱是给人读的写法。

## 3. 交互

| 动作 | 行为 |
|---|---|
| 点己方棋子 | 选中，同时向引擎要 `generateLegalMoves` 并高亮可落点 |
| 点已选中棋子 | 取消选中 |
| 点可落点 | 走子 |
| 点不可落点 | 取消选中，不弹错误提示 |
| 拖动棋子到落点 | 等同点选两段式，拖动为增强不做唯一路径 |

- 高亮一律用 `generateLegalMoves`。伪合法的 `generateMoves` 含送将着法，画成可落点后点击必被引擎拒绝，等于教出错着。
- 命中区按半径 45 换算。格宽 40px 的最小档约为 36px 直径；44px 是触控理想值，与需求 F4.3 的 40px 格宽下限在 360px 宽棋盘上不能同时成立，按格宽下限优先。
- 走子轨迹：落子时画一道从起点到落点的光影（`.move-trail-line`，22px 圆头）加落点一圈扩散环（`.move-trail-ring`），700ms 淡出。目的是「机器走子快时也能看清它刚才动了哪个子」。默认开，设置里可关（`xiangqi.trail.v1`）；`prefers-reduced-motion: reduce` 时整层不画。只动透明度与半径，不碰布局。
- 字形朝向：默认所有棋子朝同一方向（屏幕下方那位读者的方向）。对弈页按「两人面对面」摆字——黑方棋子 `rotate(180)`、河界左半边「楚河」同时转过来，坐在对面的那位读到的也是正字；只转字形、不动格位。转身的集合就这两类：黑方棋子与「楚河」。另一半「汉界」不转：河界两字各朝一方，两边都至少有一半是正的，这与棋子「各读各的正字」同一取向——`--board-ink` 的字形本身是对称的，两半都转会让其中一半倒过来读。开关是 `xiangqi.faceoff.v1`，默认开，设置浮层里「对坐下棋」可关。设置浮层里与它并列的还有「走子轨迹 开/关」（`xiangqi.trail.v1`）、「音效 开/关」（`xiangqi.sound.v1`）与「胜率 开/关」（`xiangqi.eval.v1`，规格见 `docs/design/modules/ai.md` §9）——四个开关同一处，落点是 `src/client/App.tsx` 的 `<details>` 浮层。
- `touch-action: none` 常开（交互态）：手势进行中把 `touch-action` 从 `manipulation` 改成 `none`，浏览器会直接给这个 pointer 发 `pointercancel`，拖动拖到一半就断、落子永远发生不了。代价是手指从棋盘上开始拖不能滚动页面——棋盘本身按可视高度适配，不需要在它上面滚。
- **禁止 hover-only 交互**：触屏上没有 hover，任何信息都必须点击可见。

## 4. 三种模式

```ts
type BoardMode =
  | { kind: 'play'; side: Color | 'both' }
  | { kind: 'demo' }
  | { kind: 'drill'; side: Color };

interface BoardProps {
  mode: BoardMode;
  position: Position;
  size: BoardSize;
  selection?: { selected: number | null; targets: readonly number[] };
  lastMove?: Move | null;
  checkSquare?: number | null;
  marks?: readonly { square: number; kind: 'select' | 'correct' | 'wrong' }[];
  onSelect?: (square: number) => void;
  onTap?: (square: number) => void;
}
```

- M2 起按 mode 分支：`play` 与 `drill` 可交互，`demo` 只读。
- `demo` 用 `lastMove` 标当前步；`drill` 用 `marks` 画选中与对错。

| 模式 | 可动子 | 额外显示 |
|---|---|---|
| `play` | 按 `side` 限制（本地双人 = `both`） | 可落点、上一步 |
| `demo` | 不可动 | 当前步标记 |
| `drill` | 只允许 `side` 方，且按题目要求 | 对错标记（红叉 / 绿勾）就地显示，不弹模态框 |

## 5. 响应式

棋盘尺寸用一条统一公式，三档的差别在页面布局与面板，不在棋盘本身：

```text
宽 = min(容器宽, min(容器高, 720px) × 0.9)
高 = 宽 × 10 / 9
```

- 容器宽/高指棋盘舞台的可用尺寸（已扣掉面板与内边距）。宽与高同时受约束，棋盘不越出舞台——唯一例外是格宽下限那一档（见下条）。
- ≥1024px 与右侧栏并排；768–1023px 在下抽屉上方；<768px 的面板是覆盖式底部抽屉，几何（`position: fixed` 贴底、`max-height: 50dvh`、自身滚动、收起 `translateY(100%)` + `visibility: hidden`）以 `docs/design/modules/local-play.md` §5 为唯一出处，本节只记结论：覆盖式不占棋盘高度。棋盘舞台的可用高 = 视口高减页面壳（顶栏 + 对弈页常驻的状态与按钮区），不含面板。
- 尺寸测量每次渲染都重新看元素：舞台可能在条件分支里才出现（联机页先渲染大厅、建房后才渲染棋盘），只在挂载时挂一次 `ResizeObserver`，那些页面的尺寸就永远停在 0。规则落在 `src/client/board/useStageSize.ts`。
- 可用高还没量到（`areaHeight <= 0`）时按可用宽定尺寸，不算作 0：课程页与练习页的舞台高度由内容撑开、内容尺寸又由舞台决定，这一支不兜住就会互相等成 0——手机上表现为「没有棋盘」（踩过，见 `docs/design/modules/lessons.md` §4 与 `docs/design/modules/drills.md` §4 的舞台高度）。
- 格宽 = 棋盘渲染宽度 / 9。棋盘宽度**永不超过可用宽**：宽与高同时受约束时取小者，不做「撑到 40px 再横向滚动」——对弈时看不全棋盘比格子小 2px 严重得多（360px 的手机上撑到 360 会顶出屏幕右边）。
- 手机档（<768px）棋盘左右不留页边距，按整屏宽排：360 的机器正好 40px 一格（需求 F4.3），375 上是 41.7。屏幕窄于 360 时格宽随宽度同缩，完整可见优先。
- `ResizeObserver` 监听容器变化重算，旋转屏幕不重挂载组件。
- 用 `dvh` 不用 `vh`。

## 6. 性能

- 只渲染有子的交叉点（开局 32 枚），走子重绘起点与终点两枚。
- 走子不加过渡动画，避免布局抖动与额外的重排测量。将来加动画时只碰 `transform` 与 `opacity`，并在 `prefers-reduced-motion: reduce` 时关闭。
- 不在事件处理之外读 `offsetWidth` / `getBoundingClientRect`——命中判定只在 `pointerdown` / `pointerup` 时算一次。
- 棋盘整体不做 React 重渲染优化（memo）：90 个交叉点的量级用不上，过度优化让代码难读。

## 7. 无障碍

- 每个棋子 `<g role="img">` 带 `aria-label`（如"红方俥，第 2 列第 9 行"）。
- 键盘：`Tab` 在己方棋子间移动，`Enter` 选中，方向键移到落点，`Enter` 确认。
- 将军、将死、胜负状态用 `aria-live="polite"` 播报。
