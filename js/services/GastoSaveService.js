import { AppUtils } from "../utils/AppUtils.js";
import { FormService } from "./FormService.js";

export class GastoSaveService {
    constructor({ repository } = {}) {
        if (!repository) {
            throw new Error('GastoSaveService requiere un repositorio.');
        }
        this.repository = repository;
    }

    async guardar({
        datosFormulario = {},
        contexto = {},
        userId,
        inventario = []
    } = {}) {
        const validacion = FormService.validarFormulario(datosFormulario);
        if (!validacion.valido) {
            return { guardado: false, errores: validacion.errores };
        }

        const {
            ambitoActual = 'personal',
            hogarId = null
        } = contexto;

        const tipo = FormService.determinarTipo(ambitoActual);
        const responsable = ambitoActual === 'hogar'
            ? datosFormulario.responsable
            : userId;
        const contextoGuardado = FormService.construirContexto(ambitoActual, hogarId);
        const fecha = AppUtils.getFechaLocal();
        const montoExacto = AppUtils.redondearMonto(validacion.monto);
        const usaCuotas = FormService.esPagoEnCuotas({
            metodoPago: datosFormulario.metodoPago,
            esCuotas: datosFormulario.esCuotas,
            cantidadCuotas: datosFormulario.cantidadCuotas
        });

        if (!usaCuotas) {
            const nuevoGasto = FormService.construirGasto({
                fecha,
                monto: montoExacto,
                categoria: datosFormulario.categoria,
                inventario,
                responsable,
                metodoPago: datosFormulario.metodoPago,
                tipo,
                referencia: datosFormulario.referencia
            });

            if (!nuevoGasto) {
                return { guardado: false, errores: ['No se pudo preparar el gasto.'] };
            }

            await this.repository.guardarGasto(nuevoGasto, contextoGuardado);
            return { guardado: true, usaCuotas: false };
        }

        const gastosCuota = FormService.construirGastosEnCuotas({
            fecha,
            montoTotal: montoExacto,
            categoria: datosFormulario.categoria,
            responsable,
            metodoPago: datosFormulario.metodoPago,
            tipo,
            referencia: datosFormulario.referencia,
            cantidadCuotas: datosFormulario.cantidadCuotas,
            postCierre: datosFormulario.postCierre,
            compraId: 'cuotas_' + Date.now()
        });

        if (gastosCuota.length === 0) {
            return { guardado: false, errores: ['No se pudieron preparar las cuotas.'] };
        }

        await this.repository.guardarGastosEnLote(gastosCuota, contextoGuardado);
        return { guardado: true, usaCuotas: true };
    }
}
