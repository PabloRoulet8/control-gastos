// Aplica el tema guardado antes de pintar el body para evitar FOUC.
// Se carga como script externo para no necesitar 'unsafe-inline' en la CSP.
(function () {
    let temaGuardado = 'dark';
    try {
        temaGuardado = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    } catch (error) {
        // Almacenamiento bloqueado: se usa el tema oscuro por defecto.
    }
    document.documentElement.setAttribute('data-theme', temaGuardado);
})();
