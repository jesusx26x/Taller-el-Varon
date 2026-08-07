/* Taller El Varón - Service Worker (Fase 5: PWA offline real)
 * Cachea el "app shell" para que la aplicación ABRA sin internet.
 * - Navegación: red primero, cae a index.html cacheado sin conexión.
 * - Recursos GET (propios y CDN): stale-while-revalidate (rápido y se auto-actualiza).
 * - Las llamadas al backend (POST a Apps Script) NO se interceptan: sin conexión
 *   las maneja la cola offline (Outbox) de la app.
 */
const CACHE = "tev-cache-v6-3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.css?v=6.3",
  "./manifest.json",
  "./utils.js?v=6.3",
  "./store.js?v=6.3",
  "./sync.js?v=6.3",
  "./api.js?v=6.3",
  "./print.js?v=6.3",
  "./app.js?v=6.3",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];


self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cachea cada recurso de forma tolerante: un fallo individual no aborta la instalación.
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
