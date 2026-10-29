export class IAService {
    static URL_BACKEND = 'https://control-gastos-backend-o6nv.onrender.com/';
    static WAKEUP_STORAGE_KEY = 'ia_wakeup_ultimo_intento';
    static WAKEUP_INTERVALO_MS = 10 * 60 * 1000;
    static WAKEUP_TIMEOUT_MS = 8000;

    static obtenerSessionStorage() {
        try {
            return typeof window !== 'undefined' ? window.sessionStorage : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Despierta el backend de IA alojado en Render para mitigar el cold start.
     * Es silencioso, no bloqueante y se ejecuta como máximo una vez cada 10 minutos
     * por sesión de navegador. Nunca lanza errores.
     * @returns {Promise<boolean>} `true` si se intentó el ping y respondió.
     */
    static async despertarServidor({
        url = IAService.URL_BACKEND,
        timeoutMs = IAService.WAKEUP_TIMEOUT_MS,
        intervaloMs = IAService.WAKEUP_INTERVALO_MS,
        storage = IAService.obtenerSessionStorage()
    } = {}) {
        if (!url) return false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

        try {
            const ahora = Date.now();
            const ultimoIntento = Number(storage?.getItem(IAService.WAKEUP_STORAGE_KEY)) || 0;
            if (ahora - ultimoIntento < intervaloMs) return false;
            storage?.setItem(IAService.WAKEUP_STORAGE_KEY, String(ahora));
        } catch (error) {
            // sessionStorage puede estar bloqueado (modo privado, políticas del navegador).
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const respuesta = await fetch(url, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal
            });

            return respuesta.type === 'opaque' ? true : respuesta.ok;
        } catch (error) {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    static async procesarTexto({
        texto,
        categoriasDisponibles = [],
        signal,
        auth,
        apiUrl,
        timeoutMs = 45000
    } = {}) {
        const usuarioActual = auth?.currentUser;

        if (!usuarioActual) {
            throw new Error('Sesión no válida. Iniciá sesión nuevamente.');
        }

        const idToken = await usuarioActual.getIdToken();
        const controller = new AbortController();
        let agotoTiempo = false;
        const abortarPorSenal = () => controller.abort(signal?.reason);
        const timeoutId = setTimeout(() => {
            agotoTiempo = true;
            controller.abort();
        }, timeoutMs);

        if (signal) {
            if (signal.aborted) {
                controller.abort(signal.reason);
            } else {
                signal.addEventListener('abort', abortarPorSenal, { once: true });
            }
        }

        try {
            const respuesta = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    texto,
                    categorias: Array.isArray(categoriasDisponibles) ? categoriasDisponibles : []
                }),
                signal: controller.signal
            });

            if (!respuesta.ok) {
                const detalle = await respuesta.json().catch(() => null);
                const error = new Error(detalle?.error || `El servidor de IA respondió ${respuesta.status}`);
                error.status = respuesta.status;
                throw error;
            }

            return respuesta.json();
        } catch (error) {
            if (agotoTiempo) {
                const errorTimeout = new Error('La IA tardó demasiado en responder.');
                errorTimeout.name = 'TimeoutError';
                throw errorTimeout;
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
            if (signal) {
                signal.removeEventListener('abort', abortarPorSenal);
            }
        }
    }

    static obtenerMensajeError(error) {
        if (error?.status === 429) {
            return 'Demasiadas solicitudes a la IA. Esperá unos segundos e intentá de nuevo.';
        }

        if (error?.status >= 500) {
            return 'La IA no está disponible en este momento. Intentá de nuevo.';
        }

        if (error?.name === 'TimeoutError') {
            return 'La IA tardó demasiado en responder. Intentá de nuevo.';
        }

        if (error?.name === 'AbortError') {
            return 'La interpretación fue cancelada.';
        }

        if (error instanceof TypeError) {
            return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
        }

        return error?.message || 'No se pudo procesar el gasto con IA.';
    }
}
