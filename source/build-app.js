// Builds the home-screen version into the repo root (one folder up, the part GitHub Pages serves): the same game, with its own copies of the 3D engine and fonts
// (no third-party requests), an icon, a web-app manifest, offline support and a small update checker.
const fs = require('fs'), path = require('path');
const root = __dirname, out = path.resolve(root, '..');
let html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const build = Math.floor(Date.now() / 1000);
const swap = (a, b) => { if (!html.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); html = html.replace(a, () => b); };

swap('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
`<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Monkey Jones">
<meta name="theme-color" content="#2F9BF0">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">`);
swap('<title>Monkey Jones and the Golden Banana</title>', '<title>Monkey Jones</title>');
html = html.replace(/<link rel="preconnect"[^>]*>\n/g, '');
swap('<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Rammetto+One&display=swap" rel="stylesheet">',
`<style>
@font-face{font-family:"Rammetto One";font-weight:400;font-display:swap;src:url(fonts/rammetto-one.woff2) format("woff2")}
@font-face{font-family:"Fredoka";font-weight:500;font-display:swap;src:url(fonts/fredoka-500.woff2) format("woff2")}
@font-face{font-family:"Fredoka";font-weight:600;font-display:swap;src:url(fonts/fredoka-600.woff2) format("woff2")}
@font-face{font-family:"Fredoka";font-weight:700;font-display:swap;src:url(fonts/fredoka-700.woff2) format("woff2")}
</style>`);
swap('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script src="three.min.js"></script>');
swap('</body>', `<script>
// Home-screen app extras: play offline, and pick up new versions by itself.
(function () {
  var BUILD = ${build};
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  function check() {
    var st = document.getElementById('stage').dataset.state;
    if (st !== 'title' && st !== 'over' && st !== 'fatal') return;           // never interrupt a run
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
      if (!v || !(v.build > BUILD)) return;
      var tried = 0; try { tried = +sessionStorage.getItem('mj.tried') || 0; } catch (e) {}
      if (tried === v.build) return;                                          // already reloaded for this one
      try { sessionStorage.setItem('mj.tried', String(v.build)); } catch (e) {}
      location.replace(location.pathname + '?v=' + v.build);
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  setTimeout(check, 2500);
})();
</script>
</body>`);
if (/fonts\.googleapis|cdnjs\.cloudflare/.test(html)) throw new Error('still references an outside host');

fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, 'node_modules/three/build/three.min.js'), path.join(out, 'three.min.js'));
const F = { 'rammetto-one.woff2': '@fontsource/rammetto-one/files/rammetto-one-latin-400-normal.woff2', 'fredoka-500.woff2': '@fontsource/fredoka/files/fredoka-latin-500-normal.woff2',
  'fredoka-600.woff2': '@fontsource/fredoka/files/fredoka-latin-600-normal.woff2', 'fredoka-700.woff2': '@fontsource/fredoka/files/fredoka-latin-700-normal.woff2' };
for (const k in F) fs.copyFileSync(path.join(root, 'node_modules', F[k]), path.join(out, 'fonts', k));
for (const [pkg, name] of [['@fontsource/rammetto-one', 'rammetto-one-LICENSE.txt'], ['@fontsource/fredoka', 'fredoka-LICENSE.txt'], ['three', 'three-LICENSE.txt']]) {
  const lic = path.join(root, 'node_modules', pkg, 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(out, 'fonts', name));
}
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Monkey Jones and the Golden Banana', short_name: 'Monkey Jones', start_url: './', scope: './', display: 'fullscreen', orientation: 'any',
  background_color: '#2F9BF0', theme_color: '#2F9BF0',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2));
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ build }));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'sw.js'), `// Offline support. Network first, so a new version always wins; the saved copy is only used with no connection.
const CACHE = 'monkey-jones-1';
const CORE = ['./', 'index.html', 'three.min.js', 'fonts/rammetto-one.woff2', 'fonts/fredoka-500.woff2', 'fonts/fredoka-600.woff2', 'fonts/fredoka-700.woff2', 'icon-192.png', 'manifest.webmanifest', 'version.json'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
`);
const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log('site built into ' + out + ', build', build, '| index', size('index.html'), '| three', size('three.min.js'));
