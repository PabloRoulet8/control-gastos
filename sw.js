const CACHE_NAME = 'gastos-v30.3';
const ROOT_URL = new URL('./', self.location.href).href;
const INDEX_URL = new URL('./index.html', self.location.href).href;
const ESTATICOS_REGEX = /\.(?:js|css|png|jpe?g|gif|svg|webp|ico|json|woff2?|ttf)$/i;
const DOMINIOS_API = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'firebaseappcheck.googleapis.com',
    'firebasestorage.googleapis.com',
    'accounts.google.com',
    'apis.google.com',
    'www.googleapis.com',
    'generativelanguage.googleapis.com',
    'onrender.com'
];

const urlsToCache = [
    './',
    './index.html',
    './resumen.html',
    './historial.html',
    './carga.html',
    './perfil.html',
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
    './js/services/CargaContextService.js',
    './js/services/GastoSaveService.js',
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

async function precachearRecurso(cache, url) {
    const request = new Request(new URL(url, self.location.href), { cache: 'reload' });
    const response = await fetch(request);

    if (!response.ok) {
        throw new Error(`${url}: HTTP ${response.status}`);
    }

    await cache.put(request, response);
}

async function estrategiaRedPrimero(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request, { cache: 'no-cache' });

        if (response.ok) {
            try {
                await cache.put(request, response.clone());
            } catch (error) {
                console.warn('Service Worker: no se pudo actualizar la caché de navegación.', error);
            }
        }

        if (response.status >= 500) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Fallback sin query: permite reutilizar el precache de assets versionados (?v=).
        const cachedSinQuery = await caches.match(request, { ignoreSearch: true });
        if (cachedSinQuery) return cachedSinQuery;

        if (request.mode === 'navigate') {
            return (await cache.match(INDEX_URL)) || (await cache.match(ROOT_URL)) || Response.error();
        }

        return Response.error();
    }
}

async function actualizarRecursoEstatico(request) {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request, { cache: 'no-cache' });

    if (response.ok) {
        try {
            await cache.put(request, response.clone());
        } catch (error) {
            console.warn('Service Worker: no se pudo actualizar la caché estática.', error);
        }
    }

    return response;
}

async function estrategiaStaleWhileRevalidate(request, actualizacion) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) return cached;

    // Fallback sin query: permite reutilizar el precache de assets versionados (?v=).
    const cachedSinQuery = await caches.match(request, { ignoreSearch: true });
    if (cachedSinQuery) return cachedSinQuery;

    return (await actualizacion) || Response.error();
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const resultados = await Promise.allSettled(
            urlsToCache.map(url => precachearRecurso(cache, url))
        );

        const fallidos = resultados.filter(resultado => resultado.status === 'rejected');
        if (fallidos.length > 0) {
            console.warn(
                'Service Worker: algunos recursos no se precachearon.',
                fallidos.map(resultado => resultado.reason?.message || resultado.reason)
            );
        }

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const esApiDinamica = DOMINIOS_API.some(dominio => (
        url.hostname === dominio || url.hostname.endsWith(`.${dominio}`)
    ));

    if (esApiDinamica || url.pathname.startsWith('/api/')) return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.endsWith('/sw.js')) return;

    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(estrategiaRedPrimero(request));
        return;
    }

    if (ESTATICOS_REGEX.test(url.pathname)) {
        const actualizacion = actualizarRecursoEstatico(request).catch(() => null);
        event.waitUntil(actualizacion);
        event.respondWith(estrategiaStaleWhileRevalidate(request, actualizacion));
    }
});
