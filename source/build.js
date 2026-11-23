// Stitches src/js/*.js into the HTML template → dist/index.html (one self-contained page).
const fs = require('fs'), path = require('path');
const root = __dirname;
const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const dir = path.join(root, 'src/js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const body = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const guard = `if (!window.THREE) { var st = document.getElementById('stage'); if (st) st.dataset.state = 'fatal'; return; }`;
const js = `(function () {\n'use strict';\n${guard}\n${body}\n})();`;
if (js.includes('</script')) throw new Error('script would close early');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), tpl.replace('/*__GAME__*/', () => js));
console.log('built dist/index.html', (fs.statSync(path.join(root, 'dist/index.html')).size / 1024).toFixed(1) + ' KB', files.length + ' files');
