const { open, step, until } = require('./lib2');
(async () => {
  const ev = (page, src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const shot = async (n) => { await new Promise((r) => setTimeout(r, 320)); await step(page, 0.05); await page.screenshot({ path: `shots/c-${n}.png` }); };
  await ev(page, 'm.Save.data.wallet = 700; m.Save.data.runs = 5; m.UI.refreshTitle()');
  await step(page, 0.6); await shot('title');
  await ev(page, 'm.UI.openChars()'); await step(page, 0.8); await shot('0');
  for (let i = 1; i < 5; i++) { await ev(page, 'm.UI.browse(1)'); await step(page, 0.9); await shot(String(i)); }
  // unlock the pig (600) and run with each character in turn
  const ids = ['smokey', 'pig', 'elephant', 'dino'];
  for (const id of ids) {
    await ev(page, `m.Save.data.owned = ['monkey','smokey','pig','elephant','dino']; m.Save.data.char = '${id}'; if (m.Game.state === 'title') m.Game.startIntro(false); else m.Game.restart();`);
    await until(page, 'm.Game.state === "run"', 5, false);
    await until(page, 'm.Player.s > 24', 10, true); await shot(id + '-run');
  }
  await ev(page, 'm.Game.take({kind:"rocket",got:false,sprite:null})'); await step(page, 1.4, true); await shot('dino-fly');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
