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
- **High Tide.** The same ruins, deep under water for the whole run. The logs are napping seals, the boulder that chases you is an orca, and the scenery is reef (`Tide` in `70-game.js`, the sea builders in `40-scenery.js`, the seal and orca in `30-characters.js`). On its home screen a seal circles behind the runner and bolts when the chase begins.
- **Getting harder.** Inside a run, a level is four stretches of track and you go up one at a corner. Each runs 10 % faster than the last and leaves 7 % less room between obstacles, so the difficulty compounds (the numbers are at the top of `00-util.js`). The level number is also the score multiplier, up to ×10, and the time of day moves on with it.
- **Corners.** You come out of a turn in the lane you went in on (`Player.tryTurn`).
- **Characters unlocked for testing.** `FREE_CAST` at the top of `30-characters.js` is `true`, so every character can be played without buying it; nothing is spent or recorded as bought. Set it to `false` to put the prices back: whatever was really bought is still there, and a runner that was only borrowed goes back to Monkey Jones.

Tests worth running after a change to any of these (add `MJ_MAP=tide` in front to run one in High Tide):

- `test/states.js`: the two levels on the home screen, pressed with real taps on three screen sizes; nothing of one leaks into the other.
- `test/levels.js 1 20 6 1600 tide` (or `ruins`): the autopilot plays every level to prove each layout can be passed.
- `test/turn.js`: lanes through corners.
- `test/final.js`: the characters, free for testing and with the prices back; everyone plays both levels.
- `test/tutorial.js`: a first-ever run and its hints, in both levels.
- `test/homeseal.js`: the home-screen seal keeps clear of the orca when a run starts.
- `test/sea.js`, `test/home.js`, `test/charshot.js`: pictures in `shots/` for looking at.
