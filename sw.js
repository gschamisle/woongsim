// 오프라인 실행용 서비스 워커: 처음 접속할 때 게임 파일을 모두 캐시한다.
const VERSION = 'woongsim-v6';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/util.js', './js/data.js', './js/save.js', './js/sprites.js', './js/audio.js', './js/input.js',
  './js/match.js', './js/render.js', './js/scenes.js', './js/main.js',
  './fonts/Galmuri11.woff2', './fonts/Galmuri11-Bold.woff2', './fonts/Galmuri9.woff2',
  './assets/sprites.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // 브라우저 HTTP 캐시를 거치지 않고 서버에서 최신 파일을 받아 저장
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 온라인이면 최신 파일(받은 것은 캐시에 갱신), 오프라인이면 캐시. 폰트·아이콘은 캐시 우선.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (/\/(fonts|icons)\//.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith(
    fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
