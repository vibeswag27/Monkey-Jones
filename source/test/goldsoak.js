// The autopilot plays long runs in both levels with golden bananas always in hand, setting one off at random moments
// (every 6 to 14 seconds of play). Nothing may kill him: not gold, not its ending, not what comes after.
//   node test/goldsoak.js [runs per start level, default 2] [metres per run, default 4000] [frames per second: 60, 20 or both (default)]
const { open, until } = require('./lib2');
(async () => {
  const runs = +process.argv[2] || 2, cap = +process.argv[3] || 4000, rates = process.argv[4] ? [+process.argv[4]] : [60, 20];
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  let bad = 0; const sum = { runs: 0, uses: 0, smashed: 0, nanas: 0, saves: 0, over: 0 };
  for (const map of ['ruins', 'tide']) for (const fps of rates) for (const L of [1, 4, 8, 12]) for (let i = 0; i < runs; i++) {
    await page.evaluate(({ L, map }) => { const m = window.__mj; m.Save.data.runs = 5; m.Save.data.map = map; m.Save.data.gold = 99; m.Seg.startDepth = (L - 1) * 4; m.Game.restart(); m.Seg.startDepth = 0; }, { L, map });
    await until(page, 'm.Game.state === "run"', 5, false);
    const r = await page.evaluate(({ cap, fps }) => {
      const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / fps;
      G.run.danger = 0; G.goldSaves = 0;
      let t = 0, next = 2 + Math.random() * 6, uses = 0, over = 0, lastGold = -99, endedAt = -99;
      while (G.state === 'run' && G.run.dist < cap && t < 900) {
        if (!(G.golden() && uses % 2 === 0)) m.Bot.think(); // every other time, nobody touches the controls while he is gold: he meets whatever is in his lane
        if (t > next) { m.Save.data.gold = 99; if (G.useGold()) { uses++; next = t + 6 + Math.random() * 8; } else next = t + 0.5; }
        const was = G.golden(); G.update(dt); t += dt;
        if (G.golden()) lastGold = t; else if (was) endedAt = t;
        over = Math.max(over, G.run.goldOver);
      }
      const seg = P.seg, d = G.death;
      const near = seg.obstacles.filter((o) => Math.abs(o.s - P.s) < 25).map((o) => `${o.type}${o.kind ? ':' + o.kind : ''}@${(o.s - P.s).toFixed(1)}${o.gone ? ' gone' : ''}`);
      return { end: G.state === 'run' ? 'ok' : (d ? d.type : G.state), dist: Math.round(G.run.dist), level: G.run.level, uses, smashed: G.run.smashed || 0, nanas: G.run.nanas, saves: G.goldSaves, over: +over.toFixed(2),
        sinceGold: +(t - lastGold).toFixed(2), sinceEnd: +(t - endedAt).toFixed(2), s: +P.s.toFixed(1), len: +seg.len.toFixed(1), lane: P.lane, y: +P.y.toFixed(2), ghost: +G.run.ghost.toFixed(2), near,
        holes: seg.holes.filter((h) => h.s1 > P.s - 25 && h.s0 < P.s + 25).map((h) => `${(h.s0 - P.s).toFixed(1)}..${(h.s1 - P.s).toFixed(1)}${h.bridge ? ' bridged' : ''}`),
        decks: seg.decks.filter((k) => k.s1 > P.s - 25 && k.r0 < P.s + 25).map((k) => `${k.ramp ? 'deck' : 'wall'} L${k.lane} ${(k.r0 - P.s).toFixed(1)}..${(k.s1 - P.s).toFixed(1)}`) };
    }, { cap, fps });
    sum.runs++; sum.uses += r.uses; sum.smashed += r.smashed; sum.nanas += r.nanas; sum.saves += r.saves; sum.over = Math.max(sum.over, r.over);
    if (r.end !== 'ok' || r.saves || r.over >= 3.5) { bad++; console.log(`FAIL ${map} ${fps} fps from level ${L}: ` + JSON.stringify(r)); }
  }
  await page.evaluate(() => { window.__mj.Seg.startDepth = 0; });
  console.log(`${sum.runs} runs, ${sum.uses} golden bananas set off, ${sum.smashed} things smashed, ${sum.nanas} bananas; longest hold through a corner ${sum.over} s; last-ditch saves ${sum.saves}`);
  const errs = errors.filter((e) => !/ReadPixels/.test(e));
  console.log(errs.join('\n') || 'no errors');
  console.log(bad || errs.length ? `FAIL: ${bad} bad runs` : 'PASS: nothing about gold ended a run');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
