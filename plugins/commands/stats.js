// .stats — messages and commands handled across all linked sessions.
import { sessions } from '../../lib/manager.js';
import { humanDuration } from '../../lib/helpers.js';

export default {
  name: 'stats',
  alias: ['stat'],
  category: 'ALIVE',
  desc: 'Messages and commands handled',
  usage: '.stats',
  async run(ctx) {
    let messages = 0;
    let commands = 0;
    for (const s of sessions.values()) {
      messages += s.messages;
      commands += s.commands;
    }
    await ctx.reply(
      `📊 *BOT STATS*\n\n` +
        `Sessions : *${sessions.size}*\n` +
        `Messages : *${messages}*\n` +
        `Commands : *${commands}*\n` +
        `This one : *${ctx.session.messages} msgs / ${ctx.session.commands} cmds*`,
    );
  },
};
