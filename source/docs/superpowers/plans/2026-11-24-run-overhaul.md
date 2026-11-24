# Run Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add decks with ramps, bounce pads, two kinds of mover and moving bridges to the run, each with a Jungle Ruins and a High Tide look.

**Architecture:** A stretch (`Seg`) gains a floor-height function fed by `seg.decks`; the player stands on `floorY` instead of 0. Pads and movers are new obstacle types handled in `Player.collide`; a bridge is a full-width hole with a platform that `overHole` consults. New static meshes merge into the stretch as before; movers and bridges are their own meshes, driven by game time in `World.update`. The autopilot (`Bot`) learns each piece so `test/levels.js` keeps proving every layout passable.

**Tech Stack:** Three.js r128, plain JS concatenated by `build.js`, Playwright + headless Chrome tests driving `window.__mj`.

**Spec:** `docs/superpowers/specs/2026-11-24-run-overhaul-design.md`

## Global Constraints
- Controls unchanged: swipe left, right, up, down only.
- Constants (in `src/js/00-util.js`): `DECK_H = 2.2`, `RAMP_LEN = 5.5`, `STEP_UP = 0.45`, `PAD_V = 15.4`, `PAD_AIR = 2 * PAD_V / GRAVITY`.
- Movers trip (`Game.stumble`), never kill outright. Only a missed bridge or a head-on deck face kills.
- Every piece has a land skin and a sea skin (`seg.sea`). Save format unchanged.
- Level gating by `prog`: deck 0.25, padDeck 0.75, sweeper 1, wall 1, padPile 1.25, bobber 1.5, bridge 2.
- All motion is a function of `Game.time` (headless stepping must reproduce it).
- The existing suite passes unchanged: levels (both levels, 1–20), states, final, turn, tutorial, soaks, app.

## Review Focus
1. A lane change begun just before a deck face arrives: the runner must end beside the deck or on it, never inside it (Task 1: "late swipe at a face").
2. Powers at a wall: shield, the ghost after a rocket flight, and springs must each put the runner on top instead of killing (Task 1 tests 3 and 7; Task 3 covers the pad).
3. A slowed runner (0.62 × speed after a stumble) on a pad in front of a deck still clears the lip (Task 3: three speeds).
4. Pieces near a corner: nothing new may start so late that its landing zone, lock distance or deck reaches the junction (Task 2 generator invariants).
5. A new run after dying on or beside any new piece starts clean: no stale `bouncing`, bridge lock or mover state (Task 6: restart checks in `test/overhaul.js`).

---

### Task 1: Floors, decks and their collisions
**Files:** Modify `src/js/00-util.js`, `src/js/50-track.js` (class `Seg`), `src/js/70-game.js` (`Player`, `Game.update`, `placeBoulder`), `src/js/90-boot.js` (`__mj`). Test: `test/overhaul.js` (new).

**Interfaces — produces:**
- `seg.decks: { lane: 0|1|2, s0, s1, h, ramp: boolean, r0, x0, x1 }[]` (`r0 = s0 - RAMP_LEN` when `ramp`, else `s0`; `x0/x1 = laneX(lane) ∓ LANE_W / 2`).
- `seg.floorY(s, x): number`; `seg.deckWall(lane, from, to, y): deck | null` (a deck or ramp in `lane` whose surface anywhere in `[from, to]` is more than `STEP_UP` above `y`).
- `Player.floor: number` (floor under him this frame); `Game.hitDeck(deck)`.
- Test helper in `test/overhaul.js`: `scene(setup)` clears the current stretch of obstacles, holes and decks, runs `setup(m, seg)`, and returns after stepping until a predicate.

- [ ] Step 1: write failing tests (each asserts on `Player` state after headless stepping at level-1 speed):
  1. `ramp`: deck `{lane:1, s0:30, s1:60, ramp:true}` → at s=45 `P.y === 2.2 && P.grounded`; at s=70 `P.y === 0 && P.grounded`, alive.
  2. `face`: same deck, `ramp:false` → `Game.death.type === 'bonk'` before s=31.
  3. `shield at face`: with `run.shield = true` → alive, `P.y === 2.2` at s=35, `run.shield === false`.
  4. `side`: runner in lane 0 beside it at s=40, `input('right')` → `P.lane === -1` still, `run.danger <= 0`, `P.y === 0`.
  5. `step off`: on top at s=40, `input('left')` → lands with `P.lane === -1`, `P.y === 0`, alive.
  6. `timed jump`: no ramp, jump so that y ≥ 1.75 at s0 → on top; jump too early → bonk.
  7. `springs`: `run.springs = 5`, jump at s0 − 0.3·v·AIR_T·1.34 → on top.
  8. `late swipe at a face`: in lane 0, `input('right')` when s = s0 − 0.5 → never `P.y < 2.0` with `|P.x - laneX| < 0.9` while `s0 < P.s < s1` (not inside), alive.
  9. `floorY`: 0 before r0, 1.1 at the middle of the ramp, 2.2 on the deck, 0 after s1 and in the next lane.
- [ ] Step 2: run `node test/overhaul.js` → all nine FAIL (no `seg.decks`).
- [ ] Step 3: implement. `Player.update` stands on `seg.floorY(s, x)`; leaving an edge starts a fall; landing uses the floor under him. Face check where `s` crosses `s0` of a rampless deck (or a ramp entered from the side is refused in `shift`). Push-out when inside a footprint below the lip. `hitDeck`: shield, `run.ghost > 0` or `P.bouncing` → set on top; else `die('bonk')`. Camera and shadow follow the floor; the chaser's height follows `floorY` at its own position. `clearToLand` refuses to set a rocket down within reach of a rampless face.
- [ ] Step 4: `node test/overhaul.js` → 9 pass. `node test/levels.js 1 6 3` and `node test/turn.js` still pass.
- [ ] Step 5: commit.

### Task 2: Decks in the generator, their look, and the autopilot
**Files:** Create `src/js/45-props.js` (all new models). Modify `src/js/50-track.js` (`genSegment`, `buildSegment`), `src/js/90-boot.js` (`Bot.hazard`). Test: `test/gen.js` (new), `test/levels.js`.

**Interfaces — produces:** patterns `deck` (ramped, ground rows beside it, bananas on top) and `wall` (no ramp); `addDeckMesh(gb, ol, glow, rng, deck, sea)` in `45-props.js`; `Bot.hazard` reports `'block'` for `seg.deckWall(...)`.

- [ ] Step 1: `test/gen.js` — generate 300 stretches per level for levels 1, 3, 8, 15 in both levels and assert: no deck overlaps a hole, a beam or another deck's lane span; every deck ends ≥ `max(11, 0.8 v)` before the junction; beside a deck each obstacle row leaves a ground lane free of pillars; no obstacle within `0.4 v` either side of a deck's end; at least one deck appears by level 2. FAIL first (no decks generated).
- [ ] Step 2: implement patterns and meshes (stone terrace with steps; coral-crusted shelf with shell steps under `ENV_SEA`), wire `Bot`.
- [ ] Step 3: `node test/gen.js` passes; `node test/levels.js 1 20 6 1600 ruins` and `… tide` pass.
- [ ] Step 4: commit.

### Task 3: Bounce pads
**Files:** Modify `src/js/50-track.js`, `src/js/70-game.js`, `src/js/45-props.js`, `src/js/10-audio.js`. Test: `test/overhaul.js`, `test/gen.js`.

**Interfaces — produces:** obstacle `{ type: 'pad', lane, s, s0, s1, x0, x1, y0: 0, y1: 0.3, d }`; `Player.bouncing`; `Player.bounce(pad)`; patterns `padDeck`, `padPile`; `addPadMesh(ob, ol, glow, rng, x, z, sea)`.

- [ ] Step 1: failing tests: `pad` launches (`P.vy > 0`, apex ≥ 3.3) and a pillar under the arc does not touch him; `pad then deck` at 1.0, 0.62 and 0.4 × level speed ends on top each time; `pad is one use`; `jumping over a pad` does not trigger it. `gen.js`: no hole in any lane from `0.4 v PAD_AIR` to `v PAD_AIR + 3` after a pad; a padDeck's deck is long enough to land on.
- [ ] Step 2: implement; mushroom and bubble-jet meshes (jets also emit bubbles while in view).
- [ ] Step 3: tests pass; levels pass both levels.
- [ ] Step 4: commit.

### Task 4: Movers
**Files:** Modify `src/js/50-track.js` (gen, build, `World.update`), `src/js/70-game.js` (`collide`), `src/js/45-props.js` (wheel, crab, mask, jellyfish), `src/js/90-boot.js`. Test: `test/overhaul.js`, `test/gen.js`.

**Interfaces — produces:** obstacle `{ type: 'mover', kind: 'side' | 'bob', trip: true, s, s0, s1, lane?, w, ph }`; `moverBox(o, t)` sets `o.x0, o.x1, o.y0, o.y1` for time `t`; `seg.movers` (obstacle + mesh pairs) animated in `World.update`.

- [ ] Step 1: failing tests: `sweeper` trips a runner in its lane at the crossing and not one lane away; jumped cleanly → no stumble; `bobber` low → jump clears, high (`y0 ≥ 1.47`) → running under is clean, middle (`0.85 ≤ y0 < 1.47`) → slide is clean, standing run → stumble; a mover never kills at first touch.
- [ ] Step 2: implement; `Bot` predicts a sweeper's lane at arrival (`'jump'`) and treats a bobber as `'block'`.
- [ ] Step 3: tests pass; levels pass both levels.
- [ ] Step 4: commit.

### Task 5: Moving bridges
**Files:** Modify `src/js/50-track.js`, `src/js/70-game.js`, `src/js/45-props.js` (slab, turtle), `src/js/90-boot.js`. Test: `test/overhaul.js`, `test/gen.js`.

**Interfaces — produces:** `seg.bridges: { s0, s1, x, to, locked, mesh }[]`, hole `{ …, bridge }`; `seg.overHole(s, x)` false on the platform; `bridgeStep(b, t, dt, runnerS, v)` moves, and locks once `runnerS > s0 - (1.3 v + 3)`.

- [ ] Step 1: failing tests: crossing in the locked lane survives; crossing in another lane dies with `'fall'` (`'sink'` in High Tide); the lane is fixed at least 1.2 s before arrival at level speeds 11 and 29; the platform does not move again until the runner is past `s1`; `Bot` crosses 20 of 20.
- [ ] Step 2: implement.
- [ ] Step 3: tests pass; levels pass both levels.
- [ ] Step 4: commit.

### Task 6: Whole-run verification and release
- [ ] Restart checks in `test/overhaul.js` (Review Focus 5); run the full suite (`levels` both levels and as the seal, `states`, `final`, `turn`, `tutorial`, `homeseal`, soaks, `app`).
- [ ] Contact sheets of every new piece in both levels, looked at; fix what reads badly.
- [ ] README section; `npm run build`; publish the artifact; commit; push `gh-pages`; confirm the live build number.
