// The seal that circles behind the runner on the High Tide home screen must be out of the way before the shark comes through,
// from the home screen and from "Run again", whatever point of its lap it has reached. Boxes are compared, so this is strict.
const { open } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 844, dpr: 1 });
  let fails = 0;
  for (const quick of [false, true]) {
    let worst = 99, frames = 0;
    for (let i = 0; i < 14; i++) {
      const r = await page.evaluate((quick) => {
        const m = window.__mj, G = m.Game, dt = 1 / 60; m.Save.data.map = 'tide'; m.Save.data.runs = 5; G.toTitle();
        for (let k = 0; k < Math.floor(Math.random() * 500); k++) G.update(dt); // any moment of its lap
        if (quick) G.restart(); else G.startIntro(false);
        const seal = m.world.cur.critters.find((c) => c.home);
        const bo = new THREE.Box3(), bs = new THREE.Box3(); let gap = 99, t = 0, seen = 0;
        while (t < 4 && G.state !== 'over') { G.update(dt); t += dt;
          if (!m.shark.group.visible) continue; seen++;
          m.shark.group.updateWorldMatrix(true, true); seal.obj.updateWorldMatrix(true, true);
          bo.setFromObject(m.shark.group); bs.setFromObject(seal.obj);
          const dx = Math.max(0, bs.min.x - bo.max.x, bo.min.x - bs.max.x), dy = Math.max(0, bs.min.y - bo.max.y, bo.min.y - bs.max.y), dz = Math.max(0, bs.min.z - bo.max.z, bo.min.z - bs.max.z);
          gap = Math.min(gap, Math.hypot(dx, dy, dz)); }
        return { gap, seen, found: !!seal };
      }, quick);
      if (!r.found) { fails++; console.log('FAIL no home seal in the first stretch'); break; }
      worst = Math.min(worst, r.gap); frames += r.seen;
    }
    const ok = worst > 1 && frames > 500;
    if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${quick ? '"Run again"' : 'from the home screen'}: closest the shark came to the seal ${worst.toFixed(2)} m (over ${frames} frames with the shark showing)`);
  }
  const land = await page.evaluate(() => { const m = window.__mj; m.Save.data.map = 'ruins'; m.Game.toTitle(); return m.world.cur.critters.length; });
  if (land !== 0) { fails++; console.log('FAIL sea creatures on dry land: ' + land); } else console.log('ok   no sea creatures in Jungle Ruins');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  await browser.close(); if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
