const { open, step, until } = require('./lib2');
(async () => {
  const ev = (page, src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  let { browser, page, errors } = await open({ w: 390, h: 760 });
  await step(page, 1.2); await page.screenshot({ path: 'shots/v1-title.png' });
  await ev(page, 'm.Save.data.runs = 5; m.Game.startIntro(false)');
  await until(page, 'm.Game.state === "run"', 5, false);
  // find a full-width gap, run into it without jumping
  const r = await until(page, 'm.Player.seg.holes.some(h => h.x0 < -50 && h.x1 > 50 && h.s0 > m.Player.s + 4 && h.s0 < m.Player.s + 9) || m.Game.state !== "run"', 200, true);
  await until(page, 'm.Game.state === "dying"', 4, false); await step(page, 0.2); await page.screenshot({ path: 'shots/v1-fall1.png' });
  await step(page, 0.45); await page.screenshot({ path: 'shots/v1-fall2.png' });
  await until(page, 'm.Game.state === "over"', 5, false); await new Promise((r) => setTimeout(r, 500)); await step(page, 0.3); await page.screenshot({ path: 'shots/v1-over.png' });
  console.log('portrait', r, errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
  ({ browser, page, errors } = await open({ w: 1280, h: 620, touch: false }));
  await ev(page, 'm.Game.startIntro(false)'); await until(page, 'm.Player.s > 30', 20, true);
  await page.screenshot({ path: 'shots/v1-land.png' });
  console.log('landscape', errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
