const CACHE_NAME = 'gastos-v2.2';

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

// 1. INSTALACIÓN: Obligamos a instalar al instante
self.addEventListener('install', event => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Abriendo caché y guardando archivos nuevos');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. ACTIVACIÓN: El exterminador de cachés zombies
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Si el caché no es el v99, LO BORRA.
                    if (cacheName !== CACHE_NAME) {
                        console.log('Borrando caché zombie:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Toma el control de la pantalla inmediatamente
    );
});

// 3. INTERCEPTOR DE RED
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si el archivo está en el caché nuevo, lo usa. Si no, lo baja de internet.
                return response || fetch(event.request);
            })
    );
});