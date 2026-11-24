// Pictures of the swimmers on the home screen and the Characters screen, on three screen shapes → shots/chars-test.png
// Also checks that the Characters screen's controls stay on the screen and clear of each other.
const { open, step } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const tiles = []; let fails = 0;
  for (const [w, h] of [[390, 844], [320, 568], [667, 375]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 2 });
    for (const who of ['seal', 'orca']) {
      await page.evaluate((who) => { const m = window.__mj; m.Save.data.map = 'tide'; m.Save.data.char = 'monkey'; m.Save.data.seaChar = who; m.Save.data.owned = ['monkey']; m.Save.data.wallet = 37; m.Game.toTitle(); }, who);
      await step(page, 2.0, false); await page.waitForTimeout(300); await page.evaluate(() => window.__mj.render());
      tiles.push({ buf: await page.screenshot({ type: 'png' }), w, h });
      await page.evaluate(() => window.__mj.UI.openChars()); await step(page, 2.2, false); await page.waitForTimeout(300); await page.evaluate(() => window.__mj.render());
      tiles.push({ buf: await page.screenshot({ type: 'png' }), w, h });
      const lay = await page.evaluate(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
        const o = { name: r('charName'), blurb: r('charBlurb'), dots: r('charDots'), go: r('btnCharGo'), need: r('charNeed'), done: r('btnCharDone'), prev: r('btnPrev'), next: r('btnNext') }, vw = innerWidth, vh = innerHeight;
        const out = Object.keys(o).filter((k) => o[k][0] < 0 || o[k][1] < 0 || o[k][2] > vw || o[k][3] > vh);
        const stack = ['go', 'need', 'done'], over = stack.filter((k, i) => i && o[k][1] < o[stack[i - 1]][3] - 1);
        return { out, over, note: document.getElementById('charNeed').textContent, needH: o.need[3] - o.need[1] }; });
      const ok = !lay.out.length && !lay.over.length && lay.note === 'High Tide only · free for testing' && lay.needH < 30;
      if (!ok) fails++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${w}x${h} ${who}: character screen controls fit, note on one line`, ok ? '' : JSON.stringify(lay));
      await page.evaluate(() => window.__mj.UI.closeChars());
    }
    console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
    await browser.close();
  }
  const cw = 300, ch = Math.round(cw * 844 / 390);
  const imgs = await Promise.all(tiles.map(async (s) => { const th = Math.min(ch, Math.round(cw * s.h / s.w)); return { input: await sharp(s.buf).resize(cw, th).extend({ bottom: ch - th, background: '#222' }).toBuffer() }; }));
  await sharp({ create: { width: cw * 4, height: ch * 3, channels: 3, background: '#222' } }).composite(imgs.map((t, i) => ({ input: t.input, left: (i % 4) * cw, top: Math.floor(i / 4) * ch }))).png().toFile('shots/chars-test.png');
  console.log(fails ? `FAIL: ${fails}` : 'PASS'); if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
