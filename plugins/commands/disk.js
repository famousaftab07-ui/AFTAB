// .disk — how much space the session store is using.
import fs from 'node:fs';
import path from 'node:path';
import { dirSize, humanBytes } from '../../lib/helpers.js';
import { SESSION_DIR } from '../../lib/config.js';

export default {
  name: 'disk',
  alias: ['storage'],
  category: 'ALIVE',
  desc: 'Disk usage of the session store',
  usage: '.disk',
  async run(ctx) {
    const used = dirSize(SESSION_DIR);
    let free = 'unknown';
    try {
      const st = fs.statfsSync(path.resolve(SESSION_DIR));
      free = humanBytes(st.bavail * st.bsize);
    } catch {
      /* statfs is not on every platform */
    }
    await ctx.reply(`💾 *STORAGE*\n\nSessions on disk : *${humanBytes(used)}*\nFree space       : *${free}*`);
  },
};
