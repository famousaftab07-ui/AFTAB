// .server — hostname, port and node version of the running instance.
import os from 'node:os';
import { PORT, MAX_SESSIONS } from '../../lib/config.js';
import { sessions } from '../../lib/manager.js';

export default {
  name: 'server',
  alias: ['srv'],
  category: 'ALIVE',
  desc: 'Host and port of this instance',
  usage: '.server',
  async run(ctx) {
    await ctx.reply(
      `🌐 *INSTANCE*\n\n` +
        `Hostname : *${os.hostname()}*\n` +
        `Port     : *${PORT}*\n` +
        `Node     : *${process.version}*\n` +
        `Sessions : *${sessions.size}/${MAX_SESSIONS}*\n` +
        `PID      : *${process.pid}*`,
    );
  },
};
