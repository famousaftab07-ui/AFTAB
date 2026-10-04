// .sysinfo — memory, CPU and platform of the machine the bot runs on.
import os from 'node:os';
import { humanBytes, humanDuration } from '../../lib/helpers.js';

export default {
  name: 'sysinfo',
  alias: ['sys'],
  category: 'ALIVE',
  desc: 'Server memory, CPU and platform',
  usage: '.sysinfo',
  async run(ctx) {
    const mem = process.memoryUsage();
    await ctx.reply(
      `🖥 *SERVER*\n\n` +
        `Platform : *${os.platform()} ${os.arch()}*\n` +
        `CPU      : *${os.cpus().length} cores*\n` +
        `Load     : *${os.loadavg()[0].toFixed(2)}*\n` +
        `Host up  : *${humanDuration(os.uptime() * 1000)}*\n\n` +
        `*BOT PROCESS*\n` +
        `RSS  : *${humanBytes(mem.rss)}*\n` +
        `Heap : *${humanBytes(mem.heapUsed)} / ${humanBytes(mem.heapTotal)}*`,
    );
  },
};
