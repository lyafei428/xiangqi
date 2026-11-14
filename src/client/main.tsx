import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './app.css';
import { applyTheme, readTheme } from './storage/prefs.ts';

const container = document.getElementById('root');
if (container === null) throw new Error('缺少 #root 挂载点');

// 首屏之前就把配色定下来：晚一步会让深色机器先闪一帧浅色。
applyTheme(readTheme());

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 开发态不注册：HMR 的新模块和缓存里的旧模块在同一条 URL 上打架，改一处样式看不到效果。
// 生产态等 load 后再注册，预缓存才不会和首屏资源抢带宽。
// 注册失败要自己说出来：漏拷 public/ 或 MIME 不对时，默默失败会让“没有离线”变成一个查不出的谜。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('service worker 注册失败', error);
    });
  });
}
