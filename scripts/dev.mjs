// npm run dev：同时起 Vite 与联机服务；任一退出就收掉另一个。

import { spawn } from 'node:child_process';

let stopping = false;
const children = [];

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('exit', (code) => {
    if (stopping) return;
    stopping = true;
    for (const other of children) {
      if (other !== child) other.kill();
    }
    process.exit(code ?? 0);
  });
  return child;
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

run(process.execPath, ['src/server/main.ts']);
run(process.execPath, ['node_modules/vite/bin/vite.js']);
