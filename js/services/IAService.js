export class IAService {
    static async procesarTexto({ texto, categoriasDisponibles = [], signal, auth, apiUrl } = {}) {
        const usuarioActual = auth?.currentUser;

        if (!usuarioActual) {
            throw new Error('Sesión no válida. Iniciá sesión nuevamente.');
        }

        const idToken = await usuarioActual.getIdToken();

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
            signal
        });

        if (!respuesta.ok) {
            const detalle = await respuesta.json().catch(() => null);
            throw new Error(detalle?.error || `El servidor de IA respondió ${respuesta.status}`);
        }

        return respuesta.json();
    }
}
