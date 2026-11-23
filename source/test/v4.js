const { open, step } = require('./lib2');
(async () => {
  const ev = (page, src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const { browser, page, errors } = await open({ w: 844, h: 390 });
  await ev(page, 'm.Save.data.wallet = 480; m.UI.refreshTitle()');
  await step(page, 1.0); await new Promise((r) => setTimeout(r, 300)); await page.screenshot({ path: 'shots/v4-title.png' });
  await ev(page, 'm.UI.openShop()'); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: 'shots/v4-shop.png' });
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
