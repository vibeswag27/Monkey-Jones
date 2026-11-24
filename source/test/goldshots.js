// Pictures of the Golden Banana's screens and moments, for looking at.   node test/goldshots.js [out dir] [what,what…]
//   home, hud, shop: the stock on the home screen, the golden button in a run, the Upgrades row (portrait and landscape)
const fs = require('fs');
const { open, until } = require('./lib2');
(async () => {
  const out = process.argv[2] || '/tmp/gold', want = (process.argv[3] || 'home,hud,shop').split(',');
  fs.mkdirSync(out, { recursive: true });
  const made = [];
  const snap = async (page, name) => { await page.evaluate(() => window.__mj.render()); const f = `${out}/${name}.png`; await page.screenshot({ path: f }); made.push(f); };
  for (const [tag, w, h] of [['p', 390, 760], ['l', 760, 390]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 1 });
    if (want.includes('home')) { await page.evaluate(() => { const m = window.__mj; m.Save.data.gold = 5; m.Save.data.wallet = 1234; m.Save.data.best = 45678; m.Game.toTitle(); m.Game.update(1 / 60); }); await snap(page, 'home-' + tag); }
    if (want.includes('hud')) {
      await page.evaluate(() => { const m = window.__mj; m.Save.data.runs = 5; m.Save.data.gold = 5; m.Seg.startDepth = 4; m.Game.restart(); m.Seg.startDepth = 0; });
      await until(page, 'm.Game.state === "run" && m.Player.s > 40', 8, true);
      await page.evaluate(() => { for (const id of ['toast', 'levelUp', 'hint']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
      await snap(page, 'hud-' + tag);
    }
    if (want.includes('shop')) { await page.evaluate(() => { const m = window.__mj; m.Game.toTitle(); m.Save.data.wallet = 700; m.UI.openShop(); }); await page.evaluate(() => { const l = document.getElementById('shopList'); l.scrollTop = l.scrollHeight; (l.parentElement || l).scrollTop = 9999; }); await snap(page, 'shop-' + tag); }
    if (errors.length) console.log(errors.join('\n'));
    await browser.close();
  }
  console.log(made.join(' '));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
