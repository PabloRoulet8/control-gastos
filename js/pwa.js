(function () {
    if (!('serviceWorker' in navigator)) return;

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
