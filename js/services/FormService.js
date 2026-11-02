import { AppUtils } from "../utils/AppUtils.js";

export class FormService {
    static METODO_PAGO_TARJETA_CREDITO = 'tarjeta-credito';
    static METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta-credito'];
    static MIN_CUOTAS = 2;
    static MAX_CUOTAS = 36;
    static DIA_CIERRE_TARJETA = 24;

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

        const monto = this.parsearMonto(datos.monto);

        return {
            valido: errores.length === 0,
            errores,
            monto: monto === null ? null : AppUtils.redondearMonto(monto)
        };
    }

    static parsearFecha(fecha) {
        const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
        if (!coincidencia) return null;

        const [, anio, mes, dia] = coincidencia;
        const fechaParseada = new Date(Number(anio), Number(mes) - 1, Number(dia));
        return Number.isNaN(fechaParseada.getTime()) ? null : fechaParseada;
    }

    static esTarjetaCredito(metodoPago) {
        const metodo = String(metodoPago || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[_\s]+/g, '-');

        return metodo.includes('tarjeta') && metodo.includes('credito');
    }

    static formatearFecha(fecha) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        return `${anio}-${mes}-${dia}`;
    }

    static sumarMeses(fecha, meses) {
        const base = fecha instanceof Date ? fecha : this.parsearFecha(fecha);
        if (!base || Number.isNaN(base.getTime())) return null;

        const diaOriginal = base.getDate();
        const destino = new Date(base.getFullYear(), base.getMonth() + Number(meses || 0), 1);
        const ultimoDiaDestino = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
        destino.setDate(Math.min(diaOriginal, ultimoDiaDestino));
        return destino;
    }

    // Un gasto de tarjeta de crédito comprado después del cierre (día 24 por
    // defecto) se imputa al mes siguiente. El check manual "post-cierre"
    // sigue funcionando como override explícito.
    static requiereDesplazamientoCierre(fecha, metodoPago, postCierre = false) {
        if (postCierre) return true;

        const base = fecha instanceof Date ? fecha : this.parsearFecha(fecha);
        if (!base || Number.isNaN(base.getTime())) return false;

        return this.esTarjetaCredito(metodoPago) && base.getDate() > this.DIA_CIERRE_TARJETA;
    }

    static calcularMesImputacion({ fecha, metodoPago, postCierre = false } = {}) {
        const base = fecha instanceof Date ? fecha : this.parsearFecha(fecha);
        if (!base || Number.isNaN(base.getTime())) return '';

        const fechaImputada = this.requiereDesplazamientoCierre(base, metodoPago, postCierre)
            ? this.sumarMeses(base, 1)
            : base;

        return this.formatearFecha(fechaImputada).slice(0, 7);
    }

    static calcularFechasCuotas(fechaBase, cantidadCuotas, postCierre = false) {
        const base = this.parsearFecha(fechaBase);
        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);
        if (!base || cuotas === null || cuotas < 1) return [];

        return Array.from({ length: cuotas }, (_, indice) => {
            const desplazamiento = (postCierre ? 1 : 0) + indice;
            const fechaCuota = this.sumarMeses(base, desplazamiento);
            return fechaCuota ? this.formatearFecha(fechaCuota) : '';
        }).filter(Boolean);
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
        referencia = '',
        postCierre = false,
        usarFondo
    }) {
        const montoNumerico = this.parsearMonto(monto);
        if (montoNumerico === null) return null;

        const metodoNormalizado = String(metodoPago || '').trim().toLowerCase();
        const mesImputacion = this.calcularMesImputacion({ fecha, metodoPago: metodoNormalizado, postCierre });

        return {
            fecha,
            monto: AppUtils.redondearMonto(montoNumerico),
            categoria: String(categoria || '').trim(),
            detalle_inventario: Array.isArray(inventario)
                ? inventario.map(item => ({ ...item }))
                : [],
            responsable,
            metodo_pago: metodoNormalizado,
            tipo,
            referencia: String(referencia ?? '').trim(),
            ...(mesImputacion ? { mes_imputacion: mesImputacion } : {}),
            ...(typeof usarFondo === 'boolean' ? { usar_fondo: usarFondo } : {})
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
        compraId,
        usarFondo
    }) {
        const total = this.parsearMonto(montoTotal);
        const cuotas = this.normalizarCantidadCuotas(cantidadCuotas);

        if (total === null || total <= 0 || cuotas === null ||
            cuotas < this.MIN_CUOTAS || cuotas > this.MAX_CUOTAS) {
            return [];
        }

        const desplazaCierre = this.requiereDesplazamientoCierre(fecha, metodoPago, postCierre);
        const fechas = this.calcularFechasCuotas(fecha, cuotas, desplazaCierre);
        if (fechas.length !== cuotas) return [];

        const camposFondo = typeof usarFondo === 'boolean' ? { usar_fondo: usarFondo } : {};
        const totalRedondeado = AppUtils.redondearMonto(total);
        const montosCuotas = AppUtils.distribuirEnCuotas(totalRedondeado, cuotas);
        const referenciaLimpia = String(referencia ?? '').trim();
        const prefijoReferencia = referenciaLimpia ? `${referenciaLimpia} ` : '';
        const totalFormateado = totalRedondeado.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        return fechas.map((fechaCuota, indice) => {
            const numeroCuota = indice + 1;
            return {
                fecha: fechaCuota,
                monto: montosCuotas[indice],
                categoria: String(categoria || '').trim(),
                detalle_inventario: [],
                responsable,
                metodo_pago: String(metodoPago || '').trim().toLowerCase(),
                tipo,
                mes_imputacion: fechaCuota.slice(0, 7),
                referencia: `${prefijoReferencia}(Cuota ${numeroCuota} de ${cuotas}) - Total: $${totalFormateado}`,
                es_cuota: true,
                compra_id: compraId,
                ...camposFondo
            };
        });
    }
}
