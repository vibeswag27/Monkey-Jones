// Pictures of the Characters screen (with the testing note) in both levels on three screens → shots/chars-test.png
const { open, step } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const tiles = [];
  for (const [w, h] of [[390, 844], [320, 568], [667, 375]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 2 });
    for (const [map, n] of [['tide', 2], ['ruins', 4]]) {
      await page.evaluate(({ map, n }) => { const m = window.__mj; m.Save.data.map = map; m.Save.data.char = 'monkey'; m.Save.data.owned = ['monkey']; m.Save.data.wallet = 37; m.Game.toTitle(); m.UI.openChars(); for (let i = 0; i < n; i++) m.UI.browse(1); }, { map, n });
      await step(page, 2.2, false); await page.waitForTimeout(300); await page.evaluate(() => window.__mj.render());
      const buf = await page.screenshot({ type: 'png' }); tiles.push({ buf, w, h });
      const lay = await page.evaluate(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; return { need: r('charNeed'), go: r('btnCharGo'), done: r('btnCharDone'), vh: innerHeight, note: document.getElementById('charNeed').textContent }; });
      console.log(`${w}x${h} ${map}`, JSON.stringify(lay));
      await page.evaluate(() => window.__mj.UI.closeChars());
    }
    console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
    await browser.close();
  }
  const cw = 320, ch = Math.round(cw * 844 / 390);
  const imgs = await Promise.all(tiles.map(async (s) => { const th = Math.min(ch, Math.round(cw * s.h / s.w)); return { input: await sharp(s.buf).resize(cw, th).extend({ bottom: ch - th, background: '#222' }).toBuffer() }; }));
  await sharp({ create: { width: cw * 6, height: ch, channels: 3, background: '#222' } }).composite(imgs.map((t, i) => ({ input: t.input, left: i * cw, top: 0 }))).png().toFile('shots/chars-test.png');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
