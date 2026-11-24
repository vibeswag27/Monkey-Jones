// The rule tests' rig: window.T in the page, for starting a run on an emptied stretch and placing pieces on it by hand.
// Used by test/overhaul.js and test/gold.js.
module.exports = async (page) => {
  await page.evaluate(() => {
    const m = window.__mj, G = m.Game, P = m.Player;
    window.T = {
      dt: 1 / 60,
      // a fresh run on an empty stretch; returns the stretch. speed: fraction of the level's speed to hold (default 1)
      // level: which level of the run to start in (default 1: 11 m/s; level 12 runs at the top speed, 29 m/s)
      start(map, level) {
        m.Save.data.map = map || 'ruins'; m.Save.data.runs = 5; m.Save.data.seaChar = null; m.Save.data.char = 'monkey';
        m.Seg.startDepth = ((level || 1) - 1) * 4; G.restart(); m.Seg.startDepth = 0;
        let t = 0; while (G.state !== 'run' && t < 5) { G.update(this.dt); t += this.dt; }
        const seg = P.seg; seg.obstacles.length = 0; seg.holes.length = 0; seg.holeCells.clear(); seg.bananas.length = 0; seg.pickups.length = 0;
        for (const k of ['decks', 'movers', 'bridges', 'pads']) if (seg[k]) seg[k].length = 0;
        this.v = Math.min(29, 11 * Math.pow(1.1, (level || 1) - 1));
        seg.obI = 0; seg.bI = 0; G.run.invuln = 0; G.run.danger = 0; G.run.ghost = 0; G.run.speed = this.v;
        return seg;
      },
      // a gap right across the path from s0, `len` long, with a platform that shuttles between the lanes (or, frozen, sits in `lane`)
      bridge(seg, s0, len, lane, frozen) {
        const b = { s0, s1: s0 + len, x: (lane - 1) * 1.9, to: lane, locked: !!frozen, ph: 0 };
        seg.bridges.push(b); seg.holes.push({ s0, s1: s0 + len, x0: -99, x1: 99, bridge: b }); return b;
      },
      deck(seg, lane, s0, s1, ramp) { const x = (lane - 1) * 1.9, d = { lane, s0, s1, h: 2.2, ramp: !!ramp, r0: ramp ? s0 - 5.5 : s0, x0: x - 0.95, x1: x + 0.95 }; seg.decks.push(d); return d; },
      to(s, each) { let n = 0; while (G.state === 'run' && P.s < s && n++ < 9000) { if (each) each(); G.update(this.dt); } return G.state === 'run'; },
      wait(sec, each) { for (let t = 0; t < sec && G.state === 'run'; t += this.dt) { if (each) each(); G.update(this.dt); } return G.state === 'run'; },
      lane(l) { P.lane = l; P.x = l * 1.9; },
      // obstacles as the generator makes them, kept in order along the stretch
      put(seg, o) { seg.obstacles.push(o); seg.obstacles.sort((a, b) => a.s0 - b.s0); seg.obI = 0; return o; },
      pad(seg, lane, s, d) { const x = (lane - 1) * 1.9, o = this.put(seg, { type: 'pad', lane, s, s0: s - 0.6, s1: s + 0.6, x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 0.3, d }); if (d) d.pad = o; return o; },
      pillar(seg, lane, s) { const x = (lane - 1) * 1.9; return this.put(seg, { type: 'pillar', s, s0: s - 0.62, s1: s + 0.62, x0: x - 0.72, x1: x + 0.72, y0: 0, y1: 2.8, lane }); },
      // a mover: 'side' sweeps the lanes as LANE_W * sin(w t + ph); 'bob' rides up and down over one lane, its underside at 0.05 + 0.775 (1 - cos(w t + ph))
      mover(seg, kind, lane, s, w, ph) {
        const x = (lane - 1) * 1.9, o = kind === 'side' ? { type: 'mover', kind, trip: true, s, s0: s - 0.5, s1: s + 0.5, w, ph, x0: 0, x1: 0, y0: 0, y1: 1.15 }
          : { type: 'mover', kind, trip: true, s, s0: s - 0.45, s1: s + 0.45, lane, w, ph, x0: x - 0.7, x1: x + 0.7, y0: 0, y1: 0.62 };
        seg.movers.push(o); return this.put(seg, o);
      },
      rubble(seg, lane, s) { const x = (lane - 1) * 1.9; return this.put(seg, { type: 'rubble', s, s0: s - 0.5, s1: s + 0.5, x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 0.6, trip: true, lane }); },
      near(a, b) { return Math.abs(a - b) < 1e-6; },
    };
  });
};
