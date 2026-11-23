const { open, step } = require('./lib');
(async () => {
  for (const [name, w, h] of [['p', 390, 760], ['l', 1280, 720]]) {
    const { browser, page, errors } = await open({ w, h });
    const t0 = Date.now();
    await step(page, 1.0);
    await page.screenshot({ path: `shots/title-${name}.png` });
    console.log(name, 'title ok', Date.now() - t0, 'ms', await page.evaluate(() => document.getElementById('stage').dataset.state));
    if (errors.length) console.log(errors.join('\n'));
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
