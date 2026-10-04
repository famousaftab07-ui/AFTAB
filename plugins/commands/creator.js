// .creator — who owns this bot.
export default {
  name: 'creator',
  alias: ['owner', 'af'],
  category: 'ALIVE',
  desc: 'Bot owner information',
  usage: '.creator',
  async run(ctx) {
    await ctx.reply(
      `👤 *AFTAB*\n\n` +
        `Owner : *AFTAB*\n` +
        `Bot   : Multi-Session WhatsApp Bot\n` +
        `Stack : *Node.js + Baileys*\n\n` +
        `_One server. Many sessions. Link and go._`,
    );
  },
};
