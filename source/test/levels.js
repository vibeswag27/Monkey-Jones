// Levels: prints the difficulty curve, then lets the autopilot play each level on its own to prove every pattern
// the generator can produce at that level is still passable. A death here means an unfair layout (or a blind spot in the autopilot).
//   node test/levels.js [first level] [last level] [runs per level] [metres per run]
const { open, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const from = +(process.argv[2] || 1), to = +(process.argv[3] || 16), runs = +(process.argv[4] || 5), cap = +(process.argv[5] || 1600);
  let deaths = 0;
  for (let L = from; L <= to; L++) {
    const line = { level: L, name: '', speed: 0, ends: {}, detail: [] };
    for (let i = 0; i < runs; i++) {
      await page.evaluate((L) => { const m = window.__mj; m.Save.data.runs = 5; m.Seg.startDepth = (L - 1) * 4; if (m.Game.state === 'title') m.Game.startIntro(false); else m.Game.restart(); }, L);
      await until(page, 'm.Game.state === "run"', 5, false);
      const r = await page.evaluate(({ cap, L }) => {
        const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / 60;
        let t = 0, vmax = 0;
        while (G.state === 'run' && G.run.dist < cap && G.run.level === L && t < 600) { m.Bot.think(); G.update(dt); t += dt; vmax = Math.max(vmax, G.run.speed); }
        const R = G.run, seg = P.seg;
        const near = seg.obstacles.filter((o) => Math.abs(o.s - P.s) < 30).map((o) => `${o.type}@${(o.s - P.s).toFixed(1)}${o.lane !== undefined ? ' L' + o.lane : ''}${o.l0 !== undefined ? ' L' + o.l0 + '-' + o.l1 : ''}`);
        const holes = seg.holes.filter((h) => h.s1 > P.s - 30 && h.s0 < P.s + 30).map((h) => `hole[${(h.s0 - P.s).toFixed(1)},${(h.s1 - P.s).toFixed(1)}] x[${h.x0.toFixed(1)},${h.x1.toFixed(1)}]`);
        return { end: G.death ? G.death.type : 'ok', dist: Math.round(R.dist), level: R.level, vmax: +vmax.toFixed(1), lane: P.lane, y: +P.y.toFixed(2), s: +P.s.toFixed(1), len: +seg.len.toFixed(1), jt: seg.jt, danger: +R.danger.toFixed(1), near, holes };
      }, { cap, L });
      line.speed = Math.max(line.speed, r.vmax); line.ends[r.end] = (line.ends[r.end] || 0) + 1;
      if (r.end !== 'ok') { deaths++; line.detail.push(r); }
      await page.evaluate(() => { const m = window.__mj; if (m.Game.state === 'run') m.Player.die('bonk'); });
      await until(page, 'm.Game.state === "over"', 8, false);
    }
    console.log(`level ${String(L).padStart(2)}  top speed ${line.speed.toFixed(1)} m/s  ${JSON.stringify(line.ends)}`);
    for (const d of line.detail) console.log('   ', JSON.stringify(d));
  }
  await page.evaluate(() => { window.__mj.Seg.startDepth = 0; });
  console.log(deaths ? `autopilot deaths: ${deaths}` : 'PASS: the autopilot cleared every level');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
