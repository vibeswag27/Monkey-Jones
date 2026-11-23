// in-page stepping without drawing, so long stretches are fast
const { open, step, ROOT } = require('./lib');
async function until(page, predSrc, max = 30, bot = true) {
  return page.evaluate(({ predSrc, max, bot }) => {
    const m = window.__mj, pred = new Function('m', 'return (' + predSrc + ')'), dt = 1 / 60;
    let t = 0;
    while (t < max && !pred(m)) { if (bot) m.Bot.think(); m.Game.update(dt); t += dt; }
    m.render();
    const P = m.Player, R = m.Game.run;
    return { state: m.Game.state, t: +t.toFixed(2), s: +P.s.toFixed(1), dist: Math.round(R.dist), turns: R.turns, death: m.Game.death && m.Game.death.type };
  }, { predSrc, max, bot });
}
module.exports = { open, step, until, ROOT };
