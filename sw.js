/* Taller El Varón - Service Worker (Fase 5: PWA offline real)
 * Cachea el "app shell" para que la aplicación ABRA sin internet.
 * - Navegación: red primero, cae a index.html cacheado sin conexión.
 * - Recursos GET (propios y CDN): stale-while-revalidate (rápido y se auto-actualiza).
 * - Las llamadas al backend (POST a Apps Script) NO se interceptan: sin conexión
 *   las maneja la cola offline (Outbox) de la app.
 */
const CACHE = "tev-cache-v5-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.css?v=5.1",
  "./manifest.json",
  "./utils.js?v=5.1",
  "./store.js?v=5.1",
  "./sync.js?v=5.1",
  "./api.js?v=5.1",
  "./print.js?v=5.1",
  "./app.js?v=5.1",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cachea cada recurso de forma tolerante: un fallo individual no aborta la instalación.
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const r = await fetch(url, { cache: "no-cache" });
        if (r && r.ok) await cache.put(url, r.clone());
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
        const cache = await caches.open(CACHE);
        cache.put("./index.html", net.clone());
        return net;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Resto de GET: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
