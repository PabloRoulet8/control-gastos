export class FormService {
    static METODO_PAGO_TARJETA_CREDITO = 'tarjeta-credito';
    static METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta-credito'];
    static MIN_CUOTAS = 2;
    static MAX_CUOTAS = 36;

    static parsearMonto(valor) {
        if (typeof valor === 'number') {
            return Number.isFinite(valor) ? valor : null;
        }
        const numero = parseFloat(String(valor ?? '').trim());
        return Number.isFinite(numero) ? numero : null;
    }

    static normalizarCantidadCuotas(valor) {
        if (valor === '' || valor === null || valor === undefined) return null;
        const cuotas = Number(valor);
        return Number.isInteger(cuotas) ? cuotas : null;
    }

    static admiteCuotas(metodoPago) {
        return String(metodoPago || '').trim().toLowerCase() === this.METODO_PAGO_TARJETA_CREDITO;
    }

    static esPagoEnCuotas({ metodoPago, esCuotas, cantidadCuotas } = {}) {
        if (!esCuotas || !this.admiteCuotas(metodoPago)) return false;
        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);
        return cuotas !== null && cuotas >= this.MIN_CUOTAS && cuotas <= this.MAX_CUOTAS;
    }

    static validarMonto(valor) {
        const monto = this.parsearMonto(valor);
        if (monto === null || monto <= 0) {
            return ['Ingresá un monto válido mayor a 0.'];
        }
        return [];
    }

    static validarCategoria(categoria, valorCategoria = categoria) {
        if (!String(categoria || '').trim() || !String(valorCategoria || '').trim()) {
            return ['Seleccioná una categoría.'];
        }
        return [];
    }

    static validarMetodoPago(metodoPago) {
        const metodo = String(metodoPago || '').trim().toLowerCase();
        if (!this.METODOS_PAGO_VALIDOS.includes(metodo)) {
            return ['Seleccioná un método de pago válido.'];
        }
        return [];
    }

    static validarCuotas({ metodoPago, esCuotas, cantidadCuotas } = {}) {
        if (!esCuotas || !this.admiteCuotas(metodoPago)) return [];

        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);
        if (cuotas === null || cuotas < this.MIN_CUOTAS || cuotas > this.MAX_CUOTAS) {
            return [`La cantidad de cuotas debe ser un número entre ${this.MIN_CUOTAS} y ${this.MAX_CUOTAS}.`];
        }
        return [];
    }

    static validarFormulario(datos = {}) {
        const errores = [
            ...this.validarMonto(datos.monto),
            ...this.validarCategoria(datos.categoria, datos.categoriaValor),
            ...this.validarMetodoPago(datos.metodoPago),
            ...this.validarCuotas(datos)
        ];

        return {
            valido: errores.length === 0,
            errores,
            monto: this.parsearMonto(datos.monto)
        };
    }

    static parsearFecha(fecha) {
        const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
        if (!coincidencia) return null;

        const [, anio, mes, dia] = coincidencia;
        const fechaParseada = new Date(Number(anio), Number(mes) - 1, Number(dia));
        return Number.isNaN(fechaParseada.getTime()) ? null : fechaParseada;
    }

    static formatearFecha(fecha) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        return `${anio}-${mes}-${dia}`;
    }

    static calcularFechasCuotas(fechaBase, cantidadCuotas, postCierre = false) {
        const base = this.parsearFecha(fechaBase);
        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);
        if (!base || cuotas === null || cuotas < 1) return [];

        return Array.from({ length: cuotas }, (_, indice) => {
            const desplazamiento = (postCierre ? 1 : 0) + indice;
            const fechaCuota = new Date(
                base.getFullYear(),
                base.getMonth() + desplazamiento,
                base.getDate()
            );
            return this.formatearFecha(fechaCuota);
        });
    }

    static escaparHTML(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    static determinarTipo(ambito) {
        return ambito === 'hogar' ? 'general' : 'individual';
    }

    static construirContexto(ambito, hogarId) {
        return ambito === 'hogar'
            ? { tipo: 'hogar', id: hogarId }
            : { tipo: 'personal' };
    }

    static esCategoriaVariable({ esFijo = false, llevaStock = false } = {}) {
        return !esFijo && !llevaStock;
    }

    static construirGasto({
        fecha,
        monto,
        categoria,
        inventario = [],
        responsable,
        metodoPago,
        tipo,
        referencia = ''
    }) {
        const montoNumerico = this.parsearMonto(monto);
        if (montoNumerico === null) return null;

        return {
            fecha,
            monto: montoNumerico,
            categoria: String(categoria || '').trim(),
            detalle_inventario: Array.isArray(inventario)
                ? inventario.map(item => ({ ...item }))
                : [],
            responsable,
            metodo_pago: String(metodoPago || '').trim().toLowerCase(),
            tipo,
            referencia: this.escaparHTML(referencia)
        };
    }

    static construirGastosEnCuotas({
        fecha,
        montoTotal,
        categoria,
        responsable,
        metodoPago,
        tipo,
        referencia = '',
        cantidadCuotas,
        postCierre = false,
        compraId
    }) {
        const total = this.parsearMonto(montoTotal);
        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);

        if (total === null || total <= 0 || cuotas === null ||
            cuotas < this.MIN_CUOTAS || cuotas > this.MAX_CUOTAS) {
            return [];
        }

        const fechas = this.calcularFechasCuotas(fecha, cuotas, postCierre);
        if (fechas.length !== cuotas) return [];

        const montoCuota = total / cuotas;
        const referenciaSegura = this.escaparHTML(referencia);
        const totalFormateado = total.toLocaleString('es-AR');

        return fechas.map((fechaCuota, indice) => {
            const numeroCuota = indice + 1;
            return {
                fecha: fechaCuota,
                monto: montoCuota,
                categoria: String(categoria || '').trim(),
                detalle_inventario: [],
                responsable,
                metodo_pago: String(metodoPago || '').trim().toLowerCase(),
                tipo,
                referencia: `${referenciaSegura} (Cuota ${numeroCuota} de ${cuotas}) - Total: $${totalFormateado}`,
                es_cuota: true,
                compra_id: compraId
            };
        });
    }
}
