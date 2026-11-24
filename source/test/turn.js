// Turning a corner must leave you in the lane you were in: every lane, both ways, whether the swipe is early, on time or late.
const { open } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const rows = await page.evaluate(() => {
    const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / 60, out = [];
    for (const dir of ['left', 'right']) for (const lane of [-1, 0, 1]) for (const when of ['early', 'on time', 'late']) {
      m.Save.data.runs = 0; // the tutorial opening ends in a junction that lets you go either way
      if (G.state === 'title') G.startIntro(false); else G.restart();
      let t = 0; while (G.state !== 'run' && t < 5) { G.update(dt); t += dt; }
      const seg = P.seg, L = seg.len;
      seg.obstacles.length = 0; seg.holes.length = 0; // nothing in the way
      P.s = L - 24; P.lane = lane; P.x = lane * 1.9; P.place();
      const pivot = L + (dir === 'right' ? -1 : 1) * lane * 1.9;
      const at = when === 'early' ? L - 9 : when === 'on time' ? pivot - 0.4 : Math.min(L + 2.2, pivot + 1.5);
      let pressed = false, px = P.wx, pz = P.wz, maxStep = 0, turned = false, laneAfter = null, off0 = 0, after = 0;
      for (let i = 0; i < 500 && G.state === 'run'; i++) {
        if (!pressed && P.seg === seg && P.s >= at) { G.input(dir); pressed = true; }
        G.update(dt);
        maxStep = Math.max(maxStep, Math.hypot(P.wx - px, P.wz - pz)); px = P.wx; pz = P.wz;
        if (P.seg !== seg) {
          if (!turned) { turned = true; laneAfter = P.lane; off0 = Math.abs(P.x - P.lane * 1.9); }
          after += dt; if (after > 0.6) break;
        }
      }
      const settled = Math.abs(P.x - P.lane * 1.9);
      out.push({ dir, lane, when, ok: turned && laneAfter === lane && settled < 0.05 && maxStep < 1.6 && G.state === 'run', laneAfter, slide: +off0.toFixed(2), settled: +settled.toFixed(3), maxStep: +maxStep.toFixed(2), state: G.state });
    }
    return out;
  });
  for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.dir.padEnd(5)} from lane ${String(r.lane).padStart(2)} (${r.when.padEnd(7)}) → lane ${r.laneAfter}, sideways catch-up ${r.slide} m, biggest step ${r.maxStep} m${r.state !== 'run' ? ', ' + r.state : ''}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `FAIL: ${bad} of ${rows.length}` : `PASS: all ${rows.length} turns kept their lane`);
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
  if (bad) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
