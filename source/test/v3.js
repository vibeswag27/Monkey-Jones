const { open, step, until } = require('./lib2');
(async () => {
  const ev = (page, src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const shot = async (n) => { await new Promise((r) => setTimeout(r, 300)); await step(page, 0.02, true); await page.screenshot({ path: `shots/v3-${n}.png` }); };
  await ev(page, 'm.Save.data.runs = 5; m.Game.startIntro(false)');
  await until(page, 'm.Game.state === "run"', 5, false);
  await until(page, '(m.Player.seg.pickups.some(p => !p.got && p.s - m.Player.s < 12 && p.s - m.Player.s > 7)) || m.Game.state !== "run"', 120, true);
  await shot('pickup');
  await ev(page, 'm.Game.take({kind:"rocket",got:false,sprite:null})'); await step(page, 1.6, true); await shot('fly1');
  await ev(page, 'm.Game.input("left")'); await step(page, 0.5, true); await shot('fly2');
  await until(page, '!m.Player.flying', 20, true); await step(page, 0.1, true); await shot('land');
  await ev(page, 'm.Game.take({kind:"springs",got:false,sprite:null})');
  await until(page, '(!m.Player.grounded && m.Player.y > 3.0) || m.Game.state !== "run"', 60, true); await shot('springs');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
