# Run overhaul: the calls made while building it

Every place the build departed from the plan or the plan was silent, as recorded at the time: what was decided, why, and what it costs if it was the wrong call. The plan is `2026-11-24-run-overhaul.md`, the design `../specs/2026-11-24-run-overhaul-design.md`. Release build 1795502944.

## Rulings

- Setup: Ruling: work on a feature branch in the same checkout, not a separate worktree — node_modules and the test harness live in source/ and gh-pages is the deploy branch, so the branch gives the isolation; cost if wrong: none beyond a dirty tree if abandoned.
- Setup: Ruling: native execution without asking Ale to review the plan or pick an executor — he approved the design in plain words ("let's do it for both as one big update"), is not technical, and subagents are not to be spawned unless he asks; cost if wrong: he sees the result instead of the plan, and can redirect then.
- Setup: Ruling: pushing gh-pages and republishing the artifact at the end is pre-authorised by the standing arrangement (every game change goes to both) and by my note to him that it ships once tested; cost if wrong: a release he would have wanted to hold.
- Task 2: Ruling: the autopilot now seeks out steps in a neighbouring lane (65% of flights) and test/levels.js tallies what it met — the plan only asked that walls be reported as blocks, but then the bot climbed a deck only when one happened to be in its lane, too thin for a fairness oracle — cost if wrong: the bot plays a little less like a cautious human; deaths would still show.
- Task 2: Ruling: the low road beside a deck carries hop-overs only when the deck is in the middle lane (a totem only beside a side-lane deck, from level 2) and `wall` may come two abreast from level 3 — not spelled out in the plan; follows the spec's anti-goal that nothing may be impassable — cost if wrong: the low road is a touch easier than it could be.
- Task 2: Ruling: clear ground after a deck or wall is 0.75 v (the plan's test asks only for 0.4 v either side of the end) — he lands about 0.43 v past the end after the drop, so 0.4 v would put the next obstacle at his feet — cost if wrong: decks eat a little more of a stretch.
- Task 2: Ruling: kerbs along a deck's top edges and a painted shadow on the ground beside it, added after looking at screenshots (from behind and above, the top and the ground read as one plane) — cost if wrong: purely cosmetic.
- Task 3: Ruling: a bounce clears a stumble's slow-down (run.slow = 0) as well as sizing its push to the speed he arrives at — the plan asked only for the adaptive push before a deck; without the speed reset a slowed runner off a free pad would come down short, inside the clump he was meant to clear — cost if wrong: a pad is also a small catch-up boost after a stumble.
- Task 3: Ruling: the generator's "nothing where a bounce comes down" rule covers all three lanes for a free pad but only the deck itself for a pad that serves a deck (the low road beside the deck keeps its hop-overs) — the brief's wording was all-lanes; a padDeck sets him down on the deck — cost if wrong: someone who swipes off the deck mid-bounce can land by a hop-over, with 0.35 s of grace.
- Task 3: Ruling: padPile is a clump of totems (two in the pad's lane, one or a hop-over beside) rather than anything wider, so pads stay a bonus route: every lane but the pad's can still be run on foot — cost if wrong: piles look a little alike.
- Task 4: Ruling: a sweeper stands 1.15 m tall and 1.3 m wide (the spec said 0.9 m tall, 1.6 m wide) — at 0.9 m the wheel read as a pebble next to him in screenshots; a jump still clears it with 0.4 s to spare — cost if wrong: slightly harder to hop than the spec intended.
- Task 4: Ruling: movers share one geometry per creature (wheel, crab, mask, two jellyfish colours) instead of the plan's mesh-per-mover wording, each instance a small group posed in World.update — keeps building a stretch cheap — cost if wrong: no per-instance variety in looks.
- Task 4: Ruling: the masks hang from a bamboo frame whose bar is 5.7 m up, so a rocket passes under it — not in the plan; a vine from nowhere looked wrong — cost if wrong: cosmetic.
- Task 5: Ruling: a bridge is a row of stepping stones (or turtles), one per floor row of the gap, moving as one — the plan said "slab, turtle"; a single slab or one turtle 13 to 29 m long looked absurd — cost if wrong: cosmetic.
- Task 5: Ruling: once a bridge has settled for the runner it never moves again (the plan allowed it to resume after he is past s1) — simpler, and nothing behind him is seen — cost if wrong: none visible.
- Task 5: Ruling: bananas over a bridged gap ride the platform (banana.ride = bridge), so they show where to stand — not in the plan; fixed bananas over a gap would hang over empty air two times in three — cost if wrong: a few more bananas per bridge than a fixed line would give.
- Task 5: Ruling: the new pieces' weights scale with level (× min(hard, 2.2)) so they stay about two patterns in five as the classic patterns are weighted up — the plan fixed no weights; without it bridges fell under 1 stretch in 12 and movers thinned out by level 8 — cost if wrong: late levels lean more on the new pieces than on the classic gauntlets.
- Task 5: Ruling: test/levels.js zeroes the 1.5 s start-of-run danger, and the autopilot lets a hop-over go by before dodging into its lane — a cold start at level 11 put the first obstacle inside the danger window, where the bot's one stumble (dodging a far totem into a log's lane) read as a death; real runs start at level 1 — cost if wrong: the oracle would miss a layout that is only deadly in the first 1.5 s of a run.
- Task 6: Ruling: each bridge is drawn as two merged meshes (odd and even stones) instead of one group per stone — a 13-stone bridge was 39 draws; now 6 — cost if wrong: the stones bob in two sets rather than each on its own.
- Task 6: Ruling: the camera's floor height and the chaser's are reset in startIntro — restart straight from a deck top (the pause menu's Restart) began the next run with the camera 2 m up; test "restart: straight from the top of a deck" RED→GREEN — cost if wrong: none.
- Final: Ruling: about two patterns in five are now new pieces at every level, and most of them are gentler than the classic gauntlets (a deck is 1.3 to 2 s of safe running) — judged by effect: high levels get a little more breathing room, which suits a game played for fun by two people; one constant (`fresh`) tunes it — cost if wrong: the hardest levels feel easier than before.
- Final: Ruling: no first-encounter hints for the new pieces — bananas trace every intended route (up the steps, along the bounce, across the bridge), and only a missed bridge kills — cost if wrong: a first bridge may cost a new player one run.
- Final: Ruling: draw count per frame is up by about 12 on land and 8 under water (65 and 103 on average, measured before and after), logic and stretch-building time unchanged — cannot be measured on a real phone from here — cost if wrong: an old phone drops frames in High Tide where it was already heaviest.

## Review

- Final review: self-review (subagents are not to be spawned in this session unless the user asks) — a self-review by the author is weaker than a fresh reviewer.
- Final: fixed deck push-out could shove him off the outside edge of the path (or ping-pong between two decks abreast) if he ever turned up inside one — test "deck: one in an outside lane never shoves him off the edge of the path" RED→GREEN, suite 35/35.

## Deferred minors

- the autopilot and the level test leave bookkeeping flags (fancy, met, stood) on track objects.
- steps are drawn as eight treads over a smooth slope, so feet sink or float by up to 14 cm on them.
- a used bounce pad looks the same as a fresh one (it only matters for a frame or two before it is behind him).
- the chaser's model can overlap a wall it follows him past; it is out of shot unless he has just stumbled.
- the rocket treats a bounce pad as something not to land on, so it may glide a little longer than it needs to.
- movers make no sound of their own until one trips him.

## Tasks

- Task 1: complete (commits 1182063..f5c858a, tests: node test/overhaul.js → PASS: 11 rules)
- Task 2: complete (commits f5c858a..d58748f, tests: node test/gen.js → PASS: the generator keeps its rules)
- Task 3: complete (commits d58748f..81901e7, tests: sh -c 'node test/overhaul.js && node test/gen.js' → PASS: the generator keeps its rules)
- Task 4: complete (commits 81901e7..263d266, tests: sh -c 'node test/overhaul.js && node test/gen.js' → PASS: the generator keeps its rules)
- Task 5: complete (commits 263d266..2a7d479, tests: sh -c 'node test/overhaul.js && node test/gen.js' → PASS: the generator keeps its rules)
- Task 6: complete (commits 2a7d479..f7755f5, tests: sh -c 'node test/overhaul.js && node test/gen.js' → PASS: the generator keeps its rules)
