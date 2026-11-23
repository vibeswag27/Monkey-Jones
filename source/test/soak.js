// Autopilot soak test: many runs, no drawing. Reports how each run ended and what was around.
const { open, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const runs = +(process.argv[2] || 12), cap = +(process.argv[3] || 6000);
  const out = [];
  for (let i = 0; i < runs; i++) {
    await page.evaluate(() => { const m = window.__mj; if (i_ => 0, m.Game.state === 'title') m.Game.startIntro(false); else m.Game.restart(); });
    await until(page, 'm.Game.state === "run"', 5, false);
    const r = await until(page, `m.Game.state !== "run" || m.Game.run.dist > ${cap}`, 600, true);
    const ctx = await page.evaluate(() => {
      const m = window.__mj, P = m.Player, seg = P.seg, R = m.Game.run;
      const near = seg.obstacles.filter((o) => Math.abs(o.s - P.s) < 26).map((o) => `${o.type}@${(o.s - P.s).toFixed(1)}${o.lane !== undefined ? ' L' + o.lane : ''}${o.l0 !== undefined ? ' L' + o.l0 + '-' + o.l1 : ''}`);
      const holes = seg.holes.filter((h) => h.s1 > P.s - 26 && h.s0 < P.s + 26).map((h) => `hole[${(h.s0 - P.s).toFixed(1)},${(h.s1 - P.s).toFixed(1)}] x[${h.x0.toFixed(1)},${h.x1.toFixed(1)}]`);
      return { v: +R.speed.toFixed(1), lane: P.lane, x: +P.x.toFixed(2), y: +P.y.toFixed(2), s: +P.s.toFixed(1), len: seg.len, jt: seg.jt, danger: +R.danger.toFixed(2), near, holes, score: Math.floor(R.score), nanas: R.nanas };
    });
    out.push({ i, end: r.death || 'cap', dist: r.dist, turns: r.turns, ...ctx });
    console.log(JSON.stringify(out[out.length - 1]));
    if (r.state === 'run') { await page.evaluate(() => { window.__mj.Player.die('bonk'); }); }
    await until(page, 'm.Game.state === "over"', 6, false);
  }
  const by = {}; out.forEach((o) => { by[o.end] = (by[o.end] || 0) + 1; });
  console.log('summary', by, 'avg dist', Math.round(out.reduce((a, o) => a + o.dist, 0) / out.length));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
