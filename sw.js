/* Offline cache for the emergency-plan 3D map.
   Network first and bypassing the browser's HTTP cache, so a newly uploaded version shows on the next visit;
   the saved copy is used only when there is no connection. */
var C = "phpk2-3d-v18";
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
  var req = e.request;
  if (req.method !== "GET") return;
  var same = new URL(req.url).origin === self.location.origin;
  /* own files: always ask the server (no-cache revalidates), so uploads show up at once */
  var net = same ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req);
  e.respondWith(caches.open(C).then(function (c) {
    return withTimeout(net, 15000).then(function (r) {
      if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
      return r;
    }).catch(function () {
      return c.match(req, { ignoreSearch: true }).then(function (m) { return m || Response.error(); });
    });
  }));
});
self.addEventListener("message", function (e) {
  if (!e.data || !e.data.cache) return;
  var port = e.ports && e.ports[0];
  e.waitUntil(caches.open(C).then(function (c) {
    return Promise.all(e.data.cache.map(function (u) {
      var same = u.indexOf(self.location.origin) === 0;
      return fetch(new Request(u, { mode: same ? "same-origin" : "no-cors", cache: "no-cache" })).then(function (r) {
        return c.put(u, r).then(function () { return 1; });
      }).catch(function () { return 0; });
    }));
  }).then(function (rs) {
    if (port) port.postMessage({ ok: rs.length > 0 && rs[0] === 1 && rs[1] === 1 });
  }));
});
