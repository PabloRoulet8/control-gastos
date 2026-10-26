const CACHE_NAME = 'gastos-v15.0';

const urlsToCache = [
    './',
    './index.html',
    './resumen.html',
    './historial.html',
    './carga.html',
    './perfil.html',
    './hogar.html',
    './admin_hogar.html',
    './config_hogar.html',
    './login.html',
    './manifest.json',
    './css/styles.css',
    './js/pwa.js',
    './js/auth_guard.js',
    './js/firebase-config.js',
    './js/api/GastoRepository.js',
    './js/store/CargaStore.js',
    './js/services/VoiceService.js',
    './js/services/IAService.js',
    './js/services/FormService.js',
    './js/services/CategoryService.js',
    './js/services/InventarioService.js',
    './js/services/DraftService.js',
    './js/services/ResumenService.js',
    './js/services/HogarService.js',
    './js/services/PerfilPublicoService.js',
    './js/ui/InventarioUI.js',
    './js/ui/FormUI.js',
    './js/ui/ResumenRenderer.js',
    './js/ui/HistorialRenderer.js',
    './js/ui/AdminHogarRenderer.js',
    './js/ui/PerfilRenderer.js',
    './js/ui/ToastManager.js',
    './js/ui/ModalManager.js',
    './js/ui/ConfirmManager.js',
    './js/ui/ChartManager.js',
    './js/controller_carga.js',
    './js/controller_resumen.js',
    './js/controller_historial.js',
    './js/controller_perfil.js',
    './js/controller_dashboard.js',
    './js/controller_admin_hogar.js',
    './js/controller_config_hogar.js',
    './js/controller_login.js',
    './js/utils/NavigationBuilder.js',
    './js/utils/AppUtils.js',
    './assets/img/icon-192.png',
    './assets/img/icon-512.png'
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
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) return response;

            return fetch(event.request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200) return networkResponse;

                const responseCopy = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
                return networkResponse;
            });
        })
    );
});
