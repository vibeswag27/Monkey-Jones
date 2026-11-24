# The Golden Banana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rare, stockpiled power-up found only in crates: a double tap spends one and makes the runner golden, 3x as fast and unstoppable for a few seconds, with bananas in all three lanes.

**Architecture:** Gold is one more timed state on `Game.run` (`run.gold`), ruled in `70-game.js` beside the rocket whose self-steering it borrows. While it is on, `Player.collide` smashes what it would have hit, the floor logic treats him as a ghost over gaps, and the world lays extra banana rows and holds the level. The stock lives in the save; crates are a new kind of pick-up laid by the generator.

**Tech Stack:** Three.js r128, plain JS modules concatenated by `build.js`; Playwright + headless Chrome tests driving `window.__mj`.

**Spec:** `docs/superpowers/specs/2026-11-24-golden-banana-design.md`

## Global Constraints

- Constants in `00-util.js`: `GOLD_K = 3`, `GOLD_VMAX = 58`, `GOLD_START = 5`, `GOLD_MAX = 99`, `GOLD_GRACE = 1.5`, `GOLD_OVER = 3.5`, `GOLD_BURST = 2.5` (seconds of level-speed running cleared when it ends), `CRATE_ODDS = 0.03`, `SMASH_SCORE = 50`.
- `POWERS.gold = { name: 'Golden banana', short: 'Gold', blurb: 'Unstoppable, three times as fast, bananas everywhere', t: [5, 6, 7, 8, 9, 10] }`. `POWER_KINDS` stays the five tokens; `UP_KINDS = [...POWER_KINDS, 'gold']` is what has levels and shop rows.
- Save keys: `gold` (integer 0..99, default 5), `goldUsed` (boolean), `up.gold` (1..6). An old save loads with gold 5, up.gold 1.
- Gold never kills. `Player.die` refuses while `run.gold > 0` and counts the refusal in `Game.goldSaves`; every test that runs gold asserts `Game.goldSaves === 0`, so each cause is handled where it arises.
- Rules tests live in `test/gold.js` (same harness and helpers as `test/overhaul.js`: an emptied stretch, pieces placed by hand). `sh test/check.sh` after every build. The existing suite must stay green.
- Every commit message ends with the two attribution lines.

## Review Focus

1. Setting gold off at an awkward moment (mid-air over a gap, mid-slide, mid-bounce, on a deck, on a bridge, in the last metres before a corner, while stumbling): it starts cleanly and nothing kills.
2. Gold ending at an awkward place (over a gap, on a deck, just before a wall or a corner): the burst and the grace leave him alive and with time to react.
3. Low frame rates: at 20 frames a second and 58 m/s no banana row in his lane is skipped and no corner is missed.
4. Bad saves: `gold` missing, negative, fractional, huge or not a number.
5. Leaving a run during gold (restart, home, pause and resume): look, speed, level hold, extra bananas and sounds all reset.

---

### Task 1: Stock, the upgrade row, and setting one off

**Files:** Modify `src/js/00-util.js`, `src/js/70-game.js` (Save, `Game.useGold`, `blankRun`), `src/js/80-ui.js`, `src/index.template.html`, `src/js/90-boot.js` (hooks). Create `test/gold.js`.

**Interfaces:**
- Produces: `Save.data.gold`, `Save.data.goldUsed`, `Save.fixGold()`; `powerTime('gold')`; `Game.useGold(): boolean` (true if one was spent); `run.gold` (seconds left, 0 when off), `run.max.gold`; `Game.goldSaves`; `UI.gold(n)` refreshes the button (`#btnGold`, count in `#goldCount`, hidden at 0) and the home-screen chip (`#goldHome`).
- `Game.useGold` refuses unless `state === 'run'`, the player is alive and not flying, `run.gold <= 0`, and stock > 0. On success: stock − 1, `goldUsed = true`, saved, `run.gold = run.max.gold = powerTime('gold')`, danger, slow and stumble cleared.

- [ ] **Step 1: failing tests** in `test/gold.js`: save cases (`{}` → 5 and level 1; `{gold: 2}` → 2; `-3` → 0; `2.7` → 2; `1e9` → 99; `'x'` → 5); shop has six rows, the sixth named Golden banana, "Lasts 5 s, next level 6 s"; buying it with 100 bananas makes `powerTime('gold') === 6`; `useGold()` true in a run and stock 5 → 4 in `localStorage`; false with stock 0, during the intro, during the rocket, and a second time while gold; a real double tap (two touchscreen taps 120 ms apart) sets it off, as do a tap on `#btnGold` and the G key; one tap, two taps 600 ms apart, and a swipe do not; the button shows the count and hides at 0.
- [ ] **Step 2:** run `node test/gold.js` — Expected: FAIL (no gold in the save, `useGold` undefined).
- [ ] **Step 3:** implement. Double tap: in the stage's pointer handlers a tap is down-and-up within 300 ms without the 22 px move; two taps whose ups are within 350 ms call `Game.useGold()`. `KeyG` does the same.
- [ ] **Step 4:** `node test/gold.js` — Expected: PASS. `node test/states.js` and `node test/final.js` still pass (they count things on the shop and HUD).
- [ ] **Step 5:** commit.

### Task 2: Unstoppable

**Files:** Modify `src/js/70-game.js` (`updateRun` speed, `Player.collide`, floor logic, corner steering, `die`, `stumble`, `hitSolid`, `hitDeck`, `take`), `src/js/50-track.js` (`World.smash` for movers, level hold). Test `test/gold.js`.

**Interfaces:**
- Consumes: `run.gold`, `Game.useGold`.
- Produces: `Game.goldSmash(o)` (smash, debris, throttled sound, `+SMASH_SCORE * run.mult`); `world.hold` (boolean: stretches made while true keep their parent's depth); speed target `min(GOLD_K * levelSpeed(level), GOLD_VMAX)` while gold.

- [ ] **Step 1: failing tests:** with gold on he runs through a totem, a beam, a log, rubble, a sweeper and a bobber in his lane: alive, no danger, each `gone`, score up by 50 each; a wall with no steps: he ends on top; a full-width gap, and a bridged gap away from its platform: crossed; a pad in his lane does not fire; three corners in a row with no input are taken (one a T); speed settles at 33 at level 1 and 58 at level 12 and never passes 58; set off in mid-air over a gap, mid-slide, mid-bounce and while in danger: alive ten seconds on; a rocket token is left alone while gold; with gold set off on the last stretch of level 1, `run.level` is still 1 three corners later and each stretch entered after the first has the depth of the one before; `Game.goldSaves === 0` throughout.
- [ ] **Step 2:** run — Expected: FAIL (he dies at the totem).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `node test/gold.js` and `node test/overhaul.js` — Expected: PASS.
- [ ] **Step 5:** commit.

### Task 3: Bananas everywhere

**Files:** Modify `src/js/50-track.js` (`World.addGold`, `World.dropGold`), `src/js/70-game.js` (`collect` sweep, when rows are laid), `src/js/10-audio.js` (banana chime thinned while gold). Test `test/gold.js`.

**Interfaces:**
- Produces: `world.addGold(seg, from, to)` lays a row in all three lanes every `ROW` from `from` to `to` at `seg.floorY(s, laneX(l)) + 0.62`, each banana flagged `gold: true`, and remembers how far it has laid (`seg.goldTo`) so calling it again only extends; `world.dropGold()` removes every uncollected gold banana from live stretches.
- Rows are laid on the current stretch from 3 m ahead of him to its end when gold starts, on the first 60 m of each child stretch as soon as it exists, and to the end of a stretch when he enters it.

- [ ] **Step 1: failing tests:** one second into gold, every row position from 4 m ahead to the end of the stretch has a banana in each lane; on a deck's lane they sit at 2.82; over a 600 m gold run at 58 m/s he collects at least 97% of the rows he passes, at 60 and at 20 frames a second; with the magnet on he collects more than 2.5 times as many; after gold ends no banana anywhere is flagged gold and uncollected; the number of bananas the world asks to draw never passes 640 and the 20 rows ahead of him are always among them.
- [ ] **Step 2:** run — Expected: FAIL (no rows).
- [ ] **Step 3:** implement. `collect` tests `b.s` against the span he covered this frame, not only where he ended it.
- [ ] **Step 4:** `node test/gold.js` — Expected: PASS.
- [ ] **Step 5:** commit.

### Task 4: How it ends

**Files:** Modify `src/js/70-game.js` (`Game.endGold`, `updateRun`, ghost rule over gaps, chaser gap). Test `test/gold.js`.

**Interfaces:**
- Produces: `Game.endGold()`; `run.goldOver` (seconds past the end while it is being held); the rule that `run.ghost` cannot run out while he is over a gap.
- When `run.gold` reaches 0: if `s > seg.len − HJ − max(18, 1.7 * levelSpeed)` hold gold (up to `GOLD_OVER`), else end: smash every smashable obstacle from 2 m behind to `GOLD_BURST * levelSpeed` ahead in all lanes, `run.ghost = GOLD_GRACE`, drop the extra bananas, release the level hold, restore his look, and let speed ease to the level's.

- [ ] **Step 1: failing tests:** gold with 1 s left, a totem 20 m beyond where it runs out: smashed by the burst, he lives; a full-width gap there instead: crossed, he lives; timed to run out 10 m before a corner: still gold through the corner, off within 1 s after it; after the end `run.gold === 0`, `world.hold === false`, speed within 1 m/s of the level's two seconds later; the chaser is at least 15 m back and no danger shows; the grace lasts 1.5 s and does not run out over a gap; a pending level-up arrives at the first corner after the end.
- [ ] **Step 2:** run — Expected: FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `node test/gold.js` — Expected: PASS.
- [ ] **Step 5:** commit.

### Task 5: Crates

**Files:** Modify `src/js/50-track.js` (generator, building, `World.update`), `src/js/45-props.js` (crate and sea-chest), `src/js/70-game.js` (`Game.takeCrate`), `test/gen.js`, `test/gold.js`.

**Interfaces:**
- Produces: a pick-up `{ kind: 'crate', s, x, y: 1.15, got: false, mesh }` in `seg.pickups`, at most one a stretch, only where `seg.level >= 2` and `world.hold` is false, with odds `CRATE_ODDS`; `Game.takeCrate(p)` (+1 up to `GOLD_MAX`, saved at once, toast, burst of planks).
- A crate is never within 6 m (along the path) of a gap, a deck's span, a mover or a power-up token, and has no totem in its lane within 20 m before or 9 m after.

- [ ] **Step 1: failing tests:** `test/gen.js`: no crate in level 1; over all sampled stretches of levels 2 to 15 the share with a crate is between 1.5% and 5%; never two on a stretch; the placement rules above. `test/gold.js`: running through a crate makes the stock 6 in `localStorage` and marks it got; at 99 it stays 99; a crate in the next lane is not taken; no crate on a stretch made while `world.hold`.
- [ ] **Step 2:** run both — Expected: FAIL (no crates).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** both pass.
- [ ] **Step 5:** commit.

### Task 6: Look, sound and the first-time hint

**Files:** Modify `src/js/20-gfx.js` (`MAT.midas`), `src/js/30-characters.js` (`setGold` on both character classes), `src/js/70-game.js` (trail, flicker, camera, hint), `src/js/80-ui.js` + template (timer chip, edge glow, hint text), `src/js/10-audio.js`. Create `test/goldshots.js`. Test `test/gold.js`.

**Interfaces:**
- Produces: `monkey.setGold(on)` (every mesh that wears `MAT.char` wears `MAT.midas` while on); HUD chip `gold`; `#goldGlow` layer; sounds `goldOn`, `goldOff`, `goldTick`, `crate`, `goldSmash`.
- Hint "Double tap for the Golden Banana" (keyboard: "Press G for the Golden Banana") for the first 6 s of a run when `runs >= 2`, stock > 0 and `goldUsed` is false.

- [ ] **Step 1: failing tests:** for each of the seven characters, gold on puts `MAT.midas` on at least one mesh and gold off (by ending, by restart, by going home) leaves none; the timer chip shows while gold and its bar shrinks; the hint shows under exactly those conditions and never again after the first use; the camera's extra field of view at 58 m/s is no more than 14 degrees.
- [ ] **Step 2:** run — Expected: FAIL.
- [ ] **Step 3:** implement; photograph gold, a crate and a sea-chest in both levels with `test/goldshots.js` and adjust by eye.
- [ ] **Step 4:** `node test/gold.js` — Expected: PASS.
- [ ] **Step 5:** commit.

### Task 7: Whole-game verification and release

**Files:** Create `test/goldsoak.js`. Modify `README.md`, built files.

- [ ] **Step 1:** `test/goldsoak.js`: the autopilot plays both levels from levels 1, 4, 8 and 12 with the stock kept topped up, setting gold off at random moments every 6 to 14 s, for 4,000 m a run, at 60 and at 20 frames a second. Expected: no deaths at all, `Game.goldSaves === 0`, and no page errors.
- [ ] **Step 2:** restart, home and pause-and-resume during gold (Review Focus 5) in `test/gold.js`.
- [ ] **Step 3:** the full suite: `gold`, `overhaul`, `gen`, `levels` in both levels and as the seal, `states`, `final`, `turn`, `swipe`, `audio`, `names`, `tutorial`, `homeseal`, `charshot`, the soaks, `app`. Logic and build time compared with the live build.
- [ ] **Step 4:** README; `npm run build`; publish the artifact; fast-forward `gh-pages`; push; confirm the live build number.
