// 发布前验收：用 CDP 驱本机 Chromium，取三端与性能的读数。
// 只用 node 内置模块：CDP 客户端是裸 WebSocket + id → Promise 的映射，不引第三方库。
//
// 用法：一个终端 `npm run preview`，另一个终端
//   node scripts/acceptance.mjs            # 全套读数，任一阈值不达退出码 1
//   node scripts/acceptance.mjs --self-test # 正控：慢档下 F5.2 必须判负

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

/** 仓库根：样式表与静态断言都从这里读，不依赖当前工作目录。 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const URL_UNDER_TEST = process.env.ACCEPTANCE_URL ?? 'http://localhost:4173/';
const SELF_TEST = process.argv.includes('--self-test');

const CANDIDATES = [
  process.env.ACCEPTANCE_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const VIEWPORTS = [
  { name: 'desktop 1440×900', width: 1440, height: 900, mobile: false },
  { name: 'tablet   834×1112', width: 834, height: 1112, mobile: false },
  { name: 'phone    375×812', width: 375, height: 812, mobile: true },
];

const THRESHOLDS = { cellPx: 39.95, requests: 6, cls: 0.05, moveMs: 16, frameMs: 32, lcpMs: 2000, contrast: 4.5 };

/** 4G 快档：下行 1.6 Mbps、RTT 150ms，配 4× CPU 降速，取手机档的保守值。 */
const FAST_4G = { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
/** 慢档只为自证：同样一段检查必须判负，否则量尺是空转的。 */
const SLOW_PROBE = { offline: false, latency: 300, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (200 * 1024) / 8 };

const PERF_PROBE = `
window.__perf = { cls: 0, lcp: 0, longTasks: 0 };
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) window.__perf.cls += entry.value;
  }
}).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const last = entries[entries.length - 1];
  if (last) window.__perf.lcp = last.startTime;
}).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((list) => {
  window.__perf.longTasks += list.getEntries().length;
}).observe({ type: 'longtask', buffered: true });
`;

class Cdp {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Map();

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method !== undefined) {
        for (const handler of this.#listeners.get(message.method) ?? []) handler(message.params);
        return;
      }
      if (message.id === undefined) return;
      const waiter = this.#pending.get(message.id);
      if (waiter === undefined) return;
      this.#pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
    });
  }

  on(method, handler) {
    const handlers = this.#listeners.get(method) ?? [];
    handlers.push(handler);
    this.#listeners.set(method, handlers);
  }

  static async attach(debugPort) {
    const listUrl = `http://127.0.0.1:${debugPort}/json/list`;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        const targets = await fetch(listUrl).then((r) => r.json());
        const page = targets.find((target) => target.type === 'page');
        if (page !== undefined) {
          const socket = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true });
            socket.addEventListener('error', reject, { once: true });
          });
          return new Cdp(socket);
        }
      } catch {
        // 浏览器还没起来：等下一轮。
      }
      await delay(150);
    }
    throw new Error(`连不上 CDP：${listUrl}`);
  }

  send(method, params = {}) {
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.#socket.close();
  }
}

function resolveBrowser() {
  for (const candidate of CANDIDATES) {
    if (candidate !== undefined && existsSync(candidate)) return candidate;
  }
  console.error('✗ 找不到浏览器：设 ACCEPTANCE_BROWSER 指向 msedge / chrome 的可执行文件');
  process.exit(1);
}

async function launch(browserPath) {
  const profile = mkdtempSync(join(tmpdir(), 'xiangqi-accept-'));
  const port = 9333;
  const child = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  return {
    port,
    cleanup: async () => {
      try { child.kill(); } catch {}
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
    },
  };
}

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

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? '页面表达式抛错');
  }
  return result.result.value;
}

async function waitFor(cdp, expression) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(100);
  }
  throw new Error(`等待超时：${expression}`);
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
}

async function freshLoad(cdp, hashAndQuery) {
  await cdp.send('Network.clearBrowserCache');
  // 对局会落 localStorage：不清掉，下一段测试一开局就接着上段的残局，轮到谁走都不一样。
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(URL_UNDER_TEST).origin,
    storageTypes: 'local_storage,session_storage,indexeddb',
  });
  const url = new URL(URL_UNDER_TEST);
  url.searchParams.set('run', String(Math.floor(Math.random() * 1e9)));
  url.hash = hashAndQuery;
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(cdp, `document.querySelectorAll('.piece').length > 0`);
}

async function measureViewports(cdp, traffic) {
  const readings = [];
  for (const viewport of VIEWPORTS) {
    await setViewport(cdp, viewport);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    traffic.requests = 0;
    await freshLoad(cdp, '/play');
    await delay(600);
    const page = await evaluate(cdp, `(() => {
      const board = document.querySelector('svg');
      const width = board ? board.getBoundingClientRect().width : 0;
      const nav = document.querySelector('.app-nav');
      return {
        cellPx: width / 9,
        boardWidth: width,
        navClipped: nav ? nav.scrollWidth > nav.clientWidth + 1 : false,
      };
    })()`);
    readings.push({ viewport: viewport.name, requests: traffic.requests, ...page });
  }
  return readings;
}

async function measureFirstPaint(cdp, traffic, conditions, label) {
  await setViewport(cdp, VIEWPORTS[2]);
  await cdp.send('Network.emulateNetworkConditions', conditions);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  traffic.requests = 0;
  await cdp.send('Network.clearBrowserCache');
  const url = new URL(URL_UNDER_TEST);
  url.searchParams.set('run', String(Math.floor(Math.random() * 1e9)));
  url.hash = '/play';
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(cdp, `document.querySelectorAll('.piece').length > 0`);
  // LCP 在首屏稳定后才封口；慢档要多给一点时间。
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const lcp = await evaluate(cdp, `window.__perf.lcp`);
    if (typeof lcp === 'number' && lcp > 0) break;
    await delay(100);
  }
  const perf = await evaluate(cdp, `({ lcp: window.__perf.lcp, cls: window.__perf.cls, longTasks: window.__perf.longTasks })`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  return { label, requests: traffic.requests, ...perf };
}

/** 走一着并把一枚子留在选中态，然后 20 步递减视口，每步读状态。 */
async function measureContinuity(cdp) {
  await setViewport(cdp, VIEWPORTS[0]);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  await freshLoad(cdp, '/play');
  const geometry = await evaluate(cdp, `(() => {
    const board = document.querySelector('svg').getBoundingClientRect();
    const pawn = document.querySelector('[aria-label="红方兵，第 1 列第 7 行"]').getBoundingClientRect();
    return { x: pawn.x + pawn.width / 2, y: pawn.y + pawn.height / 2, step: board.height / 10 };
  })()`);
  await click(cdp, geometry.x, geometry.y);
  await click(cdp, geometry.x, geometry.y - geometry.step);
  await delay(200);
  // 红方走完轮到黑方：选中黑方一枚子，看选中态在缩放中是否保留。
  const second = await evaluate(cdp, `(() => {
    const piece = document.querySelector('[aria-label="黑方卒，第 1 列第 4 行"]').getBoundingClientRect();
    return { x: piece.x + piece.width / 2, y: piece.y + piece.height / 2 };
  })()`);
  await click(cdp, second.x, second.y);
  await delay(150);

  // 基线必须在缩放之前取：拿缩了 5 步后的状态当基线，首步丢状态就一路判过。
  const readState = `(() => ({
    notations: (document.querySelector('.moves') || {}).textContent || '',
    selected: document.querySelectorAll('.piece-selected').length,
    clock: (document.querySelector('.clock-red') || {}).textContent || '',
  }))()`;
  const base = await evaluate(cdp, readState);
  if (base.notations.trim() === '' || base.selected !== 1 || base.clock.trim() === '') {
    throw new Error(`连续缩放的前提没成立：着法「${base.notations.trim()}」、选中 ${base.selected} 枚、时钟「${base.clock.trim()}」`);
  }

  const samples = [{ width: 1440, ...base }];
  for (let step = 1; step <= 20; step += 1) {
    const width = Math.round(1440 - ((1440 - 375) * step) / 20);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await delay(80);
    samples.push({ width, ...(await evaluate(cdp, readState)) });
  }
  return samples;
}

/** 课程页：进第一课、走两步，再递减视口，读演示文本是否还是那一步。 */
async function measureLessonContinuity(cdp) {
  await setViewport(cdp, VIEWPORTS[0]);
  const lessonHref = await evaluate(cdp, `(async () => {
    location.hash = '/learn';
    await new Promise((resolve) => setTimeout(resolve, 300));
    const link = document.querySelector('a[href^="#/lesson/"]');
    return link ? link.getAttribute('href') : null;
  })()`);
  if (lessonHref === null) throw new Error('课程页没有可进的一课，F4.2 的课程进度无从核验');
  await evaluate(cdp, `(async () => {
    location.hash = ${JSON.stringify(lessonHref.replace('#', ''))};
    await new Promise((resolve) => setTimeout(resolve, 400));
    return true;
  })()`);
  const hasDemo = await evaluate(cdp, `document.querySelector('.demo-text') !== null`);
  if (!hasDemo) throw new Error('课程页没有 .demo-text，演示步数读不到');
  const nextButton = await evaluate(cdp, `(() => {
    const buttons = [...document.querySelectorAll('.demo-controls button')];
    const next = buttons.find((button) => button.textContent.trim() === '下一步');
    return next ? true : false;
  })()`);
  if (!nextButton) throw new Error('课程页没有「下一步」按钮，演示步数推不动');
  await evaluate(cdp, `(() => {
    const buttons = [...document.querySelectorAll('.demo-controls button')];
    const next = buttons.find((button) => button.textContent.trim() === '下一步');
    next.click();
    next.click();
    return true;
  })()`);
  await delay(200);
  const before = await evaluate(cdp, `document.querySelector('.demo-text').textContent.trim()`);
  for (let step = 1; step <= 10; step += 1) {
    const width = Math.round(1440 - ((1440 - 375) * step) / 10);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await delay(80);
  }
  const after = await evaluate(cdp, `document.querySelector('.demo-text').textContent.trim()`);
  return { available: true, before, after, preserved: before === after && before !== '' };
}

async function measureTouch(cdp) {
  // 合成触摸的两条前提：开触摸仿真（否则不合成 pointer 事件）；不开 mobile 视口仿真
  // （开了以后 CDP 的 touch 坐标与布局坐标对不上，事件会落到别的格子）。
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
  await freshLoad(cdp, '/play');
  // 先点新局：上一段测试的残局还在时轮到谁走都不一样，触摸选中会被回合规则挡掉。
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '新局');
    if (button) button.click();
    return true;
  })()`);
  await delay(200);

  const cell = await evaluate(cdp, `(() => {
    const board = document.querySelector('svg').getBoundingClientRect();
    return { x: board.x, y: board.y, w: board.width, h: board.height };
  })()`);
  const at = (col, row) => ({ x: cell.x + (col - 0.5) * (cell.w / 9), y: cell.y + (row - 0.5) * (cell.h / 10) });
  const tap = async (point) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await delay(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(150);
  };

  // 点选走子：先点兵，再点它前面一格。
  const before = await evaluate(cdp, `document.querySelector('.moves').textContent.trim()`);
  await tap(at(3, 7));
  await tap(at(3, 6));
  const afterTap = await evaluate(cdp, `document.querySelector('.moves').textContent.trim()`);

  // 拖动走子：按下 → 分四步移到目标 → 抬起。
  // 红方刚走完，轮到黑方：拖黑方卒（第 3 列第 4 行）向前一格。
  const dragFrom = at(3, 4);
  const dragTo = at(3, 5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [dragFrom] });
  for (let part = 1; part <= 4; part += 1) {
    const point = {
      x: dragFrom.x + ((dragTo.x - dragFrom.x) * part) / 4,
      y: dragFrom.y + ((dragTo.y - dragFrom.y) * part) / 4,
    };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await delay(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(250);
  const afterDrag = await evaluate(cdp, `document.querySelector('.moves').textContent.trim()`);

  // 按钮与导航不靠 hover：各派一次触摸，看可见结果。
  const newGame = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '新局');
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  let resetByTouch = false;
  if (newGame !== null) {
    await tap(newGame);
    await delay(150);
    resetByTouch = (await evaluate(cdp, `document.querySelector('.moves').textContent.trim()`)).includes('尚未走子');
  }

  const navLink = await evaluate(cdp, `(() => {
    const link = [...document.querySelectorAll('.app-nav a')].find((item) => item.textContent.trim() === '规则');
    if (!link) return null;
    const rect = link.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  let navByTouch = false;
  if (navLink !== null) {
    await tap(navLink);
    await delay(150);
    navByTouch = (await evaluate(cdp, `location.hash`)) === '#/rules';
  }

  return {
    tapMoved: before !== afterTap && !afterTap.includes('尚未走子'),
    dragMoved: afterDrag !== afterTap,
    resetByTouch,
    navByTouch,
  };
}

/** 单步时延 + 连走三着期间的最大帧间隔。 */
async function measureFluency(cdp) {
  await setViewport(cdp, VIEWPORTS[0]);
  await freshLoad(cdp, '/play');
  const geometry = await evaluate(cdp, `(() => {
    const board = document.querySelector('svg').getBoundingClientRect();
    const pawn = document.querySelector('[aria-label="红方兵，第 1 列第 7 行"]').getBoundingClientRect();
    return { x: pawn.x + pawn.width / 2, y: pawn.y + pawn.height / 2, step: board.height / 10 };
  })()`);

  await evaluate(cdp, `(() => {
    window.__moveAt = 0;
    window.__upAt = 0;
    const moves = document.querySelector('.moves');
    new MutationObserver(() => { if (window.__moveAt === 0) window.__moveAt = performance.now(); })
      .observe(moves, { subtree: true, childList: true, characterData: true });
    document.addEventListener('pointerup', () => {
      if (window.__upAt === 0) window.__upAt = performance.now();
    }, true);
    return true;
  })()`);
  await click(cdp, geometry.x, geometry.y);
  await click(cdp, geometry.x, geometry.y - geometry.step);
  const firstMoveMs = await pollLatency(cdp);

  await evaluate(cdp, `(() => {
    window.__frames = [];
    const tick = (time) => { window.__frames.push(time); window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
    return true;
  })()`);
  // 连走三着：红、黑、红，每着都是当时轮到的棋子，否则选中会被拒。
  const steps = [
    { from: '红方兵，第 3 列第 7 行', dy: -1 },
    { from: '黑方卒，第 1 列第 4 行', dy: 1 },
    { from: '红方兵，第 5 列第 7 行', dy: -1 },
  ];
  for (const step of steps) {
    const point = await evaluate(cdp, `(() => {
      const board = document.querySelector('svg.board') || document.querySelector('svg');
      const rect = board.getBoundingClientRect();
      const piece = document.querySelector('[aria-label="${step.from}"]').getBoundingClientRect();
      return { x: piece.x + piece.width / 2, y: piece.y + piece.height / 2, unit: rect.height / 10 };
    })()`);
    await click(cdp, point.x, point.y);
    await click(cdp, point.x, point.y + point.unit * step.dy);
    await delay(120);
  }
  await delay(200);
  const gaps = await evaluate(cdp, `(() => {
    cancelAnimationFrame(window.__raf);
    const frames = window.__frames;
    let max = 0;
    for (let index = 1; index < frames.length; index += 1) max = Math.max(max, frames[index] - frames[index - 1]);
    return { max, count: frames.length };
  })()`);
  if (gaps.count < 10) {
    throw new Error(`帧间隔只采到 ${gaps.count} 帧，不足以判断有没有掉帧`);
  }
  return { firstMoveMs, maxFrameGapMs: gaps.max, frameCount: gaps.count };
}

async function pollLatency(cdp) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const pair = await evaluate(cdp, `({ up: window.__upAt, move: window.__moveAt })`);
    if (pair.up > 0 && pair.move > 0) return pair.move - pair.up;
    await delay(20);
  }
  throw new Error('没有读到走子时延');
}

async function click(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

/**
 * F5-4：深色令牌层的对比度与「无图片、无渐变」。
 * 读数在页面里算：从 :root 取变量值，按 WCAG 2.1 的相对亮度公式算比。
 * 断言集与禁止组合写在 docs/design/modules/theme.md §3。
 */
async function measureTheme(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await freshLoad(cdp, '/play');
  await delay(400);
  return evaluate(cdp, `(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name) => root.getPropertyValue(name).trim();
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const parse = (value) => {
      const hex = value.replace('#', '');
      if (hex.length !== 6) return null;
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(lin);
    };
    const lum = (value) => {
      const rgb = parse(value);
      if (rgb === null) return null;
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const ratio = (fg, bg) => {
      const a = lum(read(fg));
      const b = lum(read(bg));
      if (a === null || b === null) return null;
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    // 断言集：theme.md §3 里断言列为「过」的行。
    const pairs = [
      ['--text', '--page-bg'],
      ['--text', '--panel-bg'],
      ['--muted', '--page-bg'],
      ['--muted', '--panel-bg'],
      ['--muted-2', '--page-bg'],
      ['--muted-2', '--panel-bg'],
      ['--muted-2', '--raise-bg'],
      ['--accent', '--page-bg'],
      ['--accent', '--panel-bg'],
      ['--low', '--panel-bg'],
      ['--red-text', '--panel-bg'],
      ['--black-text', '--panel-bg'],
      ['--target-text', '--panel-bg'],
      ['--on-accent', '--accent-strong'],
      ['--red', '--board-bg'],
      ['--black', '--board-bg'],
      ['--board-ink', '--board-bg'],
    ];
    const readings = pairs.map(([fg, bg]) => ({ pair: fg + ' on ' + bg, ratio: ratio(fg, bg) }));

    // 禁止组合：拿它们当字色就不该出现，只作证据，不参与断言。
    const forbidden = [
      ['--on-accent', '--accent'],
      ['--red', '--panel-bg'],
      ['--black', '--panel-bg'],
    ].map(([fg, bg]) => ({ pair: fg + ' on ' + bg, ratio: ratio(fg, bg) }));

    return { readings, forbidden, tokens: { page: read('--page-bg'), panel: read('--panel-bg') } };
  })()`);
}

async function measurePhoneOneScreen(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
  await freshLoad(cdp, '/play');
  await delay(600);
  const read = (label) =>
    evaluate(cdp, `(() => {
      const board = document.querySelector('svg.board');
      const box = board ? board.getBoundingClientRect() : null;
      const nav = document.querySelector('.app-nav');
      const panel = document.querySelector('.panel');
      const sheet = document.querySelector('.panel-body');
      const doc = document.scrollingElement;
      const rect = (el) => (el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), height: Math.round(el.getBoundingClientRect().height) } : null);
      return {
        label: ${JSON.stringify(label)},
        board: rect(board),
        nav: rect(nav),
        bar: rect(panel),
        sheet: rect(sheet),
        sheetHidden: sheet ? sheet.hasAttribute('hidden') : null,
        viewport: window.innerHeight,
        scrollHeight: doc ? doc.scrollHeight : -1,
        clientHeight: doc ? doc.clientHeight : -1,
      };
    })()`);
  const closed = await read('收起');
  await evaluate(cdp, `document.querySelector('.panel-toggle').click()`);
  await delay(200);
  const open = await read('展开');
  await evaluate(cdp, `document.querySelector('.panel-close').click()`);
  await delay(200);
  const again = await read('再收起');
  return { closed, open, again };
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
    })),
  );
  for (const row of data.viewports) {
    if (row.cellPx < THRESHOLDS.cellPx) failures.push(`${row.viewport}: 格宽 ${row.cellPx.toFixed(2)} < 39.95`);
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

  console.log(`\n视觉基准与对比度（F5-4）`);
  console.table(data.theme.readings);
  for (const row of data.theme.readings) {
    // 读不出数说明 token 名改过或值不是 6 位十六进制：这本身就是缺陷，不当作通过。
    if (row.ratio === null) failures.push(`${row.pair} 读不出对比度（token 缺失或不是十六进制）`);
    else if (row.ratio < THRESHOLDS.contrast) failures.push(`${row.pair} 对比度 ${row.ratio} 低于 ${THRESHOLDS.contrast}`);
  }
  // 禁止组合只作证据：它们本来就该不达标，达标了反而说明 token 用错。
  for (const row of data.theme.forbidden) {
    if (row.ratio !== null && row.ratio >= THRESHOLDS.contrast) failures.push(`${row.pair} 是禁止组合却达标（${row.ratio}），检查 token 是否用错`);
  }
  const css = readdirSync(join(repoRoot, 'src/client/styles'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(repoRoot, 'src/client/styles', name), 'utf8'))
    .join('\n');
  for (const pattern of ['linear-gradient', 'radial-gradient', 'url(']) {
    if (css.includes(pattern)) failures.push(`样式表里出现了 ${pattern}（F5.5 要求无渐变、无装饰图片）`);
  }
  if (data.theme.tokens.page === '' || data.theme.tokens.panel === '') failures.push('深色令牌层没有生效（:root 读不到 --page-bg / --panel-bg）');

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
