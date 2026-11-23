// contact sheet: node test/sheet.js out.png cols cellW a.png b.png ...
const sharp = require('/opt/npm-tools/node_modules/sharp');
const [, , out, colsS, cwS, ...files] = process.argv;
(async () => {
  const cols = +colsS, cw = +cwS;
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const ch = Math.round(cw * metas[0].height / metas[0].width);
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(cw, ch).toBuffer(), left: (i % cols) * (cw + 6), top: Math.floor(i / cols) * (ch + 6) })));
  await sharp({ create: { width: cols * (cw + 6), height: rows * (ch + 6), channels: 3, background: '#222' } }).composite(tiles).png().toFile(out);
  console.log(out, cols * (cw + 6), rows * (ch + 6));
})();
