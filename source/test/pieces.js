// Pictures of the run's new furniture as the game really lays it out: the autopilot plays until it meets each piece, and the
// frame is saved.   node test/pieces.js [out dir, default /tmp/pieces] [ruins|tide|both] [level, default 3]
const fs = require('fs');
const { open, until } = require('./lib2');
(async () => {
  const out = process.argv[2] || '/tmp/pieces', which = process.argv[3] || 'both', L = +process.argv[4] || 3;
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  const P = 'm.Player', here = (cond) => `m.Game.state !== "run" || (${cond})`;
  // each shot: a name, and the moment to wait for (a deck `d` or obstacle `o` of the stretch he is on, relative to where he is)
  const SHOTS = [
    ['steps', `${P}.seg.decks.some((d) => d.ramp && ${P}.s > d.r0 - 11 && ${P}.s < d.r0 - 8)`],
    ['on-top', `${P}.seg.decks.some((d) => d.ramp && ${P}.grounded && ${P}.y > 2 && ${P}.s > d.s0 + 4)`],
    ['low-road', `${P}.seg.decks.some((d) => d.ramp && ${P}.y < 0.1 && ${P}.s > d.s0 + 1 && ${P}.s < d.s0 + 5)`],
    ['wall', `${P}.seg.decks.some((d) => !d.ramp && !d.pad && ${P}.s > d.s0 - 12 && ${P}.s < d.s0 - 9)`],
    ['pad-deck', `(${P}.seg.pads || []).some((o) => o.d && !o.used && ${P}.lane === o.lane - 1 && ${P}.s > o.s - 8 && ${P}.s < o.s - 5)`],
    ['pad-pile', `(${P}.seg.pads || []).some((o) => !o.d && !o.used && ${P}.lane === o.lane - 1 && ${P}.s > o.s - 8 && ${P}.s < o.s - 5)`],
    ['bounce', `${P}.bouncing && ${P}.vy < 1.5`],
    ['sweeper', `${P}.seg.movers.some((o) => o.kind === 'side' && ${P}.s > o.s - 8 && ${P}.s < o.s - 5.5)`],
    ['bridge', `${P}.seg.bridges.some((b) => ${P}.s > b.s0 - 13 && ${P}.s < b.s0 - 10)`],
    ['on-bridge', `${P}.seg.bridges.some((b) => ${P}.s > b.s0 + 3 && ${P}.s < b.s0 + 6)`],
    ['bobber', `${P}.seg.movers.some((o) => o.kind === 'bob' && ${P}.s > o.s - 9 && ${P}.s < o.s - 6.5)`],
  ];
  const only = process.argv[5]; if (only) for (let i = SHOTS.length - 1; i >= 0; i--) if (!only.split(',').includes(SHOTS[i][0])) SHOTS.splice(i, 1);
  const made = [];
  for (const map of which === 'both' ? ['ruins', 'tide'] : [which]) {
    for (const [name, cond] of SHOTS) {
      let got = false;
      for (let tries = 0; tries < 12 && !got; tries++) {
        await page.evaluate(({ L, map }) => { const m = window.__mj; m.Save.data.runs = 5; m.Save.data.map = map; m.Seg.startDepth = (L - 1) * 4; m.Game.restart(); }, { L, map });
        await until(page, 'm.Game.state === "run"', 5, false);
        const r = await until(page, here(cond), 60, true);
        got = r.state === 'run' && (await page.evaluate((c) => new Function('m', 'return (' + c + ')')(window.__mj), cond));
      }
      if (!got) { console.log('never met: ' + map + ' ' + name); continue; }
      await page.evaluate(() => { for (const id of ['toast', 'levelUp', 'hint']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } window.__mj.render(); });
      const f = `${out}/${map}-${name}.png`;
      await page.screenshot({ path: f }); made.push(f);
    }
  }
  await page.evaluate(() => { window.__mj.Seg.startDepth = 0; });
  console.log(made.join(' '));
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
