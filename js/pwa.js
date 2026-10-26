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
