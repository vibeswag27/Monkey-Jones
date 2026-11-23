// Final regression: every character plays a forced-power-up run; unlock and select flow; save survives a reload.
const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  // unlock flow through the real UI functions
  await ev('m.Save.data.wallet = 950; m.Save.data.runs = 5; m.UI.openChars(); m.UI.browse(1); m.UI.charGo();');
  console.log('after unlocking Smokey:', await ev('return JSON.stringify({char:m.Save.data.char, owned:m.Save.data.owned, wallet:m.Save.data.wallet, shown:m.monkey.id})'));
  await ev('m.UI.browse(2); m.UI.charGo();'); // elephant costs 1000, only 650 left: must refuse
  console.log('tried Peanut without enough:', await ev('return JSON.stringify({char:m.Save.data.char, owned:m.Save.data.owned, wallet:m.Save.data.wallet, shown:m.monkey.id})'));
  await ev('m.UI.closeChars()');
  console.log('after closing:', await ev('return m.monkey.id + " / stored " + localStorage.getItem("monkeyjones.v1")'));
  const ids = ['smokey', 'pig', 'elephant', 'dino', 'monkey'];
  for (const id of ids) {
    await ev(`m.Save.data.owned = ['monkey','smokey','pig','elephant','dino']; m.Save.data.char = '${id}'; if (m.Game.state === 'title') m.Game.startIntro(false); else m.Game.restart();`);
    await until(page, 'm.Game.state === "run"', 5, false);
    const r = await page.evaluate(() => {
      const m = window.__mj, G = m.Game, P = m.Player, kinds = ['rocket', 'springs', 'shield', 'magnet', 'double'];
      let t = 0, next = 2, k = 0;
      while (G.state === 'run' && G.run.dist < 2500 && t < 400) { if (t >= next && !P.flying) { G.take({ kind: kinds[k++ % 5], got: false, sprite: null }); next = t + 4; } m.Bot.think(); G.update(1 / 60); t += 1 / 60; }
      return { who: m.monkey.id, end: G.death ? G.death.type : 'cap', dist: Math.round(G.run.dist), turns: G.run.turns };
    });
    console.log(JSON.stringify(r));
    await ev('if (m.Game.state === "run") m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false);
    console.log('  over text:', await page.evaluate(() => document.getElementById('overSub').textContent));
  }
  await page.reload(); await page.waitForFunction(() => window.__mj);
  console.log('after reload:', await ev('return JSON.stringify({char:m.Save.data.char, owned:m.Save.data.owned.length, shown:m.monkey.id, up:m.Save.data.up})'));
  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
