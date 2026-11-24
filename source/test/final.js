// Characters. The seal and the orca live in High Tide only and are free while testing; the other four cost bananas.
// Checked here with real taps: who shows up in which level, who runs where after switching level, that nothing is spent or
// marked as bought for a free one, that prices come back with one switch, that everyone can play a long forced-power-up run
// in every level they are allowed in, and that the choices survive closing the game.
const { open, step, until } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760 });
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  ' + JSON.stringify(extra))); };
  const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
  const ui = () => page.evaluate(() => { const q = (id) => document.getElementById(id), b = q('btnCharGo'), m = window.__mj, st = JSON.parse(localStorage.getItem('monkeyjones.v1') || '{}');
    return { name: q('charName').textContent, btn: b.textContent.trim(), off: b.disabled, note: q('charNeed').textContent, dots: document.querySelectorAll('#charDots i').length, locked: document.querySelectorAll('#charDots .locked').length,
      char: m.Save.data.char, sea: m.Save.data.seaChar, owned: m.Save.data.owned.join(','), wallet: m.Save.data.wallet, shown: m.monkey.id, runner: m.runner(), stored: [st.char, st.seaChar, (st.owned || []).join('+'), st.map].join('/') }; });
  const tap = async (id) => { const at = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id); await page.touchscreen.tap(at.x, at.y); await page.waitForTimeout(450); await step(page, 0.3, false); };
  const level = async (id) => { await tap(id === 'tide' ? 'mapTide' : 'mapRuins'); };
  const who = () => ev('return m.monkey.id + (m.monkey.swims ? " (swims)" : "")');
  const browseTo = async (name) => { for (let i = 0; i < 8; i++) { const s = await ui(); if (s.name === name) return s; await tap('btnNext'); } return ui(); };

  check('free for testing: the seal and the orca, nobody else', (await ev('return m.cast.free.join(",")')) === 'seal,orca');
  await ev('m.Save.data.wallet = 0; m.Save.data.owned = ["monkey"]; m.Save.data.char = "monkey"; m.Save.data.seaChar = null; m.Save.data.runs = 5; m.Save.store(); m.Game.toTitle();');

  // ── Jungle Ruins: five characters, the four land ones cost bananas, no seal and no orca ──
  await tap('btnChars'); let s = await ui();
  check('Jungle Ruins: five characters on the list, four of them locked', s.dots === 5 && s.locked === 4 && s.name === 'Monkey Jones' && s.btn === 'Selected', s);
  const names = []; for (let i = 0; i < 5; i++) { names.push((await ui()).name); await tap('btnNext'); }
  check('Jungle Ruins: no seal and no orca to pick', names.join(',') === 'Monkey Jones,Strongkey,Piggie,Ellie,Herbie', names);
  s = await browseTo('Strongkey'); check('Strongkey costs bananas again', /^Unlock/.test(s.btn) && s.off && /Collect 300 more bananas/.test(s.note), s);
  await tap('btnCharDone');

  // ── High Tide: the same five and the two swimmers, free ──
  await level('tide'); await tap('btnChars'); s = await ui();
  check('High Tide: seven characters on the list', s.dots === 7 && s.locked === 4, s);
  s = await browseTo('Sealie'); check('Sealie: free to play, marked as High Tide only', s.shown === 'seal' && s.btn === 'Play as Sealie' && !s.off && s.note === 'High Tide only · free for testing', s);
  await tap('btnCharGo'); s = await ui();
  check('Sealie picked with a tap: nothing spent, nothing marked as bought, Monkey Jones still the everyday runner', s.btn === 'Selected' && s.wallet === 0 && s.owned === 'monkey' && s.sea === 'seal' && s.char === 'monkey' && s.stored === 'monkey/seal/monkey/tide', s);
  await tap('btnCharDone'); check('High Tide home screen: the seal, swimming', (await who()) === 'seal (swims)');
  // ── switching level swaps the runner, and switching back brings the swimmer back ──
  await level('ruins'); check('Jungle Ruins home screen: back to Monkey Jones', (await who()) === 'monkey');
  await tap('btnRun'); await until(page, 'm.Game.state === "run"', 5, false); await step(page, 1.5, true);
  check('a run in Jungle Ruins is on foot', (await who()) === 'monkey' && (await ev('return m.Game.state + "/" + m.Tide.wet')) === 'run/false');
  await ev('m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(700); await tap('btnHome2');
  await level('tide'); check('back in High Tide: the seal again, without picking it again', (await who()) === 'seal (swims)');
  await tap('btnRun'); await until(page, 'm.Game.state === "run"', 5, false); await step(page, 1.5, true);
  check('a run in High Tide is swum by the seal', (await who()) === 'seal (swims)' && (await ev('return m.Game.state + "/" + m.Tide.wet')) === 'run/true');
  await ev('m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(700);
  check('the card speaks of a swimmer', (await page.evaluate(() => document.getElementById('overSub').textContent)) === 'Sealie swam face-first into the ruins.');
  await tap('btnAgain'); await until(page, 'm.Game.state === "run"', 5, false); check('"Run again" keeps the seal', (await who()) === 'seal (swims)');
  await ev('m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); await page.waitForTimeout(700); await tap('btnHome2');
  // ── the orca; then a land character picked in High Tide takes over there too ──
  await tap('btnChars'); s = await browseTo('Orkie'); check('Orkie: free to play, High Tide only', s.shown === 'orca' && s.btn === 'Play as Orkie' && s.note === 'High Tide only · free for testing', s);
  await tap('btnCharGo'); await tap('btnCharDone'); check('High Tide home screen: the orca', (await who()) === 'orca (swims)' && (await ui()).stored === 'monkey/orca/monkey/tide');
  await tap('btnChars'); s = await browseTo('Monkey Jones'); check('in High Tide Monkey Jones can be picked back', s.btn === 'Play as Monkey Jones' && !s.off, s);
  await tap('btnCharGo'); await tap('btnCharDone'); s = await ui();
  check('picked in High Tide, Monkey Jones runs there too', (await who()) === 'monkey' && s.sea === null && s.char === 'monkey', s);

  // ── bananas still buy the land characters, and a bought one is the runner everywhere until a swimmer is picked for High Tide ──
  await ev('m.Save.data.wallet = 950; m.Save.store();'); await level('ruins'); await tap('btnChars'); s = await browseTo('Strongkey');
  check('with bananas, Strongkey can be unlocked', /^Unlock/.test(s.btn) && !s.off, s);
  await tap('btnCharGo'); s = await ui(); check('buying Strongkey takes 300 bananas and keeps him', s.wallet === 650 && s.owned === 'monkey,smokey' && s.char === 'smokey' && s.btn === 'Selected', s);
  s = await browseTo('Ellie'); check('Ellie cannot be had for 650', s.off && /Collect 350 more bananas/.test(s.note), s);
  await tap('btnCharDone'); await level('tide'); check('Strongkey runs in High Tide too', (await who()) === 'smokey');
  await tap('btnChars'); await browseTo('Sealie'); await tap('btnCharGo'); await tap('btnCharDone'); await level('ruins');
  check('seal for High Tide, Strongkey for the ruins: each level keeps its own', (await who()) === 'smokey' && (await ui()).stored === 'smokey/seal/monkey+smokey/ruins');

  // ── everyone, in every level they are allowed in, with power-ups forced on ──
  const ids = await ev('return ["monkey", "smokey", "pig", "elephant", "dino", "seal", "orca"]');
  await ev('m.Save.data.owned = ["monkey", "smokey", "pig", "elephant", "dino"]; m.Save.store();');
  for (const map of ['ruins', 'tide']) for (const id of ids) {
    const sea = id === 'seal' || id === 'orca';
    if (sea && map === 'ruins') { // even if the save file says so, the swimmers do not come ashore
      await ev(`m.Save.data.map = 'ruins'; m.Save.data.seaChar = '${id}'; m.Save.data.char = 'monkey'; m.Game.restart();`); await until(page, 'm.Game.state === "run"', 5, false);
      check(`ruins ${id}: stays in the sea (Monkey Jones runs instead)`, (await who()) === 'monkey'); await ev('m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); continue;
    }
    await ev(`m.Save.data.map = '${map}'; ${sea ? `m.Save.data.seaChar = '${id}'` : `m.Save.data.char = '${id}'; m.Save.data.seaChar = null`}; m.Game.restart();`);
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
    const want = map === 'ruins' ? `Splash! ${name} went for a swim.` : sea ? `Glub! The undertow pulled ${name} down.` : `Glub! ${name} sank to the sea bed.`;
    check(`${map.padEnd(5)} ${name}: 2000 m with power-ups (level ${r.level}); card reads "${over}"`, r.who === id && r.end === 'cap' && r.sea === (map === 'tide') && over === want, r);
  }

  // ── the choices survive closing the game ──
  await ev('m.Save.data.char = "smokey"; m.Save.data.seaChar = "orca"; m.Save.data.map = "tide"; m.Save.store();');
  await page.reload(); await page.waitForFunction(() => window.__mj); await step(page, 0.3, false);
  check('after closing and opening: High Tide, the orca there, Strongkey for the ruins', (await ev('return [m.Save.data.char, m.Save.data.seaChar, m.Save.data.map, m.monkey.id, m.Tide.under].join("/")')) === 'smokey/orca/tide/orca/true');

  // ── prices back for the swimmers too (the switch that ends testing) ──
  await ev('m.cast.free = []; m.Game.toTitle();'); s = await ui();
  check('prices back: a swimmer that was never bought is put away, the everyday runner takes over', s.sea === null && s.runner === 'smokey' && (await who()) === 'smokey', s);
  await ev('m.Save.data.wallet = 900; m.Save.store();'); await tap('btnChars'); s = await browseTo('Sealie');
  check('prices back: Sealie costs 800 bananas', /^Unlock/.test(s.btn) && /800/.test(s.btn) && !s.off && s.note === 'High Tide only' && s.locked === 2, s);
  await tap('btnCharGo'); s = await ui(); check('prices back: buying Sealie takes 800 and keeps it', s.wallet === 100 && /seal/.test(s.owned) && s.sea === 'seal' && s.btn === 'Selected' && s.note === 'High Tide only', s);
  s = await browseTo('Orkie'); check('prices back: Orkie cannot be had for 100', s.off && /Collect 1,100 more bananas/.test(s.note), s);
  await ev('m.UI.charGo()'); s = await ui(); check('prices back: forcing it does nothing', s.wallet === 100 && s.sea === 'seal', s);
  await tap('btnCharDone'); await ev('m.cast.free = ["seal", "orca"]; m.cast.free = [];');
  check('what was really bought is kept through the switch', (await ev('return m.Save.data.owned.join(",") + "/" + m.Save.data.seaChar')) === 'monkey,smokey,pig,elephant,dino,seal/seal');

  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors'); if (errors.filter((e) => !/ReadPixels/.test(e)).length) fails++;
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  await browser.close();
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
