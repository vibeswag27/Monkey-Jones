const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  await ev('m.UI.openChars()');
  const names = [];
  for (let i = 0; i < 5; i++) { names.push(await page.evaluate(() => document.getElementById('charName').textContent + ' — ' + document.getElementById('charBlurb').textContent)); await ev('m.UI.browse(1)'); }
  console.log(names.join('\n'));
  await ev('m.UI.closeChars(); m.Save.data.runs = 5; m.Save.data.owned = ["monkey","smokey"]; m.Save.data.char = "smokey"; m.Game.startIntro(false)');
  await until(page, 'm.Game.state === "run"', 5, false); await until(page, 'm.Game.run.dist > 400 || m.Game.state !== "run"', 60, true);
  await ev('m.Player.die("fall")'); await until(page, 'm.Game.state === "over"', 8, false);
  console.log('over:', await page.evaluate(() => document.getElementById('overSub').textContent));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
