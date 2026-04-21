const CACHE_NAME = 'gastos-v6.1';

// Agregamos TODAS las vistas y controladores del proyecto
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/carga.html',
    '/resumen.html',
    '/historial.html',
    '/perfil.html',
    '/admin_hogar.html',
    '/config_hogar.html',
    '/css/styles.css',
    '/manifest.json', // Muy importante cachear el manifest para las PWAs
    '/js/firebase-config.js',
    '/js/auth_guard.js',
    '/js/api/GastoRepository.js',
    '/js/services/ResumenService.js',
    '/js/ui/ToastManager.js',
    '/js/ui/ModalManager.js',
    '/js/ui/ConfirmManager.js',
    '/js/controller_login.js',
    '/js/controller_dashboard.js',
    '/js/controller_carga.js',
    '/js/controller_resumen.js',
    '/js/controller_historial.js',
    '/js/controller_perfil.js',
    '/js/controller_admin_hogar.js',
    '/js/controller_config_hogar.js'
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
                    // Si el caché no es el actual (v6.1), LO BORRA.
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