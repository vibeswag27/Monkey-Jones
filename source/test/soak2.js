// Soak test with power-ups forced on every few seconds (rocket and springs especially).
const { open, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const runs = +(process.argv[2] || 10), cap = +(process.argv[3] || 5000), every = +(process.argv[4] || 5);
  const kinds = (process.argv[5] || 'rocket,springs,rocket,shield,magnet,double,springs').split(',');
  const tally = {};
  for (let i = 0; i < runs; i++) {
    await page.evaluate(() => { const m = window.__mj; if (m.Game.state === 'title') m.Game.startIntro(false); else m.Game.restart(); });
    await until(page, 'm.Game.state === "run"', 5, false);
    const r = await page.evaluate(({ cap, every, kinds }) => {
      const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / 60;
      let t = 0, next = 2, k = 0, flights = 0, log = [];
      while (G.state === 'run' && G.run.dist < cap && t < 900) {
        if (t >= next && !P.flying) { const kind = kinds[k++ % kinds.length]; G.take({ kind, got: false, sprite: null }); if (kind === 'rocket') flights++; next = t + every; }
        m.Bot.think(); G.update(dt); t += dt;
      }
      const R = G.run, seg = P.seg;
      const near = seg.obstacles.filter((o) => Math.abs(o.s - P.s) < 24).map((o) => `${o.type}@${(o.s - P.s).toFixed(1)}${o.lane !== undefined ? ' L' + o.lane : ''}`);
      const holes = seg.holes.filter((h) => h.s1 > P.s - 24 && h.s0 < P.s + 24).map((h) => `hole[${(h.s0 - P.s).toFixed(1)},${(h.s1 - P.s).toFixed(1)}] x[${h.x0.toFixed(1)},${h.x1.toFixed(1)}]`);
      return { end: G.death ? G.death.type : 'cap', dist: Math.round(R.dist), turns: R.turns, flights, v: +R.speed.toFixed(1), lane: P.lane, y: +P.y.toFixed(2), s: +P.s.toFixed(1), len: +seg.len.toFixed(1), jt: seg.jt,
        springs: +R.springs.toFixed(1), ghost: +R.ghost.toFixed(2), flying: P.flying, danger: +R.danger.toFixed(1), near, holes, nanas: R.nanas, score: Math.floor(R.score) };
    }, { cap, every, kinds });
    tally[r.end] = (tally[r.end] || 0) + 1;
    console.log(JSON.stringify(r));
    if (r.end === 'cap') await page.evaluate(() => window.__mj.Player.die('bonk'));
    await until(page, 'm.Game.state === "over"', 8, false);
  }
  console.log('summary', tally);
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
