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

- **Levels.** A level is four stretches of track; you go up one at a corner. Each level runs 10 % faster than the last and leaves 7 % less room between obstacles, so the difficulty compounds (the numbers are at the top of `src/js/00-util.js`). The level is also the score multiplier, up to ×10.
- **High Tide.** Levels 2, 5, 8, … are under water. The tide starts to rise one stretch early and drains after the level. Down there the logs are napping seals, the boulder that chases you is an orca, and the scenery is reef (`Tide` in `70-game.js`, the sea builders in `40-scenery.js`, the seal and orca in `30-characters.js`).
- **Corners.** You come out of a turn in the lane you went in on (`Player.tryTurn`).

Tests worth running after a change to any of these: `test/turn.js` (lanes through corners), `test/levels.js` (the autopilot plays every level to prove each layout can be passed), `test/states.js` (the tide never leaks into menus or a new run) and `test/sea.js` (contact sheets of the High Tide level in `shots/`).
