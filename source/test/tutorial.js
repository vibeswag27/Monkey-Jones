// A first-ever run in each level: the four hints must come up in order beside the right obstacle, and the lesson must be passable.
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 844, dpr: 1 });
  let fails = 0; const tiles = [];
  for (const map of ['ruins', 'tide']) {
    await page.evaluate((map) => { const m = window.__mj; m.Save.data.map = map; m.Save.data.runs = 0; m.Game.toTitle(); m.Game.startIntro(false); }, map);
    await until(page, 'm.Game.state === "run"', 5, false);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const r = await page.evaluate((i) => { const m = window.__mj, G = m.Game, dt = 1 / 60; let t = 0;
        while (G.state === 'run' && G.hintOn !== i && t < 30) { m.Bot.think(); G.update(dt); t += dt; }
        for (let k = 0; k < 12 && G.state === 'run'; k++) { m.Bot.think(); G.update(dt); }
        m.render(); const P = m.Player, o = P.seg.obstacles.filter((o) => o.s > P.s - 2).sort((a, b) => a.s - b.s)[0];
        return { hint: document.getElementById('hintText').textContent, on: document.getElementById('hint').classList.contains('on'), state: G.state, next: o ? o.type + (o.skin ? '/' + o.skin : '') + '@' + (o.s - P.s).toFixed(0) : 'none', sea: m.Tide.wet };
      }, i);
      seen.push(r); await page.waitForTimeout(250); tiles.push(await page.screenshot({ type: 'png' }));
    }
    const end = await until(page, 'm.Game.state !== "run" || m.Game.run.turns >= 2', 60, true);
    const want = ['Swipe up to jump', 'Swipe down to slide', 'Swipe right to dodge', 'Swipe left or right to turn'];
    const ok = seen.every((s, i) => s.on && s.hint === want[i] && s.state === 'run' && s.sea === (map === 'tide')) && end.state === 'run' && end.turns >= 2 && (map !== 'tide' || /clam/.test(seen[0].next));
    if (!ok) fails++;
    console.log((ok ? 'ok   ' : 'FAIL ') + map + ': ' + seen.map((s) => `"${s.hint}" → ${s.next}`).join(' | ') + ` | then ${end.turns} corners, ${end.state}`);
    await page.evaluate(() => { const m = window.__mj; if (m.Game.state === 'run') m.Player.die('bonk'); }); await until(page, 'm.Game.state === "over"', 8, false);
  }
  const tw = 244, th = Math.round(244 * 844 / 390), imgs = await Promise.all(tiles.map((b) => sharp(b).resize(tw, th).toBuffer()));
  await sharp({ create: { width: tw * 4, height: th * 2, channels: 3, background: '#222' } }).composite(imgs.map((b, i) => ({ input: b, left: (i % 4) * tw, top: Math.floor(i / 4) * th }))).png().toFile('shots/tutorial.png');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  await browser.close(); if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
