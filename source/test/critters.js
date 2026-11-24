// Close-ups of the seal and the orca from a few angles, to check them against the plush photos.
const { open, step } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const { browser, page, errors } = await open({ w: 560, h: 420, dpr: 2, touch: false });
  await step(page, 0.5);
  await page.addStyleTag({ content: '.layer{display:none!important}' });
  const shots = [];
  for (const [kind, views] of [['seal', [[2.6, 1.0, -2.8], [-3.2, 1.4, 0.4], [0.2, 0.9, -3.4], [2.2, 2.6, 2.4]]], ['sealNap', [[2.6, 1.0, -2.8], [0.2, 0.9, -3.4]]], ['orca', [[5.5, 1.2, -5.5], [-6.5, 1.5, 1.0], [0.5, 0.6, -7.5], [4.5, 4.5, 5.5]]]]) {
    for (const v of views) {
      await page.evaluate(({ kind, v }) => {
        const m = window.__mj, sc = m.scene, cam = m.camera;
        if (!window.__stage) { window.__stage = new THREE.Group(); sc.add(window.__stage); }
        const st = window.__stage; while (st.children.length) st.remove(st.children[0]);
        for (const o of sc.children) if (o !== st && !o.isLight) o.visible = false;
        sc.background = new THREE.Color(0xcfe9ee); sc.fog.near = 500; sc.fog.far = 900;
        const G = m.seaGeo();
        const key = kind === 'orca' ? 'orca' : kind;
        const mesh = new THREE.Mesh(G[key], m.MAT.char); mesh.add(new THREE.Mesh(G[key + 'Ink'], kind === 'orca' ? m.MAT.inkDark : m.MAT.ink));
        const lift = kind === 'orca' ? 0.9 : 0;
        mesh.position.set(0, 100 + lift, 0); st.add(mesh);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9dcb8 })); floor.position.y = 100; st.add(floor);
        cam.fov = 30; cam.position.set(v[0], 100 + v[1], v[2]); cam.lookAt(0, 100 + (kind === 'orca' ? 0.8 : 0.4), kind === 'orca' ? 0.2 : 0.1); cam.updateProjectionMatrix();
        m.render();
      }, { kind, v });
      shots.push(await page.screenshot({ type: 'png' }));
    }
  }
  const W = 560, H = 420, cols = 4, rows = Math.ceil(shots.length / cols);
  const tiles = await Promise.all(shots.map((b) => sharp(b).resize(W, H).toBuffer()));
  await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#fff' } }).composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H }))).png().toFile('shots/critters.png');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'critters sheet written');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
