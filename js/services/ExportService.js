import { AppUtils } from "../utils/AppUtils.js";

const COLUMNAS = ['Fecha', 'Categoría', 'Monto', 'Método de Pago', 'Responsable', 'Referencia/Detalle'];

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
        const filas = [...gastos]
            .sort((a, b) => String(a?.fecha || '').localeCompare(String(b?.fecha || '')))
            .map(gasto => [
                this.formatearFecha(gasto?.fecha),
                gasto?.categoria,
                this.formatearMonto(gasto?.monto),
                gasto?.metodo_pago,
                this.obtenerResponsable(gasto?.responsable, nombresResponsables),
                gasto?.referencia
            ].map(valor => this.escaparCelda(valor)).join(';'));

        // El BOM permite que Excel reconozca el archivo como UTF-8 y respete las tildes.
        return `\uFEFF${[COLUMNAS.join(';'), ...filas].join('\r\n')}`;
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
