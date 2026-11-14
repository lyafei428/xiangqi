// 打一个「双击就能玩」的单文件版：产物落 standalone/，不影响 dist/ 与现有构建。
//
// 与正式构建的三处差别：
//   ① base 用相对路径（'./'）：file:// 下绝对路径 /assets/… 会指到磁盘根。
//   ② 脚本打成 IIFE 经典脚本：file:// 的 origin 是 null，type="module" 会被 CORS 拦。
//   ③ VITE_STANDALONE=1：人机改走主线程（file:// 建不了 Worker），且不注册 service worker。
//
// 用法：node scripts/build-standalone.mjs

import { readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = 'standalone';

await build({
  root,
  configFile: false,
  base: './',
  define: { 'import.meta.env.VITE_STANDALONE': '"1"' },
  plugins: [react()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    // 资源全部内联：单文件版没有 HTTP 服务器可发二次请求，外链就是断链。
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
  logLevel: 'warn',
});

// ---- 收尾：把 index.html 改成 file:// 能吃的单文件 ----
const htmlPath = join(root, OUT_DIR, 'index.html');
let html = readFileSync(htmlPath, 'utf8');

// ① 去掉 type="module" 与 crossorigin：经典脚本不受 CORS 限制。
html = html.replace(/<script type="module" crossorigin /g, '<script defer ');
html = html.replace(/<script type="module" /g, '<script defer ');
html = html.replace(/ crossorigin(?=[ >])/g, '');

// ② manifest / 图标是 public/ 里的外链：单文件版没有服务器，留着只会 404。
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');
html = html.replace(/\s*<link rel="icon"[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');

// ③ 内联。两条硬约束：
//    · `</script` 必须转义——JS 里任何一处这个字面量都会提前闭合脚本标签（字符串里也一样）。
//    · <style> 进 </head>、<script> 进 </body>：内联脚本没有 defer，放在 head 里会在 <body> 之前跑，
//      那时 #root 还不存在，整页白屏。CSS 放在脚本之前，首帧就有样式。
const css = readFileSync(join(root, OUT_DIR, 'app.css'), 'utf8');
const js = readFileSync(join(root, OUT_DIR, 'app.js'), 'utf8').replaceAll('</script', '<\\/script');

html = html.replace(/\s*<link rel="stylesheet" href="\.\/app\.css">/, '');
html = html.replace(/\s*<script defer src="\.\/app\.js"><\/script>/, '');

// 函数式替换：字符串替换会把插入内容里的 $& / $1 当反向引用吃掉，几十万字符的包里一定会撞上。
html = html.replace('</head>', () => '  <style>\n' + css + '\n  </style>\n  </head>');
html = html.replace('</body>', () => '  <script>\n' + js + '\n  </script>\n</body>');

writeFileSync(htmlPath, html);

// ---- 清掉用不到的外链产物 ----
// worker chunk 是插件阶段产出的遗留物：单文件版走主线程，app.js 里没有它的引用。
// 图标 / manifest / sw 的 html 链接已被摘掉，留着只会让人以为它们是入口。
for (const dead of ['assets', 'icons', 'manifest.webmanifest', 'sw.js', 'app.js', 'app.css']) {
  const target = join(root, OUT_DIR, dead);
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {
    // 不存在就算了：这一步只是收拾，不是构建正确性的条件。
  }
}

// ---- 报告 ----
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(join(root, OUT_DIR)).map((file) => ({
  path: relative(root, file).replaceAll('\\', '/'),
  kb: Math.round(statSync(file).size / 1024),
}));
console.log(`\n单文件版已生成：${OUT_DIR}/`);
for (const file of files) console.log(`  ${file.path}  ${file.kb} KB`);
console.log('\n用法：双击 standalone/index.html 即可（不需要服务器）。');
