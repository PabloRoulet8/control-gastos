import { AppUtils } from "../utils/AppUtils.js";

const COLUMNAS = ['Fecha', 'Categoría', 'Monto', 'Método de Pago', 'Responsable', 'Referencia/Detalle'];
const ENCABEZADO_RESUMEN = '---;RESUMEN DEL MES;---;---;---;---';
const CATEGORIAS_COMESTIBLES = ['supermercado', 'carniceria', 'verduleria', 'panaderia'];
const CATEGORIAS_FIJAS = ['alquiler', 'expensas', 'despensa', 'luz', 'agua', 'gas', 'internet', 'seguro'];

/**
 * Genera archivos CSV localmente a partir de datos ya cargados en memoria.
 * No realiza consultas a Firebase ni a ningún servicio externo.
 */
export class ExportService {

    /**
     * Exporta un listado de gastos como archivo CSV.
     * @param {Array<Object>} gastos Gastos del mes que se está visualizando.
     * @param {string} mes Mes en formato YYYY-MM para nombrar el archivo.
     * @param {Object<string, string>} nombresResponsables Mapa uid -> nombre.
     */
    static exportarCSV(gastos = [], mes = '', nombresResponsables = {}) {
        const lista = Array.isArray(gastos) ? gastos : [];
        const contenido = this.construirCSV(lista, nombresResponsables);
        const nombreArchivo = this.obtenerNombreArchivo(mes);

        this.descargar(contenido, nombreArchivo);

        return { cantidad: lista.length, nombreArchivo };
    }

    static construirCSV(gastos = [], nombresResponsables = {}) {
        const lista = [...gastos]
            .sort((a, b) => String(a?.fecha || '').localeCompare(String(b?.fecha || '')));

        const filas = lista.map(gasto => [
            this.formatearFecha(gasto?.fecha),
            gasto?.categoria,
            this.formatearMonto(gasto?.monto),
            gasto?.metodo_pago,
            this.obtenerResponsable(gasto?.responsable, nombresResponsables),
            gasto?.referencia
        ].map(valor => this.escaparCelda(valor)).join(';'));

        const filasResumen = this.construirResumen(lista);

        // La línea vacía separa el listado de movimientos del bloque de balance.
        // El BOM permite que Excel reconozca el archivo como UTF-8 y respete las tildes.
        return `\uFEFF${[
            COLUMNAS.join(';'),
            ...filas,
            '',
            ENCABEZADO_RESUMEN,
            ...filasResumen
        ].join('\r\n')}`;
    }

    /**
     * Calcula el balance del mes y los subtotales de comestibles y gastos fijos.
     * @param {Array<Object>} gastos Movimientos ya ordenados del período.
     * @returns {Array<string>} Filas CSV listas para insertar.
     */
    static construirResumen(gastos = []) {
        const lista = Array.isArray(gastos) ? gastos : [];
        const esGasto = gasto => {
            const tipo = String(gasto?.tipo || '').trim();
            if (tipo === 'gasto') return true;
            return tipo !== 'ingreso' && tipo !== 'pagoDeuda' && gasto?.categoria !== 'Pago de Deuda';
        };

        const gastosValidos = lista.filter(esGasto);
        const totalIngresos = AppUtils.sumarMontos(
            lista.filter(gasto => gasto?.tipo === 'ingreso').map(gasto => gasto?.monto)
        );
        const totalGastos = AppUtils.sumarMontos(gastosValidos.map(gasto => gasto?.monto));
        const saldo = AppUtils.aPesos(AppUtils.aCentavos(totalIngresos) - AppUtils.aCentavos(totalGastos));

        const gastosFondoComun = AppUtils.sumarMontos(
            gastosValidos.filter(gasto => gasto?.usar_fondo === true).map(gasto => gasto?.monto)
        );

        const sumarPorCategorias = categorias => AppUtils.sumarMontos(
            gastosValidos
                .filter(gasto => categorias.includes(this.normalizarCategoria(gasto?.categoria)))
                .map(gasto => gasto?.monto)
        );

        const subtotalComestibles = sumarPorCategorias(CATEGORIAS_COMESTIBLES);
        const subtotalFijos = sumarPorCategorias(CATEGORIAS_FIJAS);

        const etiquetaSaldo = saldo > 0 ? '(Sobrante)' : (saldo < 0 ? '(Faltante)' : '');

        return [
            this.filaResumen('Total Ingresos', totalIngresos),
            this.filaResumen('Total Gastos', totalGastos),
            this.filaResumen('Saldo del Mes', saldo, etiquetaSaldo),
            this.filaResumen('Gastos Fondo Común', gastosFondoComun),
            this.filaResumen('Subtotal Comestibles', subtotalComestibles),
            this.filaResumen('Subtotal Gastos Fijos', subtotalFijos)
        ];
    }

    static filaResumen(etiqueta, monto, etiquetaExtra = '') {
        const valor = `${this.formatearMonto(monto)}${etiquetaExtra ? ` ${etiquetaExtra}` : ''}`;

        return [etiqueta, '', valor, '', '', '']
            .map(celda => this.escaparCelda(celda))
            .join(';');
    }

    static normalizarCategoria(categoria) {
        return String(categoria || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    static obtenerNombreArchivo(mes = '') {
        const coincidencia = /^(\d{4})-(\d{2})$/.exec(String(mes || '').trim());
        const hoy = new Date();
        const anio = coincidencia ? coincidencia[1] : String(hoy.getFullYear());
        const numeroMes = coincidencia ? coincidencia[2] : String(hoy.getMonth() + 1).padStart(2, '0');

        return `gastos-${numeroMes}-${anio}.csv`;
    }

    static formatearFecha(fecha) {
        const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || '').trim());
        if (!coincidencia) return String(fecha || '').trim();

        const [, anio, mes, dia] = coincidencia;
        return `${dia}/${mes}/${anio}`;
    }

    static formatearMonto(monto) {
        return AppUtils.redondearMonto(monto).toFixed(2).replace('.', ',');
    }

    static obtenerResponsable(responsable, nombresResponsables = {}) {
        const identificador = String(responsable || '').trim();
        if (!identificador) return '';
        return nombresResponsables[identificador] || identificador;
    }

    static escaparCelda(valor) {
        const texto = valor === null || valor === undefined ? '' : String(valor);

        if (/[;"\r\n]/.test(texto)) {
            return `"${texto.replace(/"/g, '""')}"`;
        }

        return texto;
    }

    static descargar(contenido, nombreArchivo) {
        const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.style.display = 'none';

        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
