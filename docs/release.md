# 发布手册

v1 是纯静态站点：`npm run build` 产出的 `dist/` 直接扔到任意静态托管就能跑。没有服务端依赖，联机对战的服务是独立进程，不在这次发布范围内。

## 0. 本地试用

| 方式 | 命令 | 能用到什么 |
|---|---|---|
| 开发态 | `npm run dev` | 改代码即时生效。**没有安装与离线**——service worker 只在生产构建注册，开发态注册会和热更新抢缓存 |
| 完整版 | `npm run build` 然后 `npm run preview` | 全部功能，含安装与离线。验收与试用都走这一条 |
| 联机对战 | 另开终端 `npm run dev:server` | 联机页需要它；单机对弈、人机、课程、练习、棋谱都不需要 |

棋谱、课程进度、当前对局存在浏览器 localStorage，关页重开能接上。

手机试用：`npm run preview -- --host` 会把局域网地址打出来，手机能玩，但**装不了、也没有离线**——浏览器只在 HTTPS 或 `localhost` 下启用 service worker，局域网 IP 不算安全上下文。要在手机上看到完整 PWA，得发到 HTTPS（第 3 节），或者在电脑的 DevTools 设备模拟里看（那里的 service worker 是正常的）。

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

## 2.5 单文件版（双击即用）

```bash
node scripts/build-standalone.mjs   # 产物是 standalone/index.html 一个文件（样式与脚本内联）
```

双击 `standalone/index.html` 就能玩，不需要任何服务器——整个应用就是那一个 HTML（约 370 KB）。它与正式构建的三处差别：

- **IIFE 经典脚本 + 全部内联**：`file://` 页面的 origin 是 null，`type="module"` 会被 CORS 拦下；脚本与样式因此直接写进 HTML。
- **人机改走主线程**（`src/client/ai/inline-worker.ts`）：浏览器不给 `file://` 页面建 Worker。代价是高手档思考期间界面会卡住几秒。
- 不注册 service worker、不带 manifest 与图标：`file://` 下 PWA 安装与离线本就不成立。

联机对战在单文件版里仍然不可用（要 WS 服务，见台账 #13）。

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

## 4. 部署到 GitHub Pages

站点是纯静态产物（`dist/`），GitHub Pages 直接托管；构建与发布由 `.github/workflows/pages.yml` 完成：推送 `main` 或手动触发 → `npm ci` → `npm run check` → `npm run build` → 上传 `dist/` 并发布。跑不过闸门就不发。

**路径口径**：Pages 的项目站点挂在 `/<仓库名>/` 下，所以构建用相对 base（`vite.config.ts` 里 `base: command === 'build' ? './' : '/'`）。三处跟着走：`index.html` 的静态资源用 `%BASE_URL%`；`public/manifest.webmanifest` 的 `start_url` / `scope` / 图标用相对路径；`public/sw.js` 以 `self.registration.scope` 为部署根拼所有缓存键。写死 `/assets`、`/sw.js`、`/` 会在子路径下全套 404。

**首次启用**（只做一次）：

1. 在 GitHub 建仓库并推上去：`git remote add origin git@github.com:<用户名>/<仓库名>.git && git push -u origin main`。
2. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
3. 回到 Actions 看「部署到 GitHub Pages」这一趟跑完，站点地址是 `https://<用户名>.github.io/<仓库名>/`。

**这套静态部署没有的**：联机对战需要的 WebSocket 服务（`npm run dev:server`）不在 Pages 上，页面上点位「创建房间 / 随机匹配」会连不上 `/ws`——见台账 #13。人机、本地对弈、课程、练习、棋谱、规则全部可用。
