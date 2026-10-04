// .menu — list every command, grouped by category.
import { plugins, byCategory } from '../../lib/loader.js';
import { BOT_NAME, PREFIX } from '../../lib/config.js';

export default {
  name: 'menu',
  alias: ['help', 'h'],
  category: 'ALIVE',
  desc: 'Show every command this bot knows',
  usage: '.menu',
  async run(ctx) {
    const groups = byCategory();
    let out = `╭━━━「 *${BOT_NAME}* 」━━━\n`;
    out += `│ Total: *${plugins.size}* commands\n`;
    out += `│ Prefix: *${PREFIX}*\n`;
    out += `╰━━━━━━━━━━━━━━━━━━\n`;

    for (const [cat, list] of groups) {
      out += `\n*${cat}*\n`;
      for (const p of list) out += `  ${PREFIX}${p.name} — ${p.desc || ''}\n`;
    }

    out += `\n_Type ${PREFIX}<command> to run it._`;
    await ctx.reply(out);
  },
};
