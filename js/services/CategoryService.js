export class CategoryService {
    static CATEGORIAS_ESTANDAR = [
        'Supermercado', 'Carnicería', 'Fiambrería', 'Verdulería', 'Panadería',
        'Farmacia', 'Hogar', 'Transporte', 'Salidas', 'Delivery', 'Otros'
    ];

    static obtenerCategoriasEstandar() {
        return this.CATEGORIAS_ESTANDAR.map(nombre => ({
            nombre,
            lleva_stock: false,
            es_fijo: false
        }));
    }

    static normalizarTexto(texto) {
        return (texto || '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    static normalizarValorCategoria(nombre) {
        return this.normalizarTexto(nombre);
    }

    static normalizarCategoria(categoria) {
        const base = (typeof categoria === 'string')
            ? { nombre: categoria, lleva_stock: false, es_fijo: false }
            : { ...categoria };

        const nombre = String(base?.nombre ?? '').trim();
        if (!nombre) return null;

        return {
            ...base,
            nombre,
            lleva_stock: Boolean(base?.lleva_stock),
            es_fijo: Boolean(base?.es_fijo),
            valor: this.normalizarValorCategoria(nombre)
        };
    }

    static prepararCategorias(categorias) {
        const lista = Array.isArray(categorias) ? categorias : [];

        return lista
            .map(categoria => this.normalizarCategoria(categoria))
            .filter(categoria => categoria && categoria.activa !== false)
            .sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
    }

    static obtenerCategoriasParaAmbito(ambito, { personales = [], hogar = [] } = {}) {
        const origen = ambito === 'hogar' ? hogar : personales;
        const categorias = Array.isArray(origen) ? origen : [];

        return categorias.length > 0
            ? categorias
            : this.obtenerCategoriasEstandar();
    }

    static buscarCategoria(nombreBuscado, categoriasDisponibles) {
        const disponibles = this.prepararCategorias(categoriasDisponibles);
        const objetivo = this.normalizarTexto(nombreBuscado);

        if (!objetivo || disponibles.length === 0) return null;

        // 1) Coincidencia exacta contra el valor normalizado o el nombre visible
        let encontrada = disponibles.find(categoria =>
            this.normalizarTexto(categoria.valor) === objetivo ||
            this.normalizarTexto(categoria.nombre) === objetivo
        );
        if (encontrada) return encontrada;

        // 2) El nombre de la categoría está contenido en la respuesta (o al revés)
        encontrada = disponibles.find(categoria => {
            const valor = this.normalizarTexto(categoria.valor);
            const nombre = this.normalizarTexto(categoria.nombre);

            return objetivo.includes(valor) || objetivo.includes(nombre) ||
                   valor.includes(objetivo) || nombre.includes(objetivo);
        });
        if (encontrada) return encontrada;

        // 3) Coincidencia por palabras compartidas
        const palabras = objetivo.split(/[\s,._-]+/).filter(palabra => palabra.length > 3);
        if (palabras.length > 0) {
            encontrada = disponibles.find(categoria => {
                const tokens = new Set(
                    this.normalizarTexto(`${categoria.valor} ${categoria.nombre}`)
                        .split(/[\s,._-]+/)
                );
                return palabras.some(palabra => tokens.has(palabra));
            });
            if (encontrada) return encontrada;
        }

        return null;
    }
}
