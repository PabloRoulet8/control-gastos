import { auth } from "../firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_TIMEOUT_NOTICE_KEY = 'session_timeout_notice';
export const SESSION_TIMEOUT_MESSAGE = 'Sesión cerrada por inactividad';

const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'touchstart', 'scroll'];
const ACTIVITY_THROTTLE_MS = 10 * 1000;
const INACTIVITY_CHECK_MS = 30 * 1000;
const LOGIN_URL = 'login.html';

/**
 * Gestión de sesión por inactividad (OWASP A01: Broken Access Control).
 *
 * Mantiene un timestamp de la última actividad real del usuario y lo compara
 * contra un umbral estricto. Los eventos se procesan con throttle para evitar
 * saturar el hilo principal del navegador.
 */
export class SessionManager {
    static #instancia = null;

    #timeoutMs;
    #throttleMs;
    #chequeoMs;
    #ultimaActividad = 0;
    #ultimoEventoProcesado = 0;
    #intervaloChequeo = null;
    #activo = false;
    #cerrandoPorInactividad = false;

    constructor({
        timeoutMs = SESSION_TIMEOUT_MS,
        throttleMs = ACTIVITY_THROTTLE_MS,
        chequeoMs = INACTIVITY_CHECK_MS
    } = {}) {
        // Singleton estricto: cualquier intento de instanciar devuelve la
        // instancia existente para no duplicar listeners globales.
        if (SessionManager.#instancia) {
            return SessionManager.#instancia;
        }

        this.#timeoutMs = timeoutMs;
        this.#throttleMs = throttleMs;
        this.#chequeoMs = chequeoMs;
        SessionManager.#instancia = this;
    }

    static getInstance(opciones = {}) {
        if (!SessionManager.#instancia) {
            new SessionManager(opciones);
        }

        return SessionManager.#instancia;
    }

    start() {
        if (this.#activo) return;

        this.#activo = true;
        this.#cerrandoPorInactividad = false;
        this.#ultimaActividad = Date.now();
        this.#ultimoEventoProcesado = 0;

        EVENTOS_ACTIVIDAD.forEach(evento => {
            window.addEventListener(evento, this.#registrarActividad, { passive: true });
        });
        document.addEventListener('visibilitychange', this.#manejarVisibilidad);

        this.#intervaloChequeo = window.setInterval(
            this.#verificarInactividad,
            this.#chequeoMs
        );
    }

    stop() {
        if (!this.#activo) return;

        this.#activo = false;

        EVENTOS_ACTIVIDAD.forEach(evento => {
            window.removeEventListener(evento, this.#registrarActividad);
        });
        document.removeEventListener('visibilitychange', this.#manejarVisibilidad);

        if (this.#intervaloChequeo !== null) {
            window.clearInterval(this.#intervaloChequeo);
            this.#intervaloChequeo = null;
        }
    }

    get activo() {
        return this.#activo;
    }

    #registrarActividad = () => {
        if (!this.#activo || this.#cerrandoPorInactividad) return;

        const ahora = Date.now();
        if (ahora - this.#ultimoEventoProcesado < this.#throttleMs) return;

        this.#ultimoEventoProcesado = ahora;
        this.#ultimaActividad = ahora;
    };

    #verificarInactividad = () => {
        if (!this.#activo || this.#cerrandoPorInactividad) return;

        if (Date.now() - this.#ultimaActividad < this.#timeoutMs) return;

        this.#cerrarPorInactividad();
    };

    #manejarVisibilidad = () => {
        // Al volver a la pestaña verificamos de inmediato: el tiempo en segundo
        // plano también cuenta como inactividad.
        if (document.visibilityState === 'visible') {
            this.#verificarInactividad();
        }
    };

    async #cerrarPorInactividad() {
        if (this.#cerrandoPorInactividad) return;

        this.#cerrandoPorInactividad = true;
        this.stop();

        try {
            sessionStorage.setItem(SESSION_TIMEOUT_NOTICE_KEY, '1');
        } catch (error) {
            // sessionStorage puede estar bloqueado (modo privado o políticas del navegador).
        }

        try {
            await signOut(auth);
        } catch (error) {
            console.error('No se pudo cerrar la sesión por inactividad:', error);
        }

        if (!window.location.pathname.includes('login.html')) {
            window.location.replace(LOGIN_URL);
        }
    }
}
