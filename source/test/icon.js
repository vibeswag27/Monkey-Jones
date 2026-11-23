// Renders the app icon: Monkey Jones head-and-shoulders on a flat lagoon background.
const { open, step } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const { browser, page, errors } = await open({ w: 512, h: 512, dpr: 2 });
  await step(page, 2.4);
  await page.addStyleTag({ content: '.layer{display:none!important}' });
  await page.evaluate(() => {
    const m = window.__mj, mk = m.monkey, scene = mk.root.parent, cam = m.camera;
    for (const o of scene.children) if (o !== mk.root && !o.isLight && !(o.parent && o.type === 'Object3D')) o.visible = false;
    scene.background = new THREE.Color(0x19b9b4);
    cam.fov = 25; cam.position.set(mk.root.position.x + 0.32, 1.22, mk.root.position.z - 3.45); cam.lookAt(mk.root.position.x - 0.08, 1.2, mk.root.position.z); cam.updateProjectionMatrix();
    m.render();
  });
  const buf = await page.screenshot({ type: 'png' });
  for (const s of [512, 192, 180]) await sharp(buf).resize(s, s).png().toFile(require('path').join(__dirname, '..', '..', `icon-${s}.png`));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'icons written');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
