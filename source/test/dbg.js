const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  await ev('m.Save.data.runs = 5; m.Game.startIntro(false)');
  await until(page, 'm.Game.state === "run"', 5, false);
  console.log(await until(page, '(m.Player.seg.pickups.some(p => !p.got && p.s - m.Player.s < 11 && p.s - m.Player.s > 6)) || m.Game.state !== "run"', 120, true));
  console.log(await ev(`const P = m.Player, seg = P.seg; return JSON.stringify(seg.pickups.map(p => ({kind:p.kind, ds:+(p.s-P.s).toFixed(1), x:p.x, y:p.y, got:p.got, vis:p.sprite&&p.sprite.visible, inScene: !!(p.sprite && p.sprite.parent), scale: p.sprite && p.sprite.scale.toArray(), mat: p.sprite && {t:p.sprite.material.transparent, o:p.sprite.material.opacity, map: !!p.sprite.material.map, img: p.sprite.material.map && p.sprite.material.map.image && p.sprite.material.map.image.width}})))`));
  await page.screenshot({ path: 'shots/dbg.png' });
  await browser.close();
})();
