# 棋盘组件规格

一套组件，三种模式。对弈、教学、练习共用，不各写一份。

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
1  木纹底（单色，不做纹理图）
2  棋盘线（9 竖 + 10 横）
3  九宫斜线（两个 X）
4  兵炮位标记（十字记号）
5  河界文字「楚河　汉界」
6  走法提示点 / 上一步标记
7  棋子（32 个）
8  选中框 / 将军高亮
```

- 每枚棋子是一个 `<g>`，`transform="translate(x,y)"` 定位。走子只改 transform，不重建节点、不改 viewBox。
- 棋子用圆形底 + 单字，红黑两色加中性描边。**不做立体阴影、不做渐变**。

## 3. 交互

| 动作 | 行为 |
|---|---|
| 点己方棋子 | 选中，同时向引擎要 `generateMoves` 并高亮可落点 |
| 点已选中棋子 | 取消选中 |
| 点可落点 | 走子 |
| 点不可落点 | 取消选中，不弹错误提示 |
| 拖动棋子到落点 | 等同点选两段式，拖动为增强不做唯一路径 |

- 触控命中区 ≥ 44×44 CSS px；棋子视觉直径可小于命中区。
- `touch-action: manipulation` 消 300ms 延迟；拖动时该元素临时 `touch-action: none`。
- **禁止 hover-only 交互**：触屏上没有 hover，任何信息都必须点击可见。

## 4. 三种模式

```ts
type BoardMode =
  | { kind: 'play'; side: Color | 'both'; legalMoves: Move[] }
  | { kind: 'demo'; highlight: Move | null; arrows: Move[] }
  | { kind: 'drill'; side: Color; expected: Square[]; marks: DrillMark[] };
```

| 模式 | 可动子 | 额外显示 |
|---|---|---|
| `play` | 按 `side` 限制（本地双人 = `both`） | 可落点、上一步 |
| `demo` | 不可动 | 高亮箭头、被吃子淡出 |
| `drill` | 只允许 `side` 方，且按题目要求 | 对错标记（红叉 / 绿勾）就地显示，不弹模态框 |

## 5. 响应式

| 视口 | 棋盘尺寸 | 说明 |
|---|---|---|
| ≥1024px | 高度取 `min(可用高, 720px)`，宽度按 9:10 比例 | 与右侧栏并排 |
| 768–1023px | 宽度取容器宽，高度按 9:10 | 下方抽屉 |
| <768px | `min(容器宽, (可用高 - 面板高) * 0.9)`，**且格宽 ≥ 40px** | 底部抽屉 |

- 格宽 = 棋盘渲染宽度 / 9。低于 40px 时按 40px 反推棋盘宽度，允许横向留白，**不继续压小**。
- `ResizeObserver` 监听容器变化重算，旋转屏幕不重挂载组件。
- 用 `dvh` 不用 `vh`。

## 6. 性能

- 32 个棋子节点，走子只改受影响的 2 个节点的 `transform`。
- 动画只碰 `transform` 与 `opacity`，时长 150ms，`prefers-reduced-motion: reduce` 时关闭。
- 不在动画帧里读 `offsetWidth` / `getBoundingClientRect`——命中判定只在 `pointerdown` 时算一次。
- 棋盘整体不做 React 重渲染优化（memo）：90 个交叉点的量级用不上，过度优化让代码难读。

## 7. 无障碍

- 每个棋子 `<g role="img">` 带 `aria-label`（如"红方车，第 2 列第 9 行"）。
- 键盘：`Tab` 在己方棋子间移动，`Enter` 选中，方向键移到落点，`Enter` 确认。
- 将军、将死、胜负状态用 `aria-live="polite"` 播报。
