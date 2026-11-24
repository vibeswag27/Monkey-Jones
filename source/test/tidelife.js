// Close-ups of what High Tide puts behind you and in your way: the shark from four sides, and the giant clams as a runner meets them.
// → shots/tidelife.png
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const { browser, page, errors } = await open({ w: 560, h: 420, dpr: 2, touch: false });
  await page.addStyleTag({ content: '.layer{display:none!important}' });
  const shots = [];
  // the shark, lifted out of the game onto a plain floor
  for (const v of [[3.2, 0.5, -6.5], [5.5, 1.6, -4.5], [-7.5, 1.6, 0.6], [0.8, 4.6, 6.2], [0.3, 0.25, -6.2]]) {
    await page.evaluate((v) => {
      const m = window.__mj, sc = m.scene, cam = m.camera;
      if (!window.__floor) { window.__floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9dcb8 })); window.__floor.position.y = 100; sc.add(window.__floor); }
      for (const o of sc.children) if (!o.isLight) o.visible = false;
      window.__floor.visible = true;
      const g = m.shark.group; g.visible = true; g.position.set(0, 100, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1); m.shark.update(0.3, 1.2, 12, 0);
      sc.background = new THREE.Color(0xcfe9ee); sc.fog.near = 500; sc.fog.far = 900;
      cam.fov = 30; cam.position.set(v[0], 100 + v[1], v[2]); cam.lookAt(0, 100.95, 0.6); cam.updateProjectionMatrix();
      m.render();
    }, v);
    shots.push(await page.screenshot({ type: 'png' }));
  }
  // the clams, where they lie in a real stretch of High Tide
  await page.reload(); await page.waitForFunction(() => window.__mj); await page.addStyleTag({ content: '.layer{display:none!important}' });
  await page.evaluate(() => { const m = window.__mj; m.Save.data.map = 'tide'; m.Save.data.runs = 5; m.Game.toTitle(); m.Game.startIntro(false); });
  await until(page, 'm.Game.state === "run"', 5, false);
  for (const lanes of [3, 2, 1]) {
    const found = await page.evaluate((lanes) => { const m = window.__mj, G = m.Game, P = m.Player; let t = 0;
      const pick = () => P.seg.obstacles.find((o) => o.skin === 'clam' && !o.gone && o.l1 - o.l0 + 1 === lanes && o.s - P.s > 6 && o.s - P.s < 30);
      while (G.state === 'run' && !pick() && t < 200) { G.run.invuln = 1; G.run.danger = 0; m.Bot.think(); G.update(1 / 60); t += 1 / 60; }
      const o = pick(); if (!o) return false;
      const seg = P.seg, xc = (o.x0 + o.x1) / 2, cam = m.camera; m.monkey.root.visible = false; m.monkey.shadow.visible = false; m.shark.group.visible = false;
      window.__look = (back, side, up, fov) => { cam.fov = fov; cam.position.set(seg.wx(o.s - back, xc + side), up, seg.wz(o.s - back, xc + side)); cam.lookAt(seg.wx(o.s, xc), 0.42, seg.wz(o.s, xc)); cam.updateProjectionMatrix(); m.render(); };
      return true; }, lanes);
    if (!found) { console.log('no ' + lanes + '-lane clam row found'); continue; }
    for (const [back, side, up, fov] of lanes === 3 ? [[5.2, 0, 3.1, 60], [3.4, 0.4, 1.2, 46]] : lanes === 2 ? [[3.0, 2.6, 1.5, 40]] : [[2.3, 0.5, 0.9, 40], [1.2, 1.9, 2.4, 44]]) {
      await page.evaluate(([b, s, u, f]) => window.__look(b, s, u, f), [back, side, up, fov]); shots.push(await page.screenshot({ type: 'png' }));
    }
    await page.evaluate(() => { const m = window.__mj; m.monkey.root.visible = true; });
  }
  const W = 560, H = 420, cols = 5, rows = Math.ceil(shots.length / cols);
  const tiles = await Promise.all(shots.map((b) => sharp(b).resize(W, H).toBuffer()));
  await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#fff' } }).composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H }))).png().toFile('shots/tidelife.png');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'sheet written: ' + shots.length + ' pictures');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
