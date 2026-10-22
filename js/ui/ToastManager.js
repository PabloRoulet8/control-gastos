export class ToastManager {
    constructor(containerId = 'toast-container') {
        this.toast = document.getElementById(containerId);
        this.timer = null;
    }

    /**
     * Muestra un toast.
     * Soporta dos firmas para no romper los llamados existentes:
     *   mostrar(mensaje)                       -> 3000ms, estilo por defecto
     *   mostrar(mensaje, 4000)                 -> 4000ms, estilo por defecto
     *   mostrar(mensaje, 'info')               -> 3000ms, estilo info
     *   mostrar(mensaje, 'error', 5000)        -> 5000ms, estilo error
     * @param {string} mensaje
     * @param {...(number|string)} opciones  Duración en ms y/o tipo ('info' | 'success' | 'error')
     */
    mostrar(mensaje, ...opciones) {
        let duracion = 3000;
        let tipo = 'default';

        for (const opcion of opciones) {
            if (typeof opcion === 'number') duracion = opcion;
            else if (typeof opcion === 'string') tipo = opcion;
        }

        if (!this.toast) {
            alert(mensaje); // Respaldo por si falla el HTML
            return;
        }

        this.toast.textContent = mensaje;
        this.toast.classList.remove('toast-info', 'toast-success', 'toast-error');
        if (tipo && tipo !== 'default') {
            this.toast.classList.add(`toast-${tipo}`);
        }
        this.toast.classList.add('show');

        // Limpiamos el timer anterior para que un toast nuevo no se corte antes de tiempo
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.toast.classList.remove('show');
            this.timer = null;
        }, duracion);
    }
}
