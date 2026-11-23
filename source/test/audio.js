// Audio health check: the engine stays running through play, pause and resume, and volume automation is not scheduled every frame.
const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, manual: true });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  await page.evaluate(() => { window.__n = 0; const P = AudioParam.prototype; for (const k of ['setTargetAtTime']) { const o = P[k]; P[k] = function () { window.__n++; return o.apply(this, arguments); }; } });
  await ev('m.Save.data.runs = 5');
  await page.click('#btnRun', { force: true });
  await until(page, 'm.Game.state === "run"', 5, false);
  console.log('after start:', await ev('return m.Sound.state'));
  await page.evaluate(() => { window.__n = 0; });
  const r = await until(page, 'm.Game.run.dist > 900 || m.Game.state !== "run"', 80, true);
  const n = await page.evaluate(() => window.__n);
  console.log('played', r.t, 's of game time; volume glides scheduled:', n, '(' + (n / (r.t * 60)).toFixed(3) + ' per frame)');
  await ev('m.Game.stumble(null)'); await step(page, 3, true);
  console.log('with boulder close:', await page.evaluate(() => window.__n), 'state', await ev('return m.Sound.state'));
  await ev('m.Game.pause()'); await new Promise((res) => setTimeout(res, 300));
  console.log('paused:', await ev('return m.Sound.state'));
  await page.click('#btnResume', { force: true }); await new Promise((res) => setTimeout(res, 1900));
  console.log('resumed:', await ev('return m.Sound.state + " / game " + m.Game.state'));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
