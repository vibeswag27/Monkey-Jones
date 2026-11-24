// ───────────────────────── the run's bigger furniture: raised walkways (pads, movers and bridges follow further down) ─────────────────────────
const STAIR_N = 8;                  // a flight is drawn as eight steps; underfoot it is a plain slope, so he and the camera ride up it smoothly
const SHELF = [0x8fb9b1, 0x79a6a2]; // the sea-worn rock of an underwater shelf
const SHELL = [0xf7c9dc, 0xd9c8f5, 0xfbe6c4, 0xbfe8dc];

// A raised walkway one lane wide (see Seg.floorY). On land a mossy stone terrace with a lit band under its lip; under water a shelf of
// rock crusted with coral, with scallop shells for steps. One with no steps wears a face on its front: something to go round.
function addDeckMesh(gb, ol, glow, rng, d, sea) {
  const x = (d.x0 + d.x1) / 2, h = d.h, len = d.s1 - d.s0, zc = -(d.s0 + d.s1) / 2, w = LANE_W - 0.22, hw = w / 2;
  const wall = sea ? SHELF[0] : ENV.stoneWarm, wall2 = sea ? SHELF[1] : ENV.stoneWarm2, life = DECOR || gb;
  gb.add(SHAPE.box, M(x, (h - 0.2) / 2, zc, w, h - 0.2, len), wall);                                   // the block itself
  ol.add(SHAPE.box, M(x, h / 2, zc, w + 2 * OT, h + 2 * OT, len + 2 * OT));
  gb.add(SHAPE.box, M(x, 0.19, zc, w + 0.14, 0.38, len + 0.08), wall2);                                // a footing course
  gb.add(SHAPE.box, M(x, h - 0.56, zc, w + 0.05, 0.16, len + 0.03), sea ? 0x4f8f97 : ENV.carve);       // a dark band under the lip
  const n = Math.max(2, Math.round(len / 1.6)), sl = len / n;
  for (let i = 0; i < n; i++) gb.add(SHAPE.box, M(x, h - 0.1, -(d.s0 + (i + 0.5) * sl), LANE_W - 0.05, 0.2, sl - 0.06), rng.chance(0.1) ? ENV.slabMoss : rng.pick(ENV.slab)); // paved like the path
  const dim = shade(ENV.slab[3], 0.6);
  for (const sd of [-1, 1]) {
    const xs = x + sd * (hw + 0.035);
    gb.add(SHAPE.box, M(x + sd * (LANE_W / 2 - 0.085), h + 0.04, zc, 0.13, 0.08, len), sea ? 0xf4bdd2 : ENV.curb);          // a kerb along each edge, so the top reads as a path of its own
    if (d.lane + sd >= 0 && d.lane + sd <= 2) gb.add(SHAPE.box, M(x + sd * (hw + 0.36), 0.012, zc, 0.72, 0.02, len), dim);  // and its shadow on the ground beside it, so the ground reads as lower
    for (let s = d.s0 + 1.2; s < d.s1 - 0.6; s += 3.2) {                                                // lights along the band: amber glyphs, or pearls
      if (sea) glow.add(SHAPE.sphLo, M(xs, h - 0.56, -s, 0.17, 0.17, 0.17), 0xeaffff);
      else glow.add(SHAPE.box, M(xs, h - 0.56, -s, 0.05, 0.1, 0.36), 0xffb238);
    }
    if (sea) {
      for (let s = d.s0 + rng.range(0.6, 2.4); s < d.s1 - 0.5; s += rng.range(2.6, 4.6)) addCoral(gb, rng, x + sd * (hw + 0.1), 0, -s, rng.range(0.26, 0.4));
      for (let i = 0, k = Math.round(len / 1.8); i < k; i++) life.add(SHAPE.sphLo, M(xs - sd * 0.02, rng.range(0.5, h - 0.8), -rng.range(d.s0 + 0.3, d.s1 - 0.3), 0.12, rng.range(0.2, 0.36), rng.range(0.2, 0.36)), rng.pick(ENV.coral));
    } else {
      addVines(gb, rng, xs, h - 0.2, zc, Math.round(len / 2), 0.012, len / 2 - 0.3, 1.25);
      for (let i = 0, k = Math.round(len / 5); i < k; i++) gb.add(SHAPE.ico, M(x + sd * (LANE_W / 2 - 0.06), h + 0.05, -rng.range(d.s0 + 0.5, d.s1 - 0.5), 0.3, 0.2, 0.52, 0, rng.f() * 3, 0), rng.pick(ENV.leaf));
    }
  }
  if (d.ramp) {                                                                                          // the way up
    const run = (d.s0 - d.r0) / STAIR_N;
    for (let i = 0; i < STAIR_N; i++) {
      const top = (h * (i + 0.5)) / STAIR_N, z = -(d.r0 + (i + 0.5) * run);
      if (top > 0.12) gb.add(SHAPE.box, M(x, (top - 0.08) / 2, z, w, top - 0.08, run), i % 2 ? wall : wall2);
      if (sea) {
        const shell = SHELL[i % 4];
        gb.add(SHAPE.cyl, M(x, top - 0.04, z, LANE_W + 0.04, 0.08, run + 0.34), shell);
        for (const k of [-1, 0, 1]) gb.add(SHAPE.box, M(x + k * 0.46, top + 0.004, z + 0.03, 0.05, 0.02, run * 0.86, 0, -k * 0.3, 0), shade(shell, 0.84));
      } else {
        gb.add(SHAPE.box, M(x, top - 0.04, z, LANE_W - 0.05, 0.08, run + 0.04), ENV.slab[i % 2 ? 0 : 3]);
        if (rng.chance(0.3)) gb.add(SHAPE.box, M(x + rng.range(-0.5, 0.5), top + 0.004, z + run / 2 - 0.05, 0.6, 0.02, 0.14), ENV.moss);
      }
    }
  } else {
    const zf = -d.s0 + 0.035;
    if (sea) {                                                                                           // a great scallop set in the rock, with two pearls for eyes
      gb.add(SHAPE.cyl, M(x, 1.08, zf - 0.02, 1.2, 0.09, 1.12, Math.PI / 2, 0, 0), SHELL[rng.int(0, 3)]);
      for (const k of [-2, -1, 0, 1, 2]) gb.add(SHAPE.box, M(x + k * 0.2, 1.1 + (2 - Math.abs(k)) * 0.03, zf + 0.03, 0.045, 0.86 - Math.abs(k) * 0.16, 0.03, 0, 0, -k * 0.2), 0xe79fbd);
      for (const k of [-1, 1]) glow.add(SHAPE.sphLo, M(x + k * 0.36, 1.78, zf + 0.02, 0.22, 0.22, 0.14), 0xeaffff);
    } else {                                                                                             // a stern stone face, kin to the totems
      gb.add(SHAPE.box, M(x - 0.36, 1.66, zf, 0.52, 0.11, 0.06, 0, 0, -0.34), ENV.carve);
      gb.add(SHAPE.box, M(x + 0.36, 1.66, zf, 0.52, 0.11, 0.06, 0, 0, 0.34), ENV.carve);
      glow.add(SHAPE.box, M(x - 0.36, 1.44, zf, 0.34, 0.2, 0.06), 0xffb238);
      glow.add(SHAPE.box, M(x + 0.36, 1.44, zf, 0.34, 0.2, 0.06), 0xffb238);
      gb.add(SHAPE.box, M(x, 0.98, zf, 0.9, 0.18, 0.06), ENV.carve);
      for (const k of [-1, 0, 1]) gb.add(SHAPE.box, M(x + k * 0.26, 1.0, zf + 0.012, 0.17, 0.14, 0.06), 0xf6ecd6);
    }
  }
}

// A bounce pad (obstacle type 'pad'). On land a fat red mushroom; under water a vent in the rock with a column of bubbles standing over it.
function addPadMesh(ob, ol, glow, rng, x, z, sea) {
  if (sea) {
    ob.add(SHAPE.taper, M(x, 0.17, z, 1.56, 0.34, 1.56, 0, rng.f() * 3, 0), SHELF[1]);
    ol.add(SHAPE.taper, M(x, 0.17, z, 1.56 + 2 * OT, 0.34 + 2 * OT, 1.56 + 2 * OT));
    ob.add(SHAPE.cyl12, M(x, 0.33, z, 1.0, 0.05, 1.0), 0x2b6f86);
    glow.add(SHAPE.cyl12, M(x, 0.36, z, 0.8, 0.04, 0.8), 0x9ff6ff);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rng.f(), r = 0.62; ob.add(SHAPE.ico, M(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, 0.3, 0.26, 0.3, 0, rng.f() * 3, 0), rng.pick(ENV.coral)); }
    for (const [y, k, dx, dz] of [[0.72, 0.26, 0.05, 0], [1.14, 0.2, -0.12, 0.06], [1.5, 0.24, 0.1, -0.05], [1.94, 0.16, -0.04, 0.08], [2.36, 0.2, 0.09, 0.02], [2.84, 0.13, -0.08, -0.04]]) glow.add(SHAPE.sph, M(x + dx, y, z + dz, k, k, k), 0xeaffff); // the bubbles that never leave
  } else {
    ob.add(SHAPE.cyl12, M(x, 0.16, z, 0.66, 0.32, 0.66), 0xf6ead0);                                   // stem
    ob.add(SHAPE.cyl12, M(x, 0.3, z, 1.24, 0.07, 1.24), 0xf3d2a8);                                    // gills
    ob.add(SHAPE.sph, M(x, 0.4, z, 1.6, 0.66, 1.6), 0xf0483c);                                        // cap
    ol.add(SHAPE.sph, M(x, 0.4, z, 1.6 + 2 * OT, 0.66 + 2 * OT, 1.6 + 2 * OT));
    const a0 = rng.f() * TAU;
    for (let i = 0; i < 6; i++) {                                                                      // spots, laid on the dome
      const r = i ? 0.5 : 0, a = a0 + (i / 5) * TAU, dx = Math.cos(a) * r, dz = Math.sin(a) * r, k = i ? rng.range(0.24, 0.32) : 0.4;
      ob.add(SHAPE.sphLo, M(x + dx, 0.4 + 0.33 * Math.sqrt(Math.max(0, 1 - (r * r) / 0.64)) - 0.01, z + dz, k, 0.07, k), 0xfff6e0);
    }
    for (const sd of [-1, 1]) for (const up of [0, 1]) {                                               // "up you go", in lights on the front of the cap
      glow.add(SHAPE.box, M(x - sd * 0.12, 0.3 + up * 0.17, z + 0.79 - up * 0.05, 0.3, 0.07, 0.04, 0, 0, sd * 0.7), 0xffe45c);
    }
  }
}

// ── things that move (obstacle type 'mover'): each has a mesh of its own, posed every frame from the game clock ──
const BOB_BAR = 5.7; // how high the bar is that a mask's vine hangs from: clear of a rocket's flight
let MOVER_GEO = null;
function moverGeo() {
  if (MOVER_GEO) return MOVER_GEO;
  const make = (fn) => { const b = new GeoBuilder(), k = new GeoBuilder(false), g = new GeoBuilder(); fn(b, k, g); return { env: b.build(), ink: k.build(), glow: g.build() }; };
  const rx = Math.PI / 2;
  const jelly = (col, spot) => make((b, k, g) => { // drawn from its lowest point up: a bell, a lit frill, a fringe of tentacles and a small calm face
    b.add(SHAPE.sph, M(0, 0.36, 0, 1.16, 0.52, 1.16), col);
    k.add(SHAPE.sph, M(0, 0.36, 0, 1.16 + 2 * OT, 0.52 + 2 * OT, 1.16 + 2 * OT));
    g.add(SHAPE.cyl12, M(0, 0.15, 0, 0.94, 0.07, 0.94), spot);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; b.add(SHAPE.box, M(Math.cos(a) * 0.34, 0.1 - (i % 2) * 0.03, Math.sin(a) * 0.34, 0.07, 0.2 + (i % 2) * 0.1, 0.07), spot); }
    for (const [dx, dz, r] of [[-0.28, 0.3, 0.2], [0.24, 0.22, 0.16], [0.05, -0.2, 0.22], [-0.2, -0.25, 0.14], [0.3, -0.12, 0.13]]) b.add(SHAPE.sphLo, M(dx, 0.365 + 0.26 * Math.sqrt(1 - (dx * dx + dz * dz) / 0.3364), dz, r, 0.05, r), spot);
    for (const sd of [-1, 1]) b.add(SHAPE.sphLo, M(sd * 0.2, 0.36, 0.57, 0.1, 0.13, 0.06), 0x3a2a4a);
    b.add(SHAPE.box, M(0, 0.26, 0.56, 0.14, 0.03, 0.04), 0x3a2a4a);
  });
  MOVER_GEO = {
    // a stone wheel, 1.25 m across, drawn about its own centre so that it can roll
    wheel: make((b, k, g) => {
      const D = 1.25;
      b.add(SHAPE.cyl12, M(0, 0, 0, D, 0.66, D, rx, 0, 0), 0xbcc9cf);
      k.add(SHAPE.cyl12, M(0, 0, 0, D + 2 * OT, 0.66 + 2 * OT, D + 2 * OT, rx, 0, 0));
      for (const f of [-1, 1]) {
        b.add(SHAPE.cyl12, M(0, 0, f * 0.325, D * 0.8, 0.03, D * 0.8, rx, 0, 0), 0x93a9b5);            // a sunk ring on each face
        b.add(SHAPE.cyl12, M(0, 0, f * 0.34, D * 0.3, 0.04, D * 0.3, rx, 0, 0), 0x33424c);             // the hub
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; g.add(SHAPE.box, M(Math.cos(a) * D * 0.27, Math.sin(a) * D * 0.27, f * 0.345, D * 0.22, 0.1, 0.03, 0, 0, a), 0xffb238); } // four glyphs, so the eye can see it turn
      }
      b.add(SHAPE.box, M(0.26, 0.55, 0, 0.36, 0.1, 0.6, 0, 0, -0.42), 0x5fb85a);                       // moss that goes round with it
      b.add(SHAPE.box, M(-0.45, -0.38, 0, 0.3, 0.1, 0.56, 0, 0, 0.9), 0x5fb85a);
    }),
    // a crab, standing on the floor and facing up the path: it goes about sideways, as crabs do
    crab: make((b, k) => {
      const shell = 0xff6a4a, dark = 0xd94a33;
      b.add(SHAPE.sph, M(0, 0.4, 0, 1.0, 0.5, 0.78), shell);
      k.add(SHAPE.sph, M(0, 0.4, 0, 1.0 + 2 * OT, 0.5 + 2 * OT, 0.78 + 2 * OT));
      b.add(SHAPE.sph, M(0, 0.31, 0.1, 0.82, 0.3, 0.66), 0xffd2b8);
      for (const sd of [-1, 1]) {
        b.add(SHAPE.box, M(sd * 0.2, 0.72, 0.22, 0.07, 0.24, 0.07), shell);                           // an eye on a stalk
        b.add(SHAPE.sphLo, M(sd * 0.2, 0.86, 0.24, 0.18, 0.18, 0.18), 0xffffff);
        b.add(SHAPE.sphLo, M(sd * 0.2, 0.87, 0.32, 0.08, 0.09, 0.05), 0x241c18);
        b.add(SHAPE.sph, M(sd * 0.66, 0.5, 0.3, 0.42, 0.34, 0.3, 0, 0, sd * 0.5), shell);             // a claw held up
        k.add(SHAPE.sph, M(sd * 0.66, 0.5, 0.3, 0.42 + 2 * OT, 0.34 + 2 * OT, 0.3 + 2 * OT, 0, 0, sd * 0.5));
        b.add(SHAPE.box, M(sd * 0.75, 0.6, 0.33, 0.26, 0.04, 0.22, 0, 0, sd * 0.5), 0x7a2418);
        for (let i = 0; i < 3; i++) b.add(SHAPE.box, M(sd * (0.52 + i * 0.03), 0.17, -0.22 + i * 0.2, 0.36, 0.07, 0.07, 0, 0, -sd * 0.75), dark);
      }
      b.add(SHAPE.box, M(0, 0.45, 0.385, 0.22, 0.04, 0.03), 0x7a2418);
    }),
    // a painted wooden mask, drawn from its chin up
    mask: make((b, k, g) => {
      const wood = 0xb07a45, dark = 0x7a4e28;
      b.add(SHAPE.box, M(0, 0.31, 0, 1.24, 0.62, 0.34), wood);
      k.add(SHAPE.box, M(0, 0.31, 0, 1.24 + 2 * OT, 0.62 + 2 * OT, 0.34 + 2 * OT));
      b.add(SHAPE.box, M(0, 0.555, 0.02, 1.3, 0.13, 0.38), 0x10b3ae);
      b.add(SHAPE.box, M(0, 0.055, 0.02, 1.3, 0.11, 0.38), 0xef5f2b);
      for (const sd of [-1, 1]) {
        b.add(SHAPE.box, M(sd * 0.3, 0.44, 0.18, 0.36, 0.08, 0.04, 0, 0, -sd * 0.3), dark);
        g.add(SHAPE.box, M(sd * 0.3, 0.34, 0.18, 0.26, 0.13, 0.04), 0xffe45c);
        b.add(SHAPE.box, M(sd * 0.56, 0.3, 0.18, 0.06, 0.3, 0.04), 0xffd23f);
        b.add(SHAPE.cone4, M(sd * 0.36, 0.86, 0, 0.26, 0.5, 0.08, 0, 0, -sd * 0.3), 0x3fbf6b);
      }
      b.add(SHAPE.cone4, M(0, 0.92, 0, 0.3, 0.6, 0.08), 0x58d17f);
      b.add(SHAPE.box, M(0, 0.17, 0.18, 0.56, 0.1, 0.04), dark);
      for (const dx of [-0.17, 0, 0.17]) b.add(SHAPE.box, M(dx, 0.19, 0.19, 0.12, 0.07, 0.04), 0xf6ecd6);
    }),
    vine: make((b) => { b.add(SHAPE.box, M(0, 0, 0, 0.09, 1, 0.07), 0x2fa35a); }),                      // a metre of vine, stretched to fit
    jellyA: jelly(0xff8fc7, 0xffd9f2), jellyB: jelly(0xb9a2ff, 0xe6dcff),
  };
  return MOVER_GEO;
}
// Make the mesh for a mover (and, for a mask, its vine), and note on the obstacle which creature it is.
function makeMover(o, sea) {
  const G = moverGeo(), key = o.kind === 'side' ? (sea ? 'crab' : 'wheel') : sea ? (o.lane % 2 ? 'jellyB' : 'jellyA') : 'mask', geo = G[key];
  const grp = new THREE.Group();
  for (const [part, mat] of [['env', MAT.env], ['ink', MAT.ink], ['glow', MAT.glow]]) if (geo[part].attributes.position.count) grp.add(sharedMesh(geo[part], mat));
  o.skin = key.replace(/[AB]$/, ''); o.mesh = grp;
  if (key === 'mask') o.vine = sharedMesh(G.vine.env, MAT.env);
  return grp;
}
// Put a mover's mesh where the game says it is at time t (moverBox has just been run for the same t).
function poseMover(o, t) {
  const m = o.mesh, a = o.w * t + o.ph;
  if (o.kind === 'side') {
    if (o.skin === 'crab') { const k = Math.sin(t * 17 + o.ph); m.position.set(o.x, 0.06 * Math.abs(k), -o.s); m.rotation.z = 0.06 * k; m.scale.setScalar(1.2); }
    else { m.position.set(o.x, 0.625, -o.s); m.rotation.z = -o.x / 0.625; }
  } else {
    m.position.set(o.cx, o.y0, -o.s);
    if (o.skin === 'jelly') { const k = Math.sin(2 * a); m.scale.set(1 - 0.07 * k, 1 + 0.11 * k, 1 - 0.07 * k); }
    else { m.rotation.z = 0.07 * Math.sin(2 * a + 1); const top = o.y0 + 0.6; o.vine.scale.y = BOB_BAR - top; o.vine.position.set(o.cx, (BOB_BAR + top) / 2, -o.s); }
  }
}
// The bamboo frame over the path that the masks hang from.
function addBobFrame(gb, rng, z) {
  const px = FLOOR_HALF + CURB_W / 2, cane = 0xd8bd6e, ring = 0xa98c48;
  for (const sd of [-1, 1]) {
    gb.add(SHAPE.cyl12, M(sd * px, BOB_BAR / 2, z, 0.2, BOB_BAR + 0.5, 0.2, 0, 0, sd * 0.03), cane);
    for (let y = 0.9; y < BOB_BAR; y += 1.2) gb.add(SHAPE.cyl12, M(sd * (px + 0.03 * (y / BOB_BAR - 0.5)), y, z, 0.24, 0.06, 0.24), ring);
    gb.add(SHAPE.box, M(sd * px, BOB_BAR, z, 0.3, 0.26, 0.3), 0x8b5a31);                              // lashing
    addVines(gb, rng, sd * px, BOB_BAR - 0.1, z, 2, 0.12, 0.12, 1.4);
  }
  gb.add(SHAPE.cyl12, M(0, BOB_BAR, z, 0.18, 2 * px + 0.9, 0.18, 0, 0, Math.PI / 2), cane);
  for (let x = -2.4; x <= 2.4; x += 1.2) gb.add(SHAPE.cyl12, M(x, BOB_BAR, z, 0.06, 0.22, 0.22, 0, 0, Math.PI / 2), ring);
}

// ── a moving bridge: one stepping stone (under water, one turtle) per row of the gap, all in a group that slides from lane to lane ──
let BRIDGE_GEO = null;
function bridgeGeo() {
  if (BRIDGE_GEO) return BRIDGE_GEO;
  const make = (fn) => { const b = new GeoBuilder(), k = new GeoBuilder(false), g = new GeoBuilder(); fn(b, k, g); return { env: b.build(), ink: k.build(), glow: g.build() }; };
  BRIDGE_GEO = {
    // a slab of the old temple that never learned to fall: paved on top, raw rock beneath, lit from under
    stone: make((b, k, g) => {
      b.add(SHAPE.box, M(0, -0.16, 0, LANE_W - 0.08, 0.32, ROW - 0.14), 0xf2e2ba);
      k.add(SHAPE.box, M(0, -0.16, 0, LANE_W - 0.08 + 2 * OT, 0.32 + 2 * OT, ROW - 0.14 + 2 * OT));
      b.add(SHAPE.box, M(0, -0.03, 0, LANE_W - 0.36, 0.07, ROW - 0.42), 0xe4cf9e);
      g.add(SHAPE.box, M(0, 0.012, 0, 0.52, 0.02, 0.52, 0, Math.PI / 4, 0), 0xffe45c);                 // a lit diamond to aim for
      b.add(SHAPE.rock, M(0, -0.72, 0, 1.6, 0.86, 2.0, 0, 0.4, 0), 0x93a9b5);                          // the rock it was cut from
      b.add(SHAPE.rock, M(0.1, -1.36, -0.1, 0.9, 0.6, 1.1, 0, 1.3, 0), 0x7f96a3);
      g.add(SHAPE.box, M(0, -0.34, 0, LANE_W - 0.3, 0.05, ROW - 0.4), 0x7df0ff);                       // the light it rides on
      for (const sd of [-1, 1]) b.add(SHAPE.box, M(sd * 0.6, -0.4, 0.5 * sd, 0.09, 0.5, 0.06), 0x3fbf6b);
    }),
    // a sea turtle, nose up the path, its back level with the floor
    turtle: make((b, k) => {
      const shell = 0x4fae6a, scute = 0x3b8f57, skin = 0x9bd48f, rim = 0xe0d08f;
      b.add(SHAPE.sph, M(0, -0.31, 0, LANE_W - 0.1, 0.62, ROW - 0.2), shell);
      k.add(SHAPE.sph, M(0, -0.31, 0, LANE_W - 0.1 + 2 * OT, 0.62 + 2 * OT, ROW - 0.2 + 2 * OT));
      b.add(SHAPE.cyl12, M(0, -0.36, 0, LANE_W + 0.02, 0.12, ROW - 0.06), rim);
      for (const [dx, dz, r] of [[0, 0, 0.62], [0, -0.62, 0.42], [0, 0.62, 0.42], [-0.5, -0.3, 0.36], [0.5, -0.3, 0.36], [-0.5, 0.32, 0.36], [0.5, 0.32, 0.36]]) // the plates of its shell
        b.add(SHAPE.cyl, M(dx, -0.31 + 0.31 * Math.sqrt(Math.max(0, 1 - (dx * dx) / 0.81 - (dz * dz) / 1.21)) - 0.02, dz, r, 0.05, r, 0, 0.4, 0), scute);
      b.add(SHAPE.sph, M(0, -0.3, -1.32, 0.56, 0.44, 0.66), skin);                                      // head
      k.add(SHAPE.sph, M(0, -0.3, -1.32, 0.56 + 2 * OT, 0.44 + 2 * OT, 0.66 + 2 * OT));
      for (const sd of [-1, 1]) {
        b.add(SHAPE.sphLo, M(sd * 0.22, -0.2, -1.5, 0.12, 0.14, 0.12), 0x241c18);
        b.add(SHAPE.sph, M(sd * 1.1, -0.42, -0.62, 0.95, 0.12, 0.46, 0, sd * 0.55, sd * -0.12), skin);  // front flippers
        b.add(SHAPE.sph, M(sd * 0.9, -0.42, 0.86, 0.6, 0.1, 0.36, 0, sd * -0.7, 0), skin);              // back flippers
      }
      b.add(SHAPE.cone, M(0, -0.38, 1.22, 0.2, 0.36, 0.12, Math.PI / 2, 0, 0), skin);                   // tail
    }),
  };
  return BRIDGE_GEO;
}
function makeBridge(b, sea) {
  const geo = bridgeGeo()[sea ? 'turtle' : 'stone'], grp = new THREE.Group(), n = Math.max(1, Math.round((b.s1 - b.s0) / ROW));
  for (let i = 0; i < n; i++) {
    const one = new THREE.Group();
    for (const [part, mat] of [['env', MAT.env], ['ink', MAT.ink], ['glow', MAT.glow]]) if (geo[part].attributes.position.count) one.add(sharedMesh(geo[part], mat));
    one.position.z = -(b.s0 + (i + 0.5) * ROW);
    grp.add(one);
  }
  b.mesh = grp; b.sea = sea;
  return grp;
}
function poseBridge(b, t) {
  const kids = b.mesh.children;
  b.mesh.position.x = b.x;
  for (let i = 0; i < kids.length; i++) { // each rides a little differently from its neighbours
    const a = t * (b.sea ? 2.1 : 1.6) + i * 1.3;
    kids[i].position.y = (b.sea ? 0.03 : 0.025) * Math.sin(a) - 0.03;
    kids[i].rotation.z = (b.sea ? 0.035 : 0.012) * Math.sin(a * 0.8 + 1);
  }
}
