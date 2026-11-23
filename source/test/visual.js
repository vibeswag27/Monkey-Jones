const { open, step, until } = require('./lib2');
const [, , W = '390', H = '760', tag = 'p'] = process.argv;
(async () => {
  const { browser, page, errors } = await open({ w: +W, h: +H });
  const shot = (n) => page.screenshot({ path: `shots/${tag}-${n}.png` });
  const ev = (src) => page.evaluate((src) => { const m = window.__mj; return new Function('m', src)(m); }, src);
  await step(page, 1.2); await shot('title');
  await ev('m.Game.startIntro(false)');
  await step(page, 0.5); await shot('intro1');
  await step(page, 0.5); await shot('intro2');
  await step(page, 0.45); await shot('intro3');
  await step(page, 0.6); await shot('run0');
  await until(page, 'm.Player.slide > 0 && m.Player.slide < 0.42'); await shot('slide');
  await until(page, 'm.Player.s > 96'); await ev('m.Game.stumble(null)'); await step(page, 0.22, true); await shot('stumble');
  await step(page, 0.9, true); await shot('chased');
  await ev('m.Game.stumble(null)'); await step(page, 0.5, false); await shot('flat1');
  await until(page, 'm.Game.state === "over"', 5, false); await step(page, 0.4); await shot('flat-over');
  // bonk: run straight into the first beam
  await ev('m.Save.data.runs = 0; m.Game.restart()');
  await until(page, 'm.Game.state === "dying"', 20, false); await step(page, 0.9); await shot('bonk');
  await until(page, 'm.Game.state === "over"', 5, false); await step(page, 0.4); await shot('bonk-over');
  // fall
  await ev('m.Game.restart()'); await until(page, 'm.Game.state === "run"', 5, false); await step(page, 0.8, true);
  await ev('m.Player.die("fall")'); await step(page, 0.25); await shot('fall1'); await step(page, 0.5); await shot('fall2');
  await until(page, 'm.Game.death.splashed', 5, false); await step(page, 0.2); await shot('splash');
  // pause
  await ev('m.Game.restart()'); await until(page, 'm.Game.state === "run"', 5, false); await step(page, 1.2, true);
  await ev('m.Game.pause()'); await step(page, 0.1); await shot('pause');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
