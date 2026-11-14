// 生成 PWA 图标：棋盘底 + 深色网格 + 中心一个红圆。
// 不引第三方依赖——PNG 由 node 内置 zlib 自己编码，图标因此在仓库里可复现，
// 换形状只改这一个文件再跑一次 `node scripts/pwa-icons.mjs`。

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR_URL = new URL('../public/icons/', import.meta.url);
const OUT_DIR = fileURLToPath(OUT_DIR_URL);

// 底色与 index.html 的 theme-color 同一个值：启动闪屏切到图标时不断色。
const BG = [233, 224, 207];
// 深棕而非纯黑：与棋盘的暖底色相邻时不刺眼。
const GRID = [58, 49, 40];
// 需求档里的棋盘红。
const PIECE = [179, 58, 43];

const FILES = 9; // 象棋盘九路
const RANKS = 10; // 十行
const PIECE_RADIUS = 0.14; // 红圆半径，相对棋盘短边
const MASTER_SIZE = 512;
const MASKABLE_SAFE_AREA = 0.8; // maskable 内容收在中心 80%
const EDGE_PADDING = 0.05; // 普通图标的四周留白，外侧网格线不被切成半条
// 每个输出像素取 3×3 个采样点求平均：没有这一步圆和线全是锯齿。
const SUPERSAMPLE = 3;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4, 8), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(size, rgb) {
  const stride = size * 3;
  // 每行前面一个过滤器字节。取 0（不过滤）：图标是大面积平涂，deflate 已经压得够好，
  // 逐行 Sub/Up 只会多一处和 PNG 解码器打交道的代码。
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // 真彩色 RGB，无 alpha：iOS 主屏图标不认透明像素
  ihdr[10] = 0; // 压缩方法
  ihdr[11] = 0; // 过滤方法
  ihdr[12] = 0; // 不隔行

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 画一张 size 见方的 RGB 图。padding 是内容框四周留白占总边长的比例。
function render(size, padding) {
  const hi = size * SUPERSAMPLE;
  const boxStart = padding * hi;
  const box = hi - boxStart * 2;
  const halfLine = hi / 256; // 512 目标尺寸下约 4px 线宽
  const radius = box * PIECE_RADIUS;
  const stepX = box / (FILES - 1);
  const stepY = box / (RANKS - 1);
  const center = hi / 2;

  function paint(px, py) {
    if (px < boxStart || px > hi - boxStart || py < boxStart || py > hi - boxStart) return BG;
    if (Math.hypot(px - center, py - center) <= radius) return PIECE;
    const nearestX = Math.round((px - boxStart) / stepX) * stepX + boxStart;
    const nearestY = Math.round((py - boxStart) / stepY) * stepY + boxStart;
    const onVertical = Math.abs(px - nearestX) <= halfLine;
    const onHorizontal = Math.abs(py - nearestY) <= halfLine;
    return onVertical || onHorizontal ? GRID : BG;
  }

  const out = Buffer.alloc(size * size * 3);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const color = paint(
            x * SUPERSAMPLE + sx + 0.5,
            y * SUPERSAMPLE + sy + 0.5,
          );
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const offset = (y * size + x) * 3;
      out[offset] = Math.round(r / samples);
      out[offset + 1] = Math.round(g / samples);
      out[offset + 2] = Math.round(b / samples);
    }
  }
  return out;
}

// 面积加权缩小：每个目标像素按重叠面积取源像素的均值，192/180 才不会出现丢线的断层。
function downsample(src, srcSize, dstSize) {
  const scale = srcSize / dstSize;
  const out = Buffer.alloc(dstSize * dstSize * 3);
  for (let y = 0; y < dstSize; y += 1) {
    const y0 = y * scale;
    const y1 = y0 + scale;
    for (let x = 0; x < dstSize; x += 1) {
      const x0 = x * scale;
      const x1 = x0 + scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let weightSum = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy += 1) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx += 1) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0);
          if (wx <= 0) continue;
          const weight = wx * wy;
          const offset = (sy * srcSize + sx) * 3;
          r += src[offset] * weight;
          g += src[offset + 1] * weight;
          b += src[offset + 2] * weight;
          weightSum += weight;
        }
      }
      const offset = (y * dstSize + x) * 3;
      out[offset] = Math.round(r / weightSum);
      out[offset + 1] = Math.round(g / weightSum);
      out[offset + 2] = Math.round(b / weightSum);
    }
  }
  return out;
}

const master = render(MASTER_SIZE, EDGE_PADDING);
const maskable = render(MASTER_SIZE, (1 - MASKABLE_SAFE_AREA) / 2);

const OUTPUTS = [
  { name: 'icon-512.png', size: MASTER_SIZE, rgb: master },
  { name: 'icon-192.png', size: 192, rgb: downsample(master, MASTER_SIZE, 192) },
  { name: 'icon-maskable-512.png', size: MASTER_SIZE, rgb: maskable },
  { name: 'apple-touch-icon.png', size: 180, rgb: downsample(master, MASTER_SIZE, 180) },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { name, size, rgb } of OUTPUTS) {
  const png = encodePng(size, rgb);
  writeFileSync(fileURLToPath(new URL(name, OUT_DIR_URL)), png);
  console.log(`${name}\t${size}x${size}\t${png.length} 字节`);
}
