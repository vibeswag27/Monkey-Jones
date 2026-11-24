// A walk through the High Tide level with a camera: the tide coming in, the reef, seals, the orca, both watery endings, and the tide going out.
//   node test/sea.js [w] [h] [tag] [sea level: 2, 5, 8 …] [character id]
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 760), TAG = process.argv[4] || 'sea', LV = +(process.argv[5] || 2), WHO = process.argv[6] || 'monkey', D0 = (LV - 1) * 4;
(async () => {
  const { browser, page, errors } = await open({ w: W, h: H, dpr: 2 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const shots = [];
  const KEEP = /rising 0.6|just under|reef 1|reef 2|seals ahead|hopping|orca on|boop \+0.7|sinking \+0.7|coming up/;
  const snap = async (label) => { await new Promise((r) => setTimeout(r, 120)); await page.evaluate(() => window.__mj.render()); const buf = await page.screenshot({ type: 'png' }); shots.push({ label, buf }); if (KEEP.test(label)) require('fs').writeFileSync(`shots/${TAG}-${label.replace(/[^a-z0-9]+/gi, '_')}.png`, buf); };
  const begin = async (depth) => { await ev(`m.Save.data.runs = 5; m.Save.data.owned = ['monkey','smokey','pig','elephant','dino']; m.Save.data.char = '${WHO}'; m.Seg.startDepth = ${depth}; m.Game.toTitle(); m.Game.startIntro(false);`); await until(page, 'm.Game.state === "run"', 5, false); };

  // 1. the tide comes in on the last stretch of level 1
  await begin(D0 - 2);
  await until(page, 'm.Game.run.turns >= 1', 30, true);
  await snap('corner: tide ' + (await ev('return m.Tide.y.toFixed(1)')));
  for (const y of [-1.2, 0.6, 2.2]) { await until(page, `m.Tide.y > ${y}`, 6, true); await snap('rising ' + y); }
  await until(page, 'm.Tide.under', 6, true); await step(page, 0.12, true); await snap('just under');
  await step(page, 1.6, true); await snap('flooded jungle');
  // 2. round the corner into level 2
  await until(page, `m.Game.run.level === ${LV}`, 20, true); await step(page, 0.35, true); await snap('level ' + LV + ' banner');
  await step(page, 1.6, true); await snap('reef 1');
  await step(page, 2.2, true); await snap('reef 2');
  // 3. seals
  const seal = await page.evaluate(() => { const m = window.__mj, G = m.Game, P = m.Player; let t = 0; const ahead = () => P.seg.obstacles.find((o) => o.skin === 'seal' && !o.gone && o.s - P.s > 4 && o.s - P.s < 9); while (G.state === 'run' && !ahead() && t < 40) { m.Bot.think(); G.update(1 / 60); t += 1 / 60; } m.render(); return !!ahead(); });
  await snap(seal ? 'seals ahead' : 'no seals found');
  await step(page, 0.28, true); await snap('hopping them');
  // 4. the orca
  await until(page, 'm.Player.grounded && m.Game.run.danger <= 0', 5, true);
  await ev('m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "seal" })'); await step(page, 0.5, true); await snap('orca on his tail');
  await step(page, 0.5, true); await snap('orca closer');
  await ev('m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "seal" })');
  for (const t of [0.25, 0.3, 0.45, 0.7]) { await step(page, t, false); await snap('boop +' + t); }
  await until(page, 'm.Game.state === "over"', 8, false); await new Promise((r) => setTimeout(r, 500)); await snap('booped card');
  // 5. sinking
  await page.evaluate((D0) => { // find an opening stretch with a gap right across it and a clear run-up, then run straight in
    const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      m.Save.data.runs = 5; m.Seg.startDepth = D0 + 1; G.toTitle(); G.startIntro(false);
      let t = 0; while (G.state !== 'run' && t < 5) { G.update(dt); t += dt; }
      const h = P.seg.holes.find((q) => q.x0 < -50 && q.x1 > 50 && q.s0 > P.s + 10 && !P.seg.obstacles.some((o) => o.s1 > q.s0 - 10 && o.s0 < q.s0));
      if (!h) continue;
      P.s = h.s0 - 8; P.place();
      while (G.state === 'run' && t < 30) { G.update(dt); t += dt; }
      break;
    }
  }, D0);
  for (const t of [0.5, 0.7, 0.9]) { await step(page, t, false); await snap('sinking +' + t); }
  await until(page, 'm.Game.state === "over"', 8, false); await new Promise((r) => setTimeout(r, 500)); await snap('sunk card');
  // 6. the tide goes out at the end of the level
  await begin(D0 + 3);
  await step(page, 1.2, true); await snap('last sea stretch');
  await until(page, `m.Game.run.level === ${LV + 1}`, 25, true); await step(page, 0.4, true); await snap('next level banner');
  await until(page, '!m.Tide.under', 6, true); await step(page, 0.15, true); await snap('coming up');
  await step(page, 0.7, true); await snap('draining');
  await step(page, 1.6, true); await snap('dry again');
  await ev('m.Seg.startDepth = 0');

  const cols = W > H ? 4 : 6, sc = W > H ? 0.5 : 0.62, w = Math.round(W * sc), h = Math.round(H * sc), rows = Math.ceil(shots.length / cols);
  const tiles = await Promise.all(shots.map((s) => sharp(s.buf).resize(w, h).toBuffer()));
  const per = cols * 2;
  for (let p = 0; p * per < shots.length; p++) {
    const part = tiles.slice(p * per, (p + 1) * per);
    await sharp({ create: { width: w * cols, height: h * Math.ceil(part.length / cols), channels: 3, background: '#222' } })
      .composite(part.map((b, i) => ({ input: b, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(`shots/${TAG}-${p + 1}.png`);
  }
  console.log(shots.map((s, i) => `${i + 1}:${s.label}`).join(' | '));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
