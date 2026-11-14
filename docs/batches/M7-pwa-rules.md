# 2026-11-14 · M7 PWA 与规则页
> 六段，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 每段只有一个作者：作者的段可 `append` 加内容、可就地改（`edit`，§4.19）；非作者一概拒。
> 编制：主 agent · 2026-11-14 · 来源 = 用户「按建议」——M7（PWA 安装 + 规则说明页）开工，见架构 §8 里程碑。
> 台账 = #9（xiangqi · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口（M7 PWA 与规则页（F4.5））
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

用户提问「接下来做什么」，我按架构 §8 盘了剩余项：M0–M6 已核销，只剩 M7「PWA 安装 + 规则说明页」；`grep manifest / serviceWorker` 零命中、`src/client/pages/` 无规则页，两项都确实没做。给了三条路——M7、先做三端与性能验收补齐、引擎增强（已写在「不做」里）——顺位建议是「M7 → 再补一次三端/性能验收」。用户回「按建议」。

本批做 M7 两件：可安装的 PWA（manifest + 图标 + service worker + 生产注册）与规则页 `#/rules`（八条判罚口径 + 不在 v1 范围内的声明）。导航从六项变七项，多出的一条是纯文字「规则」。

已知取舍：开发态不注册 service worker（HMR 与缓存打架），验收走 `npm run build && npm run preview` 一次；需求 §6 的日常验收仍是 `npm run dev`，那边能验 manifest 与安装菜单。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**任务**

M7：PWA 安装与规则说明页。验收是架构 §8 的两句——「主屏安装并全屏运行」「规则页明示 v1 判罚口径」。

**设计**

`docs/design/modules/pwa-rules.md`：manifest 字段与图标规格、service worker 的三个事件与缓存策略、规则页三段内容与路由导航、验收对照、测试分工、文件划分。

**受影响文件**

| 文件 | 动作 |
|---|---|
| `public/manifest.webmanifest`、`public/sw.js`、`public/icons/*` | 新增 |
| `scripts/pwa-icons.mjs` | 新增（生成图标） |
| `index.html` | 加 manifest 与图标链接 |
| `src/client/main.tsx` | 生产态注册 service worker |
| `src/client/pages/RulesPage.tsx`、`src/client/rules/content.ts` | 新增 |
| `src/client/shell/routes.ts`、`src/client/App.tsx` | 加路由与导航项 |
| `test/pwa.test.ts`、`test/rules-content.test.ts`、`test/integration/rules.test.tsx`、`test/routes.test.ts` | 新增或扩展 |

**边界**

不做：离线写入、后台同步、推送、安装引导弹窗、跨设备同步、真字标图标。

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

评审目标：`docs/design/modules/pwa-rules.md`（M7 PWA 安装与规则页）。

对照文档：`docs/design/modules/app-shell.md`、`docs/design/architecture.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。

文档地图：harness 未提供独立 document map，按 `docs/design/architecture.md` §4「文档地图」核对归属。

归属结论：`docs/design/modules/pwa-rules.md` 拥有「PWA 安装与离线、规则页」，成档位置正确，未碎片化。

已通过项：设计档存在；closest precedent 有坐标与偏离理由；survey evidence 有公开源清单；集成测试节以 RTM 为起点；验收命令按改动面文件而非全量套件。

| # | 类别 | 严重度 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | 可行性 / 验收 | 🔴 | Service worker 按现设计交付不了它自己声明的离线场景。`install` 只「预缓存 `/`、`/manifest.webmanifest` 与三个图标」，其余资源靠「其余：先缓存，未命中再网络并写入缓存」；而注册点在「注册点：`src/client/main.tsx`，只在 `import.meta.env.PROD` 下」——首访的 JS/CSS 全部在这个 worker 控制页面之前取完，进不了运行时缓存。平台语义（worker 只接管激活之后开始的加载；平台行为，仓库内不可验证，标 unverified）推出：断网刷新只拿回预缓存的 `/`，带哈希的 JS/CSS 请求全部落空，得到白屏而非「离线：同一地址首访后断网刷新，页面仍加载出棋盘与导航。」§1 承诺的「断网重开仍能进对局页」因此不成立。 | 二选一：(a) 预缓存覆盖构建产物——`vite.config.ts` 开 `build.manifest`，构建后用脚本把 `dist` 资源名注入复制后的 `sw.js`；(b) 从 §1/§3 撤掉离线交付，只留 manifest + 图标（F4.5 验收口径是「PWA manifest + 图标」，不要求 worker）。任一选择都要写明导航响应是否回写缓存的 `/`。 |
| 2 | 文档归属 | 🔴 | 同一个机制（顶部导航的项集合）在拥有它的档里有两份不同的生效描述。`docs/design/modules/app-shell.md` 写「顶部一条导航：对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱 / 规则」，同档验收对照又写「导航六项（对弈 / 人机 / 联机 / 课程 / 练习 / 棋谱），不附加装饰控件」；本设计再加第三份「导航第 7 项「规则」（原六项之后）」，而同档路由表已含「\| `#/rules` \| 规则说明 \|」。读者无法判断导航到底是六项还是七项，而这正是本改动要动的那个物件。 | 把 `docs/design/modules/app-shell.md` 的 F5.1 验收行同步到七项集合，让拥有该主题的档只留一份导航描述；本设计 §4 的「原六项之后」在该行改好后再定稿。 |
| 3 | 分支出处 | 🔴 | 本设计新增的唯一按状态分支是开发态 / 生产态注册（「只在 `import.meta.env.PROD` 下」），其场景只给了一个通用论断「开发态不注册——HMR 与缓存会在同一条 URL 上互相打脸」，既没有一条观测，也没有复现命令。（规则页本身无分支，其余分支是 SW 固有事件。）按判定口径，这属于守着场景未发生过的分支。 | 补一行复现路径即可成交付：`npm run dev` 下注册 `/sw.js`，改一处样式，HMR 更新到不了页面（响应来自缓存）。有路径则这条分支可验证、可被后来人删除。 |
| 4 | 现有件检查 | 🟡 | 三条答复里有两条与仓库状态不符。其一「existing — `public/` 目录（Vite 原样拷贝）」：仓库根下没有 `public/`（glob 零命中），`publicDir` 目前无物可拷。其二「`#/rules`、`规则` 页，仓库内无同名先例（`grep` 零命中）」：`docs/design/modules/app-shell.md` 路由表已列「\| `#/rules` \| 规则说明 \|」、导航清单已列「规则」。 | 按件分写：`none found: public/ 目录尚不存在，需新建`；`existing: #/rules 与「规则」已在 app-shell 路由表与导航清单，代码侧 Route 联合尚无 rules`；manifest / sw / 图标脚本保持 none found。 |
| 5 | 分档 / 受影响文件表 | 🟡 | §7 表里没有样式表条目，而全仓唯一样式表是 `src/client/app.css`（`src/**/*.{css,scss}` 仅一处命中），实测 1290 行，已越过 800 行硬档。「无文件跨 500 行档，无 300+ 行单函数，不需要拆分方案」只对所列表的文件成立；规则页一旦要样式就落在这个越档且无拆分方案的文件里。 | 明确写一句：规则页是否新增 CSS。要新增，就把 `src/client/app.css` 列进受影响文件表并给出实测档案与拆分方案；不新增，就写明「规则页不加样式」，让分档结论覆盖整次改动。 |
| 6 | 验收命令 | 🟡 | 「前端集成在收口时跑 `npx vitest run test/integration/rules.test.tsx test/routes.test.ts`」把 node:test 文件塞进了 vitest。`vitest.config.ts` 的收集面是「include: ['test/**/*.test.tsx']」，`test/routes.test.ts` 首行是「import test from 'node:test';」，项目用「"test": "node --test \"test/**/*.test.ts\""」跑它。它同时不在「命令：`node --test test/pwa.test.ts test/rules-content.test.ts`」里——被改的路由函数那个往返断言因此在收口时不会被执行。 | 把 `test/routes.test.ts` 移到 `node --test` 那条命令里，vitest 那条只留 `.tsx`。 |
| 7 | 集成测试增量 | 🟡 | §6 说「起点：`test/RTM.md` 的「页面壳」故事。新增一行 F4-2」，只答了「缺哪行」，没答另两个增量问题。一是新增第七个导航项是否影响既有行（RTM 的「\| F4-1 \| 切页不丢对局 \|」；其实现 `test/integration/navigation.test.tsx` 不按导航项数断言——对其 grep `nav|links|toHaveLength` 零命中，但这条结论设计里没写）。二是 RTM 是否本批要改（RTM 已带「\| F4-2 \| 规则页 \|」且「用例实现：…`test/integration/rules.test.tsx`（F4-2）」）。 | §6 补两句：F4-1 不破坏及其理由；RTM 的 F4-2 行号已定、本批不再改 RTM。 |
| 8 | 性能预算口径 | 🔵 | 「图标与 manifest 只在安装时取，首屏仍是 HTML + 一个 JS + 一个 CSS」不成立：manifest 与本设计新加的 `<link rel="icon">` 在正常加载时就会取。总数仍是 5 ≤ 6，F5.2 不破，但理由是错的。 | 按实际改口径：HTML + JS + CSS + 图标 + manifest = 5，≤ 6。 |
| 9 | 内容漂移 | 🔵 | 八条判罚现在有两处（需求 §4 与 `src/client/rules/content.ts`），设计自认这条依赖「靠用例里的逐条标题兜底」——标题在、判罚文案改了照样过，例如把「连续 60 回合（120 着）」写成「六十回合无吃子」不会被发现。 | 用例再断言每行的判罚文案（或行数 + 每行判罚关键词），让需求 §4 与页面无法静默漂移。 |
| 10 | 文档卫生 | 🔵 | §5 写「规则页只有正文与一张表」，§4 却规定三段（走法要点、八行判罚表、不在 v1 范围内）——用 F5.1 论证的那一行低估了它要论证的页面。 | 把 §5 的 F5.1 行改成三段口径；若保留「走法要点」，就写明这是超出需求 §4 要求的唯一自愿增量。 |

计数：🔴 3 · 🟡 4 · 🔵 3。

VERDICT: changes-required

### 轮次 2（评审子代理）

第 2 轮复核目标：`docs/design/modules/pwa-rules.md`（M7 PWA 安装与规则页）。

对照：`docs/design/modules/app-shell.md`、`docs/design/architecture.md`、`docs/requirements/xiangqi.md`、`test/RTM.md`。

结论：上轮 3 条 🔴、4 条 🟡、3 条 🔵 全部核对为已修；新增 1 条 🟡、2 条 🔵，均不阻塞。

| # | 原# | 文件 | 严重度 | 状态 | 说明 |
|---|-----|------|--------|------|------|
| 1 | 1 | docs/design/modules/pwa-rules.md | 🔴 | Fixed | install 改为「预缓存 `/`、`/manifest.webmanifest` 与图标；再读回缓存里的 `/`，用正则取出 HTML 中的」产物一并预缓存；离线场景同步改写为「首访后断网刷新，页面仍出棋盘与导航（首次加载就把 JS/CSS 预缓存进去了）」；并补「导航请求：先网络（成功就回写缓存）」 |
| 2 | 2 | docs/design/modules/app-shell.md | 🔴 | Fixed | 验收对照已从「导航六项」改为七项集合，与同档 §3 的导航清单逐字一致 |
| 3 | 3 | docs/design/modules/pwa-rules.md | 🔴 | Fixed | 补了复现路径：「开发态不注册的复现：在 `npm run dev` 里也注册 `/sw.js`，改一处样式，页面拿到的仍是缓存里的旧 CSS」 |
| 4 | 4 | docs/design/modules/pwa-rules.md | 🟡 | Fixed | 现有件检查按件重写：`public/` 记为「尚不存在（glob 零命中），需新建」；`#/rules` 记为已在 app-shell 路由表与导航清单 |
| 5 | 5 | docs/design/modules/pwa-rules.md | 🟡 | Fixed | 文件表新增 rules.css 条目，并写明 app.css 实测 1290 行已越 800 行硬档、本批不动且另立样式表 |
| 6 | 6 | docs/design/modules/pwa-rules.md | 🟡 | Fixed | `test/routes.test.ts` 移入 `node --test` 命令，vitest 只跑 `.tsx` 集成用例 |
| 7 | 7 | docs/design/modules/pwa-rules.md | 🟡 | Fixed | 补「RTM 的 F4-2 行号已定」与本批不改 RTM，并补「F4-1 不破坏」及其理由；对 `test/RTM.md` 复核成立 |
| 8 | 8 | docs/design/modules/pwa-rules.md | 🔵 | Fixed | F5.2 改为「HTML + JS + CSS + 图标 + manifest = 5 ≤ 6（manifest 与图标在正常加载时就会取，不是只在安装时）」 |
| 9 | 9 | docs/design/modules/pwa-rules.md | 🔵 | Fixed | 用例改为断言「八条判罚的标题与判罚文案逐条存在」 |
| 10 | 10 | docs/design/modules/pwa-rules.md | 🔵 | Fixed | F5.1 行改为「规则页三段：走法要点、八行判罚表、不在 v1 范围内」 |
| 11 | (new) | docs/design/modules/ai.md | 🟡 | New | 第 2 条整改的下游残留：「导航六项之第 2 位（…见 `docs/design/modules/app-shell.md` §3）」与所指 §3 的七项不一致；该档不在本轮评审面，只报告不改。不阻塞 |
| 12 | (new) | docs/design/modules/pwa-rules.md | 🔵 | New | §6 引述的业务结果漏了「一将一闲」（同节表格行与 RTM 都有）；§4 行名「六十回合无吃子」漏了需求 §4 的「（120 着）」 |
| 13 | (new) | docs/design/modules/app-shell.md | 🔵 | New | 开头「承载对弈、人机、联机、课程、练习、棋谱六块业务」与七项导航不矛盾（规则页不是业务块），措辞可选调整 |

计数：🔴 0 · 🟡 1 · 🔵 2

VERDICT: pass

## §4 用户批准（主 agent）

用户于 2026-11-14 08:18 在本会话回「收口」，批准本批交付，授权写 §6、核销台账 #9 并提交。

批准范围：M7 的两件交付——可安装的 PWA（manifest / 图标 / service worker / 生产态注册）与规则页 `#/rules`（导航第 7 项）。不含离线写入、推送、安装引导弹窗、跨设备同步。

## §5 实施记录（实施者：主 agent ∥ coder）
**状态行**：实施完成（安装半边完成，规则页半边不在本笔）



实施者：coder 子代理 · 2026-11-14 · 范围 = 本批 M7 的安装半边（图标 / manifest / service worker / 生产注册 / 文本用例），规则页半边不在本笔。

**改动文件**

| 文件 | 动作 | 对外形状 |
|---|---|---|
| `scripts/pwa-icons.mjs` | 新增 | 命令行脚本，无导出；`node scripts/pwa-icons.mjs` 写四张 PNG 并逐行打印文件名 / 尺寸 / 字节数 |
| `public/icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png` | 新增（脚本生成） | 8 位真彩 RGB，无 alpha |
| `public/manifest.webmanifest` | 新增 | 设计档 manifest 表的八个字段，无增减 |
| `public/sw.js` | 新增 | 纯静态，`install` / `activate` / `fetch` 三个监听；常量 `CACHE = 'xiangqi-v1'` |
| `index.html` | 改 | 加 manifest、icon、apple-touch-icon 三条链接 |
| `src/client/main.tsx` | 改 | 渲染之后按生产态注册 `/sw.js` |
| `test/pwa.test.ts` | 新增 | 8 个用例，覆盖图标 IHDR、manifest 字段与图标清单、sw 三个监听与扫产物正则、index.html 链接、注册点生产态判断 |

**验证读数**

- `node scripts/pwa-icons.mjs` 退出码 0，输出：icon-512.png 512x512 5627 字节 · icon-192.png 192x192 1887 字节 · icon-maskable-512.png 512x512 5461 字节 · apple-touch-icon.png 180x180 1800 字节。四张的 IHDR 尺寸、chunk CRC、IDAT 解压后行数与 `高 ×（宽×3+1）` 全部吻合，四张都过 1KB。
- `node --test test/pwa.test.ts`：8 通过 0 失败。
- `npm test`（全量）：215 通过 0 失败。
- `npm run typecheck`：退出码 0。
- `npm run build`：退出码 0；产物 `dist/manifest.webmanifest` 585 B、`dist/sw.js` 3247 B、`dist/icons/icon-192.png` 1887 B，四张图与清单都在。
- `vite preview` 实跑一轮：`/manifest.webmanifest` 回 `application/manifest+json`、`/sw.js` 回 `text/javascript`、四张图回 `image/png`，全部 200。把 sw.js 里的扫产物正则取出来跑构建后的真实 HTML，认出 `/assets/index-DU1TFNKp.js` 与 `/assets/index-HOntuoHk.css` 两条——install 的预缓存分支在真产物上能取到脚本与样式。

**与设计档的偏差**

- 无（按设计档的 manifest 表、三个事件表、图标规格逐条实现）；下面四条是设计档没写死、由实现定的细节，一并记明：manifest 图标回写的缓存键固定取 `/`（设计档只说「成功就回写缓存」；hash 路由下所有导航拿到的是同一份 HTML，键取 `/` 才能让失败回退读到）；`activate` 删的是「名字不等于当前 CACHE」的全部缓存（设计档说「版本号不匹配的旧缓存」，同源下没有别的缓存，两种写法等价）；注册点多两个细节——`'serviceWorker' in navigator` 判断与 `load` 事件后注册（前者避免不支持的环境抛错，后者让预缓存不与首屏资源抢带宽）；图标脚本额外做 3×3 超采样与 5% 外边距，否则线与圆全是锯齿、外侧网格线被切半。

**复现**

- 安装：`npm run build && npm run preview` 后开 `http://localhost:4173/`，Chrome 地址栏出安装图标，DevTools → Application → Manifest 显示可安装。
- 离线：同一地址首访成功后断网刷新，页面仍出棋盘与导航，控制台无未捕获的模块加载失败。

**未做（留给收口）**

浏览器里的安装判定与断网刷新要真跑一次 `npm run build && npm run preview`，本笔只做到 HTTP 层（资源可取、类型正确、正则认得出产物），DevTools → Application 的可安装判定与断网实测没有做。

实施者：coder 子代理 · 2026-11-14 · 范围 = 本批 M7 的规则页半边（内容常量 / 页面 / 样式 / `#/rules` 路由 / 导航第 7 项 / 三份用例），安装半边不在本笔。

**改动文件**

| 文件 | 动作 | 对外形状 |
|---|---|---|
| `src/client/rules/content.ts` | 新增 | 导出 `MOVE_POINTS`（`RuleSection`，5 条）、`PENALTY_TABLE`（`PenaltyTable`，8 行）、`OUT_OF_SCOPE`（`RuleSection`） |
| `src/client/pages/RulesPage.tsx` | 新增 | `RulesPage()` 无 props；自己 `import '../rules/rules.css'` |
| `src/client/rules/rules.css` | 新增 | 规则页样式，77 行 |
| `src/client/shell/routes.ts` | 改 | `Route` 加 `{ name: 'rules' }`；`parseHash` 认 `/rules`；`routeHash` 回 `#/rules` |
| `src/client/App.tsx` | 改 | NAV 第 7 项「规则」；`rules` 时渲染 `RulesPage` |
| `test/rules-content.test.ts` | 新增 | 5 个用例 |
| `test/integration/rules.test.tsx` | 新增 | 1 个用例（F4-2） |
| `test/routes.test.ts` | 改 | 加 1 个路由用例，往返表加 `#/rules` |

**验证读数**

- `npm run typecheck`：退出码 0。
- `node --test test/rules-content.test.ts test/routes.test.ts`：13 通过 0 失败。
- `npx vitest run test/integration/rules.test.tsx`：1 通过。
- `npm run check`：退出码 0；node 221 通过 0 失败（基线 215，多 6），vitest 10 个文件 53 个用例全过（基线 52，多 1）。
- `grep -c "规则" src/client/App.tsx src/client/shell/routes.ts`：1 / 1。
- `npm run build`：退出码 0，CSS 单包 15.06 kB——规则页样式并进同一个 CSS 请求，首屏请求数不变。
- 真浏览器走一遍（`vite preview` + 内置浏览器）：七项导航 + 规则页三段 + 八行表格 + 「不在 v1 范围内」两条都在；点「对弈」回棋盘、点「规则」回来。桌面 1414px 下 `.rules-inner` 880 居中，页面可滚动到底。

**与设计档的偏差**

- 无：三段内容、导航第 7 项、路由、样式另立 `rules.css`、测试分工都按设计档。实现细节三条，一并记明：
  - `.page.page-rules` 用了双类名。实测打包后 `rules.css` 排在 `app.css` 之前（`main.tsx` 第 3 行先 import `App.tsx`、第 4 行才 import `./app.css`），单类名会被 `.page{display:flex}` 按住，正文缩成 530px；双类名把权重抬到 0,2,0，不再依赖文件顺序。
  - 判罚行的 `title` 取需求 §4「情形」列全文（含括号注释）。设计档 §4 用的短名（如「和棋同意」）是同义省略，需求档是唯一真相，用例直接与需求档逐行 deepEqual。
  - `rules.css` 77 行，设计档预估「40 行内」。多出来的是表格与窄屏两段，没有再加别的。

**未做**

- 375px 窄屏没经真浏览器视口验证：内置浏览器改不了视口宽度。按实测字宽推（每个导航链接 50px、字距 4px、品牌 68px），七项在 ≤767px 媒体查询下合计约 472px（六项时约 418px），超出 375px 后靠 flex 压缩与 CJK 折行落在 48px 高的导航条里。这是既有紧绷状态被加宽一项，不是本笔引入；`app.css` 不在本笔范围，要处理另开。

**实施记录（主 agent，代码评审 #14 之后的六处整改）**

| 文件 | 改法 | 为什么 |
|---|---|---|
| `public/sw.js` | 抽出 `fillMissing` / `fillFromScripts`；`install` 与导航回写都走这两条；回写后把新壳里的产物补齐 | 评审 🟡①：换了壳不补产物，发版后先在线刷一次再断网就是白页 |
| `public/sw.js` | `fillFromScripts` 从缓存里的主 JS 文本再扫一层 `/assets/*.js` | 评审 🟡②：人机 worker 是只在 JS 里引用的 chunk，不在 HTML 里，只扫 HTML 会让离线人机页搭不上脚本 |
| `src/client/main.tsx` | 注册加 `.catch(console.warn)` | 评审 🔵④：注册失败要显式可见，别静默 |
| `test/pwa.test.ts` | CACHE 断言改成形状 `/const CACHE = 'xiangqi-[\w.-]+';/` | 评审 🔵⑤：原写法让「按文档改版本号」这件事本身打红用例 |
| `test/pwa.test.ts` | install 断言改为 `scanAssetUrls` + `fillMissing` 两条 | 上一行改法带出的断言同步 |
| `src/client/app.css` | `@media (max-width: 767px)` 里 `.app-nav` 允许折行（`height: auto; min-height: 48px; flex-wrap: wrap`）、`.app-links` 折行 | 评审 🟡③：七项在 375px 下装不进一行，折行比把标签压成单字再溢出到内容区好 |
| `test/RTM.md` | 「用例实现」行补 `test/pwa.test.ts` | 评审 🔵⑥：F4.5 的静态断言在矩阵里查不到 |

评审 🔵⑦（把 `scripts/` 纳入类型检查面）未做：要新开一份 `allowJs` 的 tsconfig 或把编码函数抽成可导入纯函数，代价与收益不匹配。

真机读数（Chrome，`npm run build && npm run preview`，随后杀掉 preview 进程）：

- SW `active`，scope `/`；缓存 `xiangqi-v1` 含 `/`、manifest、四张图标、`index-*.js`、`index-*.css` 与 `/assets/worker-BZDWpNgI.js`。
- 断网重开 `#/play`：32 枚棋子照常渲染，`performance` 的 `transferSize` 为 0。
- 断网进 `#/ai`：走「兵九进一」，AI 回「炮8平7」，无「AI 出错」提示——worker 脚本确实来自缓存。

`node scripts/pwa-icons.mjs` 生成四张 PNG：512 / 192 / maskable-512 / apple-180，尺寸与字节数见评审前的交付报告。

## §6 验证与收口（父代理）

**收口（主 agent，2026-11-14）**

交付范围：M7 的可安装 PWA 与规则页。新增 `public/`（manifest、sw.js、四张图标）、`scripts/pwa-icons.mjs`、`src/client/rules/{content.ts,rules.css}`、`src/client/pages/RulesPage.tsx`；改动 `index.html`、`src/client/main.tsx`、`src/client/shell/routes.ts`、`src/client/App.tsx`、`src/client/app.css`（仅窄屏导航折行）。

需求—落点对照：

| 需求 | 落点 | 读数 |
|---|---|---|
| F4.5 可添加到主屏全屏运行 | manifest（`display: standalone`、192/512 `any` + 512 `maskable`）+ `index.html` 三条链接 | Chrome 判为可安装；SW `active`、scope `/` |
| 需求 §4 规则页明示 v1 判罚 | `#/rules` 八行表（逐字取自需求 §4）+「不在 v1 范围内」写明长捉与一将一闲 | `test/rules-content.test.ts` 与需求档逐行 `deepEqual` |
| 架构 §8「主屏安装并全屏运行」 | 同上；`standalone` 不吞状态栏 | 真机安装读数为可安装 |
| F5.2 首屏请求数 ≤ 6 | HTML + JS + CSS + 图标 + manifest = 5 | 实测 5 条 |

收口测试行：

- `npm run check` 退出码 0；`node --test` 221 通过 / 0 失败；vitest 10 文件 53 通过。
- 相对 M6 的增量：单测 207 → 221（+14），前端用例 52 → 53（+1）。
- `npm run build` 退出码 0；主包 gzip 97.72 kB（上限 150），CSS gzip 3.52 kB，Worker 独立成包 8.69 kB。
- 真机（build + preview，随后杀掉 preview 进程）：`#/play` 断网重开 32 枚棋子照常、`transferSize` 为 0；`#/ai` 断网走「兵九进一」后 AI 回「炮8平7」，无错误提示；缓存含 `/assets/worker-BZDWpNgI.js`。

评审处置：设计评审两轮（#5 十条 → #6 通过签 token）；代码评审一轮（#14，3 🟡 可选 + 4 🔵 无 🔴），六条已修、一条（`scripts/` 纳入类型检查面）以代价不匹配为由记录不做。

遗留：

- 375px 真实视口未实测（工具改不了视口）。已按推算改成折行（`.app-nav` 允许 wrap、高度自适应），真实观感待你在手机或浏览器设备模式下看一眼。
- maskable 图标按设计写的「中心 80% 方框」实现；W3C 的圆形安全区会裁到最外圈四角少许像素，要绝对不裁需把内容框收到约 56%。
- 离线回退只保证主包内页面；只在 JS 里引用的 chunk 已由 install 扫主包补上（worker 实测在缓存里），动态懒加载的未来产物若新增，同一扫描会跟上。
