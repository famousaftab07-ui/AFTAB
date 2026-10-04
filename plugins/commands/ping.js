// .ping — latency check against WhatsApp's servers.
export default {
  name: 'ping',
  alias: ['p'],
  category: 'ALIVE',
  desc: 'Check bot latency',
  usage: '.ping',
  async run(ctx) {
    const t0 = Date.now();
    await ctx.reply('🏓 ...');
    const ms = Date.now() - t0;
    await ctx.reply(`🏓 *Pong!*\nLatency: *${ms} ms*\nSession: \`${ctx.session.number}\``);
  },
};
