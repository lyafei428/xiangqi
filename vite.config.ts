import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const wsProxy = {
  '/ws': {
    target: 'ws://127.0.0.1:8787',
    ws: true,
  },
};

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 构建用相对 base：GitHub Pages 的项目站点挂在 /<仓库名>/ 下，
  // 写死成 '/assets/...' 会指到域名根，整套脚本都 404。相对路径对根部署同样成立。
  base: command === 'build' ? './' : '/',
  // host: true 让手机在同一 Wi-Fi 下用电脑的局域网地址打开（localhost 只有本机能访问）。
  // 这是开发/局域网试玩的入口，不是公网部署——公网要走 #13 的托管方案。
  server: {
    host: true,
    port: 5173,
    proxy: wsProxy,
  },
  preview: {
    host: true,
    proxy: wsProxy,
  },
}));
