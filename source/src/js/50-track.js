// ───────────────────────── the endless track ─────────────────────────
// The path is a tree of straight stretches joined by square junctions. Each stretch knows its
// obstacles, holes, bananas and pick-ups in its own (s = distance along, x = sideways) coordinates.
let SEG_ID = 0;

class Seg {
  constructor(parent, turn) {
    this.id = SEG_ID++;
    this.parent = parent; this.turn = turn;
    if (!parent) { this.heading = 0; this.ox = 0; this.oz = 0; this.dist0 = 0; this.first = true; }
    else {
      this.heading = turn === 'R' ? (parent.heading + 1) % 4 : (parent.heading + 3) % 4;
      const d = DIRS[parent.heading];
      this.ox = parent.ox + d.fx * parent.len; this.oz = parent.oz + d.fz * parent.len;
      this.dist0 = parent.dist0 + parent.len; this.first = false;
    }
    this.dir = DIRS[this.heading]; this.yaw = yawOf(this.heading);
    this.obstacles = []; this.holes = []; this.holeCells = new Set(); this.bananas = []; this.pickups = [];
    this.kids = { L: null, R: null };
    this.obI = 0; this.bI = 0; this.group = null; this.dead = false;
  }
  wx(s, x) { return this.ox + this.dir.fx * s + this.dir.rx * x; }
  wz(s, x) { return this.oz + this.dir.fz * s + this.dir.rz * x; }
  overHole(s, x) {
    for (const h of this.holes) if (s > h.s0 + 0.14 && s < h.s1 - 0.14 && x > h.x0 && x < h.x1) return true;
    return false;
  }
}

// ── layout: decide what goes where on a stretch ──
function genSegment(seg, W) {
  const rng = W.rng, v = speedAt(seg.dist0), lvl = seg.dist0 / 450;
  seg.v = v;
  const tutorial = seg.first && W.tutorial;
  seg.jt = seg.heading === 0 ? rng.weighted([[1, 'L'], [1, 'R'], [0.85, 'T']]) : seg.heading === 1 ? 'L' : 'R';
  if (seg.first) { seg.floorStart = -ROW * 11; seg.nRows = tutorial ? 63 : 11 + rng.int(40, 58); if (tutorial) seg.jt = 'T'; }
  else { seg.floorStart = HJ; seg.nRows = Math.max(22, Math.round((v * rng.range(4.6, 8.2)) / ROW)); }
  seg.len = seg.floorStart + seg.nRows * ROW + HJ;

  const O = seg.obstacles, B = seg.bananas;
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
  const nana = (s, lane, y) => B.push({ s, x: laneX(lane), y: y === undefined ? 0.62 : y, got: false, pull: -1, ph: rng.f() * TAU, wx: 0, wz: 0 });
  const line = (s0, s1, lane, y) => { for (let s = s0; s <= s1 + 0.01; s += 1.9) nana(s, lane, y); };
  const arc = (mid, lane) => {
    const half = (v * AIR_T) / 2, n = Math.max(1, Math.floor((half - 0.5) / 1.9));
    for (let i = -n; i <= n; i++) { const ds = i * 1.9; nana(mid + ds, lane, 0.62 + JUMP_H * 0.93 * (1 - (ds / half) * (ds / half))); }
  };

  // Patterns return how many metres they used, or -1 if they did not fit.
  const P = {
    pillars1(s) { const lane = rng.int(0, 2); addPillar(s, lane); line(s - 5.7, s + 3.8, rng.pick(others(lane))); return 1.3; },
    pillars2(s) { const open = rng.int(0, 2); for (const l of others(open)) addPillar(s, l); line(s - 7.6, s + 3.8, open); return 1.3; },
    log(s) { addLog(s, 0, 2); arc(s, rng.int(0, 2)); return 1; },
    beam(s) { addBeam(s); line(s - 3.8, s + 3.8, rng.int(0, 2), 0.5); return 1; },
    beamPillar(s) { addBeam(s); const lane = rng.int(0, 2); addPillar(s, lane); line(s - 5.7, s + 3.8, rng.pick(others(lane)), 0.5); return 1.3; },
    gap(s) {
      const rows = v < 15 ? 1 : v < 20.5 ? 2 : 3, k = rowOf(s);
      if (k + rows + 2 >= seg.nRows) return -1;
      addHole(k, rows, [0, 1, 2]);
      arc(rowS(k) + (rows * ROW) / 2, rng.int(0, 2));
      return rowS(k + rows) - s;
    },
    narrow(s) {
      const rows = clamp(Math.round((v * rng.range(0.75, 1.05)) / ROW), 4, 7), k = rowOf(s);
      if (k + rows + 2 >= seg.nRows) return -1;
      const mode = rng.weighted([[lvl > 3 ? 2 : 1, 'one'], [1.4, 'two'], [1, 'split']]);
      let gone, keep;
      if (mode === 'one') { keep = rng.int(0, 2); gone = others(keep); }
      else if (mode === 'two') { const g = rng.pick([0, 2]); gone = [g]; keep = rng.pick(others(g)); }
      else { gone = [1]; keep = rng.pick([0, 2]); }
      addHole(k, rows, gone);
      line(rowS(k) - 7.6, rowS(k + rows) + 1.9, keep);
      return rowS(k + rows) - s;
    },
    zig(s) {
      const a = rng.int(0, 2), b = a === 1 ? rng.pick([0, 2]) : 1, d = Math.max(v * 0.62, 9);
      for (const l of others(a)) addPillar(s, l);
      for (const l of others(b)) addPillar(s + d, l);
      line(s - 5.7, s, a); line(s + d - 3.8, s + d + 1.9, b);
      return d + 1.3;
    },
    logBeam(s) { const d = Math.max(v, 12), lane = rng.int(0, 2); addLog(s, 0, 2); addBeam(s + d); arc(s, lane); line(s + d - 3.8, s + d + 1.9, lane, 0.5); return d + 1; },
    beamLog(s) { const d = Math.max(v * 0.95, 12), lane = rng.int(0, 2); addBeam(s); addLog(s + d, 0, 2); line(s - 3.8, s + 1.9, lane, 0.5); arc(s + d, lane); return d + 1; },
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
    bananas(s) {
      let lane = rng.int(0, 2), ss = s;
      for (let i = 0; i < 3; i++) { line(ss, ss + 5.7, lane); ss += 7.6; lane = clamp(lane + rng.pick([-1, 1]), 0, 2); }
      return ss - s - 1.9;
    },
  };
  const need = { pillars1: 1.3, pillars2: 1.3, log: 1, beam: 1, beamPillar: 1.3, gap: 4 * ROW, narrow: 8 * ROW, zig: Math.max(v * 0.62, 9) + 1.3, logBeam: Math.max(v, 12) + 1, beamLog: Math.max(v, 12) + 1, rubble: 1.2, mixed: 1.3, bananas: 21 };

  if (tutorial) { // a gentle opening that teaches one move at a time
    line(7.6, 22.8, 1);
    addLog(36, 0, 2); arc(36, 1);
    addBeam(64); line(60.2, 67.8, 1, 0.5);
    addPillar(90, 0); addPillar(90, 1); line(82.4, 93.8, 2);
    line(101, 116.2, 1);
  } else {
    let s = seg.first ? 30 : seg.floorStart + Math.max(11, v * 0.95);
    if (seg.first) line(7.6, 19, 1);
    const end = seg.len - HJ - Math.max(11, v * 0.8);
    const tGap = lerp(1.3, 0.9, clamp(lvl / 9, 0, 1));
    let last = '';
    while (s < end - 2) {
      const on = (min, w) => (lvl >= min ? w : 0);
      const table = [
        [3, 'pillars1'], [lvl > 0.4 ? 2.3 : 0.7, 'pillars2'], [3, 'log'], [2.5, 'beam'], [1, 'bananas'],
        [on(0.45, 2.3), 'gap'], [on(0.8, 1.6), 'rubble'], [on(1.2, 1.6), 'mixed'], [on(1.5, 1.3), 'beamPillar'],
        [on(1.5, 1.8), 'narrow'], [on(1.8, 1.8), 'zig'], [on(2.2, 1.5), 'logBeam'], [on(2.2, 1.3), 'beamLog'],
      ];
      let name = rng.weighted(table);
      if (name === last) name = rng.weighted(table);
      if (s + need[name] > end) { name = rng.pick(['pillars1', 'log', 'beam']); if (s + need[name] > end) break; }
      let used = P[name](s);
      if (used < 0) { name = 'log'; used = P.log(s); }
      last = name;
      const gap = v * tGap * rng.range(1.0, 1.35);
      if (seg.dist0 + s > W.nextPickupAt && gap > 9) {
        const ps = s + used + gap * 0.5; // never tucked in behind a totem
        const open = [0, 1, 2].filter((l) => !O.some((o) => o.type === 'pillar' && o.lane === l && o.s > ps - 20 && o.s < ps + 9));
        seg.pickups.push({ kind: rng.weighted([[3, 'magnet'], [2.5, 'double'], [2.5, 'shield'], [2.5, 'springs'], [1.7, 'rocket']]), s: ps, x: laneX(open.length ? rng.pick(open) : rng.int(0, 2)), y: 1.15, got: false, sprite: null });
        W.nextPickupAt = seg.dist0 + s + rng.range(210, 350);
      }
      s += used + gap;
    }
  }
  O.sort((a, b) => a.s0 - b.s0);
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

  // obstacles (kept in their own meshes so a shield can smash one)
  for (const o of seg.obstacles) {
    const a = ob.n, b = ol.n, c = glow.n, z = -o.s;
    if (o.type === 'pillar') addTotem(ob, ol, glow, laneX(o.lane), z);
    else if (o.type === 'log') addLogMesh(ob, ol, rng, (laneX(o.l0) + laneX(o.l1)) / 2, z, (o.l1 - o.l0) * LANE_W + 1.72);
    else if (o.type === 'rubble') addRubbleMesh(ob, ol, rng, laneX(o.lane), z);
    else if (o.type === 'beam') addBeamMesh(ob, ol, glow, rng, z);
    o.rOb = [a, ob.n]; o.rOl = [b, ol.n]; o.rGl = [c, glow.n];
  }

  // scenery beside the path
  const d0 = seg.first ? seg.floorStart + 6 : HJ + 13, d1 = seg.len - HJ - 13;
  let sa = d0 + rng.range(10, 30);
  while (sa < d1) { addArch(gb, glow, rng, -sa); sa += rng.range(40, 66); }
  for (const side of [-1, 1]) {
    let s = d0 + rng.range(0, 7);
    while (s < d1) {
      const kind = rng.weighted([[3, 'island'], [2.2, 'column'], [0.8, 'idol'], [1.1, 'tree'], [1.2, 'rocks']]);
      const z = -s;
      if (kind === 'island') { const R = rng.range(1.8, 3.3); addIsland(gb, rng, side * (HJ + 1.5 + R + rng.range(0, 5)), z, R, rng.range(-1.2, 0.9), true); }
      else if (kind === 'column') addColumn(gb, rng, side * (HJ + 1.6 + rng.range(0, 6.5)), z, rng.range(1.2, 7.5));
      else if (kind === 'idol') { const x = side * (HJ + 2.3); gb.add(SHAPE.box, M(x, (0.1 + WATER_BASE) / 2, z, 2.1, 0.1 - WATER_BASE, 2.1), ENV.baseDark); addFoam(gb, x, z, 3.4); addIdol(gb, glow, rng, x, z, 0.1, { x: -side * 0.8, z: 0.6 }, 1); }
      else if (kind === 'tree') addBigTree(gb, rng, side * (HJ + 7 + rng.range(0, 5)), z);
      else addRocks(gb, rng, side * (HJ + 3 + rng.range(0, 8)), z);
      s += rng.range(7, 14);
    }
  }
  if (seg.first) addTemple(gb, glow, rng, -seg.floorStart);

  const env = new THREE.Mesh(gb.build(), MAT.env);
  seg.obMesh = new THREE.Mesh(ob.build(), MAT.env);
  seg.olMesh = new THREE.Mesh(ol.build(), MAT.ink);
  seg.glMesh = new THREE.Mesh(glow.build(), MAT.glow);
  group.add(env, seg.obMesh, seg.olMesh, seg.glMesh);

  for (const p of seg.pickups) {
    const sp = new THREE.Sprite(W.pickupMat[p.kind]);
    sp.position.set(p.x, p.y, -p.s); sp.scale.set(1.5, 1.5, 1);
    p.sprite = sp; group.add(sp);
  }
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
    this.nextPickupAt = 170; this.skyOn = false;
    this.first = this.cur = this._make(null, null);
    this.prev = null;
    this.ensureAhead();
    while (this.queue.length) this.tick(); // the opening stretches are built up front
  }
  root_seg() { let s = this.cur; while (s && s.parent && !s.parent.dead) s = s.parent; return s; }

  _make(parent, turn) {
    const seg = new Seg(parent, turn);
    genSegment(seg, this);
    if (this.skyOn) this.addSky(seg, seg.floorStart + 6);
    buildSegment(seg, this);
    this.root.add(seg.group);
    if (parent) parent.kids[turn] = seg;
    return seg;
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
  }

  update(dt, t, px, py, pz) {
    if (this.dropLater) { this.dropT -= dt; if (this.dropT <= 0) { this._disposeTree(this.dropLater); this.dropLater = null; } }
    this.tick();
    // bananas: one instanced draw for every banana in view
    const arr = this.nanas.instanceMatrix.array, cap = this.cap;
    let n = 0;
    const segs = [this.prev, this.cur, this.cur.kids.L, this.cur.kids.R];
    for (const seg of segs) {
      if (!seg || seg.dead) continue;
      for (const b of seg.bananas) {
        if (b.got || n >= cap) continue;
        let x = b.wx, y = b.y + Math.sin(t * 3 + b.ph) * 0.07, z = b.wz, sc = 1;
        if (b.pull >= 0) { const e = b.pull * b.pull; x = lerp(x, px, e); y = lerp(y, py + 0.8, e); z = lerp(z, pz, e); sc = 1 - e * 0.5; }
        const a = t * 2.6 + b.ph, ca = Math.cos(a) * sc, sn = Math.sin(a) * sc, o = n * 16;
        arr[o] = ca; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
        arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
        arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = ca; arr[o + 11] = 0;
        arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
        n++;
      }
      for (const p of seg.pickups) if (p.sprite && !p.got) { p.sprite.position.y = p.y + Math.sin(t * 3.2 + p.s) * 0.14; const k = 1.5 + Math.sin(t * 6 + p.s) * 0.07; p.sprite.scale.set(k, k, 1); }
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
