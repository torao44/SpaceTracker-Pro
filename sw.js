const CACHE_NAME = 'spacetracker-pro-v4-20260923'; // 更新するたびにここを変える（古いキャッシュを破棄させるため）
const CORE_ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 外部API（ISS/打上げ/オーロラ等）はSWを介さずそのまま通す。
// 静的アセット（HTML/CSS/JS）は「ネットワーク優先」に変更：
// 常に最新版を取りに行き、取得できた場合のみキャッシュを更新する。
// オフライン時や取得失敗時だけ、保存済みキャッシュにフォールバックする。
// （以前は「キャッシュ優先」だったため、更新後も古い版が表示され続ける不具合があった）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
