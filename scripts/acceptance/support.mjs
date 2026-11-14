// 验收脚本的底座：CDP 客户端、浏览器启停、页面求值小工具与全部阈值。
// 从 scripts/acceptance.mjs 拆出（原档 807 行越过了 800 行硬上限）。

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

/** 仓库根：样式表与静态断言都从这里读，不依赖当前工作目录。 */
export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const URL_UNDER_TEST = process.env.ACCEPTANCE_URL ?? 'http://localhost:4173/';

export const CANDIDATES = [
  process.env.ACCEPTANCE_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

export const VIEWPORTS = [
  { name: 'desktop 1440×900', width: 1440, height: 900, mobile: false },
  { name: 'tablet   834×1112', width: 834, height: 1112, mobile: false },
  { name: 'phone    375×812', width: 375, height: 812, mobile: true },
  { name: 'phone    360×740', width: 360, height: 740, mobile: true },
];

// 360px 的手机把左右内边距让给棋盘后正好 40px 一格（F4.3）；0.05 是亚像素容差。
export const THRESHOLDS = { cellPx: 39.95, requests: 6, cls: 0.05, moveMs: 16, frameMs: 32, lcpMs: 2000, contrast: 4.5 };

/** 4G 快档：下行 1.6 Mbps、RTT 150ms，配 4× CPU 降速，取手机档的保守值。 */
export const FAST_4G = { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
/** 慢档只为自证：同样一段检查必须判负，否则量尺是空转的。 */
export const SLOW_PROBE = { offline: false, latency: 300, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (200 * 1024) / 8 };

export const PERF_PROBE = `
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

export class Cdp {
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

export function resolveBrowser() {
  for (const candidate of CANDIDATES) {
    if (candidate !== undefined && existsSync(candidate)) return candidate;
  }
  console.error('✗ 找不到浏览器：设 ACCEPTANCE_BROWSER 指向 msedge / chrome 的可执行文件');
  process.exit(1);
}

export async function launch(browserPath) {
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

export async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? '页面表达式抛错');
  }
  return result.result.value;
}

export async function waitFor(cdp, expression) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(100);
  }
  throw new Error(`等待超时：${expression}`);
}

export async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
}

export async function freshLoad(cdp, hashAndQuery) {
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

