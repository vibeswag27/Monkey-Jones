// ───────────────────────── scenery pieces (all merged into one mesh per stretch of track) ─────────────────────────
const ENV = {
  slab: [0xecd9ad, 0xe4cf9e, 0xf2e2ba, 0xdec796], slabMoss: 0xbdd28c, base: 0xa58d6c, baseDark: 0x8d7658,
  curb: 0xd9c08e, curb2: 0xcdb27e, stone: 0x93a9b5, stone2: 0x7f96a3, stone3: 0xa7bac4, stoneWarm: 0xcdb891, stoneWarm2: 0xbfa77f,
  moss: 0x5fb85a, leaf: [0x3fbf6b, 0x2fa35a, 0x58d17f, 0x249a55], trunk: [0xb98a5a, 0xa8794a],
  rock: [0x8f9aa0, 0x7d8a92, 0xa3adb0], wood: 0xa8703f, woodDark: 0x8b5a31, woodEnd: 0xe6bd80, sand: 0xf2deb0, foam: 0xe8fbfa,
  flower: [0xff6fa5, 0xffe45c, 0xffffff, 0xff9a3c], gold: 0xffd23f, dark: 0x241c18, carve: 0x33424c, flame: 0xff8a1f, flame2: 0xffe066,
  cloth: [0xef5f2b, 0x10b3ae, 0xffd23f],
};
const WATER_BASE = WATER_Y - 1;

function addFoam(gb, x, z, w, d) { gb.add(SHAPE.cyl, M(x, WATER_Y + 0.05, z, w, 0.08, d === undefined ? w : d), ENV.foam); }

function addPalm(gb, rng, x, y, z, h) {
  const lean = rng.range(0.1, 0.36), dir = rng.range(0, TAU), segs = 5, segH = h / segs;
  let px = x, py = y, pz = z;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs, a = lean * t * 1.7;
    _v.set(Math.cos(dir) * Math.sin(a), Math.cos(a), Math.sin(dir) * Math.sin(a));
    const w = lerp(0.44, 0.27, t);
    gb.add(SHAPE.taper, Mdir(px, py, pz, _v, w, segH * 1.1), ENV.trunk[i % 2]);
    px += _v.x * segH; py += _v.y * segH; pz += _v.z * segH;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.2, 0.2), droop = rng.range(0.25, 0.75), len = rng.range(1.9, 2.7);
    _v.set(Math.cos(a), 0.5 - droop, Math.sin(a)).normalize();
    gb.add(SHAPE.cone4, Mdir(px, py + 0.05, pz, _v, 0.78, len, 0.16), rng.pick(ENV.leaf));
  }
  gb.add(SHAPE.ico, M(px, py + 0.08, pz, 0.6, 0.45, 0.6), 0x2f8f50);
  for (let i = 0; i < 2; i++) gb.add(SHAPE.ico, M(px + rng.range(-0.22, 0.22), py - 0.2, pz + rng.range(-0.22, 0.22), 0.27, 0.27, 0.27), 0x8a5a33);
}

function addBush(gb, rng, x, y, z, s) {
  for (let i = 0; i < 3; i++) {
    gb.add(SHAPE.ico1, M(x + rng.range(-0.4, 0.4) * s, y + (0.28 + rng.range(0, 0.22)) * s, z + rng.range(-0.4, 0.4) * s,
      s * rng.range(0.75, 1.1), s * rng.range(0.6, 0.9), s * rng.range(0.75, 1.1), 0, rng.range(0, 3), 0), rng.pick(ENV.leaf));
  }
  if (rng.chance(0.55)) {
    const c = rng.pick(ENV.flower);
    for (let i = 0; i < 3; i++) gb.add(SHAPE.ico, M(x + rng.range(-0.5, 0.5) * s, y + rng.range(0.45, 0.75) * s, z + rng.range(-0.5, 0.5) * s, 0.17, 0.17, 0.17), c);
  }
}

function addRocks(gb, rng, x, z) {
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const s = rng.range(1.2, 2.6);
    gb.add(SHAPE.ico, M(x + rng.range(-1.6, 1.6), WATER_Y + s * 0.18, z + rng.range(-1.6, 1.6), s, s * rng.range(0.7, 1.1), s, rng.range(0, 1), rng.range(0, 3), 0), rng.pick(ENV.rock));
  }
  addFoam(gb, x, z, 4.4);
}

function addVines(gb, rng, x, y, z, n, spreadX, spreadZ, maxLen) {
  for (let i = 0; i < n; i++) {
    const len = rng.range(0.5, maxLen);
    gb.add(SHAPE.box, M(x + rng.range(-spreadX, spreadX), y - len / 2, z + rng.range(-spreadZ, spreadZ), 0.11, len, 0.07), rng.pick(ENV.leaf));
  }
}

function addColumn(gb, rng, x, z, top) {
  const r = rng.range(1.1, 1.6), h = top - WATER_BASE, col = rng.chance(0.5) ? ENV.stone : ENV.stone2;
  gb.add(SHAPE.cyl, M(x, (top + WATER_BASE) / 2, z, r, h, r, 0, rng.f(), 0), col);
  gb.add(SHAPE.cyl, M(x, top - 0.9, z, r * 1.22, 0.36, r * 1.22), ENV.stone3);
  if (rng.chance(0.5)) {
    gb.add(SHAPE.cyl, M(x, top + 0.18, z, r * 1.35, 0.4, r * 1.35), ENV.stone3);
    gb.add(SHAPE.cyl, M(x, top + 0.44, z, r * 1.38, 0.14, r * 1.38), ENV.moss);
    if (rng.chance(0.5)) addBush(gb, rng, x, top + 0.45, z, 0.8);
  } else { // snapped off
    gb.add(SHAPE.cyl, M(x + 0.12, top + 0.25, z, r * 0.9, 0.7, r * 0.9, 0.22, rng.f() * 3, 0.18), col);
    gb.add(SHAPE.ico, M(x - 0.2, top + 0.12, z + 0.2, r * 0.9, 0.3, r * 0.9), ENV.moss);
  }
  addVines(gb, rng, x, top - 0.2, z, 3, r * 0.5, r * 0.5, 2.4);
  addFoam(gb, x, z, r * 2);
}

function addIsland(gb, rng, x, z, R, top, lush) {
  const h = top - WATER_BASE;
  gb.add(SHAPE.rock, M(x, (top + WATER_BASE) / 2 - 0.2, z, R * 2, h, R * 2, 0, rng.f() * 3, 0), rng.pick(ENV.rock));
  gb.add(SHAPE.cyl, M(x, top - 0.1, z, R * 2.12, 0.42, R * 2.12, 0, rng.f() * 3, 0), 0x67c35f);
  gb.add(SHAPE.cyl, M(x, top - 0.36, z, R * 2.05, 0.2, R * 2.05, 0, rng.f() * 3, 0), ENV.sand);
  addFoam(gb, x, z, R * 1.7);
  const palms = lush ? rng.int(1, 3) : rng.int(0, 1);
  for (let i = 0; i < palms; i++) addPalm(gb, rng, x + rng.range(-0.55, 0.55) * R, top + 0.05, z + rng.range(-0.55, 0.55) * R, rng.range(3.4, 5.6));
  const bushes = rng.int(1, 3);
  for (let i = 0; i < bushes; i++) addBush(gb, rng, x + rng.range(-0.7, 0.7) * R, top + 0.08, z + rng.range(-0.7, 0.7) * R, rng.range(0.7, 1.2));
  if (rng.chance(0.4)) gb.add(SHAPE.ico, M(x + rng.range(-0.6, 0.6) * R, top + 0.3, z + rng.range(-0.6, 0.6) * R, 0.9, 0.7, 0.9, 0, rng.f() * 3, 0), rng.pick(ENV.rock));
  if (rng.chance(0.3)) { // a scrap of old wall
    gb.add(SHAPE.box, M(x, top + 0.75, z + R * 0.3, 1.6, 1.5, 0.6, 0, rng.f() * 3, 0), ENV.stoneWarm);
    gb.add(SHAPE.box, M(x + 0.2, top + 1.6, z + R * 0.3, 0.9, 0.5, 0.6, 0, rng.f() * 3, 0.1), ENV.stoneWarm2);
  }
}

function addBigTree(gb, rng, x, z) {
  const R = rng.range(3.2, 4.2), top = rng.range(-0.8, 0.6);
  gb.add(SHAPE.rock, M(x, (top + WATER_BASE) / 2 - 0.2, z, R * 2, top - WATER_BASE, R * 2, 0, rng.f() * 3, 0), rng.pick(ENV.rock));
  gb.add(SHAPE.cyl, M(x, top - 0.1, z, R * 2.1, 0.42, R * 2.1), 0x67c35f);
  addFoam(gb, x, z, R * 1.7);
  const th = rng.range(5, 7.5);
  gb.add(SHAPE.taper, M(x, top + th / 2, z, 1.5, th, 1.5, 0, rng.f() * 3, 0), 0x9a6a42);
  for (let i = 0; i < 4; i++) { // roots
    const a = (i / 4) * TAU + rng.f();
    gb.add(SHAPE.cone, M(x + Math.cos(a) * 0.8, top + 0.5, z + Math.sin(a) * 0.8, 0.8, 1.6, 0.8, 0, 0, 0), 0x8a5c38);
  }
  const blobs = rng.int(4, 6);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * TAU + rng.f() * 0.6, rr = i === 0 ? 0 : rng.range(1.4, 2.6), s = rng.range(3.2, 4.8);
    gb.add(SHAPE.ico1, M(x + Math.cos(a) * rr, top + th + rng.range(-0.3, 1.5), z + Math.sin(a) * rr, s, s * 0.78, s, 0, rng.f() * 3, 0), rng.pick(ENV.leaf));
  }
  addVines(gb, rng, x, top + th - 0.3, z, 5, 2.2, 2.2, 3.2);
  for (let i = 0; i < 3; i++) addBush(gb, rng, x + rng.range(-0.7, 0.7) * R, top + 0.08, z + rng.range(-0.7, 0.7) * R, rng.range(0.8, 1.3));
}

// A stone monkey head on a plinth; face turned toward (fx,fz).
function addIdol(gb, glow, rng, x, z, baseY, face, scale) {
  const s = scale || 1;
  gb.add(SHAPE.box, M(x, baseY + 0.5 * s, z, 1.5 * s, 1.0 * s, 1.5 * s), ENV.stone2);
  gb.add(SHAPE.box, M(x, baseY + 1.08 * s, z, 1.75 * s, 0.18 * s, 1.75 * s), ENV.stone3);
  const hy = baseY + 2.0 * s, yaw = Math.atan2(-face.x, -face.z); // model faces -Z by default
  const put = (shape, lx, ly, lz, sx, sy, sz, col, tgt) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    (tgt || gb).add(shape, M(x + lx * c + lz * sn, hy + ly, z - lx * sn + lz * c, sx, sy, sz, 0, yaw, 0), col);
  };
  put(SHAPE.ico1, 0, 0, 0, 1.7 * s, 1.55 * s, 1.6 * s, ENV.stone);
  put(SHAPE.ico1, 0, -0.26 * s, -0.6 * s, 1.1 * s, 0.76 * s, 0.8 * s, ENV.stone3);
  for (const sx of [-1, 1]) {
    put(SHAPE.cyl, sx * 0.9 * s, 0.05 * s, 0, 0.78 * s, 0.26 * s, 0.78 * s, ENV.stone2);
    put(SHAPE.box, sx * 0.3 * s, 0.16 * s, -0.78 * s, 0.2 * s, 0.2 * s, 0.1 * s, ENV.gold, glow);
  }
  gb.add(SHAPE.ico, M(x, hy + 0.8 * s, z, 0.9 * s, 0.34 * s, 0.9 * s), ENV.moss);
}

function addTorch(gb, glow, x, y, z) {
  gb.add(SHAPE.taper, M(x, y + 0.16, z, 0.62, 0.32, 0.62, Math.PI, 0, 0), 0x6b5a4a);
  glow.add(SHAPE.cone, M(x, y + 0.72, z, 0.44, 0.9, 0.44), ENV.flame);
  glow.add(SHAPE.cone, M(x, y + 0.6, z, 0.26, 0.56, 0.26), ENV.flame2);
}

// Tall gateway over the path. Purely for looks: everything hangs well above a jump.
function addArch(gb, glow, rng, z) {
  const px = HJ + 1.5, top = rng.range(7.4, 8.4), col = rng.chance(0.5) ? ENV.stoneWarm : ENV.stone;
  for (const sd of [-1, 1]) {
    gb.add(SHAPE.box, M(sd * px, (top + WATER_BASE) / 2, z, 1.5, top - WATER_BASE, 1.7), col);
    gb.add(SHAPE.box, M(sd * px, 0.25, z, 1.9, 0.5, 2.1), ENV.stone3);
    gb.add(SHAPE.box, M(sd * px, top - 0.5, z, 1.9, 0.4, 2.1), ENV.stone3);
    addFoam(gb, sd * px, z, 3);
    if (rng.chance(0.7)) addVines(gb, rng, sd * px, top - 0.6, z, 4, 0.8, 0.9, 2.8);
  }
  gb.add(SHAPE.box, M(0, top + 0.6, z, px * 2 + 3.2, 1.2, 1.9), col);
  gb.add(SHAPE.box, M(0, top + 1.34, z, px * 2 + 3.8, 0.3, 2.3), ENV.stone3);
  gb.add(SHAPE.box, M(0, top + 1.55, z, px * 2 + 3.0, 0.14, 2.0), ENV.moss);
  for (let l = 0; l < 3; l++) { // pennants over each lane
    if (rng.chance(0.2)) continue;
    const len = rng.range(1.0, 1.7);
    gb.add(SHAPE.box, M(laneX(l), top - len / 2, z, 1.0, len, 0.07), rng.pick(ENV.cloth));
    gb.add(SHAPE.cone4, M(laneX(l), top - len - 0.3, z, 1.0, 0.6, 0.07, Math.PI, 0, 0), ENV.gold);
  }
  addVines(gb, rng, 0, top, z, 6, px, 0.8, 1.6);
}

// The temple Monkey Jones has just robbed. Its doorway faces north, down the path.
function addTemple(gb, glow, rng, z0) {
  const zc = z0 + 3.5, wallTop = 9, wallH = wallTop - WATER_BASE, wy = (wallTop + WATER_BASE) / 2;
  for (const sd of [-1, 1]) {
    gb.add(SHAPE.box, M(sd * 8.2, wy, zc, 11.6, wallH, 7), ENV.stoneWarm);
    gb.add(SHAPE.box, M(sd * 2.36, 2.3, zc, 0.08, 4.6, 7), ENV.dark);              // door liners keep the inside dark
    gb.add(SHAPE.box, M(sd * 2.85, 2.45, z0 - 0.15, 0.9, 4.9, 0.7), ENV.stone3);     // jambs
    gb.add(SHAPE.box, M(sd * 6.6, 3.2, z0 - 0.5, 1.6, 6.4, 1.4), ENV.stoneWarm2);    // buttresses
    gb.add(SHAPE.box, M(sd * 6.6, 6.6, z0 - 0.5, 2.0, 0.5, 1.8), ENV.stone3);
    addTorch(gb, glow, sd * 6.6, 6.85, z0 - 0.5);
    gb.add(SHAPE.box, M(sd * 11.5, 4.2, z0 - 0.4, 1.4, 8.4, 1.2), ENV.stoneWarm2);
    addIdol(gb, glow, rng, sd * 4.5, z0 - 1.6, -0.35, { x: 0, z: -1 }, 0.82);
    gb.add(SHAPE.box, M(sd * 4.5, -3.9, z0 - 1.6, 2.2, 7.2, 2.2), ENV.baseDark);
    addVines(gb, rng, sd * 8, wallTop, z0 - 0.06, 9, 4.5, 0.02, 4.5);
    for (let i = 0; i < 4; i++) gb.add(SHAPE.box, M(sd * rng.range(3.6, 12.5), rng.range(1, 8), z0 - 0.03, rng.range(0.8, 1.6), rng.range(0.4, 0.8), 0.1), rng.chance(0.5) ? ENV.stoneWarm2 : 0xd8c6a0);
  }
  gb.add(SHAPE.box, M(0, (4.6 + wallTop) / 2, zc, 4.8, wallTop - 4.6, 7), ENV.stoneWarm);
  gb.add(SHAPE.box, M(0, 4.62, zc, 4.7, 0.08, 7), ENV.dark);
  gb.add(SHAPE.box, M(0, 2.3, z0 + 7.1, 4.8, 4.8, 0.3), ENV.dark);
  gb.add(SHAPE.box, M(0, -0.74, zc, 4.8, 0.84, 7), ENV.base);
  gb.add(SHAPE.box, M(0, -0.16, zc, 4.7, 0.32, 7), ENV.slab[3]);
  gb.add(SHAPE.box, M(0, 5.2, z0 - 0.2, 6.9, 0.9, 0.8), ENV.stone3);                 // lintel
  gb.add(SHAPE.cyl, M(0, 7.1, z0 - 0.12, 2.5, 0.3, 2.5, Math.PI / 2, 0, 0), ENV.carve); // plaque
  gb.add(GEO.banana, M(0, 7.15, z0 - 0.32, 3.1, 3.1, 3.1, 0, 0, 0.2), 0xffffff);       // banana crest
  const tiers = [[25, 2.2, 6.4], [18.5, 2.2, 5.2], [12, 2.2, 4.2], [6, 1.6, 3.2]];
  let ty = wallTop;
  for (const [w, h, d] of tiers) {
    gb.add(SHAPE.box, M(0, ty + h / 2, zc + 0.4, w, h, d), ENV.stoneWarm2);
    gb.add(SHAPE.box, M(0, ty + h + 0.1, zc + 0.4, w + 0.5, 0.22, d + 0.5), ENV.stone3);
    gb.add(SHAPE.box, M(0, ty + h + 0.27, zc + 0.4, w * 0.9, 0.12, d * 0.9), ENV.moss);
    ty += h + 0.2;
  }
  addBigTree(gb, rng, -17, z0 - 3);
  addBigTree(gb, rng, 17.5, z0 - 1);
  addIsland(gb, rng, -11, z0 - 9, 2.6, 0.2, true);
  addIsland(gb, rng, 11.5, z0 - 11, 2.8, -0.2, true);
}

// Ruined tower behind a junction's sign wall: a landmark that says "the path ends here".
function addTower(gb, glow, rng, x, z) {
  const top = rng.range(7, 10);
  gb.add(SHAPE.box, M(x, (top + WATER_BASE) / 2, z, 6.4, top - WATER_BASE, 4.6), ENV.stone);
  gb.add(SHAPE.box, M(x, top + 0.2, z, 7, 0.4, 5.2), ENV.stone3);
  gb.add(SHAPE.box, M(x - 1.6, top + 1.3, z, 2.2, 1.9, 4.0, 0, 0, 0.05), ENV.stone2);
  gb.add(SHAPE.box, M(x + 1.9, top + 0.9, z, 1.6, 1.1, 3.6), ENV.stone2);
  gb.add(SHAPE.ico, M(x, top + 0.55, z, 3, 0.5, 3), ENV.moss);
  addVines(gb, rng, x, top, z + 2.34, 7, 2.8, 0.02, 4);
  addFoam(gb, x, z, 8, 6.4);
  addPalm(gb, rng, x + 2.2, top + 0.3, z - 0.5, rng.range(3.5, 5));
  addBush(gb, rng, x - 1.8, top + 2.2, z, 1.2);
}
