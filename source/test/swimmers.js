// The seal and the orca as runners, in pictures: home screen, character screen, the start, swimming, a leap, a dive under a beam,
// the rocket, shield and springs, a stumble, and the three endings. One contact sheet each in shots/.
//   node test/swimmers.js [seal|orca|both] [w] [h]
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
const WHO = process.argv[2] && process.argv[2] !== 'both' ? [process.argv[2]] : ['seal', 'orca'], W = +(process.argv[3] || 390), H = +(process.argv[4] || 844), QUICK = process.argv[5] === 'quick';
(async () => {
  const { browser, page, errors } = await open({ w: W, h: H, dpr: 2 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  for (const who of WHO) {
    const shots = [];
    const snap = async (label, keep) => { await page.waitForTimeout(140); await page.evaluate(() => window.__mj.render()); const buf = await page.screenshot({ type: 'png' }); shots.push({ label, buf }); if (keep) require('fs').writeFileSync(`shots/swim-${who}-${label.replace(/[^a-z0-9]+/gi, '_')}.png`, buf); };
    const fresh = async (depth) => { await ev(`m.Save.data.runs = 5; m.Save.data.map = 'tide'; m.Save.data.seaChar = '${who}'; m.Seg.startDepth = ${depth || 0}; m.Game.toTitle();`); };
    const begin = async (depth) => { await fresh(depth); await ev('m.Game.startIntro(false)'); await until(page, 'm.Game.state === "run"', 5, false); };
    // run with the autopilot until an obstacle of this kind is `gap` metres ahead in his lane or right across
    const upTo = (type, gap) => page.evaluate(({ type, gap }) => { const m = window.__mj, G = m.Game, P = m.Player; let t = 0;
      const near = () => P.seg.obstacles.find((o) => o.type === type && !o.gone && o.s0 - P.s > gap - 0.6 && o.s0 - P.s < gap);
      while (G.state === 'run' && !near() && t < 60) { m.Bot.think(); G.update(1 / 60); t += 1 / 60; } m.render(); return !!near(); }, { type, gap });

    await fresh(); await step(page, 1.3); await snap('home', true); await step(page, 2.2); await snap('home 2');
    await ev('m.UI.openChars()'); await step(page, 1.6); await snap('characters', true); await ev('m.UI.closeChars()'); await step(page, 0.5);
    await ev('m.Game.startIntro(false)'); await step(page, 0.3); await snap('startled'); await step(page, 0.6); await snap('off');
    await until(page, 'm.Game.state === "run"', 5, false); await step(page, 0.7, true); await snap('swimming', true); await step(page, 0.22, true); await snap('swimming 2');
    // a leap over napping seals
    if (await upTo('log', 3.2)) { await step(page, 0.14, true); await snap('leap up', true); await step(page, 0.2, true); await snap('leap over'); await step(page, 0.2, true); await snap('coming down'); }
    // a dive under a beam
    if (await upTo('beam', 7)) { await snap('beam ahead'); await until(page, 'm.Player.slide > 0', 3, true); await step(page, 0.12, true); await snap('dive', true); await step(page, 0.16, true); await snap('under it'); }
    if (!QUICK) {
    // a lane change
    await until(page, 'm.Player.grounded && Math.abs(m.Player.x - m.Player.lane * 1.9) > 0.5', 20, true); await snap('banking');
    // powers
    await until(page, 'm.Player.grounded && m.Player.slide <= 0', 5, true);
    await ev('m.Game.take({ kind: "shield", got: false, sprite: null }); m.Game.take({ kind: "springs", got: false, sprite: null });'); await step(page, 0.5, true); await snap('shield and springs', true);
    await ev('m.Player.input("up")'); await step(page, 0.3, true); await snap('spring leap');
    await until(page, 'm.Player.grounded', 4, true);
    await ev('m.Game.take({ kind: "rocket", got: false, sprite: null });'); await step(page, 1.1, true); await snap('rocket', true); await step(page, 0.4, true); await snap('rocket 2');
    await until(page, '!m.Player.flying && m.Player.grounded && m.Game.run.ghost <= 0', 30, true); // (just down from a flight nothing can touch it for a moment)
    // a stumble
    await ev('m.Game.run.shield = false; m.monkey.bubble.visible = false; m.Game.run.invuln = 0; m.Game.run.danger = 0; m.Game.stumble({ type: "log", skin: "seal" })'); await step(page, 0.2, true); await snap('stumble'); await step(page, 0.3, true); await snap('orca close');
    // booped
    await ev('m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "seal" })'); await step(page, 0.3); await snap('boop'); await step(page, 0.5); await snap('boop 2');
    await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(500); await snap('booped card', true);
    // bonk
    await begin(); await step(page, 1.0, true); await ev('m.Player.die("bonk")'); await step(page, 0.3); await snap('bonk'); await step(page, 1.0); await snap('seeing stars', true);
    await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(500); await snap('bonk card');
    // pulled under
    await begin(); await step(page, 1.0, true); await ev('m.Player.die("fall")'); await step(page, 0.7); await snap('pulled under'); await step(page, 0.6); await snap('going down');
    await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(500); await snap('sunk card');
    }

    const cols = 7, sc = 0.56, w = Math.round(W * sc), h = Math.round(H * sc);
    const tiles = await Promise.all(shots.map((s) => sharp(s.buf).resize(w, h).toBuffer()));
    for (let p = 0; p * cols * 2 < tiles.length; p++) {
      const part = tiles.slice(p * cols * 2, (p + 1) * cols * 2);
      await sharp({ create: { width: w * cols, height: h * Math.ceil(part.length / cols), channels: 3, background: '#222' } }).composite(part.map((b, i) => ({ input: b, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(`shots/swim-${who}-${p + 1}.png`);
    }
    console.log(who + ': ' + shots.map((s, i) => `${i + 1}:${s.label}`).join(' | '));
  }
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
