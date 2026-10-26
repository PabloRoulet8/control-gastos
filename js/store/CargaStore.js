const ESTADO_INICIAL = {
    currentUserIdGlobal: null,
    ambitoActual: 'personal',
    hogarId: null,
    hogarNombre: null,
    arrayInventario: [],
    listaCategorias: []
};

export class CargaStore {
    static #instancia = null;

    #state;
    #listeners;

    constructor() {
        if (CargaStore.#instancia) {
            return CargaStore.#instancia;
        }

        this.#state = {
            ...ESTADO_INICIAL,
            arrayInventario: [],
            listaCategorias: []
        };
        this.#listeners = new Set();

        CargaStore.#instancia = this;
    }

    static getInstance() {
        if (!CargaStore.#instancia) {
            new CargaStore();
        }
        return CargaStore.#instancia;
    }

    getState() {
        return {
            ...this.#state,
            arrayInventario: this.#clonarLista(this.#state.arrayInventario),
            listaCategorias: this.#clonarLista(this.#state.listaCategorias)
        };
    }

    setContexto({ currentUserIdGlobal, ambitoActual, hogarId, hogarNombre } = {}) {
        const cambios = {};

        if (currentUserIdGlobal !== undefined && currentUserIdGlobal !== this.#state.currentUserIdGlobal) {
            cambios.currentUserIdGlobal = currentUserIdGlobal;
        }

        if (ambitoActual !== undefined) {
            const valor = ambitoActual || 'personal';
            if (valor !== this.#state.ambitoActual) {
                cambios.ambitoActual = valor;
            }
        }

        if (hogarId !== undefined && hogarId !== this.#state.hogarId) {
            cambios.hogarId = hogarId;
        }

        if (hogarNombre !== undefined && hogarNombre !== this.#state.hogarNombre) {
            cambios.hogarNombre = hogarNombre;
        }

        this.#aplicarCambios(cambios);
    }

    setUsuario(userId) {
        this.setContexto({ currentUserIdGlobal: userId });
    }

    setInventario(arrayInventario) {
        if (!Array.isArray(arrayInventario)) return;

        this.#aplicarCambios({
            arrayInventario: this.#clonarLista(arrayInventario)
        });
    }

    setCategorias(listaCategorias) {
        if (!Array.isArray(listaCategorias)) return;

        this.#aplicarCambios({
            listaCategorias: this.#clonarLista(listaCategorias)
        });
    }

    limpiarInventario() {
        if (this.#state.arrayInventario.length === 0) return;
        this.#aplicarCambios({ arrayInventario: [] });
    }

    reset() {
        const cambios = {};

        for (const clave of Object.keys(ESTADO_INICIAL)) {
            const valorInicial = ESTADO_INICIAL[clave];
            const valorActual = this.#state[clave];

            if (Array.isArray(valorInicial)) {
                if (valorActual.length !== 0) {
                    cambios[clave] = [];
                }
                continue;
            }

            if (valorActual !== valorInicial) {
                cambios[clave] = valorInicial;
            }
        }

        this.#aplicarCambios(cambios);
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }

        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    }

    #aplicarCambios(cambios) {
        const claves = Object.keys(cambios);
        if (claves.length === 0) return;

        const estadoAnterior = this.getState();
        this.#state = { ...this.#state, ...cambios };
        const estadoActual = this.getState();

        for (const listener of this.#listeners) {
            try {
                listener({
                    state: estadoActual,
                    previousState: estadoAnterior,
                    changed: claves
                });
            } catch (error) {
                console.error('[CargaStore] Error en suscriptor:', error);
            }
        }
    }

    #clonarLista(lista) {
        return lista.map(item => (
            item && typeof item === 'object' ? { ...item } : item
        ));
    }
}
