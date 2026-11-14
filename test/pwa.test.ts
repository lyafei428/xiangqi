import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// 安装与离线是文件级交付：manifest / sw.js / 图标 / index.html 的链接。
// 本轮只做文本与二进制的静态断言——浏览器里装不装得上要真机跑一次 preview，用例管不到。

const ROOT = new URL('../', import.meta.url);

function readText(relativePath: string): string {
  return readFileSync(new URL(relativePath, ROOT), 'utf8');
}

function readBytes(relativePath: string): Buffer {
  return readFileSync(new URL(relativePath, ROOT));
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null, `${what} 不是对象`);
  return value as Record<string, unknown>;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ICONS = [
  { path: 'public/icons/icon-192.png', width: 192, height: 192 },
  { path: 'public/icons/icon-512.png', width: 512, height: 512 },
  { path: 'public/icons/icon-maskable-512.png', width: 512, height: 512 },
  { path: 'public/icons/apple-touch-icon.png', width: 180, height: 180 },
];

test('四个图标是合法 PNG，尺寸与声明一致', () => {
  for (const icon of ICONS) {
    const bytes = readBytes(icon.path);
    assert.deepEqual([...bytes.subarray(0, 8)], PNG_SIGNATURE, `${icon.path} 的 8 字节签名不是 PNG`);
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${icon.path} 的第一个 chunk 不是 IHDR`);
    assert.equal(bytes.readUInt32BE(16), icon.width, `${icon.path} 宽度不对`);
    assert.equal(bytes.readUInt32BE(20), icon.height, `${icon.path} 高度不对`);
    // 纯色方块能压到几百字节；过小说明画面没画上去，只剩一张底。
    assert.ok(bytes.length > 1024, `${icon.path} 只有 ${bytes.length} 字节，画面多半是空的`);
  }
});

const manifest = asRecord(
  JSON.parse(readText('public/manifest.webmanifest')) as unknown,
  'manifest',
);

test('manifest 带齐安装所需字段', () => {
  assert.equal(manifest['name'], '中国象棋');
  assert.equal(manifest['short_name'], '象棋');
  assert.equal(manifest['start_url'], '/');
  assert.equal(manifest['scope'], '/');
  assert.equal(manifest['display'], 'standalone');
  // 与 index.html 的 theme-color 同值：启动闪屏切进应用时不跳色。
  assert.equal(manifest['theme_color'], '#e9e0cf');
  assert.equal(manifest['background_color'], '#e9e0cf');
});

test('manifest 图标覆盖 192 / 512 与一个 maskable，且指向真实文件', () => {
  const rawIcons: unknown = manifest['icons'];
  assert.ok(Array.isArray(rawIcons), 'manifest.icons 不是数组');
  const icons = rawIcons.map((icon: unknown) => asRecord(icon, 'manifest.icons[]'));

  const sizes = icons.map((icon) => icon['sizes']);
  assert.ok(sizes.includes('192x192'), 'manifest 缺 192 图标，Chromium 不判可安装');
  assert.ok(sizes.includes('512x512'), 'manifest 缺 512 图标，Chromium 不判可安装');
  assert.ok(
    icons.some((icon) => icon['purpose'] === 'maskable'),
    'manifest 缺 maskable 图标，Android 主屏会裁掉棋盘四角',
  );

  for (const icon of icons) {
    assert.equal(icon['type'], 'image/png', 'manifest 图标类型应为 image/png');
    const src = icon['src'];
    assert.equal(typeof src, 'string', 'manifest 图标的 src 应为字符串');
    // 图标是脚本生成的静态文件：清单指了但文件没生成，装到一半才会发现。
    assert.ok(
      existsSync(new URL(`public${String(src)}`, ROOT)),
      `${String(src)} 不存在——先跑 node scripts/pwa-icons.mjs`,
    );
  }
});

const sw = readText('public/sw.js');

test('sw.js 有版本常量，install / activate / fetch 三个监听齐备', () => {
  assert.match(sw, /const CACHE = 'xiangqi-[\w.-]+';/, 'sw.js 缺版本常量 CACHE');
  for (const event of ['install', 'activate', 'fetch']) {
    assert.ok(
      sw.includes(`addEventListener('${event}'`),
      `sw.js 没有 ${event} 监听`,
    );
  }
});

test('sw.js 的预缓存清单含首页、manifest 与图标', () => {
  const body = /const PRECACHE = \[([\s\S]*?)\];/.exec(sw)?.[1];
  assert.ok(body !== undefined, 'sw.js 里找不到 PRECACHE 清单');
  for (const entry of [
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
  ]) {
    assert.ok(body.includes(`'${entry}'`), `预缓存清单缺 ${entry}`);
  }
  assert.match(body, /SHELL_URL/, '预缓存清单缺首页条目');
});

test('sw.js 的 install 从首页 HTML 里扫出构建产物一并预缓存', () => {
  const literal = /const ASSET_PATTERN = (\/[^\n]+?\/g);/.exec(sw)?.[1];
  assert.ok(literal !== undefined, 'sw.js 里找不到扫 /assets 的 ASSET_PATTERN');
  assert.ok(
    sw.includes('const assets = scanAssetUrls(await shell.text());') &&
      sw.includes('await fillMissing(cache, assets);'),
    'sw.js 的 install 没有把扫到的产物加进缓存——首访断网刷新会是白页',
  );

  // 把清单里的正则原样取出来跑一遍构建后的 HTML：js 与 css 两条都要认出来。
  const source = literal.slice(1, literal.lastIndexOf('/'));
  const html =
    '<script type="module" crossorigin src="/assets/index-Bk3x.js"></script>' +
    '<link rel="stylesheet" crossorigin href="/assets/index-C9pz.css">';
  assert.deepEqual(html.match(new RegExp(source, 'g')), [
    '/assets/index-Bk3x.js',
    '/assets/index-C9pz.css',
  ]);
});

const indexHtml = readText('index.html');

test('index.html 引了 manifest 与 apple-touch-icon', () => {
  assert.ok(indexHtml.includes('rel="manifest"'), 'index.html 没有 manifest 链接');
  assert.ok(
    indexHtml.includes('href="/manifest.webmanifest"'),
    'index.html 的 manifest 链接没指向 /manifest.webmanifest',
  );
  assert.ok(indexHtml.includes('rel="apple-touch-icon"'), 'index.html 没有 apple-touch-icon 链接');
  assert.ok(
    indexHtml.includes('href="/icons/apple-touch-icon.png"'),
    'index.html 的 apple-touch-icon 没指向 /icons/apple-touch-icon.png',
  );
});

test('service worker 只在生产构建下注册', () => {
  const main = readText('src/client/main.tsx');
  assert.ok(main.includes('import.meta.env.PROD'), '注册点没有生产态判断，开发态的 HMR 会撞缓存');
  assert.ok(main.includes("serviceWorker.register('/sw.js')"), '注册点没有注册 /sw.js');
});
