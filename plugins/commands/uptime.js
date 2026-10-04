// .uptime — how long this process and the host have been up.
import os from 'node:os';
import { humanDuration } from '../../lib/helpers.js';
import { BOT_NAME } from '../../lib/config.js';
import { sessions } from '../../lib/manager.js';

export default {
  name: 'uptime',
  alias: ['up'],
  category: 'ALIVE',
  desc: 'Bot and server uptime',
  usage: '.uptime',
  async run(ctx) {
    const proc = humanDuration(Date.now() - ctx.session.startedAt);
    const host = humanDuration(os.uptime() * 1000);
    const online = [...sessions.values()].filter((s) => s.online).length;
    await ctx.reply(
      `⏱ *${BOT_NAME} UPTIME*\n\n` +
        `Process : *${proc}*\n` +
        `Server  : *${host}*\n` +
        `Sessions: *${online}/${sessions.size}* online`,
    );
  },
};
