export class IAService {
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
