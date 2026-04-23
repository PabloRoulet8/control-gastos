const CACHE_NAME = 'gastos-v9.5';

const urlsToCache = [
    '/',
    '/index.html',
    '/resumen.html',
    '/historial.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/api/GastoRepository.js',
    '/js/services/ResumenService.js',
    '/js/ui/ToastManager.js',
    '/js/ui/ModalManager.js',
    '/js/ui/ConfirmManager.js',
    '/js/controller_carga.js',
    '/js/controller_resumen.js',
    '/js/controller_historial.js'
];

self.addEventListener('install', event => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim()) 
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});