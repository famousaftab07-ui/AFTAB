// .speed — how fast this bot answers.
export default {
  name: 'speed',
  alias: ['latency'],
  category: 'ALIVE',
  desc: 'Measure bot response speed',
  usage: '.speed',
  async run(ctx) {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
      const t0 = Date.now();
      await ctx.send('·');
      samples.push(Date.now() - t0);
    }
    const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    await ctx.reply(`🚀 *SPEED*\n\nSamples: *${samples.join(' ms, ')} ms*\nAverage: *${avg} ms*`);
  },
};
