// The tide must never leak out of a run: restarting, going home, pausing and the game-over card are all checked here.
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const shots = [];
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  for (const [w, h] of [[390, 760], [320, 568], [667, 375]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 2 });
    const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
    const state = () => ev('return { y: +m.Tide.y.toFixed(2), under: m.Tide.under, sub: m.sky.sub, seaOn: document.getElementById("sea").classList.contains("on"), fogFar: Math.round(m.scene.fog.far), orca: m.scene.children.some((o) => o.visible && o.children.length && o === m.Game && 0), st: m.Game.state, level: m.Game.run.level }');
    const snap = async (label) => { await new Promise((r) => setTimeout(r, 350)); await page.evaluate(() => window.__mj.render()); shots.push({ label: `${w}x${h} ${label}`, buf: await page.screenshot({ type: 'png' }), w, h }); };
    // into the sea level and under
    await ev('m.Save.data.runs = 5; m.Seg.startDepth = 4; m.Game.toTitle(); m.Game.startIntro(false);');
    await until(page, 'm.Game.state === "run" && m.Tide.under', 8, true); await step(page, 1.0, true);
    let s = await state(); check(`${w}x${h} under water during a High Tide level`, s.under && s.seaOn && s.fogFar < 100, JSON.stringify(s));
    // pause freezes the tide
    await ev('m.Game.pause()'); const y0 = (await state()).y; await step(page, 1.0, false); s = await state();
    check(`${w}x${h} paused: nothing moves`, s.st === 'pause' && s.y === y0); await snap('paused under water');
    await ev('m.Game.state = "run"; m.UI.setState("run"); m.Sound.wake();');
    // game over card under water (5 rows of stats)
    await ev('m.Game.run.invuln = 0; m.Game.run.danger = 0; m.Game.stumble({ type: "log", skin: "seal" }); m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "seal" });');
    await until(page, 'm.Game.state === "over"', 8, false); await snap('booped card');
    const card = await page.evaluate(() => { const r = document.querySelector('#over .card').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }; });
    check(`${w}x${h} game-over card fits on screen`, card.top >= 0 && card.bottom <= card.vh, JSON.stringify(card));
    // restart: dry land again
    await ev('m.Seg.startDepth = 0; m.Game.restart();'); await step(page, 0.3, false); s = await state();
    check(`${w}x${h} restart is back on dry land`, !s.under && !s.seaOn && s.y === -6.5 && s.fogFar === 168 && s.level === 1, JSON.stringify(s));
    await until(page, 'm.Game.state === "run"', 5, false); await step(page, 0.6, true); await snap('fresh run');
    // home from under water
    await ev('m.Seg.startDepth = 4; m.Game.toTitle(); m.Game.startIntro(false);'); await until(page, 'm.Tide.under', 8, true);
    await ev('m.Seg.startDepth = 0; m.Game.toTitle();'); await step(page, 0.5, false); s = await state();
    const banner = await page.evaluate(() => getComputedStyle(document.getElementById('levelUp')).visibility);
    check(`${w}x${h} home screen is dry, with no level banner left over`, !s.under && !s.seaOn && s.y === -6.5 && s.fogFar === 168 && banner === 'hidden', JSON.stringify(s) + ' banner ' + banner); await snap('title after the sea');
    console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
    await browser.close();
  }
  const cw = 300, tiles = await Promise.all(shots.map(async (s) => ({ input: await sharp(s.buf).resize(cw, Math.round(cw * s.h / s.w)).extend({ bottom: Math.max(0, Math.round(cw * 760 / 390) - Math.round(cw * s.h / s.w)), background: '#222' }).toBuffer() })));
  const ch = Math.round(cw * 760 / 390);
  await sharp({ create: { width: cw * 4, height: ch * 3, channels: 3, background: '#222' } }).composite(tiles.map((t, i) => ({ input: t.input, left: (i % 4) * cw, top: Math.floor(i / 4) * ch }))).png().toFile('shots/states.png');
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
