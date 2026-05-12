import { config } from './config/index.js';
import { pingDb } from './db/pool.js';
import { startCollector, stopCollector } from './collector/index.js';
import { createApp } from './api/index.js';
import { routerSSH } from './router-client/ssh.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info({ env: config.server.env, port: config.server.port }, '启动');

  await pingDb();

  const app = createApp();
  const server = app.listen(config.server.port, () => {
    logger.info({ port: config.server.port }, 'API 监听中');
  });

  startCollector();

  const shutdown = async (sig: string): Promise<void> => {
    logger.info({ sig }, '收到关闭信号');
    stopCollector();
    server.close();
    await routerSSH.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error({ err: e instanceof Error ? e.message : String(e) }, '启动失败');
  process.exit(1);
});
