// .runtime — the health of the session that received this command.
import { humanDuration, nowStamp } from '../../lib/helpers.js';

export default {
  name: 'runtime',
  alias: ['rt'],
  category: 'ALIVE',
  desc: "This session runtime health",
  usage: '.runtime',
  async run(ctx) {
    const s = ctx.session;
    const up = s.connectedAt ? Date.now() - s.connectedAt : Date.now() - s.startedAt;
    await ctx.reply(
      `⚙️ *SESSION RUNTIME*\n\n` +
        `Number    : \`${s.number}\`\n` +
        `Status    : *${s.online ? 'ONLINE' : 'OFFLINE'}*\n` +
        `Connected : *${humanDuration(up)}*\n` +
        `Reconnects: *${s.reconnects}*\n` +
        `Checked   : *${nowStamp()}*`,
    );
  },
};
