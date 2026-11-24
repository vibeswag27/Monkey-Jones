// A walk through the High Tide level with a camera: the home screen, the shark coming out of the temple, the reef, clams,
// the chase, both watery endings and a night level. Contact sheets go to shots/.
//   node test/sea.js [w] [h] [tag] [character id]
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 760), TAG = process.argv[4] || 'sea', WHO = process.argv[5] || 'monkey';
(async () => {
  const { browser, page, errors } = await open({ w: W, h: H, dpr: 2 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const shots = [];
  const KEEP = /home|intro|reef 1|clams ahead|shark on|boop|night/;
  const snap = async (label) => { await new Promise((r) => setTimeout(r, 120)); await page.evaluate(() => window.__mj.render()); const buf = await page.screenshot({ type: 'png' }); shots.push({ label, buf }); if (KEEP.test(label)) require('fs').writeFileSync(`shots/${TAG}-${label.replace(/[^a-z0-9]+/gi, '_')}.png`, buf); };
  const home = (depth) => ev(`m.Save.data.runs = 5; m.Save.data.map = 'tide'; m.Save.data.char = '${WHO}'; m.Seg.startDepth = ${depth}; m.Game.toTitle();`);
  const begin = async (depth) => { await home(depth); await ev('m.Game.startIntro(false)'); await until(page, 'm.Game.state === "run"', 5, false); };

  // 1. home screen, then the start of a run
  await home(0); await step(page, 1.0); await new Promise((r) => setTimeout(r, 400)); await snap('home');
  await ev('m.Game.startIntro(false)');
  for (const t of [0.3, 0.3, 0.3, 0.3, 0.3]) { await step(page, t); await snap('intro'); }
  await until(page, 'm.Game.state === "run"', 5, false); await step(page, 0.5, true); await snap('level 1 banner');
  await step(page, 2.0, true); await snap('reef 1');
  await step(page, 2.4, true); await snap('reef 2');
  // 2. clams
  const clam = await page.evaluate(() => { const m = window.__mj, G = m.Game, P = m.Player; let t = 0; const ahead = () => P.seg.obstacles.find((o) => o.skin === 'clam' && !o.gone && o.s - P.s > 4 && o.s - P.s < 9); while (G.state === 'run' && !ahead() && t < 40) { m.Bot.think(); G.update(1 / 60); t += 1 / 60; } m.render(); return !!ahead(); });
  await snap(clam ? 'clams ahead' : 'no clams found');
  await step(page, 0.28, true); await snap('hopping them');
  // 3. the shark
  await until(page, 'm.Player.grounded && m.Game.run.danger <= 0', 8, true);
  await ev('m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "clam" })'); await step(page, 0.6, true); await snap('shark on his tail');
  await ev('m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "clam" })');
  for (const t of [0.25, 0.45, 0.7]) { await step(page, t, false); await snap('boop +' + t); }
  await until(page, 'm.Game.state === "over"', 8, false); await new Promise((r) => setTimeout(r, 500)); await snap('booped card');
  // 4. sinking: find an opening stretch with a gap right across it and a clear run-up, then run straight in
  await page.evaluate(() => {
    const m = window.__mj, G = m.Game, P = m.Player, dt = 1 / 60;
    for (let i = 0; i < 80; i++) {
      m.Save.data.runs = 5; m.Seg.startDepth = 3; G.toTitle(); G.startIntro(false);
      let t = 0; while (G.state !== 'run' && t < 5) { G.update(dt); t += dt; }
      const h = P.seg.holes.find((q) => q.x0 < -50 && q.x1 > 50 && q.s0 > P.s + 10 && !P.seg.obstacles.some((o) => o.s1 > q.s0 - 10 && o.s0 < q.s0));
      if (!h) continue;
      P.s = h.s0 - 8; P.place();
      while (G.state === 'run' && t < 30) { G.update(dt); t += dt; }
      break;
    }
  });
  for (const t of [0.5, 0.7]) { await step(page, t, false); await snap('sinking +' + t); }
  await until(page, 'm.Game.state === "over"', 8, false); await new Promise((r) => setTimeout(r, 500)); await snap('sunk card');
  // 5. later levels: sunset, then night
  await begin(3); await until(page, 'm.Game.run.level === 2', 25, true); await step(page, 0.4, true); await snap('level 2 banner');
  await begin(8); await step(page, 5.5, true); await snap('night 1');
  await step(page, 2.5, true); await snap('night 2');
  await ev('m.Seg.startDepth = 0; m.Save.data.map = "ruins"; m.Game.toTitle();'); await step(page, 0.6); await snap('home, back in the ruins');

  const cols = W > H ? 4 : 6, sc = W > H ? 0.5 : 0.62, w = Math.round(W * sc), h = Math.round(H * sc), per = cols * 2;
  const tiles = await Promise.all(shots.map((s) => sharp(s.buf).resize(w, h).toBuffer()));
  for (let p = 0; p * per < shots.length; p++) {
    const part = tiles.slice(p * per, (p + 1) * per);
    await sharp({ create: { width: w * cols, height: h * Math.ceil(part.length / cols), channels: 3, background: '#222' } })
      .composite(part.map((b, i) => ({ input: b, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(`shots/${TAG}-${p + 1}.png`);
  }
  console.log(shots.map((s, i) => `${i + 1}:${s.label}`).join(' | '));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
