# Run overhaul: heights, bounce pads, things that move, moving bridges

Approved by Ale in chat on 2026-11-24 ("let's do it for both as one big update").

## Intent
The run is solid but flat: one floor, nothing moves. Ale wants more to do in it: platforms and heights to go up,
things that move, and both levels (Jungle Ruins and High Tide) to get an equal share of it. It ships as one update.

## Goals
- An upstairs: raised walkways ("decks") in a lane. A ramp leads up some; the rest are walls to dodge, or to get onto another way.
- Bounce pads that launch the runner, onto a deck with no ramp or over a pile of obstacles.
- Things that move and can be read from a distance: one that crosses the lanes, one that goes up and down.
- Moving bridges: a gap too wide to jump with one platform sliding across it.
- Every piece exists in both levels with its own look. Swipe-only controls stay exactly as they are.
- New pieces appear gently early in level 1/2 and get more frequent and faster with the levels.

## Non-goals
Forks with a high road and a low road, crumbling bridges, obstacles on top of decks, new power-ups, new controls.

## Anti-goals
- Anything the autopilot cannot get past: every layout the generator can produce must stay passable (`test/levels.js`).
- Pure timing traps that kill outright. Movers trip (a stumble); only a missed bridge is deadly, and it stops for you.
- One level getting the mechanic and the other a recolour of nothing.

## Constraints
Single-file Three.js r128 game, static merged meshes per stretch, 60 fps on a phone, deterministic headless stepping for tests.
The existing suite must still pass. Save data format unchanged.

## Approaches considered
1. Lane decks with ramps, as on train roofs in Subway Surfers (chosen): a real second floor with a choice of route.
2. The whole path rising and falling: dramatic, but no new decisions.
3. Bespoke set pieces (rope bridge, zip line): spectacle, but each is one-off work and rare in play.
Ale picked 1 together with pads, movers and bridges, for both levels, in a single update.

## Design (the parts Ale decided, as decided)
| Piece | Jungle Ruins | High Tide |
|---|---|---|
| Deck | mossy stone terrace, stone steps up | coral shelf, shell-strewn steps |
| Bounce pad | giant mushroom | bubble jet |
| Sideways mover | rolling stone wheel | scuttling crab |
| Up-and-down mover | carved mask yo-yoing on a vine | drifting jellyfish |
| Moving bridge | floating temple stone | sea turtle |

## My calls (not asked, stated to Ale where visible)
- Deck: 2.2 m high, one lane wide, steps 5.5 m long. Top holds bananas only. End is a drop, harmless.
  Head-on into a face below the lip: bonk (a shield, or the moment after a flight or bounce, lifts you onto it instead).
  A swipe into the side of one is refused with a thud, no stumble. A jump that reaches within 0.45 m of the lip climbs on.
- Pad: one use, launches to about 3.5 m; nothing below can touch you until you land (plus 0.35 s). A pad in front of a
  deck adjusts its push to your speed so you always clear the lip. Pads are a bonus route: what they fly over is passable without them.
- Sideways mover: sweeps all three lanes on a sine, 0.9 m tall (jumpable), trips. Up-and-down mover: one lane (or two with
  the third free), bobbing between floor and overhead; jump it low, slide or run under it high; trips.
- Bridge: full-width gap, one-lane platform stepping lane to lane; it finishes its step and stops once you are
  about 1.3 s away, so its final lane is known in good time. Miss it and you fall.
- The chaser follows the runner's floor height. The rocket flies over everything.
- Level gating by `prog` (depth/4): ramped deck 0.25, pad+deck 0.75, sideways mover and bare wall 1, pad+pile 1.25, bobber 1.5, bridge 2.

## Left to the builder
Exact weights and spacings, model details, sounds, and test scaffolding.
