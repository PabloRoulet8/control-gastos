export class ToastManager {
    constructor(containerId = 'toast-container') {
        this.toast = document.getElementById(containerId);
    }

    mostrar(mensaje, duracion = 3000) {
        if (this.toast) {
            this.toast.textContent = mensaje;
            this.toast.classList.add('show');
            setTimeout(() => { this.toast.classList.remove('show'); }, duracion);
        } else {
            alert(mensaje); // Respaldo por si falla el HTML
        }
    }
}