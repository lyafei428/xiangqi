// 发布前验收：用 CDP 驱本机 Chromium，取三端与性能的读数。
// 只用 node 内置模块：CDP 客户端是裸 WebSocket + id → Promise 的映射，不引第三方库。
//
// 用法：一个终端 `npm run preview`，另一个终端
//   node scripts/acceptance.mjs            # 全套读数，任一阈值不达退出码 1
//   node scripts/acceptance.mjs --self-test # 正控：慢档下 F5.2 必须判负
//
// 分层：底座（CDP / 浏览器 / 阈值）在 `scripts/acceptance/support.mjs`，
// 读数器在 `scripts/acceptance/measures.mjs`，本档只做编排与判阈值。

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  Cdp,
  PERF_PROBE,
  THRESHOLDS,
  URL_UNDER_TEST,
  FAST_4G,
  SLOW_PROBE,
  launch,
  repoRoot,
  resolveBrowser,
  waitFor,
} from './acceptance/support.mjs';
import {
  measureContinuity,
  measureFirstPaint,
  measureFluency,
  measureLessonContinuity,
  measurePhoneOneScreen,
  measureTheme,
  measureTouch,
  measureViewports,
} from './acceptance/measures.mjs';

const SELF_TEST = process.argv.includes('--self-test');

async function main() {
  try {
    await fetch(URL_UNDER_TEST, { method: 'HEAD' });
  } catch {
    console.error(`✗ 打不开 ${URL_UNDER_TEST}——先跑 npm run preview`);
    process.exit(1);
  }

  const browser = await launch(resolveBrowser());
  const cdp = await Cdp.attach(browser.port);
  const traffic = { requests: 0 };
  cdp.on('Network.requestWillBeSent', () => { traffic.requests += 1; });

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PERF_PROBE });

    await cdp.send('Page.navigate', { url: `${URL_UNDER_TEST}#/play` });
    await waitFor(cdp, `document.querySelectorAll('.piece').length > 0`);

    const viewports = await measureViewports(cdp, traffic);
    const firstPaint = await measureFirstPaint(cdp, traffic, FAST_4G, '4G 快档 + CPU 4×');
    const continuity = await measureContinuity(cdp);
    const lesson = await measureLessonContinuity(cdp);
    const touch = await measureTouch(cdp);
    const fluency = await measureFluency(cdp);
    const oneScreen = await measurePhoneOneScreen(cdp);
    const theme = await measureTheme(cdp);

    let selfTest = null;
    if (SELF_TEST) {
      const slow = await measureFirstPaint(cdp, traffic, SLOW_PROBE, '慢档（自证用）');
      selfTest = { ...slow, failedAsExpected: slow.lcp >= THRESHOLDS.lcpMs };
    }

    report({ viewports, firstPaint, continuity, lesson, touch, fluency, oneScreen, theme, selfTest });
  } finally {
    cdp.close();
    await browser.cleanup();
  }
}

function report(data) {
  const failures = [];

  console.log('\n三视口');
  console.table(
    data.viewports.map((row) => ({
      viewport: row.viewport,
      cellPx: row.cellPx.toFixed(1),
      requests: String(row.requests),
      navClipped: row.navClipped ? 'yes' : 'no',
      boardClipped: row.boardClipped ? 'yes' : 'no',
    })),
  );
  for (const row of data.viewports) {
    if (row.cellPx < THRESHOLDS.cellPx) failures.push(`${row.viewport}: 格宽 ${row.cellPx.toFixed(2)} < ${THRESHOLDS.cellPx}`);
    if (row.boardClipped) failures.push(`${row.viewport}: 棋盘超出视口（手机上看不全）`);
    if (row.stageOverflow) failures.push(`${row.viewport}: 棋盘比舞台大，要横向滚动才看得全`);
    if (row.requests > THRESHOLDS.requests) failures.push(`${row.viewport}: 请求 ${row.requests} > 6`);
    if (row.navClipped) failures.push(`${row.viewport}: 导航溢出`);
  }

  console.log('\n首屏（4G 快档 + CPU 4×）');
  console.table([{
    label: data.firstPaint.label,
    lcpMs: Math.round(data.firstPaint.lcp),
    cls: data.firstPaint.cls.toFixed(3),
    requests: String(data.firstPaint.requests),
    longTasks: String(data.firstPaint.longTasks),
  }]);
  if (data.firstPaint.lcp >= THRESHOLDS.lcpMs) failures.push(`首屏 LCP ${Math.round(data.firstPaint.lcp)}ms ≥ 2000ms`);
  if (data.firstPaint.requests > THRESHOLDS.requests) failures.push(`首屏请求 ${data.firstPaint.requests} > 6`);
  if (data.firstPaint.cls >= THRESHOLDS.cls) failures.push(`CLS ${data.firstPaint.cls.toFixed(3)} ≥ 0.05`);

  console.log(`\n缩放不丢状态（1440 → 375，${data.continuity.length} 个采样点，含缩放前的基线）`);
  console.table(data.continuity);
  const base = data.continuity[0];
  for (const sample of data.continuity) {
    if (sample.notations !== base.notations) failures.push(`缩放到 ${sample.width}px 时着法记录变了`);
    if (sample.clock !== base.clock && sample.clock === '') failures.push(`缩放到 ${sample.width}px 时时钟丢了`);
    if (sample.selected !== base.selected) failures.push(`缩放到 ${sample.width}px 时选中态变了`);
  }

  console.log(`\n课程进度：缩放前「${data.lesson.before}」→ 后「${data.lesson.after}」${data.lesson.preserved ? '（保留）' : '（变了）'}`);
  if (!data.lesson.preserved) failures.push('缩放后课程演示步数变了');

  console.log('\n触摸交互');
  console.table([data.touch]);
  if (!data.touch.tapMoved) failures.push('合成触摸点选没有走子');
  if (!data.touch.dragMoved) failures.push('合成触摸拖动没有走子');
  if (!data.touch.resetByTouch) failures.push('触摸点「新局」没有生效');
  if (!data.touch.navByTouch) failures.push('触摸点导航没有换页');

  console.log(`\n走子流畅：单步 ${data.fluency.firstMoveMs.toFixed(1)}ms（阈值 <16ms），连走三着最大帧间隔 ${data.fluency.maxFrameGapMs.toFixed(1)}ms（阈值 ≤32ms，采样 ${data.fluency.frameCount} 帧）`);
  if (data.fluency.firstMoveMs >= THRESHOLDS.moveMs) failures.push(`单步时延 ${data.fluency.firstMoveMs.toFixed(1)}ms 不低于 16ms`);
  if (data.fluency.maxFrameGapMs > THRESHOLDS.frameMs) failures.push(`连续走子最大帧间隔 ${data.fluency.maxFrameGapMs.toFixed(1)}ms > 32ms`);

  for (const scheme of ['dark', 'light']) {
    const label = scheme === 'dark' ? '深色' : '浅色';
    console.log(`\n视觉基准与对比度（F5-4，${label}）`);
    console.table(data.theme[scheme].readings);
    for (const row of data.theme[scheme].readings) {
      // 读不出数说明 token 名改过或值不是 6 位十六进制：这本身就是缺陷，不当作通过。
      if (row.ratio === null) failures.push(`${label}：${row.pair} 读不出对比度（token 缺失或不是十六进制）`);
      else if (row.ratio < THRESHOLDS.contrast) failures.push(`${label}：${row.pair} 对比度 ${row.ratio} 低于 ${THRESHOLDS.contrast}`);
    }
    if (data.theme[scheme].page === '') failures.push(`${label}：:root 读不到 --page-bg，配色没生效`);
  }
  // 两套配色必须真的是两套：页面底一样就说明媒体查询没接上。
  if (data.theme.dark.page === data.theme.light.page) failures.push('深浅两套配色的 --page-bg 相同，prefers-color-scheme 没生效');

  const css = readdirSync(join(repoRoot, 'src/client/styles'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(repoRoot, 'src/client/styles', name), 'utf8'))
    .join('\n');
  for (const pattern of ['linear-gradient', 'radial-gradient', 'url(']) {
    if (css.includes(pattern)) failures.push(`样式表里出现了 ${pattern}（F5.5 要求无渐变、无装饰图片）`);
  }
  // 颜色只许出现在令牌层（base.css）：别处写死一个浅色，深色主题下就会把文字吞掉。
  // 规则页的「判罚口径」表就这么瞎过一次——这条断言就是为了让下一次当场变红。
  const tokenHome = readFileSync(join(repoRoot, 'src/client/styles/base.css'), 'utf8');
  const strayColors = [];
  for (const name of readdirSync(join(repoRoot, 'src/client/styles')).filter((item) => item.endsWith('.css'))) {
    if (name === 'base.css') continue;
    const text = readFileSync(join(repoRoot, 'src/client/styles', name), 'utf8');
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) strayColors.push(`${name}: ${match[0]}`);
  }
  for (const file of readdirSync(join(repoRoot, 'src/client'), { recursive: true })) {
    if (!`${file}`.endsWith('.css')) continue;
    const full = join(repoRoot, 'src/client', `${file}`);
    if (full.endsWith(join('styles', 'base.css'))) continue;
    if (full.endsWith('app.css')) continue;
    const text = readFileSync(full, 'utf8');
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) strayColors.push(`${file}: ${match[0]}`);
  }
  if (strayColors.length > 0) {
    failures.push(`样式表里出现写死的颜色（应改用令牌）：${[...new Set(strayColors)].join('、')}`);
  }
  if (tokenHome.length === 0) failures.push('读不到 base.css 的令牌层');
  // 棋盘色只许落在棋盘上：拿它们当界面文字或填充底，深色下会掉到 2.4:1 与 1.0:1。
  // 这条与配色方案无关，所以查源码而不是查对比度（浅色下黑字压白底反而是对的）。
  const boardTokens = ['--red', '--black', '--target'];
  for (const token of boardTokens) {
    const asText = new RegExp(`color:\\s*var\\(\\${token}\\)`);
    const asFill = new RegExp(`background(-color)?:\\s*var\\(\\${token}\\)`);
    if (asText.test(css)) failures.push(`界面文字用了棋盘色 ${token}：深底上读不出来，请改用 ${token}-text`);
    if (asFill.test(css)) failures.push(`界面底色用了棋盘色 ${token}：请改用 --raise-bg / --sunken-bg`);
  }
  if (/background(-color)?:\s*var\(--accent\)/.test(css)) failures.push('填充底用了 --accent：白字只有 3.37:1，用 --accent-strong');

  console.log(`\n手机一屏（375×667，F4.6）`);
  console.table(
    [data.oneScreen.closed, data.oneScreen.open, data.oneScreen.again].map((row) => ({
      label: row.label,
      boardTop: row.board.top,
      boardBottom: row.board.bottom,
      barTop: row.bar.top,
      sheetTop: row.sheet?.top ?? null,
      sheetBottom: row.sheet?.bottom ?? null,
      sheetHidden: String(row.sheetHidden),
      viewport: row.viewport,
    })),
  );
  const oneScreen = data.oneScreen.closed;
  const opened = data.oneScreen.open;
  const again = data.oneScreen.again;
  const board = oneScreen.board;
  // 不靠 scrollHeight：.app 钉了 100dvh + overflow:hidden，那个值永远等于 clientHeight。
  // 直接逐元素看「底边有没有越出视口」，被裁掉也算不达标。
  for (const [name, box] of [
    ['导航', oneScreen.nav],
    ['棋盘', board],
    ['常驻条', oneScreen.bar],
  ]) {
    if (box === null) {
      failures.push(`375×667 下没有读到${name}`);
      continue;
    }
    if (box.bottom > oneScreen.viewport) failures.push(`375×667 下${name}底边 ${box.bottom} 超出视口 ${oneScreen.viewport}`);
    if (box.top < 0) failures.push(`375×667 下${name}顶边 ${box.top} 被裁`);
  }
  if (oneScreen.scrollHeight > oneScreen.clientHeight + 1) failures.push(`375×667 下页面可纵向滚动（${oneScreen.scrollHeight} > ${oneScreen.clientHeight}）`);
  // 展开态必须真展开，而且不能盖住常驻条。
  if (opened.sheetHidden !== false) failures.push('点「着法」后着法区仍标记为隐藏');
  if ((opened.sheet?.height ?? 0) <= 0) failures.push('点「着法」后着法区高度为 0');
  if (opened.sheet !== null && opened.sheet.bottom > opened.bar.top + 1) failures.push(`着法上浮层盖住了常驻条（浮层底 ${opened.sheet.bottom} > 条顶 ${opened.bar.top}）`);
  if (opened.sheet !== null && opened.sheet.top >= opened.board.bottom) failures.push('着法上浮层没有盖住棋盘下沿（设计要求覆盖式）');
  if (again.sheetHidden !== true) failures.push('点「收起着法」后着法区没有回到隐藏态');
  if (opened.board.bottom !== board.bottom) failures.push('展开「着法」后棋盘被挤小了');
  if (again.board.bottom !== board.bottom) failures.push('收起「着法」后棋盘没有回到原位');

  if (data.selfTest !== null) {
    console.log(`\n正控（${data.selfTest.label}）：LCP ${Math.round(data.selfTest.lcp)}ms —— ${data.selfTest.failedAsExpected ? '如预期判负，量尺有效' : '没判负，F5.2 的检查是空转'}`);
    if (!data.selfTest.failedAsExpected) failures.push('自证失败：慢档下 F5.2 仍判过，检查没有牙');
  }

  if (failures.length > 0) {
    console.error('\n✗ 不达阈值：');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ 全部阈值通过');
}

await main();
