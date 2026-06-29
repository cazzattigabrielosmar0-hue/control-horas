const CACHE_NAME = "control-horas-v7";
const ARCHIVOS = ["index.html", "style.css", "app.js", "manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(nombres =>
      Promise.all(
        nombres
          .filter(nombre => nombre !== CACHE_NAME)
          .map(nombre => caches.delete(nombre))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(respuesta => respuesta || fetch(event.request))
  );
});
