# Monkey-Jones
Monkey jones game for sim 

## Play

https://vibeswag27.github.io/Monkey-Jones/

To put it on an iPhone like an app: open that link in Safari, tap Share, then **Add to Home Screen**.

## What is in this branch

- The files in this folder are the game exactly as GitHub Pages serves it: `index.html` (the whole game), `three.min.js` (3D engine), `fonts/`, the icons, `sw.js` (lets it open with no signal) and `version.json` (how installed copies notice a new version).
- `source/` is the project the game is built from: `src/` (game code), `build.js`, `build-app.js` and `test/`.

## Updating the game

```
cd source
npm install
npm run build
```

`build.js` stitches `src/` into `dist/index.html`. `build-app.js` turns that into the site files one folder up and stamps a new build number into `index.html` and `version.json`. Commit and push to the `gh-pages` branch. Copies already on a home screen check `version.json` when they are opened and reload themselves onto the new build.

The scripts in `source/test/` drive the game in headless Chrome with Playwright. `test/app.js` checks the published files the way a web host serves them: no outside requests, offline reload, and the self-update.

## How the game is put together

- **Where you run.** The home screen offers two levels, Jungle Ruins and High Tide, and remembers the last one picked (`MAPS` in `src/js/00-util.js`, saved as `map`). The whole game is rebuilt for the one chosen: `Game.setScene` runs before the track is made.
- **High Tide.** The same ruins, deep under water for the whole run. What you hop over are giant clams instead of logs, what chases you is a shark instead of the boulder, and the scenery is reef (`Tide` in `70-game.js`, `addClams` in `50-track.js`, the sea builders in `40-scenery.js`, `Shark` in `30-characters.js`). Seals and orcas only swim about in the background: they are playable characters, so they are never the obstacle or the chaser. On the home screen a seal circles behind a runner with legs and bolts when the chase begins.
- **Getting harder.** Inside a run, a level is four stretches of track and you go up one at a corner. Each runs 10 % faster than the last and leaves 7 % less room between obstacles, so the difficulty compounds (the numbers are at the top of `00-util.js`). The level number is also the score multiplier, up to ×10, and the time of day moves on with it.
- **Corners.** You come out of a turn in the lane you went in on (`Player.tryTurn`).
- **The seal and the orca.** Two playable characters that live in High Tide and nowhere else (`sea: true` in `CHARS`). They swim instead of running: `SeaCharacter` in `30-characters.js` answers everything the game asks of a `Character`, with a leap for a jump and a dive for a slide, and the same hitbox as everyone, so no layout gets easier or harder. The Characters screen lists them only while High Tide is chosen. `Save.data.char` is the everyday runner; `Save.data.seaChar` is the swimmer picked for High Tide, if any (`runner()` in `70-game.js` decides who is up). Their names, Sealie and Orkie, are stand-ins.
- **Up, over and across (the run's bigger furniture).** Four kinds of piece, each with a Jungle Ruins look and a High Tide look, laid by patterns in `genSegment` (`50-track.js`), drawn by `45-props.js`, ruled by `Player` in `70-game.js`:
  - *Raised walkways* (`seg.decks`, `Seg.floorY`): one lane wide and 2.2 m up. Stone terraces with steps, or coral shelves with shell steps: bananas along the top, hop-overs on the low road beside. Ones with no steps (a stern face, or a scallop, on the front) are walls to go round; running into the face is a bonk, swiping into a side is refused and costs nothing, and a shield, springs or the moment after a rocket flight puts you on top.
  - *Bounce pads* (obstacle `pad`): a red mushroom, or a bubble jet. Step on one and it throws you about 3.5 m up, over a clump of totems or onto a block that has no other way up, with a moment's grace on landing. Jumping over a pad leaves it asleep.
  - *Movers* (obstacle `mover`, `moverBox`): a stone wheel or a crab trundling from kerb to kerb, and a mask on a vine or a jellyfish riding up and down over a lane. They only ever trip. Where they are depends only on the game clock.
  - *Moving bridges* (`seg.bridges`, `bridgeStep`): a gap too wide to jump, crossed on floating stones or sea turtles that shuttle from lane to lane; about 1.3 s before you arrive the bridge finishes its step and stays put, and its bananas ride with it.
  They start at level 1's second stretch (walkways), then pads, then from level 2 the movers and plain walls, and bridges from level 3; from there they make up about two patterns in five. The design notes and the build plan are in `source/docs/superpowers/`.
- **The Golden Banana.** Found only in crates (a sea-chest in High Tide), which float on the path from level 2 on, on about 3 stretches in 100: one every three or four minutes. Each crate is one more golden banana, kept in the save (`Save.data.gold`; everyone starts with 5, and a save holds at most 99). A double tap on the play area, a press of the round golden button low on the right, or the G key sets one off (`Game.useGold`), any time in a run except while the rocket is carrying him. For 5 seconds (10 with its row in Upgrades bought right up) he is solid gold:
  - *Three times as fast*, though never over 58 m/s, which is twice the game's top speed (`GOLD_K`, `GOLD_VMAX` in `00-util.js`).
  - *Unstoppable.* Whatever he runs into is knocked flying for 50 points (`Game.goldSmash`), a wall lifts him onto its top, gaps are run straight across, corners turn themselves, and the chaser is left far behind. `Player.die` refuses to kill him while it lasts; `Game.goldSaves` counts how often that last line was needed, and the tests insist on never.
  - *Bananas everywhere*: a row in all three lanes every 2.4 m (`World.addGold`). He collects the lane he is in.
  - *The level stands still* (`World.setHold`): no level-up, and track laid meanwhile is no harder, so gold cannot carry anyone into a faster game than they earned. Crates are never laid on track made while it is on.
  - *When it ends* (`Game.endGold`): never in the run-up to a corner (it is held on until he is round); then one burst clears everything smashable for the next 2.5 s of running, nothing can touch him for 1.5 s, and his speed eases back down. Its last second and a half is counted down with a tick and a flicker (under three flashes a second; none for players who ask their device for less motion).
  - *What he throws off travels with him* (`Fx.carry`): at that speed, dust and debris left where they fell would be in the camera's face a tenth of a second later.
  - A swipe that happens to begin on the golden button is still a swipe; only a touch that stays put presses it. A tap, for the double tap, is a touch that moves less than 12 px and lasts under 0.3 s.
- **Free for testing.** `FREE_CAST` at the top of `30-characters.js` lists who can be played without being bought (now the seal and the orca); nothing is spent or recorded as bought. Empty the list to put their prices back: whatever was really bought is still there, and a swimmer that was only borrowed steps aside for the everyday runner.

Tests worth running after a change to any of these (put `MJ_MAP=tide` in front to run one in High Tide, `MJ_CHAR=seal` to run it as the seal):

- `test/states.js`: the two levels on the home screen, pressed with real taps on three screen sizes; nothing of one leaks into the other.
- `test/final.js`: the characters, with real taps: who is on the list in which level, who runs where after switching, free and bought, and everyone playing every level they are allowed in.
- `test/levels.js 1 20 6 1600 tide` (or `ruins`): the autopilot plays every level to prove each layout can be passed, and tallies which of the new pieces it met and used.
- `test/overhaul.js`: the rules of walkways, pads, movers and bridges, one at a time on an emptied stretch (give it part of a test's name to run just those).
- `test/gen.js`: what the track generator must never do (a pillar with no lane to dodge into, a hole where a bounce lands, a bridge too near a corner, …), over 1,500 laid-out stretches per level.
- `test/gold.js`: the rules of the Golden Banana, one at a time: the stock and its upgrade, setting one off (and the moments it must refuse), what gold does, how it ends, crates, how it looks and sounds, and leaving a run in the middle of it.
- `test/goldsoak.js`: the autopilot plays long runs in both levels, at 60 and at 20 frames a second, setting golden bananas off at random moments. Nothing may end a run.
- `test/goldshots.js`: photographs of the stock, a crate, gold itself and its moments, into `/tmp/gold`.
- `test/pieces.js`: photographs each new piece in both levels, as the game really lays it out, into `/tmp/pieces`.
- `test/turn.js`: lanes through corners.
- `test/tutorial.js`: a first-ever run and its hints, in both levels.
- `test/homeseal.js`: the home-screen seal keeps clear of the shark when a run starts.
- `test/charshot.js`: the swimmers on the menus, three screen shapes; checks the controls fit.
- `test/swimmers.js`, `test/sea.js`, `test/home.js`, `test/tidelife.js` (the shark and the clams close up): pictures in `shots/` for looking at.
