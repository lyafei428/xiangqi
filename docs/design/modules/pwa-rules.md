# PWA 安装与规则页模块

M7 的两件交付：把应用变成可安装的 PWA（FR-4.5），给出一页明示 v1 判罚口径的规则页（需求 §4 要求「在规则页明示采用哪一版」）。

Closest precedent: `docs/design/modules/app-shell.md` — 路由、导航与页面清单由它拥有；实现坐标是 `src/client/shell/routes.ts` 的 `Route` 联合与 `src/client/App.tsx` 的导航数组。本模块只在它的路由表里加一行 `#/rules`、在导航里加一项，不另起一套壳。偏离：安装与离线是壳之外的一层（manifest / 图标 / service worker），app-shell 没有对应位置，因此单独成档。

Survey evidence: 已核对 `docs/requirements/xiangqi.md`（F4.5、§4 判罚口径、§6 以 `npm run dev` 为验收）、`docs/design/architecture.md`（§7 性能预算、§8 里程碑 M7）、`docs/design/modules/app-shell.md`（路由与导航）、`index.html`（已有 `theme-color`，无 manifest 链接）、`vite.config.ts`（无 PWA 插件）、`package.json`（`build` / `preview` 已有）。

## 1. 范围

| 交付 | 验收 |
|---|---|
| Web App Manifest + 图标 | Chrome 应用面板判为可安装；安装后以独立窗口启动 |
| Service worker | 生产构建下注册；首访后断网重开仍能进对局页（预缓存含构建产物） |
| 规则页 `#/rules` | 明示 v1 八条判罚，且写明「长捉、一将一闲不在 v1 范围内」 |

不做：离线写入、后台同步、推送、跨设备同步、安装引导弹窗。

## 2. Manifest 与图标

`public/manifest.webmanifest`：

| 字段 | 值 | 为什么 |
|---|---|---|
| `name` / `short_name` | 中国象棋 / 象棋 | 桌面安装用全名，主屏图标下用短名 |
| `start_url` | `/` | 对局页是默认页，hash 路由不需要服务器配合 |
| `scope` | `/` | 所有路由都在壳内，安装后不再跳浏览器标签 |
| `display` | `standalone` | 隐藏地址栏、全屏可用；`fullscreen` 会连状态栏一起吞掉，对棋类没必要 |
| `theme_color` / `background_color` | `#e9e0cf` | 与 `index.html` 里已有的 `theme-color` 同一个值，启动闪屏不跳色 |
| `icons` | 192 / 512（`any`）+ 512（`maskable`） | Chromium 的安装条件要求至少 192 与 512 两个尺寸 |

图标用脚本生成后提交为静态文件：`scripts/pwa-icons.mjs`（node 内置 `zlib`，无第三方依赖）画一张「棋盘 + 红圆」的 512 见方母图，再缩出 192、512 与居中的 maskable 512（内容放在中心 80% 安全区内）。另出 180 的 `apple-touch-icon.png` 给 iOS。

`index.html` 增三行：`<link rel="manifest" href="/manifest.webmanifest">`、`<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`、`<link rel="icon" type="image/png" href="/icons/icon-192.png">`。

## 3. Service worker

`public/sw.js`（纯静态，不经打包，避免与 Vite 的哈希文件名耦合）。

| 时机 | 行为 |
|---|---|
| `install` | 预缓存 `/`、`/manifest.webmanifest` 与图标；再读回缓存里的 `/`，用正则取出 HTML 中的 `/assets/*.js|css` 一并预缓存；再从主包里扫一层 chunk（人机页的 worker 就在这层）；最后 `skipWaiting()` |
| `activate` | 删掉名字不等于当前缓存名的旧缓存；`clients.claim()` |
| `fetch` | 只处理同源 GET。导航请求：先网络，成功就回写缓存、**并把新壳里的产物补齐**（否则发版后旧产物与新壳错位，下次断网就是白页）；失败回缓存里的 `/`。其余：先缓存，未命中再网络并写入缓存 |

为什么 install 要扫 HTML 取产物名：带哈希的文件名只有构建知道；只靠运行时缓存的话，首访那一次 JS/CSS 在这个 worker 接管页面之前就取完了，进不了缓存——断网刷新只能拿回壳、脚本全落空，页面是白页。预缓存清单从 HTML 里现读，就不需要构建插件，也不怕文件名变。

为什么还要扫主包：只在 JS 里引用的 chunk（`new Worker(new URL('./worker.ts', import.meta.url))` 打出来的那一包）不会出现在 HTML 里，只扫 HTML 会让「首访后断网进人机页」搭不上 worker 脚本。

版本常量 `CACHE = 'xiangqi-v1'`，发版时改这一行；其余字符串不动。

注册点：`src/client/main.tsx`，只在生产构建且非单文件版时注册（`import.meta.env.PROD && import.meta.env.VITE_STANDALONE !== '1'`）。开发态不注册的复现：在 `npm run dev` 里也注册 `/sw.js`，改一处样式，页面拿到的仍是缓存里的旧 CSS——HMR 的更新到不了页面。

场景与复现：

- 安装：`npm run build && npm run preview` 打开 `http://localhost:4173/`，Chrome 地址栏出安装图标、DevTools → Application → Manifest 显示可安装（复现命令写在 `docs/batches/M7-pwa-rules.md` §5）。
- 离线：`npm run build && npm run preview` 首访后断网刷新，页面仍出棋盘与导航（首次加载就把 JS/CSS 预缓存进去了）；控制台无未捕获的模块加载失败。

## 4. 规则页

路由 `#/rules`，页面 `src/client/pages/RulesPage.tsx`；导航第 7 项「规则」（在现有六项之后）。放导航而不放页脚：手机上没有页脚滚动到底的习惯，规则是随时要查的参照物，多一个纯文字入口不违反 F5.1（没有装饰控件，只有一条链接）。

页面由三段正文与一节进阶阅读组成：

1. **走法要点**：马走日、象走田不过河、炮隔子吃、兵过河可横走、将帅不出九宫且不可照面——每条一句，不展开教学（课程页已有 22 课）。
2. **判罚口径**：八行表格（将死 / 困毙 / 长将 / 三次重复 / 连续 60 回合（120 着）无吃子 / 超时 / 认输 / 和棋同意），逐条与 `docs/requirements/xiangqi.md` §4 对齐。
3. **不在 v1 范围内**：长捉、一将一闲等复杂判罚明确写「按上表简化处理」。
4. **进阶阅读**：两篇长文，默认收起（`<details>`），点了才展开。规则页的主任务是查判罚，长文不能抢位置。

| 篇 | 解决什么 | 内容骨架 |
|---|---|---|
| 《对局中如何提升自己》 | 「下了很多盘但不长进」 | 复盘三步法（先找自己的漏着 → 再看对方意图 → 最后找更好的着）、每盘只定一个目标、计算力从三步起、残局基本功优先于定式、定式记「为什么」、快棋靠模式慢棋靠计算、找强一点的对手、写下来才算学过 |
| 《看棋局的视角：把局面读成三笔账》 | 「不知道局面该看什么」 | 子力（账面差）、位置（能去哪里、有效着法）、先手（谁在逼谁、会过期）；吃子不是目的而是「让对方的子无效」；交换看剩余局面；何时简化何时复杂化；将帅安全与主动权一体两面；把视角接回界面上的每步胜率（它是结果，不是理由） |

内容以 `src/client/rules/content.ts` 的常量数组承载，页面只负责渲染；`test/rules-content.test.ts` 断言八条判罚的标题与判罚文案逐条存在、且「长捉」那句在「不在 v1 范围内」一节里。需求 §4 是唯一真相，改判罚口径要同时改需求档与本数组——两处文案由用例逐条对齐，改一处不改另一处会红。

## 5. 验收对照

| 需求 | 落点 |
|---|---|
| F4.5 可添加到主屏全屏运行 | manifest 的 192/512 图标 + `display: standalone`；`npm run preview` 实测安装 |
| F4.5 图标 | `public/icons/*`；maskable 版留安全区 |
| 需求 §4 规则页明示 | `#/rules` 的八行判罚表 + 「不在 v1 范围内」一节 |
| F5.2 首屏请求数 ≤ 6 | HTML + JS + CSS + 图标 + manifest = 5 ≤ 6（manifest 与图标在正常加载时就会取，不是只在安装时）；service worker 只缓存不新增首屏请求 |
| F5.8 规则页进阶阅读 | `#/rules` 底部的两篇 `<details>`：默认收起，点开可见每篇八节正文；正文不引用具体着法编号 | 打开页面 → 规则 → 点开任一篇 |
| F5.1 界面简约 | 规则页三段正文（走法要点、八行判罚表、不在 v1 范围内）+ 一节默认收起的进阶阅读；导航只多一项纯文字链接 |

## 6. 集成测试设计

起点：`test/RTM.md` 的「页面壳」故事。RTM 的 F4-2 行号已定（「| F4-2 | 规则页 |」），本批不改 RTM；入口「打开页面 → 规则」，业务结果「八条判罚逐条可见；写明长捉与一将一闲不在 v1 范围内」。

F4-1 不破坏：该行断言的是切页后棋盘与记谱保持原样，不涉导航项数；`test/integration/navigation.test.tsx` 里也没有按导航链接数与文字断言。

| 行 | 验的交互 | 用户可见结果 | 入口 | 需求 |
|---|---|---|---|---|
| F4-2 | 导航点「规则」 | 规则页列出八条判罚；「不在 v1 范围内」一节写明长捉与一将一闲 | 打开页面 → 规则 | F4.5、需求 §4 |

实现分工：

- `test/rules-content.test.ts`：常量数组八条判罚、标题不重复、长捉那节的文案。
- `test/integration/rules.test.tsx`：点导航进规则页，断言表格八行与那句声明；再点「对弈」回得去。
- `test/routes.test.ts`：`#/rules` 往返。
- `test/pwa.test.ts`：读 `public/manifest.webmanifest` 与 `public/sw.js` 的文本断言——manifest 有 name/short_name/start_url/scope/display/icons 三个尺寸；`sw.js` 含 `install` / `activate` / `fetch` 三个监听与版本常量；`index.html` 引了 manifest 与 apple-touch-icon。

命令：`node --test test/pwa.test.ts test/rules-content.test.ts test/routes.test.ts`；前端集成在收口时跑 `npx vitest run test/integration/rules.test.tsx`。

## 7. 文件划分

| 文件 | 职责 |
|---|---|
| `public/manifest.webmanifest` | 安装清单。 |
| `public/sw.js` | service worker：预缓存 / 旧缓存清理 / 离线回退。 |
| `public/icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png` | 图标，脚本生成后提交。 |
| `scripts/pwa-icons.mjs` | 图标生成脚本（node 内置 zlib，无依赖）。 |
| `src/client/main.tsx` | 生产构建下注册 service worker。 |
| `src/client/pages/RulesPage.tsx` | 规则页。 |
| `src/client/rules/content.ts` | 判罚与走法要点常量。 |
| `src/client/rules/rules.css` | 规则页样式，由页面自己 import；不进 `src/client/app.css`。 |
| `src/client/shell/routes.ts` | 加 `rules` 路由。 |
| `src/client/App.tsx` | 导航第 7 项与页面分派。 |
| `index.html` | manifest / 图标链接。 |
| `test/pwa.test.ts`、`test/rules-content.test.ts`、`test/integration/rules.test.tsx`、`test/routes.test.ts` | 用例。 |

文件分档结论：表内文件均未跨 500 行档，也没有 300 行以上的单函数——**本批不需要拆分方案**。样式落在自己的 `src/client/rules/rules.css`，不写进 `src/client/app.css`（后者只是 `@import` 入口）。

现有件检查：

- existing — `src/client/shell/routes.ts` 的 `parseHash` / `routeHash` 与 `Route` 联合，加一项即可；`test/routes.test.ts` 已有往返断言。
- existing — `index.html` 已有 `theme-color` 与 `viewport`，只补链接。
- existing — `#/rules` 与「规则」已在 `docs/design/modules/app-shell.md` 的路由表与导航清单；代码侧 `src/client/shell/routes.ts` 的 `Route` 联合有 `rules`，`href` 由同一处拼成 `#/rules`。
- `public/` 现有 manifest、`sw.js` 与四张图标；manifest 与图标的尺寸/用途写在 `docs/design/modules/pwa-rules.md` 的图标一节。
- existing：`public/manifest.webmanifest`、`public/sw.js` 与 `src/client/main.tsx` 的注册点都已在仓库内。
- none found：图标生成脚本在本仓没有先例；用 node 内置 `zlib` 自己写 PNG 编码，不引依赖。

## 8. 风险

- **开发态没有 service worker**：`npm run dev` 下只能验 manifest 与安装菜单，验不了离线。取舍写在 §3：宁可开发态没有离线，也不让 HMR 撞缓存。验收跑 `build + preview` 一次。
- **图标是生成的几何图形**，没有书法字。够用且可复现；要换成真字标属于设计资源，另开。
