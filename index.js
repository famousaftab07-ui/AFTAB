// AFTAB — entry point.
//
//   node index.js
//
// Boots the plugin set, restores every linked session from ./session, and
// starts the pairing panel on PORT.

import { PORT, BOT_NAME } from './lib/config.js';
import { loadPlugins } from './lib/loader.js';
import { restoreAll } from './lib/manager.js';
import { startPanel } from './panel.js';

async function main() {
  console.log(`\n=== ${BOT_NAME} — Multi-Session WhatsApp Bot ===`);
  console.log(`[boot] node ${process.version}`);

  const { count, failed } = await loadPlugins(console.log);
  console.log(`[boot] commands ready: ${count} (${failed} skipped)`);

  startPanel(console.log);

  await restoreAll(console.log);

  console.log(`[boot] up. panel on port ${PORT} — open it to link a number.`);
}

main().catch((err) => {
  console.error(`[fatal] ${err.stack || err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error(`[unhandled] ${err?.message || err}`);
});
