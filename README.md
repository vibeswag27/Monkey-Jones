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
