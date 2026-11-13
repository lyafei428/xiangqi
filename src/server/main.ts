// 联机服务启动入口：node src/server/main.ts。

import { createOnlineServer } from './server.ts';

const port = Number(process.env.PORT ?? 8787);
const server = await createOnlineServer({ port });

console.log(`xiangqi online ws://127.0.0.1:${server.port}/ws`);

const shutdown = async (): Promise<void> => {
  await server.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
