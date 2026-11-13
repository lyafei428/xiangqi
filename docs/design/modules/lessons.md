# 课程与演示模块

分章课程的内容格式、课程页与棋盘演示。课程是纯数据，代码只负责读取、校验与播放；讲解文案改动不碰代码。

Closest precedent: `docs/design/modules/local-play.md` — 对局页的单状态、棋盘尺寸测量与三档布局已由该模块定下。本模块沿用它的页面骨架与棋盘尺寸规则，只在同一壳内增加课程页。

Survey evidence: 已核对 `docs/design/architecture.md`（M2 里程碑、内容生产纪律、按课拆包）、`docs/requirements/xiangqi.md`（F2.1、F2.2、F2.3）、`docs/design/modules/board-ui.md`（三种模式与演示层）、`src/shared/` 的 `parseFen` / `playMove` / `toChineseNotation` 契约。未发现与 M2 冲突的既有设计。

## 1. 内容布局

```text
content/lessons/index.json        三章的章节与课目元数据
content/lessons/<id>.json         一课一个文件，讲解与演示步骤
```

- 课的标题与摘要只写在 `index.json`；课文件只写内容，避免同一事实两处维护。
- 课文件按需加载（Vite `import.meta.glob` 生成逐课 chunk），一次请求一课，不进主包。
- 练习配置 `content/drills/default.json` 的布局由 `docs/design/modules/drills.md` §1 拥有，本模块只引用。

## 2. Schema

```ts
interface LessonIndex {
  chapters: {
    number: number;
    title: string;
    lessons: { id: string; title: string; summary: string }[];
  }[];
}

interface LessonContent {
  id: string;
  source: string;                       // 教材出处或「自编」
  sections: LessonSection[];
}

type LessonSection =
  | { kind: 'text'; title?: string; body: string[] }
  | { kind: 'note'; body: string[] }
  | { kind: 'demo'; title?: string; startFen: string; steps: DemoStep[] };

interface DemoStep {
  from: [number, number];               // [x, y]，0-based，x=0 左，y=0 黑方底线
  to: [number, number];
  text: string;
}
```

- 演示步骤用坐标而不是 90 格下标：作者读 JSON 就能对上棋盘，不用心算 `y * 9 + x`。
- `[x, y]` 到 90 格下标的换算只在 `src/client/learn/schema.ts` 的 `demoFrames` / `validateDemo` 内发生；界面与引擎只拿下标。
- 每一步的 `text` 是这一步的讲解；没有文案的步骤不允许（读者看不出为什么走这一步）。

## 3. 演示语义

- 从 `startFen` 起，按顺序应用 `steps`；每一步必须对应用引擎合法（`playMove` 不抛错）。
- 步进器状态 `stepIndex`：`-1` 表示起始局面，`0..n-1` 表示已走到第几步；上一步/下一步/重播只改这个下标。
- 当前步的走法用棋盘的上一着标记；不播放动画。
- 演示不可交互：棋盘处于 `demo` 模式，点击不选中、不走子。

## 4. 课程页

- 目录页按章列出课目，显示标题、摘要与本次会话内是否看过。
- 课程页从上到下：标题、来源、正文段落与演示块；演示块带「上一步 / 下一步 / 重播」。
- 「去练习」进入练习页。
- 进度：需求 §5 的 v1 口径是「进度存浏览器本地」；当前只做本次会话内的进度，跨会话持久化尚未实现，留待后续批次。

## 5. 校验

`src/client/learn/schema.ts` 提供纯校验函数，内容测试对 22 课逐课调用：

| 检查 | 失败即内容错 |
|---|---|
| 课目 id 与文件名一致，`index.json` 与课文件双向无孤儿 | 是 |
| 章节号连续、课序连续、每章都有课；全书 8 / 6 / 8，共 22 课 | 是 |
| `source` 非空，`sections` 非空，正文与步骤文案非空 | 是 |
| `startFen` 可解析，演示每一步合法 | 是 |

校验不通过时抛错并带课 id 与步骤序号；内容测试直接失败。

## 6. 文件划分

| 文件 | 职责 |
|---|---|
| `src/client/learn/schema.ts` | 课程类型与校验；纯函数，不碰 DOM。 |
| `src/client/learn/content.ts` | 读取 `index.json` 与逐课 JSON；Vite 环境下按需加载。 |
| `src/client/pages/LessonPage.tsx` | 课程页、演示步进与「去练习」；`DemoBlock` 是本文件内部组件。 |
| `src/client/pages/LearnPage.tsx` | 章节目录与会话内进度。 |

命名：`DemoBlock` 为 `LessonPage.tsx` 内部组件，不单独成档；`demoFrames`、`loadLesson` 为新增名字，项目内无同名先例（checked, none found）。

文件分档：实测无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案。

## 7. 验收对照

| 需求 | 落点 |
|---|---|
| F2.1 每课可读讲解、看到走法演示 | 课程页正文 + `LessonPage.tsx` 内的演示步进 |
| F2.2 三章 22 课全部可跑 | `content/lessons/` 课文件 + 内容测试 |
| F2.3 每课局面经引擎验证 | `test/content.test.ts` 逐课跑 `validateLessonContent` |
| 第三章每课关联一道对弈题 | 见 `docs/design/modules/missions.md` §2 |

## 8. 集成测试设计

起点：`test/RTM.md` 的「教学」故事。本批新增 F2-1 一行；此前只有对弈行 F1-1，不破坏、不冗余。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F2-1 | 课程目录 → 课程页 → 棋盘演示 | 进入课程页读到讲解；点「下一步」后棋盘走出该步 | 打开页面 → 课程 | F2.1 |

实现：`test/integration/learn.test.tsx`。呼应上面的 F2.2 / F2.3 是内容自证，不是集成用例，不进 RTM。
