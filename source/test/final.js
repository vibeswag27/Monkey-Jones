// Characters. While the cast is unlocked for testing, everyone can be picked for free and nothing is spent or marked as bought;
// with the prices back, bananas are needed again and what was really bought is still there. Then every character plays a
// forced-power-up run in both levels, and the choice survives closing the game.
const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  ' + JSON.stringify(extra))); };
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const ui = () => page.evaluate(() => { const q = (id) => document.getElementById(id), b = q('btnCharGo'), m = window.__mj;
    return { name: q('charName').textContent, btn: b.textContent.trim(), off: b.disabled, note: q('charNeed').textContent, locked: document.querySelectorAll('#charDots .locked').length,
      char: m.Save.data.char, owned: m.Save.data.owned.join(','), wallet: m.Save.data.wallet, shown: m.monkey.id, stored: JSON.parse(localStorage.getItem('monkeyjones.v1') || '{}') }; });
  const ids = await ev('return Object.keys({ monkey: 1, smokey: 1, pig: 1, elephant: 1, dino: 1 })');

  // ── unlocked for testing (how the game ships right now) ──
  check('the cast is unlocked for testing', await ev('return m.cast.free') === true);
  await ev('m.Save.data.wallet = 0; m.Save.data.owned = ["monkey"]; m.Save.data.char = "monkey"; m.Save.data.runs = 5; m.Save.store(); m.UI.openChars();');
  let s = await ui(); check('no bananas, nothing bought: Monkey Jones is selected and no one is shown as locked', s.btn === 'Selected' && s.off && s.locked === 0 && s.note === '', s);
  for (let i = 1; i < ids.length; i++) {
    await ev('m.UI.browse(1)'); s = await ui();
    check(`${s.name}: offered for free, marked "Unlocked for testing"`, s.shown === ids[i] && /^Play as /.test(s.btn) && !s.off && s.note === 'Unlocked for testing', s);
    await page.tap('#btnCharGo'); s = await ui();
    check(`${s.name}: picked with a tap, nothing spent, nothing marked as bought`, s.char === ids[i] && s.btn === 'Selected' && s.wallet === 0 && s.owned === 'monkey' && s.stored.char === ids[i] && s.stored.owned.join(',') === 'monkey', s);
  }
  await page.tap('#btnCharDone'); await step(page, 0.3, false);
  check('back on the home screen as the last one picked', await ev('return m.monkey.id + "/" + m.Game.state') === 'dino/title');

  // ── every character, both levels, with power-ups forced on ──
  for (const map of ['ruins', 'tide']) for (const id of ids) {
    await ev(`m.Save.data.map = '${map}'; m.Save.data.char = '${id}'; m.Game.restart();`);
    await until(page, 'm.Game.state === "run"', 5, false);
    const r = await page.evaluate(() => {
      const m = window.__mj, G = m.Game, P = m.Player, kinds = ['rocket', 'springs', 'shield', 'magnet', 'double'];
      let t = 0, next = 2, k = 0;
      while (G.state === 'run' && G.run.dist < 2000 && t < 400) { if (t >= next && !P.flying) { G.take({ kind: kinds[k++ % 5], got: false, sprite: null }); next = t + 4; } m.Bot.think(); G.update(1 / 60); t += 1 / 60; }
      return { who: m.monkey.id, sea: m.Tide.wet, end: G.death ? G.death.type : 'cap', dist: Math.round(G.run.dist), level: G.run.level };
    });
    await ev('if (m.Game.state === "run") m.Player.die("fall")'); await until(page, 'm.Game.state === "over"', 8, false);
    const over = await page.evaluate(() => document.getElementById('overTitle').textContent + ' ' + document.getElementById('overSub').textContent);
    const name = await ev('return m.monkey.spec.name');
    check(`${map.padEnd(5)} ${name}: 2000 m with power-ups (level ${r.level}); card reads "${over}"`, r.who === id && r.end === 'cap' && r.sea === (map === 'tide') && over.includes(name) && over.startsWith(map === 'tide' ? 'Glub!' : 'Splash!'), r);
  }

  // ── the choice survives closing the game ──
  await ev('m.Save.data.char = "pig"; m.Save.data.map = "tide"; m.Save.store();');
  await page.reload(); await page.waitForFunction(() => window.__mj); await step(page, 0.3, false);
  check('after closing and opening: still the free character, still High Tide', await ev('return [m.Save.data.char, m.monkey.id, m.Save.data.map, m.Save.data.owned.join(","), m.Tide.under].join("/")') === 'pig/pig/tide/monkey/true');

  // ── prices back (the switch that will be flipped when testing is over) ──
  await ev('m.cast.free = false; m.Game.toTitle();');
  check('prices back: a character that was never bought is put away again', await ev('return m.Save.data.char + "/" + m.monkey.id + "/" + m.Save.data.owned.join(",")') === 'monkey/monkey/monkey');
  await ev('m.Save.data.wallet = 950; m.UI.openChars(); m.UI.browse(1);'); s = await ui();
  check(`prices back: ${s.name} costs bananas`, /^Unlock/.test(s.btn) && !s.off && s.locked === 4 && s.note === '', s);
  await page.tap('#btnCharGo'); s = await ui(); const paid = 950 - s.wallet;
  check(`prices back: buying ${s.name} takes ${paid} bananas and keeps it`, paid > 0 && s.owned === 'monkey,smokey' && s.char === 'smokey' && s.btn === 'Selected' && s.stored.owned.join(',') === 'monkey,smokey', s);
  await ev('m.UI.browse(2)'); s = await ui(); const before = s.wallet;
  check(`prices back: ${s.name} cannot be had without enough bananas`, /^Unlock/.test(s.btn) && s.off && /more bananas to unlock/.test(s.note), s);
  await ev('m.UI.charGo()'); s = await ui(); check('prices back: forcing it does nothing', s.wallet === before && s.char === 'smokey' && s.owned === 'monkey,smokey', s);
  await ev('m.UI.closeChars(); m.cast.free = true; m.cast.free = false;');
  check('what was really bought is kept through the switch', await ev('return m.Save.data.owned.join(",") + "/" + m.Save.data.char') === 'monkey,smokey/smokey');

  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors'); if (errors.filter((e) => !/ReadPixels/.test(e)).length) fails++;
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  await browser.close();
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
