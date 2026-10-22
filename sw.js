const CACHE_NAME = 'gastos-v11.14';

const urlsToCache = [
    '/',
    '/index.html',
    '/resumen.html',
    '/historial.html',
    '/carga.html',
    '/perfil.html',
    '/hogar.html',
    '/admin_hogar.html',
    '/config_hogar.html',
    '/login.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/api/GastoRepository.js',
    '/js/services/ResumenService.js',
    '/js/ui/ResumenRenderer.js',
    '/js/ui/HistorialRenderer.js',
    '/js/ui/ToastManager.js',
    '/js/ui/ModalManager.js',
    '/js/ui/ConfirmManager.js',
    '/js/ui/ChartManager.js',
    '/js/ui/ListRenderer.js',
    '/js/controller_carga.js',
    '/js/controller_resumen.js',
    '/js/controller_historial.js',
    '/js/controller_perfil.js',
    '/js/controller_dashboard.js',
    '/js/controller_admin_hogar.js',
    '/js/controller_config_hogar.js',
    '/js/controller_login.js',
    '/js/utils/NavigationBuilder.js',
    '/js/utils/AppUtils.js'
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