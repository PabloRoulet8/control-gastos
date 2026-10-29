(function () {
    let deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;

        if (document.getElementById('banner-instalar-pwa')) return;

        const banner = document.createElement('div');
        banner.id = 'banner-instalar-pwa';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Instalar aplicación');
        banner.style.cssText = [
            'position: fixed',
            'left: 16px',
            'right: 16px',
            'bottom: 16px',
            'z-index: 9999',
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 12px',
            'padding: 14px 16px',
            'border-radius: 16px',
            'background: linear-gradient(135deg, #1f2937, #111827)',
            'color: #ffffff',
            'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35)',
            'font-family: inherit'
        ].join(';');

        const texto = document.createElement('div');
        texto.innerHTML = [
            '<strong style="display:block;font-size:15px;">📲 Instalar App</strong>',
            '<span style="font-size:12px;opacity:0.85;">Accedé más rápido y sin navegador</span>'
        ].join('');

        const boton = document.createElement('button');
        boton.id = 'btn-instalar-pwa';
        boton.type = 'button';
        boton.textContent = 'Instalar';
        boton.style.cssText = [
            'border: none',
            'border-radius: 10px',
            'padding: 10px 16px',
            'background: #22c55e',
            'color: #ffffff',
            'font-weight: 700',
            'font-size: 14px',
            'cursor: pointer',
            'white-space: nowrap'
        ].join(';');

        boton.addEventListener('click', async function () {
            if (!deferredInstallPrompt) return;

            deferredInstallPrompt.prompt();

            try {
                await deferredInstallPrompt.userChoice;
            } catch (error) {
                console.warn('No se pudo obtener la elección de instalación:', error);
            }

            deferredInstallPrompt = null;
            banner.remove();
        });

        banner.appendChild(texto);
        banner.appendChild(boton);
        document.body.appendChild(banner);
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        document.getElementById('banner-instalar-pwa')?.remove();
    });

    const AVISO_CONEXION_ID = 'aviso-conexion';
    let avisoConexionTimer = null;

    function mostrarAvisoConexion(mensaje, esOnline) {
        let aviso = document.getElementById(AVISO_CONEXION_ID);

        if (!aviso) {
            aviso = document.createElement('div');
            aviso.id = AVISO_CONEXION_ID;
            aviso.setAttribute('role', 'status');
            aviso.setAttribute('aria-live', 'polite');
            aviso.style.cssText = [
                'position: fixed',
                'top: 14px',
                'left: 50%',
                'transform: translate(-50%, -8px)',
                'z-index: 10000',
                'max-width: calc(100% - 32px)',
                'padding: 10px 18px',
                'border-radius: 999px',
                'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25)',
                'color: #ffffff',
                'font-family: inherit',
                'font-size: 13px',
                'font-weight: 600',
                'line-height: 1.35',
                'text-align: center',
                'opacity: 0',
                'pointer-events: none',
                'transition: opacity 0.25s ease, transform 0.25s ease'
            ].join(';');
            document.body.appendChild(aviso);
        }

        aviso.textContent = mensaje;
        aviso.style.background = esOnline
            ? 'rgba(16, 185, 129, 0.96)'
            : 'rgba(245, 158, 11, 0.96)';

        // Reinicia la transición si el aviso ya estaba visible.
        void aviso.offsetWidth;
        aviso.style.opacity = '1';
        aviso.style.transform = 'translate(-50%, 0)';

        if (avisoConexionTimer) clearTimeout(avisoConexionTimer);
        avisoConexionTimer = setTimeout(function () {
            aviso.style.opacity = '0';
            aviso.style.transform = 'translate(-50%, -8px)';
            avisoConexionTimer = null;
        }, 5000);
    }

    window.addEventListener('offline', function () {
        mostrarAvisoConexion(
            'Modo sin conexión activo: los gastos se guardarán en el dispositivo',
            false
        );
    });

    window.addEventListener('online', function () {
        mostrarAvisoConexion(
            'Conexión restablecida: sincronizando datos con la nube',
            true
        );
    });

    if (!('serviceWorker' in navigator)) return;

    let primeraTomaDeControl = !navigator.serviceWorker.controller;
    let recargando = false;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (recargando) return;

        if (primeraTomaDeControl) {
            primeraTomaDeControl = false;
            return;
        }

        recargando = true;
        window.location.reload();
    });

    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js')
            .then(function (registration) {
                registration.update();
            })
            .catch(function (error) {
                console.error('No se pudo registrar el Service Worker:', error);
            });
    });
})();
