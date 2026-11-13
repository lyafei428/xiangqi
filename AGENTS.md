# AGENTS.md — 中国象棋在线游戏

## 项目

浏览器、平板、手机三端通用的中国象棋应用，含对弈、教学、规则练习。规则引擎前后端共用，是唯一真相。

## 验证命令

```bash
npm run typecheck     # tsc --noEmit，类型检查
npm test              # node --test，引擎与纯逻辑单测
npm run test:ui       # vitest run，前端集成用例（jsdom）
npm run check         # 三者连跑
```

提交前 `npm run check` 必须全绿。测试文件在 `test/`，命名 `*.test.ts`；前端用例用 `*.test.tsx`（集成用例放 `test/integration/`），需求—测试矩阵在 `test/RTM.md`。

## 文档

| 层 | 位置 | 内容 |
|---|---|---|
| 需求 | `docs/requirements/` | 要什么、验收口径 |
| 设计 | `docs/design/` | 怎么实现、模块规格 |
| 模块 | `docs/design/modules/` | 单模块细节 |
| 批次 | `docs/batches/` | 一轮实现的执行记录 |
| 测试 | `test/RTM.md` | 需求—测试矩阵，集成用例索引 |

需求与设计文档只写"现在是什么"，不写历史。历史在 git 提交里。

## 代码约定

- TypeScript 严格模式，`noUncheckedIndexedAccess` 开启；引擎层禁止 `any`。
- `src/shared/` 零依赖：不 import 任何 npm 包，不碰 DOM，不碰 Node API。它要能在浏览器和 Node 里同时跑。
- 引擎函数是纯函数：不修改入参，返回新局面。`applyMove` 复制棋盘后改副本。
- 命名：类型用 PascalCase，函数用 camelCase，常量用 UPPER_SNAKE。
- 注释只写"为什么"，不写"是什么"。一段代码的决策理由比它的行为更值得记录。
- 前端不引入 UI 组件库、CSS-in-JS 运行时、状态管理框架。

## 规则判罚口径

见 `docs/requirements/xiangqi.md` §4。v1 简化判罚：长将判负、三次重复判和、60 回合无吃子判和。困毙判负而非和棋。
