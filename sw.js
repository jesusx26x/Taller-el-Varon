/* Taller El Varón - Service Worker (Fase 5: PWA offline real)
 * Cachea el "app shell" para que la aplicación ABRA sin internet.
 * - Navegación: red primero, cae a index.html cacheado sin conexión.
 * - Recursos GET (propios y CDN): stale-while-revalidate (rápido y se auto-actualiza).
 * - Las llamadas al backend (POST a Apps Script) NO se interceptan: sin conexión
 *   las maneja la cola offline (Outbox) de la app.
 */
const CACHE = "tev-cache-v6-5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.css?v=6.4",
  "./manifest.json",
  "./utils.js?v=6.4",
  "./store.js?v=6.4",
  "./sync.js?v=6.4",
  "./api.js?v=6.4",
  "./print.js?v=6.4",
  "./app.js?v=6.4",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const cross = /^https?:\/\//.test(url);
        const req = new Request(url, { mode: cross ? "no-cors" : "same-origin", cache: "no-cache" });
        const r = await fetch(req);
        if (r && (r.ok || r.type === "opaque")) await cache.put(url, r.clone());
      } catch (e) { /* recurso opcional o sin red durante la instalación */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST/PUT al backend van a la red; el offline lo maneja la app.

  // Navegaciones (abrir/recargar la app): red primero, fallback al index cacheado.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net && net.status === 200 && !net.redirected) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put("./index.html", net.clone());
            await cache.put(req, net.clone());
          } catch (err) {}
        }
        return net;
      } catch (e) {
        const cache = await caches.open(CACHE);
        const match = (await cache.match(req)) || (await cache.match("./index.html")) || (await cache.match("index.html")) || (await cache.match("./"));
        if (match) return match;
        return fetch(req).catch(() => new Response("Servicio no disponible sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
      }
    })());
    return;
  }

  // Resto de GET: stale-while-revalidate.
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then(async (res) => {
        if (res && (res.status === 200 || res.type === "opaque") && !res.redirected) {
          try { cache.put(req, res.clone()); } catch (err) {}
        }
        return res;
      }).catch(() => null);

      if (cached) {
        networkPromise; // Actualiza en segundo plano
        return cached;
      }
      const res = await networkPromise;
      if (res) return res;
      return fetch(req);
    } catch (e) {
      return fetch(req);
    }
  })());
});
