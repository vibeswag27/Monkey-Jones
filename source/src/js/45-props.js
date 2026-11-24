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
