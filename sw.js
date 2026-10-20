// 文王聖卦離線快取：先回快取、背景更新；更新檔案後請調高版本號
var CACHE = "wenwang-gua-v9";
var FILES = [
  "./",
  "./index.html",
  "./3-2.html",
  "./manifest.webmanifest",
  "./lib/lunar.js",
  "./lib/zhouyi.js",
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

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(function(c) {
    return c.match(e.request, { ignoreSearch: true }).then(function(hit) {
      var net = fetch(e.request).then(function(res) {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) c.put(e.request, res.clone());
        return res;
      }).catch(function() { return hit; });
      return hit || net;
    });
  }));
});
