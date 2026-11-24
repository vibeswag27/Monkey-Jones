// ───────────────────────── the endless track ─────────────────────────
// The path is a tree of straight stretches joined by square junctions. Each stretch knows its
// obstacles, holes, bananas and pick-ups in its own (s = distance along, x = sideways) coordinates.
let SEG_ID = 0;
const SEA_LIFE_Y = -2.5; // once the tide is this high, the sea life of a High Tide stretch is shown

class Seg {
  constructor(parent, turn) {
    this.id = SEG_ID++;
    this.parent = parent; this.turn = turn;
    if (!parent) { this.heading = 0; this.ox = 0; this.oz = 0; this.dist0 = 0; this.first = true; this.depth = Seg.startDepth || 0; }
    else {
      this.heading = turn === 'R' ? (parent.heading + 1) % 4 : (parent.heading + 3) % 4;
      const d = DIRS[parent.heading];
      this.ox = parent.ox + d.fx * parent.len; this.oz = parent.oz + d.fz * parent.len;
      this.dist0 = parent.dist0 + parent.len; this.first = false; this.depth = parent.depth + 1;
    }
    this.level = levelOf(this.depth); this.sea = atSea();
    this.dir = DIRS[this.heading]; this.yaw = yawOf(this.heading);
    this.obstacles = []; this.holes = []; this.holeCells = new Set(); this.bananas = []; this.pickups = [];
    this.decks = []; this.pads = []; this.movers = []; this.bridges = []; // raised walkways; bounce pads and obstacles that move (both also in `obstacles`); platforms that cross a gap
    this.kids = { L: null, R: null };
    this.obI = 0; this.bI = 0; this.group = null; this.dead = false;
  }
  wx(s, x) { return this.ox + this.dir.fx * s + this.dir.rx * x; }
  wz(s, x) { return this.oz + this.dir.fz * s + this.dir.rz * x; }
  overHole(s, x) { // (a gap with a bridge is solid where the bridge is at the moment)
    for (const h of this.holes) if (s > h.s0 + 0.14 && s < h.s1 - 0.14 && x > h.x0 && x < h.x1 && !(h.bridge && Math.abs(x - h.bridge.x) < LANE_W / 2)) return true;
    return false;
  }
  // How high the floor stands at (s, x): 0, part of the way up a flight of steps, or on top of a deck.
  // A deck is { lane, s0, s1, h, ramp, r0, x0, x1 }: one lane wide from s0 to s1, with steps from r0 up to s0 if it has any (r0 = s0 if not).
  floorY(s, x) {
    let y = 0;
    for (const d of this.decks) if (s >= d.r0 && s <= d.s1 && x > d.x0 && x < d.x1) y = Math.max(y, s >= d.s0 ? d.h : (d.h * (s - d.r0)) / (d.s0 - d.r0));
    return y;
  }
  // A deck (or its steps) in this lane that stands more than a step above height y somewhere between `from` and `to`: a wall, to anyone at that height.
  deckWall(lane, from, to, y) {
    for (const d of this.decks) {
      if (d.lane !== lane || d.s1 < from || d.r0 > to) continue;
      if ((to >= d.s0 ? d.h : (d.h * (to - d.r0)) / (d.s0 - d.r0)) > y + STEP_UP) return d;
    }
    return null;
  }
}

// Where a moving obstacle is at time t on the game clock: a sweeper's place across the path, a bobber's height over it.
function moverBox(o, t) {
  const a = o.w * t + o.ph;
  if (o.kind === 'side') { o.x = LANE_W * Math.sin(a); o.x0 = o.x - 0.65; o.x1 = o.x + 0.65; }
  else { o.y0 = 0.05 + 0.775 * (1 - Math.cos(a)); o.y1 = o.y0 + 0.62; }
  return o;
}

// A moving bridge { s0, s1, x, to, locked, ph }: a platform one lane wide across a gap, which shuttles from lane to lane
// (0 → 1 → 2 → 1 → …) with a second's wait in each. Once the runner is about 1.3 s short of the gap it finishes the step
// it is on and stays there for good; `to` is the lane it is in, or on its way to.
const BRIDGE_SEQ = [0, 1, 2, 1], BRIDGE_WAIT = 1.0, BRIDGE_SLIDE = 0.35;
function bridgeStep(b, t, dt, runnerS, v) {
  const step = BRIDGE_WAIT + BRIDGE_SLIDE, u = (t + (b.ph || 0)) / step, i = Math.floor(u), f = (u - i) * step, sliding = f > BRIDGE_WAIT;
  const from = BRIDGE_SEQ[((i % 4) + 4) % 4], next = BRIDGE_SEQ[(((i + 1) % 4) + 4) % 4];
  if (!b.locked && runnerS > b.s0 - (1.3 * v + 3)) { b.locked = true; b.to = sliding ? next : from; b.holdAt = sliding ? t + step - f : t; }
  if (b.locked && !(t < b.holdAt)) { b.x = laneX(b.to); return b; }
  if (!b.locked) b.to = sliding ? next : from;
  b.x = lerp(laneX(from), laneX(next), sliding ? smooth((f - BRIDGE_WAIT) / BRIDGE_SLIDE) : 0);
  return b;
}

// ── layout: decide what goes where on a stretch ──
function genSegment(seg, W) {
  const rng = W.rng, L = seg.level, v = levelSpeed(L);
  const prog = seg.depth / LEVEL_STRETCHES;                  // 0 at the start, 1 where level 2 begins, …
  const hard = Math.min(4, Math.pow(1.22, L - 1));           // how far the tricky patterns outweigh the simple ones
  const fresh = Math.min(hard, 2.2);                         // and how far the new furniture (decks, pads, movers, bridges) is weighted up to keep pace
  const tight = Math.max(0.78, Math.pow(0.975, L - 1));      // two-part patterns close up a little each level too
  const dZig = Math.max(v * 0.62 * tight, 9), dLogBeam = Math.max(v * tight, 12), dBeamLog = Math.max(v * 0.95 * tight, 12);
  seg.v = v;
  const tutorial = seg.first && W.tutorial;
  seg.jt = seg.heading === 0 ? rng.weighted([[1, 'L'], [1, 'R'], [0.85, 'T']]) : seg.heading === 1 ? 'L' : 'R';
  if (seg.first) { seg.floorStart = -ROW * 11; seg.nRows = tutorial ? 63 : 11 + rng.int(40, 58); if (tutorial) seg.jt = 'T'; }
  else { seg.floorStart = HJ; seg.nRows = Math.max(22, Math.round((v * rng.range(4.6, 8.2)) / ROW)); }
  seg.len = seg.floorStart + seg.nRows * ROW + HJ;

  const O = seg.obstacles, B = seg.bananas, spots = [];       // spots: open ground half way between one pattern and the next
  const end = seg.len - HJ - Math.max(11, v * 0.8);          // nothing is laid beyond here: the run-up to the corner is kept clear
  const rowS = (k) => seg.floorStart + k * ROW;
  const rowOf = (s) => Math.ceil((s - seg.floorStart) / ROW - 1e-6);
  const others = (l) => [0, 1, 2].filter((i) => i !== l);
  const addPillar = (s, lane) => O.push({ type: 'pillar', s, s0: s - 0.62, s1: s + 0.62, x0: laneX(lane) - 0.72, x1: laneX(lane) + 0.72, y0: 0, y1: 2.8, lane });
  const addLog = (s, l0, l1) => O.push({ type: 'log', s, s0: s - 0.42, s1: s + 0.42, x0: laneX(l0) - 0.92, x1: laneX(l1) + 0.92, y0: 0, y1: 0.82, trip: true, l0, l1 });
  const addRubble = (s, lane) => O.push({ type: 'rubble', s, s0: s - 0.5, s1: s + 0.5, x0: laneX(lane) - 0.8, x1: laneX(lane) + 0.8, y0: 0, y1: 0.6, trip: true, lane });
  const addBeam = (s) => O.push({ type: 'beam', s, s0: s - 0.46, s1: s + 0.46, x0: -9, x1: 9, y0: 1.18, y1: 2.42 });
  const addHole = (k0, rows, lanes) => {
    for (let k = k0; k < k0 + rows; k++) for (const l of lanes) seg.holeCells.add(k * 3 + l);
    const s0 = rowS(k0), s1 = rowS(k0 + rows);
    let i = 0;
    while (i < lanes.length) { // one rectangle per run of neighbouring lanes
      let j = i;
      while (j + 1 < lanes.length && lanes[j + 1] === lanes[j] + 1) j++;
      seg.holes.push({ s0, s1, x0: lanes[i] === 0 ? -99 : laneX(lanes[i]) - LANE_W / 2, x1: lanes[j] === 2 ? 99 : laneX(lanes[j]) + LANE_W / 2 });
      i = j + 1;
    }
  };
  const addDeck = (lane, s0, s1, ramp) => { const x = laneX(lane), d = { lane, s0, s1, h: DECK_H, ramp, r0: ramp ? s0 - RAMP_LEN : s0, x0: x - LANE_W / 2, x1: x + LANE_W / 2 }; seg.decks.push(d); return d; };
  const landing = 0.75 * v;                                  // clear ground kept after anything he may come down from
  const addPad = (s, lane, d) => { const x = laneX(lane), o = { type: 'pad', lane, s, s0: s - 0.6, s1: s + 0.6, x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 0.3, d }; O.push(o); if (d) d.pad = o; return o; };
  const nana = (s, lane, y) => B.push({ s, x: laneX(lane), y: y === undefined ? 0.62 : y, got: false, pull: -1, ph: rng.f() * TAU, wx: 0, wz: 0 });
  const line = (s0, s1, lane, y) => { for (let s = s0; s <= s1 + 0.01; s += 1.9) nana(s, lane, y); };
  const arc = (mid, lane) => {
    const half = (v * AIR_T) / 2, n = Math.max(1, Math.floor((half - 0.5) / 1.9));
    for (let i = -n; i <= n; i++) { const ds = i * 1.9; nana(mid + ds, lane, 0.62 + JUMP_H * 0.93 * (1 - (ds / half) * (ds / half))); }
  };

  // Movers only ever trip. A sweeper trundles from kerb to kerb, waist high; a bobber rides up and down over one lane, from the floor to overhead.
  const addSweeper = (s) => O.push({ type: 'mover', kind: 'side', trip: true, s, s0: s - 0.5, s1: s + 0.5, w: TAU / rng.range(2.3, 3.1), ph: rng.f() * TAU, x: 0, x0: -0.65, x1: 0.65, y0: 0, y1: 1.15 });
  const addBobber = (s, lane, w, ph) => O.push({ type: 'mover', kind: 'bob', trip: true, s, s0: s - 0.45, s1: s + 0.45, lane, w, ph, cx: laneX(lane), x0: laneX(lane) - 0.7, x1: laneX(lane) + 0.7, y0: 0.05, y1: 0.67 });
  const bow = (ps, lane, t0, t1) => { for (let t = t0; t <= t1 + 1e-6; t += 1.9 / v) nana(ps + v * t, lane, 0.62 + PAD_V * t - (GRAVITY / 2) * t * t); }; // bananas strung along the path of a bounce
  // The low road beside a raised walkway: things to hop over and, where there is a lane beside it to dodge into, now and then a totem.
  const lowRoad = (d) => {
    const low = others(d.lane), gapLow = Math.max(12, v * 1.05 * tight);
    for (let r = d.s0 + rng.range(1, 4); r < d.s1 - 0.4 * v - 1.2; r += gapLow * rng.range(1, 1.3)) {
      const a = rng.pick(low), b = low[0] === a ? low[1] : low[0];
      const kind = rng.weighted([[3, 'rubble'], [3, 'log'], [2, 'both'], [d.lane !== 1 && prog >= 1 ? 2 : 0, 'totem']]);
      if (kind === 'rubble') addRubble(r, a);
      else if (kind === 'log') addLog(r, a, a);
      else if (kind === 'both') { addLog(r, a, a); if (rng.chance(0.5)) addLog(r, b, b); else addRubble(r, b); }
      else { addPillar(r, a); if (rng.chance(0.4)) addLog(r, b, b); }
    }
  };

  // Patterns return how many metres they used, or -1 if they did not fit.
  const P = {
    pillars1(s) { const lane = rng.int(0, 2); addPillar(s, lane); line(s - 5.7, s + 3.8, rng.pick(others(lane))); return 1.3; },
    pillars2(s) { const open = rng.int(0, 2); for (const l of others(open)) addPillar(s, l); line(s - 7.6, s + 3.8, open); return 1.3; },
    log(s) { addLog(s, 0, 2); arc(s, rng.int(0, 2)); return 1; },
    beam(s) { addBeam(s); line(s - 3.8, s + 3.8, rng.int(0, 2), 0.5); return 1; },
    beamPillar(s) { addBeam(s); const lane = rng.int(0, 2); addPillar(s, lane); line(s - 5.7, s + 3.8, rng.pick(others(lane)), 0.5); return 1.3; },
    gap(s) {
      const rows = v < 15 ? 1 : v < 20.5 ? 2 : v < 26 ? 3 : 4, k = rowOf(s);
      if (k + rows + 2 >= seg.nRows) return -1;
      addHole(k, rows, [0, 1, 2]);
      arc(rowS(k) + (rows * ROW) / 2, rng.int(0, 2));
      return rowS(k + rows) - s;
    },
    narrow(s) {
      const rows = clamp(Math.round((v * rng.range(0.75, 1.05)) / ROW), 4, 7), k = rowOf(s);
      if (k + rows + 2 >= seg.nRows) return -1;
      const mode = rng.weighted([[L > 4 ? 2 : 1, 'one'], [1.4, 'two'], [1, 'split']]);
      let gone, keep;
      if (mode === 'one') { keep = rng.int(0, 2); gone = others(keep); }
      else if (mode === 'two') { const g = rng.pick([0, 2]); gone = [g]; keep = rng.pick(others(g)); }
      else { gone = [1]; keep = rng.pick([0, 2]); }
      addHole(k, rows, gone);
      line(rowS(k) - 7.6, rowS(k + rows) + 1.9, keep);
      return rowS(k + rows) - s;
    },
    zig(s) {
      const a = rng.int(0, 2), b = a === 1 ? rng.pick([0, 2]) : 1, d = dZig;
      for (const l of others(a)) addPillar(s, l);
      for (const l of others(b)) addPillar(s + d, l);
      line(s - 5.7, s, a); line(s + d - 3.8, s + d + 1.9, b);
      return d + 1.3;
    },
    logBeam(s) { const d = dLogBeam, lane = rng.int(0, 2); addLog(s, 0, 2); addBeam(s + d); arc(s, lane); line(s + d - 3.8, s + d + 1.9, lane, 0.5); return d + 1; },
    beamLog(s) { const d = dBeamLog, lane = rng.int(0, 2); addBeam(s); addLog(s + d, 0, 2); line(s - 3.8, s + 1.9, lane, 0.5); arc(s + d, lane); return d + 1; },
    rubble(s) {
      const a = rng.int(0, 2), two = rng.chance(0.45), b = two ? rng.pick(others(a)) : -1;
      addRubble(s, a); if (two) addRubble(s, b);
      line(s - 5.7, s + 3.8, rng.pick([0, 1, 2].filter((l) => l !== a && l !== b)));
      return 1.2;
    },
    mixed(s) {
      const a = rng.int(0, 2), rest = others(a), flip = rng.chance(0.5), b = flip ? rest[0] : rest[1], c = flip ? rest[1] : rest[0];
      addPillar(s, a); addLog(s, b, b);
      if (rng.chance(0.5)) { addLog(s, c, c); arc(s, b); } else line(s - 5.7, s + 3.8, c);
      return 1.3;
    },
    // A raised walkway with steps up to it. Up top: a clear run and a row of bananas. Down below: things to hop over, and now and then a totem.
    deck(s) {
      const len = Math.min(clamp(v * rng.range(1.3, 2.1), 14, 46), end - s - RAMP_LEN - landing);
      if (len < 12) return -1;
      const lane = rng.int(0, 2), d = addDeck(lane, s + RAMP_LEN, s + RAMP_LEN + len, true);
      for (let i = 1; i < 3; i++) nana(d.r0 + i * 1.9, lane, 0.62 + (DECK_H * i * 1.9) / RAMP_LEN);
      line(d.s0 + 0.2, d.s1 - 1, lane, DECK_H + 0.62);
      lowRoad(d);
      return RAMP_LEN + len + landing;
    },
    // A bounce pad with a block behind it: the bounce is the only way up, and the bananas show the way.
    padDeck(s) {
      const lead = 0.25 * v + 1, len = Math.min(clamp(v * rng.range(1.4, 2.1), 14, 46), end - s - 1 - lead - landing);
      if (len < Math.max(12, 1.1 * v)) return -1;
      const lane = rng.int(0, 2), ps = s + 1, d = addDeck(lane, ps + lead, ps + lead + len, false);
      addPad(ps, lane, d);
      bow(ps, lane, 0.14, 0.7);
      line(ps + v * 0.76 + 1, d.s1 - 1, lane, DECK_H + 0.62);
      lowRoad(d);
      return 1 + lead + len + landing;
    },
    // A bounce pad with a clump of totems behind it: sail over the lot, or pick a way through on foot.
    padPile(s) {
      const fly = v * PAD_AIR, ps = s + 1, lane = rng.int(0, 2), rest = others(lane), r = ps + 0.36 * fly, flip = rng.chance(0.5), b = flip ? rest[0] : rest[1], c = flip ? rest[1] : rest[0];
      addPad(ps, lane);
      addPillar(r, lane); addPillar(r + 1.5, lane);
      if (rng.chance(0.5)) addPillar(r, b); else addLog(r, b, b);
      if (rng.chance(0.4)) { if (rng.chance(0.5)) addLog(r, c, c); else addRubble(r, c); }
      bow(ps, lane, 0.14, 0.8);
      return 1 + fly + 0.55 * v;
    },
    // A block of masonry with no way up it (short of springs, a shield or a bounce): something to go round, now and then two abreast.
    wall(s) {
      const len = Math.min(clamp(v * rng.range(0.7, 1.2), 9, 30), end - s - landing);
      if (len < 8) return -1;
      const lane = rng.int(0, 2), rest = others(lane), two = prog >= 2 && rng.chance(0.35), open = two ? rest[rng.int(0, 1)] : rng.pick(rest);
      for (const l of two ? others(open) : [lane]) { addDeck(l, s, s + len, false); line(s + 1, s + len - 1, l, DECK_H + 0.62); }
      line(s - 7.6, s + 1.9, open);
      return len + landing;
    },
    // A stone wheel (under water, a crab) trundling from kerb to kerb: hop it, or be where it is not.
    sweeper(s) {
      const lane = rng.int(0, 2);
      addSweeper(s + 0.5);
      if (rng.chance(0.6)) arc(s + 0.5, lane); else line(s - 3.3, s + 4.3, lane);
      return 1.2;
    },
    // A mask on a vine (a jellyfish) riding up and down over one lane, later sometimes two: go round it, or time it and go under or over.
    bobber(s) {
      const a = rng.int(0, 2), two = prog >= 2.5 && rng.chance(0.4), b = two ? rng.pick(others(a)) : -1, w = TAU / rng.range(2.6, 3.4), ph = rng.f() * TAU;
      addBobber(s + 0.5, a, w, ph);
      if (two) addBobber(s + 0.5, b, w, ph + Math.PI);
      if (two || rng.chance(0.5)) line(s - 5.2, s + 4.3, rng.pick([0, 1, 2].filter((l) => l !== a && l !== b)));
      else line(s - 3.3, s + 4.3, a, 0.5); // bananas along the floor beneath it, for the bold
      return 1.2;
    },
    // A gap too wide to jump, and one platform that shuttles across it from lane to lane; it settles for him as he comes, and its bananas ride with it.
    bridge(s) {
      const k = rowOf(s + 0.9 * v), rows = Math.ceil((0.9 * v + 3) / ROW);
      if (k + rows + 2 >= seg.nRows || rowS(k + rows) + 0.3 * v > end) return -1;
      addHole(k, rows, [0, 1, 2]);
      const h = seg.holes[seg.holes.length - 1], b = { s0: h.s0, s1: h.s1, x: 0, to: 1, locked: false, ph: rng.f() * 5.4 };
      h.bridge = b; seg.bridges.push(b);
      for (let q = b.s0 + 1.2; q < b.s1 - 0.6; q += 1.9) { nana(q, 1); B[B.length - 1].ride = b; }
      return b.s1 - s + 0.3 * v;
    },
    bananas(s) {
      let lane = rng.int(0, 2), ss = s;
      for (let i = 0; i < 3; i++) { line(ss, ss + 5.7, lane); ss += 7.6; lane = clamp(lane + rng.pick([-1, 1]), 0, 2); }
      return ss - s - 1.9;
    },
  };
  const need = { pillars1: 1.3, pillars2: 1.3, log: 1, beam: 1, beamPillar: 1.3, gap: 5 * ROW, narrow: 8 * ROW, zig: dZig + 1.3, logBeam: dLogBeam + 1, beamLog: dBeamLog + 1, rubble: 1.2, mixed: 1.3, bananas: 21,
    deck: RAMP_LEN + 12 + landing, wall: 8 + landing, padDeck: 2 + 0.25 * v + Math.max(12, 1.1 * v) + landing, padPile: 1 + v * PAD_AIR + 0.55 * v, sweeper: 1.2, bobber: 1.2, bridge: 2.1 * v + 3 + 2 * ROW };

  if (tutorial) { // a gentle opening that teaches one move at a time
    line(7.6, 22.8, 1);
    addLog(36, 0, 2); arc(36, 1);
    addBeam(64); line(60.2, 67.8, 1, 0.5);
    addPillar(90, 0); addPillar(90, 1); line(82.4, 93.8, 2);
    line(101, 116.2, 1);
  } else {
    let s = seg.first ? 30 : seg.floorStart + Math.max(11, v * 0.95);
    if (seg.first) line(7.6, 19, 1);
    const tGap = levelGap(L);
    const hop = seg.sea ? 1.5 : 1; // under water there is more to hop over (giant clams) and a little less of everything else
    let last = '';
    while (s < end - 2) {
      const on = (min, w) => (prog >= min ? w : 0);
      const table = [
        [3, 'pillars1'], [prog >= 0.5 ? 2.3 : 0.7, 'pillars2'], [3 * hop, 'log'], [2.5, 'beam'], [1 / hard, 'bananas'],
        [on(0.5, 2.3), 'gap'], [on(0.75, 1.6), 'rubble'], [on(1, 1.6 * hard * hop), 'mixed'], [on(1.75, 1.3 * hard), 'beamPillar'],
        [on(2, 1.8 * hard), 'narrow'], [on(2.25, 1.8 * hard), 'zig'], [on(2.75, 1.5 * hard * hop), 'logBeam'], [on(2.75, 1.3 * hard * hop), 'beamLog'],
        // the bigger furniture keeps its share as the classics grow fiercer: about two patterns in five, at every level
        [on(0.25, 2.6 * fresh), 'deck'], [on(1, 1.1 * hard), 'wall'], [on(0.75, 2 * fresh), 'padDeck'], [on(1.25, 1.2 * fresh), 'padPile'],
        [on(1, 2.2 * fresh), 'sweeper'], [on(1.5, 2 * fresh), 'bobber'], [on(2, 2.4 * fresh), 'bridge'],
      ];
      let name = rng.weighted(table);
      if (name === last) name = rng.weighted(table);
      if (s + need[name] > end) { name = rng.pick(['pillars1', 'log', 'beam']); if (s + need[name] > end) break; }
      let used = P[name](s);
      if (used < 0) { name = 'log'; used = P.log(s); }
      last = name;
      const gap = v * tGap * rng.range(1.0, 1.35);
      if (gap > 9 && s + used + gap * 0.5 < end - 1) spots.push(s + used + gap * 0.5);
      if (seg.dist0 + s > W.nextPickupAt && gap > 9) {
        const ps = s + used + gap * 0.5; // never tucked in behind a totem
        const open = [0, 1, 2].filter((l) => !O.some((o) => o.type === 'pillar' && o.lane === l && o.s > ps - 20 && o.s < ps + 9));
        seg.pickups.push({ kind: rng.weighted([[3, 'magnet'], [2.5, 'double'], [2.5, 'shield'], [2.5, 'springs'], [1.7, 'rocket']]), s: ps, x: laneX(open.length ? rng.pick(open) : rng.int(0, 2)), y: 1.15, got: false, sprite: null });
        W.nextPickupAt = seg.dist0 + s + rng.range(210, 350);
      }
      s += used + gap;
    }
  }
  // A crate, now and then: never in level 1, and never on a stretch laid while the level is held (so gold cannot be used to hunt them).
  // It floats on open ground between two patterns, clear of gaps, walkways, movers and tokens, in a lane with no totem to hide it or to follow it.
  if (seg.level >= 2 && !W.hold && spots.length && rng.chance(CRATE_ODDS)) {
    const ok = [];
    for (const ps of spots) {
      if (seg.holes.some((h) => h.s1 > ps - 6 && h.s0 < ps + 6) || seg.decks.some((d) => d.s1 > ps - 6 && d.r0 < ps + 6)
        || O.some((o) => o.type === 'mover' && Math.abs(o.s - ps) < 6) || seg.pickups.some((p) => Math.abs(p.s - ps) < 6)) continue;
      for (let l = 0; l < 3; l++) {
        const x = laneX(l);
        if (!O.some((o) => (o.type === 'pillar' && o.lane === l && o.s > ps - 20 && o.s < ps + 9) || (o.s1 > ps - 1.5 && o.s0 < ps + 1.5 && o.x1 > x - 0.6 && o.x0 < x + 0.6))) ok.push([ps, x]);
      }
    }
    if (ok.length) { const at = rng.pick(ok); seg.pickups.push({ kind: 'crate', s: at[0], x: at[1], y: 1.15, got: false, sprite: null }); }
  }
  O.sort((a, b) => a.s0 - b.s0);
  seg.pads = O.filter((o) => o.type === 'pad');
  seg.movers = O.filter((o) => o.type === 'mover');
  B.sort((a, b) => a.s - b.s);
  for (const b of B) { b.wx = seg.wx(b.s, b.x); b.wz = seg.wz(b.s, b.x); }
}

// ── obstacle models ──
const OT = 0.045; // outline thickness for track props
function addTotem(ob, ol, glow, x, z) {
  const parts = [[0.45, 1.5, 0.9, 1.26, 0x8fa6b3], [1.28, 1.26, 0.78, 1.08, 0xa5bbc6], [2.14, 1.56, 0.96, 1.3, 0x8fa6b3]];
  for (const [y, w, h, d, c] of parts) { ob.add(SHAPE.box, M(x, y, z, w, h, d), c); ol.add(SHAPE.box, M(x, y, z, w + 2 * OT, h + 2 * OT, d + 2 * OT)); }
  ob.add(SHAPE.box, M(x, 2.69, z, 1.62, 0.16, 1.36), ENV.moss);
  const fz = z + 0.66;
  ob.add(SHAPE.box, M(x - 0.37, 2.46, fz, 0.52, 0.11, 0.06, 0, 0, -0.34), ENV.carve);
  ob.add(SHAPE.box, M(x + 0.37, 2.46, fz, 0.52, 0.11, 0.06, 0, 0, 0.34), ENV.carve);
  glow.add(SHAPE.box, M(x - 0.37, 2.24, fz, 0.34, 0.2, 0.06), 0xffb238);
  glow.add(SHAPE.box, M(x + 0.37, 2.24, fz, 0.34, 0.2, 0.06), 0xffb238);
  ob.add(SHAPE.box, M(x, 1.88, fz, 0.86, 0.16, 0.06), ENV.carve);
  ob.add(SHAPE.box, M(x - 0.2, 1.9, fz + 0.01, 0.16, 0.13, 0.06), 0xf6ecd6);
  ob.add(SHAPE.box, M(x + 0.2, 1.9, fz + 0.01, 0.16, 0.13, 0.06), 0xf6ecd6);
  ob.add(SHAPE.box, M(x, 1.28, z + 0.55, 0.5, 0.5, 0.06, 0, 0, Math.PI / 4), 0x7f96a3);
}
function addLogMesh(ob, ol, rng, xc, z, len) {
  const r = 0.44, rz = Math.PI / 2;
  ob.add(SHAPE.cyl12, M(xc, r, z, 2 * r, len, 2 * r, 0, 0, rz), ENV.wood);
  ol.add(SHAPE.cyl12, M(xc, r, z, 2 * r + 2 * OT, len + 2 * OT, 2 * r + 2 * OT, 0, 0, rz));
  for (const e of [-1, 1]) ob.add(SHAPE.cyl12, M(xc + e * (len / 2 + 0.012), r, z, r * 1.6, 0.03, r * 1.6, 0, 0, rz), ENV.woodEnd);
  const bands = len > 3 ? 3 : 1;
  for (let i = 0; i < bands; i++) ob.add(SHAPE.cyl12, M(xc + (i - (bands - 1) / 2) * len * 0.3 + rng.range(-0.15, 0.15), r, z, 2 * r + 0.03, 0.16, 2 * r + 0.03, 0, 0, rz), ENV.woodDark);
  ob.add(SHAPE.cone4, M(xc + rng.range(-0.3, 0.3) * len, 2 * r + 0.16, z, 0.4, 0.5, 0.1, 0, rng.f() * 3, 0.5), ENV.leaf[0]);
}
// Under water, what lies across the path is a row of giant clams, one to a lane, each gaping towards you with a pearl inside.
const CLAM_SHELL = [0xf7c9dc, 0xd9c8f5, 0xfbe6c4, 0xbfe8dc], CLAM_FLESH = [0x2fc7c9, 0x7b6cf0, 0x3aa0ff, 0xf06ca8];
function addClams(ob, ol, glow, rng, xc, z, len) {
  const G = seaGeo(), n = Math.max(1, Math.round(len / 1.84)), step = len / n, HY = 0.27, HZ = -0.5, GAPE = 0.5;
  let ci = rng.int(0, 3);
  for (let i = 0; i < n; i++) {
    const x = xc + (i - (n - 1) / 2) * step, yaw = rng.range(-0.14, 0.14), dz = rng.range(-0.06, 0.06), k = rng.range(0.95, 1.02), c = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (lx, ly, lz) => [x + (lx * c + lz * sn) * k, ly * k, z + dz + (-lx * sn + lz * c) * k]; // a point of the clam, out in the stretch
    const shell = CLAM_SHELL[ci++ % 4], flesh = rng.pick(CLAM_FLESH), [hx, hy, hz] = at(0, HY, HZ);
    for (const [rx, rz] of [[0, Math.PI], [-GAPE, 0]]) { // the lower half lies dome down; the upper one is hinged open at the back
      ob.add(G.clamValve, M(hx, hy, hz, k, k, k, rx, yaw, rz), shell);
      ol.add(G.clamValveInk, M(hx, hy, hz, k, k, k, rx, yaw, rz));
    }
    let p = at(0, 0.39, 0.04); ob.add(SHAPE.sph, M(p[0], p[1], p[2], 1.44 * k, 0.34 * k, 0.86 * k, 0, yaw, 0), flesh);  // the soft part, bright between the lips
    for (const lx of [-0.5, -0.17, 0.17, 0.5]) { p = at(lx, 0.48 + 0.05 * (1 - Math.abs(lx) * 2), 0.4 - Math.abs(lx) * 0.16); ob.add(SHAPE.sphLo, M(p[0], p[1], p[2], 0.11 * k, 0.07 * k, 0.11 * k), shade(flesh, 1.45)); }
    p = at(0, 0.55, 0.26); glow.add(SHAPE.sph, M(p[0], p[1], p[2], 0.3 * k, 0.3 * k, 0.3 * k), 0xfffdf2);               // the pearl
  }
}
function addRubbleMesh(ob, ol, rng, x, z) {
  const rocks = [[-0.42, 0.24, 0.1, 0.86, 0.56, 0.74], [0.36, 0.2, -0.12, 0.74, 0.48, 0.7], [0.02, 0.36, 0.0, 0.6, 0.5, 0.6]];
  for (const [dx, y, dz, sx, sy, sz] of rocks) {
    const ry = rng.f() * 3;
    ob.add(SHAPE.ico, M(x + dx, y, z + dz, sx, sy, sz, 0, ry, 0), rng.pick(ENV.rock));
    ol.add(SHAPE.ico, M(x + dx, y, z + dz, sx + 2 * OT, sy + 2 * OT, sz + 2 * OT, 0, ry, 0));
  }
}
function addBeamMesh(ob, ol, glow, rng, z) {
  const w = 2 * HJ + 0.5;
  ob.add(SHAPE.box, M(0, 1.74, z, w, 1.04, 0.96), ENV.stoneWarm);
  ol.add(SHAPE.box, M(0, 1.74, z, w + 2 * OT, 1.04 + 2 * OT, 0.96 + 2 * OT));
  for (const sd of [-1, 1]) {
    ob.add(SHAPE.box, M(sd * (HJ + 0.1), 0.56, z, 0.64, 1.32, 1.0), ENV.stoneWarm2);
    ol.add(SHAPE.box, M(sd * (HJ + 0.1), 0.56, z, 0.64 + 2 * OT, 1.32 + 2 * OT, 1.0 + 2 * OT));
  }
  ob.add(SHAPE.box, M(0, 2.3, z, w, 0.12, 1.02), ENV.moss);
  ob.add(SHAPE.box, M(0, 1.74, z + 0.485, w - 0.5, 0.62, 0.02), 0x8f7b5c);
  for (let l = 0; l < 3; l++) { // "duck here" chevrons
    const lx = laneX(l);
    glow.add(SHAPE.box, M(lx - 0.17, 1.74, z + 0.51, 0.46, 0.12, 0.05, 0, 0, -0.75), 0xffe45c);
    glow.add(SHAPE.box, M(lx + 0.17, 1.74, z + 0.51, 0.46, 0.12, 0.05, 0, 0, 0.75), 0xffe45c);
  }
  for (let i = 0; i < 6; i++) { const len = rng.range(0.1, 0.3); ob.add(SHAPE.box, M(rng.range(-2.7, 2.7), 1.22 - len / 2, z + rng.range(-0.35, 0.35), 0.09, len, 0.05), rng.pick(ENV.leaf)); }
}
function addChevron(glow, cx, cy, z, dir) { // ">" for dir=+1, "<" for dir=-1
  glow.add(SHAPE.box, M(cx - dir * 0.02, cy + 0.3, z, 1.0, 0.27, 0.08, 0, 0, -dir * 0.7), 0xffe14d);
  glow.add(SHAPE.box, M(cx - dir * 0.02, cy - 0.3, z, 1.0, 0.27, 0.08, 0, 0, dir * 0.7), 0xffe14d);
}

// ── build the meshes for one stretch ──
function buildSegment(seg, W) {
  const rng = makeRng((W.seed ^ Math.imul(seg.id + 1, 0x9E3779B1)) >>> 0); // scenery dice, separate from layout dice
  const gb = new GeoBuilder(), ob = new GeoBuilder(), ol = new GeoBuilder(false), glow = new GeoBuilder();
  const sea = seg.sea;
  const gs = new GeoBuilder();     // sea life: shown only while the water is up
  ENV = sea ? ENV_SEA : ENV_LAND; // a High Tide stretch is dressed in weed and coral
  DECOR = sea ? gs : null;
  if (sea) seaGeo();
  const group = seg.group = new THREE.Group();
  group.position.set(seg.ox, 0, seg.oz); group.rotation.y = seg.yaw;
  const hole = (k, l) => seg.holeCells.has(k * 3 + l);

  // floor: three slabs per row, on a darker bed, with curbs
  for (let k = 0; k < seg.nRows; k++) {
    const z = -(seg.floorStart + (k + 0.5) * ROW);
    let cells = 0;
    for (let l = 0; l < 3; l++) {
      if (hole(k, l)) continue;
      cells++;
      const x = laneX(l);
      gb.add(SHAPE.box, M(x, -0.16, z, LANE_W - 0.07, 0.32, ROW - 0.07), rng.chance(0.06) ? ENV.slabMoss : rng.pick(ENV.slab));
      gb.add(SHAPE.box, M(x, -0.74, z, LANE_W, 0.84, ROW), ENV.base);
      if (k + 1 < seg.nRows && hole(k + 1, l)) for (let i = 0; i < 2; i++) gb.add(SHAPE.box, M(x + rng.range(-0.6, 0.6), -0.24, z - ROW / 2 - 0.16, 0.5, 0.3, 0.44, 0, rng.range(-0.4, 0.4), 0), ENV.slab[3]);
      if (k > 0 && hole(k - 1, l)) for (let i = 0; i < 2; i++) gb.add(SHAPE.box, M(x + rng.range(-0.6, 0.6), -0.24, z + ROW / 2 + 0.16, 0.5, 0.3, 0.44, 0, rng.range(-0.4, 0.4), 0), ENV.slab[3]);
    }
    for (const side of [-1, 1]) {
      if (hole(k, side < 0 ? 0 : 2)) continue;
      gb.add(SHAPE.box, M(side * (FLOOR_HALF + CURB_W / 2), -0.1, z, CURB_W, 0.64, ROW - 0.05), k % 2 ? ENV.curb : ENV.curb2);
      if (rng.chance(0.15)) gb.add(SHAPE.ico, M(side * (FLOOR_HALF + 0.2), 0.27, z + rng.range(-0.8, 0.8), 0.52, 0.34, 0.52, 0, rng.f() * 3, 0), rng.pick(ENV.leaf));
      else if (sea && rng.chance(0.07)) addStarfish(gb, rng, side * (FLOOR_HALF + CURB_W / 2), 0.22, z + rng.range(-0.8, 0.8), 0.7);
      else if (sea && rng.chance(0.09)) addCoral(gb, rng, side * (FLOOR_HALF + CURB_W * 0.8), 0.2, z + rng.range(-0.8, 0.8), rng.range(0.36, 0.55)); // a little coral has taken to the kerb
    }
    if (cells === 3 && k % 5 === 2) { // a pier down into the water
      gb.add(SHAPE.box, M(0, -1.45, z, 5.0, 0.6, 2.2), ENV.baseDark);
      gb.add(SHAPE.box, M(0, (WATER_BASE - 1.75) / 2, z, 2.6, -1.75 - WATER_BASE, 2.0), ENV.baseDark);
      addFoam(gb, 0, z, 4.2, 3.6);
    }
  }

  // junction square at the far end, with a sign wall telling you which way to go
  const zc = -seg.len;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) gb.add(SHAPE.box, M(i * 2.133, -0.16, zc + j * 2.133, 2.07, 0.32, 2.07), (i + j) % 2 === 0 ? ENV.slab[2] : ENV.slab[3]);
  gb.add(SHAPE.cyl12, M(0, 0.006, zc, 2.3, 0.02, 2.3), 0xf0c860);
  gb.add(SHAPE.cyl12, M(0, 0.014, zc, 1.4, 0.02, 1.4), 0xe9a23f);
  gb.add(SHAPE.box, M(0, -0.74, zc, 2 * HJ, 0.84, 2 * HJ), ENV.base);
  gb.add(SHAPE.box, M(0, (WATER_BASE - 1.16) / 2, zc, 3.4, -1.16 - WATER_BASE, 3.4), ENV.baseDark);
  addFoam(gb, 0, zc, 5.4);
  const wall = (x, z, w, d) => { gb.add(SHAPE.box, M(x, 0.5, z, w, 1.3, d), ENV.stoneWarm); gb.add(SHAPE.box, M(x, 1.22, z, w + 0.14, 0.16, d + 0.14), ENV.curb); };
  const zf = zc - HJ - 0.3;
  wall(0, zf, 2 * HJ + 1.2, 0.6);
  if (seg.jt === 'R') wall(-HJ - 0.3, zc, 0.6, 2 * HJ);
  if (seg.jt === 'L') wall(HJ + 0.3, zc, 0.6, 2 * HJ);
  gb.add(SHAPE.box, M(0, 2.42, zf, 4.6, 2.3, 0.5), 0x46535f);
  gb.add(SHAPE.box, M(0, 3.66, zf, 5.0, 0.2, 0.7), ENV.stone3);
  gb.add(SHAPE.box, M(0, 3.82, zf, 4.6, 0.12, 0.6), ENV.moss);
  const zs = zf + 0.28;
  if (seg.jt === 'T') { addChevron(glow, -1.05, 2.42, zs, -1); addChevron(glow, 1.05, 2.42, zs, 1); glow.add(SHAPE.box, M(0, 2.42, zs, 0.3, 0.3, 0.08, 0, 0, Math.PI / 4), 0xffe14d); }
  else { const d = seg.jt === 'R' ? 1 : -1; addChevron(glow, -0.55 * d - 0.1 * d, 2.42, zs, d); addChevron(glow, 0.65 * d - 0.1 * d, 2.42, zs, d); }
  for (const sd of [-1, 1]) {
    gb.add(SHAPE.box, M(sd * (HJ + 0.3), 1.2, zf, 0.9, 2.6, 0.9), ENV.stoneWarm2);
    gb.add(SHAPE.box, M(sd * (HJ + 0.3), 2.56, zf, 1.1, 0.2, 1.1), ENV.stone3);
    addTorch(gb, glow, sd * (HJ + 0.3), 2.66, zf);
  }
  addTower(gb, glow, rng, 0, zf - 4.4);

  for (const d of seg.decks) addDeckMesh(gb, ol, glow, rng, d, sea); // raised walkways are part of the ground: nothing smashes one

  // obstacles (kept in their own meshes so a shield can smash one)
  for (const o of seg.obstacles) {
    const a = ob.n, b = ol.n, c = glow.n, z = -o.s;
    if (o.type === 'pillar') addTotem(ob, ol, glow, laneX(o.lane), z);
    else if (o.type === 'log') {
      const xc = (laneX(o.l0) + laneX(o.l1)) / 2, len = (o.l1 - o.l0) * LANE_W + 1.72;
      if (sea) { addClams(ob, ol, glow, rng, xc, z, len); o.skin = 'clam'; } else addLogMesh(ob, ol, rng, xc, z, len);
    }
    else if (o.type === 'rubble') addRubbleMesh(ob, ol, rng, laneX(o.lane), z);
    else if (o.type === 'beam') addBeamMesh(ob, ol, glow, rng, z);
    else if (o.type === 'pad') addPadMesh(ob, ol, glow, rng, laneX(o.lane), z, sea);
    o.rOb = [a, ob.n]; o.rOl = [b, ol.n]; o.rGl = [c, glow.n];
  }

  // things that move get meshes of their own, posed every frame (see World.update)
  for (const b of seg.bridges) { group.add(makeBridge(b, sea)); bridgeStep(b, 0, 0, -1e9, 0); poseBridge(b, 0); }
  let frameAt = -9;
  for (const o of seg.movers) {
    group.add(makeMover(o, sea));
    if (o.vine) { group.add(o.vine); if (Math.abs(o.s - frameAt) > 1) { addBobFrame(gb, rng, -o.s); frameAt = o.s; } }
    moverBox(o, 0); poseMover(o, 0);
  }

  // scenery beside the path
  const d0 = seg.first ? seg.floorStart + 6 : HJ + 13, d1 = seg.len - HJ - 13;
  let sa = d0 + rng.range(10, 30);
  const arches = [], posts = []; // remembered so the swimmers can keep clear of them
  while (sa < d1) { addArch(gb, glow, rng, -sa); arches.push(sa); sa += rng.range(40, 66); }
  for (const side of [-1, 1]) {
    let s = d0 + rng.range(0, 7);
    while (s < d1) {
      const kind = rng.weighted(sea ? [[3, 'reef'], [1.9, 'column'], [0.7, 'idol'], [1.5, 'kelp'], [1, 'rocks']] : [[3, 'island'], [2.2, 'column'], [0.8, 'idol'], [1.1, 'tree'], [1.2, 'rocks']]);
      const z = -s;
      if (kind === 'reef') {
        const R = rng.range(1.8, 3.3), x = side * (HJ + 1.5 + R + rng.range(0, 5)), top = addReef(gb, glow, rng, x, z, R, rng.range(-1.2, 0.9));
        if (rng.chance(0.3)) gs.add(GEO.seal, M(x - side * R * 0.35, top + 0.06, z - R * 0.2, 0.95, 0.95, 0.95, 0, side * rng.range(0.9, 2.0), 0)); // one hauled out for a rest, watching you go by
      } else if (kind === 'kelp') addKelpForest(gb, rng, side * (HJ + 5.5 + rng.range(0, 7)), z);
      else if (kind === 'island') { const R = rng.range(1.8, 3.3); addIsland(gb, rng, side * (HJ + 1.5 + R + rng.range(0, 5)), z, R, rng.range(-1.2, 0.9), true); }
      else if (kind === 'column') { const x = side * (HJ + 1.6 + rng.range(0, 6.5)), top = rng.range(1.2, 7.5); addColumn(gb, rng, x, z, top); posts.push({ x, s, top }); }
      else if (kind === 'idol') { const x = side * (HJ + 2.3); gb.add(SHAPE.box, M(x, (0.1 + WATER_BASE) / 2, z, 2.1, 0.1 - WATER_BASE, 2.1), ENV.baseDark); addFoam(gb, x, z, 3.4); addIdol(gb, glow, rng, x, z, 0.1, { x: -side * 0.8, z: 0.6 }, 1); }
      else if (kind === 'tree') addBigTree(gb, rng, side * (HJ + 7 + rng.range(0, 5)), z);
      else { const x = side * (HJ + 3 + rng.range(0, 8)); addRocks(gb, rng, x, z); if (sea) addKelp(gb, rng, x + rng.range(-1, 1), WATER_Y + 0.6, z + rng.range(-1, 1), rng.range(5, 9)); }
      s += rng.range(7, 14);
    }
  }
  if (seg.first) addTemple(gb, glow, rng, -seg.floorStart);

  const env = new THREE.Mesh(gb.build(), MAT.env);
  seg.obMesh = new THREE.Mesh(ob.build(), MAT.env);
  seg.olMesh = new THREE.Mesh(ol.build(), MAT.ink);
  seg.glMesh = new THREE.Mesh(glow.build(), MAT.glow);
  group.add(env, seg.obMesh, seg.olMesh, seg.glMesh);
  if (sea) { seg.seaMesh = new THREE.Mesh(gs.build(), MAT.env); seg.seaMesh.visible = Tide.y > SEA_LIFE_Y; group.add(seg.seaMesh); }

  for (const p of seg.pickups) {
    if (p.kind === 'crate') { group.add(makeCrate(p, sea)); continue; } // a crate is a thing, not a token
    const sp = new THREE.Sprite(W.pickupMat[p.kind]);
    sp.position.set(p.x, p.y, -p.s); sp.scale.set(1.5, 1.5, 1);
    p.sprite = sp; group.add(sp);
  }

  // company for a High Tide stretch: an orca wheeling high over the path, and seals looping round the far columns
  seg.critters = [];
  if (sea) {
    if (d1 - d0 > 34) {
      let sc = rng.range(d0 + 10, d1 - 10);
      for (let i = 0; i < 6 && arches.some((a) => Math.abs(a - sc) < 11); i++) sc = rng.range(d0 + 10, d1 - 10); // not through a gateway
      seg.critters.push(new Swimmer('orca', { cx: 0, cy: rng.range(6.4, 7.3), cz: -sc, rx: rng.range(17, 24), rz: rng.range(4, 6), w: rng.range(0.34, 0.46) * (rng.chance(0.5) ? 1 : -1), ph: rng.f() * TAU, bob: 0.6 }));
    }
    if (seg.first) { // where the home screen looks: a seal circling just behind him (it bolts when the chase begins), and a school of fish across the temple doorway
      seg.critters.push(new Swimmer('seal', { home: true, cx: -1.9, cy: 2.3, cz: 5.2, rx: 1.4, rz: 1.1, w: -0.8, ph: 2.2, bob: 0.25, size: 0.95, roll: true }));
      seg.critters.push(new Swimmer('fish', { cx: 1.2, cy: 2.7, cz: -seg.floorStart - 5, rx: 2.6, rz: 1.5, w: 0.5, ph: rng.f() * TAU, bob: 0.4, size: 1.25 }));
    }
    const far = posts.filter((p) => Math.abs(p.x) > 7).slice(0, 3);
    for (const p of far) seg.critters.push(new Swimmer('seal', { cx: p.x, cy: clamp(p.top - 1, 1.6, 4.2), cz: -p.s, rx: 2.5, rz: 2.5, w: rng.range(0.8, 1.15) * (rng.chance(0.5) ? 1 : -1), ph: rng.f() * TAU, bob: 0.45, size: rng.range(0.85, 1.05), roll: rng.chance(0.5) }));
    for (let i = 0; i < 2; i++) { // and a couple of schools of fish milling about beside it
      const side = rng.chance(0.5) ? 1 : -1, r = rng.range(2.6, 4.2);
      seg.critters.push(new Swimmer('fish', { alt: i === 1, cx: side * (HJ + 2.2 + r + rng.range(0, 4)), cy: rng.range(1.8, 4.6), cz: -rng.range(d0, d1), rx: r, rz: r * rng.range(1, 1.8), w: rng.range(0.5, 0.8) * (rng.chance(0.5) ? 1 : -1), ph: rng.f() * TAU, bob: 0.5, size: rng.range(0.9, 1.3) }));
    }
    for (const c of seg.critters) { c.update(0); c.obj.visible = Tide.y > SEA_LIFE_Y; group.add(c.obj); }
  }
  ENV = ENV_LAND; DECOR = null;
}

// ── the world keeps the tree of stretches alive around the player ──
class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    this.cap = 640;
    GEO.nana = GEO.banana.clone(); GEO.nana.rotateZ(0.95);
    GEO.nanaInk = outlineOf(GEO.nana, 0.024);
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD_CHAR, emissive: 0x4a3600 });
    this.nanas = new THREE.InstancedMesh(GEO.nana, mat, this.cap);
    this.nanaInk = new THREE.InstancedMesh(GEO.nanaInk, MAT.ink, this.cap);
    this.nanaInk.instanceMatrix = this.nanas.instanceMatrix;
    for (const m of [this.nanas, this.nanaInk]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.pickupMat = makePickupMaterials();
    this.queue = []; this.cur = null; this.prev = null; this.first = null;
  }

  reset(seed, tutorial) {
    if (this.dropLater) { this._disposeTree(this.dropLater); this.dropLater = null; }
    if (this.first) this._disposeTree(this.root_seg());
    this.queue.length = 0; this.tutorial = !!tutorial;
    this.seed = seed >>> 0; this.rng = makeRng(this.seed);
    this.nextPickupAt = 170; this.skyOn = false; this.wet = false; this.hold = false;
    this.first = this.cur = this._make(null, null);
    this.prev = null;
    this.ensureAhead();
    while (this.queue.length) this.tick(); // the opening stretches are built up front
  }
  root_seg() { let s = this.cur; while (s && s.parent && !s.parent.dead) s = s.parent; return s; }

  _make(parent, turn) {
    const seg = new Seg(parent, turn);
    if (this.hold && parent) { seg.depth = parent.depth; seg.level = parent.level; } // made while the level is held: no deeper into the run than the stretch before
    genSegment(seg, this);
    if (this.skyOn) this.addSky(seg, seg.floorStart + 6);
    buildSegment(seg, this);
    this.root.add(seg.group);
    if (parent) parent.kids[turn] = seg;
    return seg;
  }
  // Hold the level (while he is gold): every stretch ahead, built already or yet to be, counts as being as deep into the run as the one he is on.
  setHold(on) {
    this.hold = !!on;
    if (!on || !this.cur) return;
    const level = (seg, d) => { if (!seg || seg.dead) return; seg.depth = d; seg.level = levelOf(d); level(seg.kids.L, d); level(seg.kids.R, d); };
    level(this.cur.kids.L, this.cur.depth); level(this.cur.kids.R, this.cur.depth);
  }
  _want(seg) {
    const turns = seg.jt === 'T' ? ['L', 'R'] : [seg.jt];
    for (const t of turns) if (!seg.kids[t] && !this.queue.some((q) => q.parent === seg && q.turn === t)) this.queue.push({ parent: seg, turn: t });
  }
  ensureAhead() {
    this._want(this.cur);
    for (const t of ['L', 'R']) if (this.cur.kids[t]) this._want(this.cur.kids[t]);
  }
  // Build at most one queued stretch per frame so a turn never hitches.
  tick() {
    while (this.queue.length) {
      const q = this.queue.shift();
      if (q.parent.dead || q.parent.kids[q.turn]) continue;
      this._make(q.parent, q.turn);
      if (q.parent === this.cur) this._want(q.parent.kids[q.turn]);
      return;
    }
  }
  _disposeTree(seg) {
    if (!seg || seg.dead) return;
    seg.dead = true;
    for (const t of ['L', 'R']) if (seg.kids[t]) this._disposeTree(seg.kids[t]);
    if (seg.group) { this.root.remove(seg.group); disposeTree(seg.group); seg.group = null; }
  }
  _disposeOne(seg) {
    if (!seg || seg.dead) return;
    seg.dead = true;
    if (seg.group) { this.root.remove(seg.group); disposeTree(seg.group); seg.group = null; }
  }
  // The player took `turn` at the end of the current stretch.
  enter(turn) {
    const old = this.cur, next = old.kids[turn], other = old.kids[turn === 'L' ? 'R' : 'L'];
    if (this.dropLater) { this._disposeTree(this.dropLater); this.dropLater = null; }
    if (other) { this.dropLater = other; this.dropT = 1.2; old.kids[turn === 'L' ? 'R' : 'L'] = null; }
    if (this.prev) this._disposeOne(this.prev);
    this.prev = old; this.cur = next;
    this.ensureAhead();
    return next;
  }
  showSeaLife(seg, on, n) {
    if (!seg || seg.dead || n > 2) return;
    if (seg.seaMesh) seg.seaMesh.visible = on;
    if (seg.critters) for (const c of seg.critters) c.obj.visible = on;
    this.showSeaLife(seg.kids.L, on, n + 1); this.showSeaLife(seg.kids.R, on, n + 1);
  }
  // A trail of bananas in the air for the rocket to fly through.
  addSky(seg, from) {
    if (!seg || seg.dead || seg.sky) return;
    seg.sky = true;
    let lane = 1, n = 0, s = Math.max(from, seg.floorStart + 6);
    const end = seg.len - HJ - 9;
    while (s < end) {
      const x = laneX(lane);
      seg.bananas.push({ s, x, y: FLY_Y + 0.72, got: false, pull: -1, ph: Math.random() * TAU, wx: seg.wx(s, x), wz: seg.wz(s, x), sky: true });
      s += 1.9;
      if (++n >= 7) { n = 0; s += 5.7; lane = clamp(lane + (Math.random() < 0.5 ? -1 : 1), 0, 2); }
    }
    seg.bananas.sort((a, b) => a.s - b.s); seg.bI = 0;
  }
  // Gold's bananas: one in each lane at every floor row from `from` to `to`, at the height of the floor there (so along the top
  // of a walkway where there is one), except where a banana already hangs. Calling it again only carries the rows further.
  addGold(seg, from, to) {
    if (!seg || seg.dead) return;
    const top = Math.min(to, seg.len - HJ - 0.5), k0 = Math.ceil((Math.max(from, seg.goldTo === undefined ? -1e9 : seg.goldTo + 0.01) - seg.floorStart) / ROW - 0.5);
    let s = seg.floorStart + (Math.max(0, k0) + 0.5) * ROW;
    if (s > top) return;
    const B = seg.bananas, old = B.length;
    for (; s <= top; s += ROW) {
      for (let l = 0; l < 3; l++) {
        const x = laneX(l), y = seg.floorY(s, x) + 0.62;
        let taken = false;
        for (let i = 0; i < old && !taken; i++) { const b = B[i]; taken = !b.got && Math.abs(b.s - s) < 1 && Math.abs(b.x - x) < 0.5 && Math.abs(b.y - y) < 1; }
        if (!taken) B.push({ s, x, y, got: false, pull: -1, ph: s * 0.9 + l * 2.1, wx: seg.wx(s, x), wz: seg.wz(s, x), gold: true });
      }
      seg.goldTo = s;
    }
    B.sort((a, b) => a.s - b.s); seg.bI = 0;
  }
  // While he is gold: rows right to the end of the stretch he is on (from just ahead of him), and along the first 60 m of whatever comes next.
  goldAhead(s) {
    this.addGold(this.cur, s + 3, 1e9);
    for (const t of ['L', 'R']) { const k = this.cur.kids[t]; if (k) this.addGold(k, -1e9, k.floorStart + 60); }
  }
  dropGold() { // gold is over: its bananas go with it
    const clear = (seg, n) => { if (!seg || n > 3) return; seg.goldTo = undefined; for (const b of seg.bananas) if (b.gold && !b.got && b.pull < 0) b.got = true; clear(seg.kids.L, n + 1); clear(seg.kids.R, n + 1); };
    clear(this.cur, 0); clear(this.prev, 3);
  }
  dropSky() { // the flight is over: clear whatever is still hanging in the air
    this.skyOn = false;
    const clear = (seg) => { if (!seg || seg.dead) return; seg.sky = false; for (const b of seg.bananas) if (b.sky && !b.got && b.pull < 0) b.got = true; for (const t of ['L', 'R']) clear(seg.kids[t]); };
    clear(this.cur);
  }
  // Shield smash: collapse the obstacle's triangles so it vanishes.
  smash(seg, o) {
    o.gone = true;
    const wipe = (mesh, r) => { if (!mesh || !r || r[1] <= r[0]) return; const a = mesh.geometry.attributes.position; a.array.fill(0, r[0] * 3, r[1] * 3); a.needsUpdate = true; };
    wipe(seg.obMesh, o.rOb); wipe(seg.olMesh, o.rOl); wipe(seg.glMesh, o.rGl);
    if (o.mesh) o.mesh.visible = false; // (a mover has a mesh of its own)
    if (o.vine) o.vine.visible = false;
  }

  update(dt, t, px, py, pz) {
    if (this.dropLater) { this.dropT -= dt; if (this.dropT <= 0) { this._disposeTree(this.dropLater); this.dropLater = null; } }
    this.tick();
    // bananas: one instanced draw for every banana in view
    const arr = this.nanas.instanceMatrix.array, cap = this.cap;
    let n = 0;
    const segs = [this.cur, this.cur.kids.L, this.cur.kids.R, this.prev], wet = Tide.y > SEA_LIFE_Y; // (what is ahead first: should the banana list ever fill, what goes undrawn is behind him)
    if (wet !== this.wet) { this.wet = wet; this.showSeaLife(this.prev, wet, 0); this.showSeaLife(this.cur, wet, 0); } // coral and company appear as the water reaches them
    for (const seg of segs) {
      if (!seg || seg.dead) continue;
      for (const b of seg.bridges) { bridgeStep(b, t, dt, Player.seg === seg ? Player.s : -1e9, Game.run ? Game.run.speed : 0); if (b.mesh) poseBridge(b, t); }
      for (const b of seg.bananas) {
        if (b.got || n >= cap) continue;
        if (b.ride && b.pull < 0) { b.x = b.ride.x; b.wx = seg.wx(b.s, b.x); b.wz = seg.wz(b.s, b.x); } // a banana on a moving bridge goes where the bridge goes
        let x = b.wx, y = b.y + Math.sin(t * 3 + b.ph) * 0.07, z = b.wz, sc = 1;
        if (b.pull >= 0) { const e = b.pull * b.pull; x = lerp(x, px, e); y = lerp(y, py + 0.8, e); z = lerp(z, pz, e); sc = 1 - e * 0.5; }
        const a = t * 2.6 + b.ph, ca = Math.cos(a) * sc, sn = Math.sin(a) * sc, o = n * 16;
        arr[o] = ca; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
        arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = ca; arr[o + 11] = 0;
        arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
        n++;
      }
      if (seg.critters) for (const c of seg.critters) c.update(t);
      for (const o of seg.movers) { moverBox(o, t); if (o.mesh) poseMover(o, t); }
      if (seg.sea && seg.pads && wet) for (const o of seg.pads) { // the bubble jets blow, while they are near enough to see
        if (o.used) continue;
        const jx = seg.wx(o.s, laneX(o.lane)), jz = seg.wz(o.s, laneX(o.lane));
        if ((jx - px) * (jx - px) + (jz - pz) * (jz - pz) > 5600) continue;
        if ((o.bt = (o.bt || 0) - dt) <= 0) { o.bt = 0.13 + Math.random() * 0.1; fx.bubbles(jx, 0.55, jz, 1, 0.4, 1.3); }
      }
      for (const p of seg.pickups) {
        if (p.got) continue;
        if (p.sprite) { p.sprite.position.y = p.y + Math.sin(t * 3.2 + p.s) * 0.14; const k = 1.5 + Math.sin(t * 6 + p.s) * 0.07; p.sprite.scale.set(k, k, 1); }
        else if (p.mesh) { // a crate turns and bobs, and sheds the odd glint when he is near enough to see it
          p.mesh.position.y = p.y + Math.sin(t * 2.6 + p.s) * 0.12; p.box.rotation.set(0.16, t * 1.1 + p.s, 0.1);
          const k = 3.4 + Math.sin(t * 4 + p.s) * 0.35; p.halo.scale.set(k, k, 1);
          const cx = seg.wx(p.s, p.x), cz = seg.wz(p.s, p.x);
          if ((cx - px) * (cx - px) + (cz - pz) * (cz - pz) < 4900 && Math.random() < dt * 5) fx.sparkle(cx + (Math.random() - 0.5) * 0.9, p.y + Math.random() * 0.9 - 0.2, cz + (Math.random() - 0.5) * 0.9, 1, 0xffe45c);
        }
      }
    }
    this.nanas.count = n; this.nanaInk.count = n;
    this.nanas.instanceMatrix.needsUpdate = true;
  }
}

// Power-up badges drawn on a canvas and shown as stickers floating over the path.
function drawBadge(kind, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), u = size / 128;
  g.scale(u, u);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.arc(64, 68, 50, 0, TAU); g.fillStyle = '#3A1E14'; g.fill();           // drop shadow
  g.beginPath(); g.arc(64, 60, 50, 0, TAU);
  g.fillStyle = { magnet: '#FFF2DC', shield: '#BFF3FF', double: '#FFD23F', springs: '#C9F5A0', rocket: '#FFC2A8' }[kind]; g.fill();
  g.lineWidth = 8; g.strokeStyle = '#3A1E14'; g.stroke();
  if (kind === 'magnet') {
    g.lineWidth = 22; g.strokeStyle = '#3A1E14';
    g.beginPath(); g.moveTo(42, 38); g.lineTo(42, 62); g.arc(64, 62, 22, Math.PI, 0, true); g.lineTo(86, 38); g.stroke();
    g.lineWidth = 13; g.strokeStyle = '#E8402A';
    g.beginPath(); g.moveTo(42, 40); g.lineTo(42, 62); g.arc(64, 62, 22, Math.PI, 0, true); g.lineTo(86, 40); g.stroke();
    g.strokeStyle = '#E9EEF2'; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(42, 34); g.lineTo(42, 46); g.moveTo(86, 34); g.lineTo(86, 46); g.stroke();
  } else if (kind === 'shield') {
    g.beginPath(); g.arc(64, 60, 30, 0, TAU); g.fillStyle = '#5FD6F2'; g.fill(); g.lineWidth = 7; g.stroke();
    g.beginPath(); g.arc(54, 50, 9, 0, TAU); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(73, 70, 4, 0, TAU); g.fill();
  } else if (kind === 'springs') {
    const zig = () => { g.beginPath(); g.moveTo(44, 90); g.lineTo(84, 80); g.lineTo(44, 68); g.lineTo(84, 56); g.lineTo(44, 44); g.lineTo(84, 32); g.stroke(); };
    g.lineWidth = 15; g.strokeStyle = '#3A1E14'; zig();
    g.lineWidth = 7; g.strokeStyle = '#5FCB2E'; zig();
  } else if (kind === 'rocket') {
    g.translate(64, 60); g.scale(0.74, 0.74); g.translate(-64, -66);
    g.lineWidth = 8; g.strokeStyle = '#3A1E14';
    g.beginPath(); g.moveTo(64, 96); g.quadraticCurveTo(50, 106, 64, 116); g.quadraticCurveTo(78, 106, 64, 96); g.fillStyle = '#FF8A1F'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(46, 78); g.lineTo(34, 96); g.lineTo(50, 92); g.closePath(); g.moveTo(82, 78); g.lineTo(94, 96); g.lineTo(78, 92); g.closePath(); g.fillStyle = '#E8402A'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(64, 16); g.quadraticCurveTo(90, 44, 82, 94); g.lineTo(46, 94); g.quadraticCurveTo(38, 44, 64, 16); g.closePath(); g.fillStyle = '#FFF2DC'; g.fill(); g.stroke();
    g.beginPath(); g.arc(64, 56, 10, 0, TAU); g.fillStyle = '#5FD6F2'; g.fill(); g.lineWidth = 5; g.stroke();
  } else {
    g.font = '900 54px "Rammetto One","Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#3A1E14'; g.strokeText('×2', 64, 64);
    g.fillStyle = '#fff'; g.fillText('×2', 64, 64);
  }
  return c;
}
function makePickupMaterials() {
  const out = {};
  for (const kind of POWER_KINDS) {
    const tex = new THREE.CanvasTexture(drawBadge(kind, 128));
    out[kind] = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  }
  return out;
}
