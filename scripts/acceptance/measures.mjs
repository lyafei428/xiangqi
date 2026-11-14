// 各类读数器：端点、性能、连贯、触屏、流畅、配色、手机一屏。
// 从 scripts/acceptance.mjs 拆出，逻辑逐行照搬。

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { THRESHOLDS, URL_UNDER_TEST, VIEWPORTS, repoRoot, evaluate, waitFor, setViewport, freshLoad } from './support.mjs';


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
 * F5-4：令牌层的对比度与「无图片、无渐变」，深浅两套各量一遍。
 * 读数在页面里算：从 :root 取变量值，按 WCAG 2.1 的相对亮度公式算比。
 * 断言集与禁止组合写在 docs/design/modules/theme.md §3 的对比度口径里。
 */


export async function measureViewports(cdp, traffic) {
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
      const box = board ? board.getBoundingClientRect() : null;
      const stage = document.querySelector('.board-fit');
      return {
        cellPx: width / 9,
        boardWidth: width,
        navClipped: nav ? nav.scrollWidth > nav.clientWidth + 1 : false,
        // 棋盘看不全 = 它有边跑到视口或舞台外面。对弈时看不全棋盘是致命的。
        boardClipped: box !== null && (box.right > window.innerWidth + 1 || box.bottom > window.innerHeight + 1),
        stageOverflow: stage !== null && box !== null && (box.width > stage.clientWidth + 1 || box.height > stage.clientHeight + 1),
      };
    })()`);
    readings.push({ viewport: viewport.name, requests: traffic.requests, ...page });
  }
  return readings;
}


export async function measureFirstPaint(cdp, traffic, conditions, label) {
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

export async function measureContinuity(cdp) {
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

export async function measureLessonContinuity(cdp) {
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


export async function measureTouch(cdp) {
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

export async function measureFluency(cdp) {
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


export async function measureTheme(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await freshLoad(cdp, '/play');
  await delay(400);

  const readOnce = async () =>
    evaluate(cdp, `(() => {
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
    return { readings, page: read('--page-bg') };
  })()`);

  const out = {};
  for (const scheme of ['dark', 'light']) {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await delay(120);
    out[scheme] = await readOnce();
  }
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  return out;
}


export async function measurePhoneOneScreen(cdp) {
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

