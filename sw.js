/* Offline cache for the emergency-plan 3D map: network first (so updates arrive), cache as fallback. */
var C = "phpk2-3d-v2";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function withTimeout(p, ms) {
  return new Promise(function (res, rej) {
    var t = setTimeout(function () { rej(new Error("timeout")); }, ms);
    p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
  });
}
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(C).then(function (c) {
    return withTimeout(fetch(e.request), 5000).then(function (r) {
      if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone());
      return r;
    }).catch(function () {
      return c.match(e.request, { ignoreSearch: true }).then(function (m) { return m || Response.error(); });
    });
  }));
});
self.addEventListener("message", function (e) {
  if (!e.data || !e.data.cache) return;
  var port = e.ports && e.ports[0];
  e.waitUntil(caches.open(C).then(function (c) {
    return Promise.all(e.data.cache.map(function (u) {
      var same = u.indexOf(self.location.origin) === 0;
      return fetch(new Request(u, { mode: same ? "same-origin" : "no-cors" })).then(function (r) {
        return c.put(u, r).then(function () { return 1; });
      }).catch(function () { return 0; });
    }));
  }).then(function (rs) {
    if (port) port.postMessage({ ok: rs.length > 0 && rs[0] === 1 });
  }));
});
