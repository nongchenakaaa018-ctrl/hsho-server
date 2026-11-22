'use strict';

const config = require('./src/config');
const db = require('./src/db');
const createApp = require('./src/app');

async function main() {
  await db.connect();
  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    console.log('=================================================');
    console.log('  Home Sweet Home Online API  v2.0.0');
    console.log(`  Listening : http://${config.host}:${config.port}`);
    console.log(`  Driver    : ${db.getDriver()}`);
    console.log('  Prefix    : /api/... and /hshs/api/...');
    console.log(`  Health    : http://localhost:${config.port}/api/health`);
    console.log('=================================================');
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received — closing connections`);
    server.close(async () => {
      await db.close();
      console.log('[Server] closed cleanly');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[Startup] Failed:', error.message);
  process.exit(1);
});
