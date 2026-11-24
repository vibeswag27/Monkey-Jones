# The Golden Banana: design

## Intent

The game is named after the Golden Banana and the player never gets to use one. This adds it as a rare, stockpiled
super power-up: found only in crates, kept between runs, set off when the player chooses, and for a few seconds it
makes the runner unstoppable. It is a treat and a spectacle, and the thing you save for a bad moment.

Asked for by Ale (2026-11-24) in these words: crates that float like bananas; a golden banana used with a double tap;
he turns golden for a set time, moves 3x as fast, has enough autopilot not to die at walls and corners, cannot be hurt,
and bananas spawn in all three lanes; upgradeable in Upgrades; start with 5. Agreed in conversation: speed capped at
twice the game's top speed; the level does not climb while he is gold; golden bananas come only from crates and crates
are rare; of the three ways gold could meet an obstacle (smash through / glide over / pass through like a ghost) he
took "unstoppable": stay on the ground and smash through.

## Goals

- One more thing to hope for on a run (a crate), and one decision to make (when to spend).
- Gold feels like being the boulder: fast, loud, bright, nothing stops you.
- Works the same in Jungle Ruins and High Tide, for all seven characters.
- Nothing about it can end a run or strand the player: not using one, not running out, not the moment it ends.

## Non-goals

- No way to buy golden bananas, no daily gifts, no second kind of crate.
- No new controls beyond the double tap (and its button and key).
- No change to how the other five power-ups work, except where they meet gold (below).

## Anti-goals

- Gold must never kill: not at a corner, a gap, a wall, or in the second after it ends.
- It must not become the way to play: crates stay rare enough that most short runs see none.
- It must not carry the player into a harder game than they left (hence the frozen level).

## What the player sees

**Stock.** A count of golden bananas, saved with the game. New players start with 5; so do existing saves that have no
count yet. Shown on the home screen, and during a run as a round golden button with the count on it (hidden at 0).

**Crates.** A small crate floating in a lane at power-up height, turning slowly, glowing gold through its slats (in
High Tide, a barnacled sea-chest wreathed in kelp). Run through it: it bursts, the count goes up by one and is saved
at once. Crates appear only from level 2 on, on about 3 stretches in 100 (one every three or four minutes of running),
never on a stretch laid while gold is on, never over a gap, on or beside a raised walkway, or where a power-up token is.

**Setting one off.** Double tap anywhere on the play area (two taps within 0.35 s; a tap is a touch that neither moves
22 px nor lasts 0.3 s), or tap the golden button, or press G. It works at any moment of a run while he is alive,
on the ground or in the air, even in the beat before a fall; not during the intro, not while the rocket is carrying
him, and not while gold is already on. It spends one and saves at once.

**Gold.** For T seconds:

- He turns solid gold and trails sparks (golden bubbles under water). A timer chip shows on the HUD like the other
  power-ups. In the last 1.5 s the gold flickers and a tick sounds.
- Speed: 3 x the level's speed, capped at 58 m/s (twice the game's top speed), eased in over about 0.4 s.
- Nothing hurts or trips him. Totems, beams, logs, clams, rubble, wheels, crabs, masks and jellyfish that he runs into
  are smashed aside (debris, a chunky sound, +50 x multiplier points each). A wall or walkway lifts him onto its top and
  he runs off the far end. Bounce pads do not fire. Over a gap, bridged or not, he runs straight across on his own
  trail of gold.
- Corners take themselves, as the rocket's do: at a T he goes the way he last swiped, or picks one. He can still change
  lane, jump and slide.
- Bananas: a row in all three lanes every 2.4 m, at floor height (so along the top of a walkway where there is one),
  on the stretch he is on from just ahead of him, and on every stretch he enters while gold. He collects the lane he
  is in (all three if the magnet is on). These extra bananas vanish when gold ends.
- The level is frozen: no level-up happens while he is gold, and stretches laid while he is gold are laid at the level
  he was on. A level-up that falls due is given at the first corner after gold ends.
- The chaser is left behind and eases back to its usual distance afterwards.
- Other power-ups picked up or running carry on as normal, except that a rocket token cannot be taken while gold.

**When it ends.** Not in the run-up to a corner: if time runs out there, gold holds through the corner (up to 3.5 s
over). Then everything smashable for the next 2.5 s of running at the level's speed is smashed in one burst, he has
1.5 s in which nothing can touch him (and gaps cannot swallow him), and his speed eases back down.

**Upgrades.** A sixth row, "Golden banana: unstoppable, three times as fast, bananas everywhere". Six levels on the
same price ladder as the rest (100, 250, 600, 1,200, 2,500): lasts 5, 6, 7, 8, 9, 10 s.

**First time.** From the third run on (after the coaching runs), while the player has stock and has never used one, a
hint at the start of each run: "Double tap for the Golden Banana" ("Press G ..." with a keyboard).

## Approaches considered

1. **Unstoppable (chosen).** On the ground, smashing through. Uses what exists: the shield's smash, the lift onto a
   deck given to a ghost, a ghost's immunity to gaps, the rocket's self-steering. Most work, most reward.
2. **Golden glide.** Lift off and skim over everything. Cheapest (it is the rocket, faster) and so not special.
3. **Ghost.** Run through things untouched. Cheap, and passing through a wall looks like a bug.

## My calls (not asked for; say if any is wrong)

- The on-screen button and the G key, besides the double tap: a gesture alone is invisible to a new player.
- He collects only the lane he is in. One use is then worth about 70 to 240 bananas, not three times that.
- Durations 5 to 10 s. Shorter than the rocket's 5 to 12 because this does far more.
- Usable in mid-air and at the brink of a fall, so it doubles as a rescue.
- Smash bonus of 50 x multiplier per thing smashed.
- Gold ends with a burst that clears the way, instead of waiting for clear ground as the rocket does: at 58 m/s clear
  ground long enough to matter rarely comes.
- Crate odds are per stretch (3 in 100 from level 2), not per metre, so they do not come faster as the game speeds up.
- No crates on stretches laid during gold, so gold cannot be used to farm crates.

## Constraints

- Three.js r128, one built file; the existing module layout (`00-util` constants, `50-track` layout and world,
  `45-props` models, `70-game` rules, `80-ui` screen, `90-boot` hooks and autopilot).
- Save format `monkeyjones.v1` gains `gold` (count) and `goldUsed` (has he ever used one); `up.gold` joins the levels.
  Old saves must load and come out with gold 5, up.gold 1.
- At most 640 bananas are drawn at once (instanced). The flood must stay inside that with the ordinary bananas.
- Banana pick-up must not skip a row at 58 m/s down to 20 frames a second.
- The existing suite stays green, including the autopilot's level runs in both levels.

## Left to the builder

- The exact look of the crate, the sea-chest, the gold material and the trail, judged from screenshots in both levels.
- How the banana sound is thinned out at 25 bananas a second.
- How far the field of view opens at gold speed (the present formula would add about 20 degrees; too much).
- Whether the camera needs anything else at 58 m/s, found by looking.

## Risks

- A stretch takes about 9 ms to build on land and 40 ms under water (desktop figures). At gold speed that hitch comes
  three times as often. Not measurable on a phone from here.
