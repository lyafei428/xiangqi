// service worker：预缓存 / 旧缓存清理 / 离线回退。
// 纯静态文件，不经打包——放在 public/ 原样拷进 dist/，因此文件名与 Vite 的哈希产物无关。

// 发版只改这一行版本号：activate 会把名字对不上的旧缓存整批删掉。
const CACHE = 'xiangqi-v1';

// 壳的入口。hash 路由不经过服务器，所有导航请求拿到的都是同一份 HTML，
// 所以预缓存与离线回退都只认这一个键。
const SHELL_URL = '/';

const PRECACHE = [
  SHELL_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// 带哈希的产物名只有构建知道：只靠运行时缓存的话，首访那一次的 JS/CSS 在本 worker
// 接管页面之前就取完了，断网刷新只剩壳、脚本全落空，页面是白的。
// 从首页 HTML 里现读产物名，就不需要构建插件，也不怕文件名变。
const ASSET_PATTERN = /\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g;

function scanAssetUrls(html) {
  return [...new Set(html.match(ASSET_PATTERN) ?? [])];
}

/**
 * 补上没有的产物。逐个 add 而不是 addAll：主包里引的 chunk（比如人机页的 worker）
 * 不一定全部存在，一条拿不到不该拖垮整次预缓存。
 */
async function fillMissing(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      const hit = await cache.match(url);
      if (hit !== undefined) return;
      try {
        await cache.add(url);
      } catch (error) {
        // 拿不到就从缓存里少一块，但要说出来：离线时少哪块能直接对到这里。
        console.warn(`[sw] 预缓存失败 ${url}`, error);
      }
    }),
  );
}

/** 主包文本里还会引 chunk（worker 就是这种），一并扫出来补上——它不在 HTML 里。 */
async function fillFromScripts(cache, scriptUrls) {
  const nested = [];
  for (const url of scriptUrls) {
    if (!url.endsWith('.js')) continue;
    const hit = await cache.match(url);
    if (hit === undefined) continue;
    nested.push(...scanAssetUrls(await hit.text()));
  }
  await fillMissing(cache, [...new Set(nested)]);
}

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(PRECACHE);

  // 读缓存里的首页而不是再 fetch 一次：省一次网络，也保证扫到的就是刚缓存的那份 HTML。
  const shell = await cache.match(SHELL_URL);
  if (shell === undefined) throw new Error(`预缓存后缓存里没有 ${SHELL_URL}`);
  const assets = scanAssetUrls(await shell.text());
  await fillMissing(cache, assets);
  await fillFromScripts(cache, assets);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // 回写的键固定是 SHELL_URL：导航到任何地址拿到的都是同一份 HTML，离线回退也读这一个键。
    if (response.ok) {
      const fresh = response.clone();
      await cache.put(SHELL_URL, response.clone());
      // 新壳可能指向新哈希的产物；只换壳不补产物的话，下一次断网就是白屏。
      const assets = scanAssetUrls(await fresh.text());
      await fillMissing(cache, assets);
      await fillFromScripts(cache, assets);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(SHELL_URL);
    if (cached !== undefined) return cached;
    // 壳都没缓存上，离线就是没有可回退的东西——把网络错误原样抛出去，别装作拿到了页面。
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached !== undefined) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // 只接同源 GET：POST 与跨源请求交给网络，缓存对它们没有意义。
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request));
});
