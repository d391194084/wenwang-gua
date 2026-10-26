// 文王聖卦離線快取：頁面先抓網路、其他檔案先回快取；更新檔案後請調高版本號
var CACHE = "wenwang-gua-v43";
var FILES = [
  "./",
  "./index.html",
  "./3-2.html",
  "./manifest.webmanifest",
  "./lib/lunar.js",
  "./lib/zhouyi.js",
  "./lib/jiegua.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// 頁面（HTML）先抓網路，有網路時一定拿到最新版；離線或 4 秒沒回應才用快取
function networkFirst(c, req) {
  var net = fetch(req).then(function(res) {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  });
  var timeout = new Promise(function(resolve) { setTimeout(resolve, 4000); });
  return Promise.race([net, timeout]).then(function(res) {
    return res || c.match(req, { ignoreSearch: true }).then(function(hit) { return hit || net; });
  }).catch(function() {
    return c.match(req, { ignoreSearch: true });
  });
}

// 其他檔案（曆法、經文、圖示）先回快取、背景更新
function cacheFirst(c, req) {
  return c.match(req, { ignoreSearch: true }).then(function(hit) {
    var net = fetch(req).then(function(res) {
      if (res && res.ok && new URL(req.url).origin === location.origin) c.put(req, res.clone());
      return res;
    }).catch(function() { return hit; });
    return hit || net;
  });
}

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var isPage = e.request.mode === "navigate" || e.request.destination === "document";
  e.respondWith(caches.open(CACHE).then(function(c) {
    return isPage ? networkFirst(c, e.request) : cacheFirst(c, e.request);
  }));
});
