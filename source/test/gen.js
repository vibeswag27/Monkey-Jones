// What the track generator must never do, checked over hundreds of laid-out stretches per level in both levels.
//   node test/gen.js [stretches per level, default 300]
const { open } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  const N = +process.argv[2] || 300;
  let fails = 0;
  for (const map of ['ruins', 'tide']) {
    const r = await page.evaluate(({ map, N }) => {
      const m = window.__mj, HJ = 3.2, LANE_W = 1.9, laneX = (l) => (l - 1) * LANE_W;
      m.Save.data.map = map; m.Game.toTitle();
      const bad = [], stats = {};
      const fail = (L, i, msg) => { if (bad.length < 12) bad.push('level ' + L + ' #' + i + ': ' + msg); else if (bad.length === 12) bad.push('…'); };
      for (const L of [1, 2, 3, 8, 15]) {
        const st = stats[L] = { stretches: 0, withDeck: 0, decks: 0, walls: 0 };
        for (let i = 0; i < N; i++) {
          const depth = (L - 1) * 4 + (L === 1 ? 1 + (i % 3) : i % 4), seg = m.gen(depth, (i + 1) * 7919 + L * 104729), v = seg.v;
          const O = seg.obstacles, D = seg.decks, tail = 0.4 * v, f = (msg) => fail(L, i, msg);
          if (seg.sea !== (map === 'tide')) f('wrong level: sea=' + seg.sea);
          st.stretches++; if (D.length) st.withDeck++;
          for (const d of D) {
            st.decks++; if (!d.ramp) st.walls++;
            const x = laneX(d.lane);
            if (d.h !== 2.2 || Math.abs(d.x0 - (x - LANE_W / 2)) > 1e-9 || Math.abs(d.x1 - (x + LANE_W / 2)) > 1e-9) f('deck has the wrong shape ' + JSON.stringify(d));
            if (Math.abs(d.r0 - (d.ramp ? d.s0 - 5.5 : d.s0)) > 1e-9) f('deck steps are the wrong length');
            if (d.s1 - d.s0 < 7.9) f('deck only ' + (d.s1 - d.s0).toFixed(1) + ' m long');
            if (d.s1 > seg.len - HJ - Math.max(11, 0.8 * v) + 1e-6) f('deck ends ' + (seg.len - HJ - d.s1).toFixed(1) + ' m before the junction');
            if (d.r0 < seg.floorStart + 8) f('deck starts ' + (d.r0 - seg.floorStart).toFixed(1) + ' m into the stretch');
            for (const h of seg.holes) if (h.s1 > d.r0 - 1 && h.s0 < d.s1 + tail) f('a hole beside or just after a deck');
            for (const o of O) {
              if (o.type === 'beam' && o.s1 > d.r0 - 1 && o.s0 < d.s1 + tail) f('a beam across a deck');
              if (o.s1 > d.s1 - tail && o.s0 < d.s1 + tail) f(o.type + ' within ' + tail.toFixed(1) + ' m of the end of a deck');
              if (o.s1 > d.r0 && o.s0 < d.s1 && o.x1 > d.x0 + 0.05 && o.x0 < d.x1 - 0.05) f(o.type + ' inside a deck');
              if (o.type === 'pillar' && o.s > d.r0 - 1 && o.s < d.s1 + 1) { // a totem on the low road: the lane next to it must be open
                const way = [o.lane - 1, o.lane + 1].filter((l) => l >= 0 && l <= 2 && l !== d.lane && !D.some((e) => e !== d && e.lane === l && e.s1 > o.s - 3 && e.r0 < o.s + 3)
                  && !O.some((q) => q.type === 'pillar' && q.lane === l && Math.abs(q.s - o.s) < Math.max(9, 0.6 * v)));
                if (!way.length) f('a totem beside a deck with no lane to dodge into');
              }
            }
            for (const e of D) if (e !== d && e.lane === d.lane && e.s1 > d.r0 - 2 && e.r0 < d.s1 + 2) f('two decks overlap in one lane');
            if ([0, 1, 2].every((l) => l === d.lane || D.some((e) => e.lane === l && e.s1 > d.r0 && e.r0 < d.s1))) f('decks block all three lanes');
            for (const b of seg.bananas) if (Math.abs(b.x - x) < 0.5 && b.s > d.s0 && b.s < d.s1 && b.y < d.h + 0.5) f('a banana buried in a deck');
            for (const p of seg.pickups) if (Math.abs(p.x - x) < 0.5 && p.s > d.r0 - 1 && p.s < d.s1 + 1) f('a pick-up buried in a deck');
          }
        }
      }
      return { bad, stats };
    }, { map, N });
    const S = r.stats, share = (L) => S[L].withDeck / S[L].stretches;
    const want = [
      ['a deck appears by level 2', S[1].decks + S[2].decks > 0],
      ['decks are a real presence at every level (at least 1 stretch in 6)', [1, 2, 3, 8, 15].every((L) => share(L) >= 1 / 6)],
      ['no walls without steps in level 1, some from level 3', S[1].walls === 0 && S[3].walls > 0 && S[8].walls > 0 && S[15].walls > 0],
    ];
    for (const [name, ok] of want) { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + map + ': ' + name); }
    if (r.bad.length) { fails++; console.log('FAIL ' + map + ': layout rules broken\n  ' + r.bad.join('\n  ')); } else console.log('ok   ' + map + ': no layout rule broken in ' + N * 5 + ' stretches');
    console.log('     ' + [1, 2, 3, 8, 15].map((L) => 'L' + L + ' ' + Math.round(share(L) * 100) + '% (' + S[L].decks + ' decks, ' + S[L].walls + ' walls)').join('  '));
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  console.log(fails || errors.length ? 'FAIL: ' + fails : 'PASS: the generator keeps its rules');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
