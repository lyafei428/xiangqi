# 发布手册

v1 是纯静态站点：`npm run build` 产出的 `dist/` 直接扔到任意静态托管就能跑。没有服务端依赖，联机对战的服务是独立进程，不在这次发布范围内。

## 1. 发版前

| 步骤 | 命令 | 通过标准 |
|---|---|---|
| 类型与单测 | `npm run typecheck` | 无输出错误 |
| 引擎与逻辑单测 | `npm test` | 全绿 |
| 前端集成 | `npm run test:ui` | 全绿 |
| 三条一起 | `npm run check` | 退出码 0 |
| 三端与性能读数 | 一个终端 `npm run preview`，另一个 `node scripts/acceptance.mjs` | 退出码 0；慢档自证也跑一次 `--self-test` |

三端读数覆盖：格宽 ≥ 39.95px、首屏请求 ≤ 6、4G 快档首屏 LCP < 2s、CLS < 0.05、缩放不丢状态、单步 < 16ms、触摸点选与拖动。

## 2. 版本与缓存

`package.json` 的 `version` 与 `public/sw.js` 的 `CACHE` 绑定：缓存名必须是 `xiangqi-<version>`，`test/pwa.test.ts` 会断言这条。

发版流程因此只有一处要改：

1. 改 `package.json` 的 `version`；
2. 同步 `public/sw.js` 里 `const CACHE = 'xiangqi-<同一个版本>'`；
3. `npm run check`——缓存名与版本不一致会直接把用例打红。

为什么绑在一起：缓存名不变，`activate` 就认为旧缓存还有效，用户会一直跑上一版；两处手改一定会漏一处。

## 3. 构建与部署

```bash
npm run build          # 产物在 dist/
```

`dist/` 是完整产物，直接部署即可。托管侧只需要两条：

- **hash 路由**：所有路径回落到 `index.html`（`#/play`、`#/rules` 这些都在 hash 里，服务器不需要额外配置路由）。
- **`/assets/*` 用长缓存**：文件名带内容哈希，可以 `immutable`。

`index.html` 与 `sw.js` 不要长缓存——前者决定加载哪一版产物，后者决定缓存怎么换。

## 4. 发版后自检

| 检查 | 怎么做 | 通过标准 |
|---|---|---|
| 页面能开 | 打开线上首页，走一着 | 棋盘出现，走子生效 |
| 规则页 | 导航点「规则」 | 八行判罚可见 |
| 安装 | 浏览器地址栏/菜单里的「安装」 | 可安装，装完是全屏 |
| 离线 | 在线打开一次 → 关掉网络 → 刷新 | 棋盘照常出现（不是白屏） |
| 版本 | DevTools → Application → Cache Storage | 只有一个 `xiangqi-<当前版本>` |

离线这一条必须在**发版后**做一次：`sw.js` 换了新缓存名时，旧缓存会在 `activate` 里删掉，用户第一次访问会重新预缓存，这一步最容易被发版打坏。

## 5. 回滚

产物是静态文件，回滚 = 把上一版 `dist/` 重新部署。

注意 `sw.js` 的 `CACHE` 已经是新版本时，回滚要同时把 `CACHE` 改回旧名，否则老版本产物会被新缓存名接下，用户看到的还是新代码。
