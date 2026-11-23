const { open, step } = require('./lib2');
(async () => {
  const ev = (page, src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  for (const [n, w, h] of [['a', 844, 390], ['b', 375, 600]]) {
    const { browser, page, errors } = await open({ w, h });
    await ev(page, 'm.Save.data.wallet = 480; m.UI.refreshTitle(); m.UI.openShop()');
    await step(page, 0.5); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: `shots/v5-${n}.png` });
    if (n === 'b') { await ev(page, 'm.UI.setState("title")'); await new Promise((r) => setTimeout(r, 400)); await step(page, 0.1); await page.screenshot({ path: 'shots/v5-c.png' }); }
    console.log(n, errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
