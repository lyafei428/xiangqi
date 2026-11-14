# 棋盘组件规格

一套组件，三种模式。对弈、教学、练习共用，不各写一份。

Closest precedent: `docs/design/modules/local-play.md` — 棋盘的尺寸测量、三档布局与对弈模式的行为已由该模块定下。本模块只把入参收口成 `BoardMode`，不改变 M1 的棋盘几何与视觉。

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
- ≥1024px 与右侧栏并排；768–1023px 在下抽屉上方；<768px 下，面板为覆盖式底部抽屉：`position: fixed` 贴底、`max-height: 50dvh`、自身纵向滚动，不占棋盘高度；收起时 `translateY(100%)` 并 `visibility: hidden`，不参与布局也不可聚焦。棋盘舞台的可用高 = 视口高减页面壳（顶栏 + 对弈页常驻的状态与按钮区），不含面板。
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
