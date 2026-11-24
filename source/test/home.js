// The home screen for each level, on three screens, at three moments. Full-size pictures go to shots/home-*.png.
const { open, step } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const tiles = [];
  for (const [w, h] of [[390, 760], [320, 568], [667, 375]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 2 });
    for (const map of ['tide', 'ruins']) {
      await page.evaluate((map) => { const m = window.__mj; m.Save.data.map = map; m.Game.toTitle(); }, map);
      for (const t of map === 'tide' ? [1.2, 2.4, 2.4] : [1.2]) {
        await step(page, t, false); await page.waitForTimeout(250); await page.evaluate(() => window.__mj.render());
        const buf = await page.screenshot({ type: 'png' }); tiles.push({ buf, w, h });
        require('fs').writeFileSync(`shots/home-${map}-${w}x${h}-${tiles.length}.png`, buf);
      }
    }
    console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
    await browser.close();
  }
  const cw = 300, ch = Math.round(cw * 760 / 390);
  const imgs = await Promise.all(tiles.map(async (s) => { const th = Math.min(ch, Math.round(cw * s.h / s.w)); return { input: await sharp(s.buf).resize(cw, th).extend({ bottom: ch - th, background: '#222' }).toBuffer() }; }));
  await sharp({ create: { width: cw * 4, height: ch * 3, channels: 3, background: '#222' } }).composite(imgs.map((t, i) => ({ input: t.input, left: (i % 4) * cw, top: Math.floor(i / 4) * ch }))).png().toFile('shots/home.png');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
