// A long swipe must change exactly one lane.
const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, manual: true });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  await ev('m.Save.data.runs = 5; m.Game.startIntro(false)');
  await until(page, 'm.Game.state === "run"', 5, false);
  const swipe = async (dx, dy) => {
    await page.evaluate(({ dx, dy }) => {
      const st = document.getElementById('stage'); const mk = (type, x, y) => st.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
      mk('pointerdown', 195, 500); for (let i = 1; i <= 10; i++) mk('pointermove', 195 + dx * i / 10, 500 + dy * i / 10); mk('pointerup', 195 + dx, 500 + dy);
    }, { dx, dy });
    return ev('return m.Player.lane');
  };
  const a = await swipe(260, 10), b = await swipe(-300, -20), c = await swipe(-300, 5), d = await swipe(-300, 5);
  console.log('lanes after long swipes right, left, left, left:', a, b, c, d, (a === 1 && b === 0 && c === -1 && d === -1) ? 'PASS' : 'FAIL');
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
