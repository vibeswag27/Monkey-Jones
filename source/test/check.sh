#!/bin/sh
# Build, then make sure the game script parses.
cd "$(dirname "$0")/.." && node build.js | tail -n 1 && node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');fs.writeFileSync('/tmp/mj-game.js', h.match(/<script>\n([\s\S]*)\n<\/script>/)[1])" && node --check /tmp/mj-game.js && echo "syntax ok"
