/**
 * Cerebro de Utilidades - Centraliza lógica repetitiva para evitar Deuda Técnica
 */

// Entidades que pudieron quedar persistidas por versiones anteriores de la app.
const ENTIDADES_HTML_BASICAS = /&(?:amp|lt|gt|quot|apos|#0*39|#x0*27);/gi;

export const AppUtils = {
    // 1. Capitalizar texto (Ej: "juan" -> "Juan")
    capitalizar: (str) => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // 2. Formateador de Moneda Argentino (Ej: 1500.5 -> $ 1.500,50)
    formatearARS: (monto) => {
        const n = Number(monto) || 0;
        return n.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    // 3. Sanitizador de HTML para evitar XSS (Crucial para la seguridad)
    // Escapa también comillas para que el valor sea seguro tanto en texto como en atributos.
    // Normaliza entidades antes de escapar: registros antiguos guardados con `&#39;`
    // o `&amp;` no deben terminar mostrando `&amp;#39;` (doble escape).
    escapeHTML: (str) => {
        if (!str) return "";
        return AppUtils.desescaparHTMLBasico(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Decodifica solo las entidades básicas que generaba la app. Se repite el
    // proceso para limpiar textos con más de un nivel de escape, sin tocar
    // caracteres sueltos como `&` o `<` escritos por el usuario.
    desescaparHTMLBasico: (str) => {
        if (str === null || str === undefined) return "";
        let texto = String(str);

        for (let intento = 0; intento < 3; intento += 1) {
            const siguiente = texto.replace(ENTIDADES_HTML_BASICAS, (entidad) => {
                switch (entidad.toLowerCase()) {
                    case '&amp;': return '&';
                    case '&lt;': return '<';
                    case '&gt;': return '>';
                    case '&quot;': return '"';
                    default: return "'";
                }
            });

            if (siguiente === texto) break;
            texto = siguiente;
        }

        return texto;
    },

    // 4. Manejador de Fechas (YYYY-MM-DD local)
    getFechaLocal: (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    aCentavos: (monto) => {
        const numero = Number(monto);
        return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
    },

    aPesos: (centavos) => {
        const numero = Number(centavos);
        return Number.isFinite(numero) ? Math.round(numero) / 100 : 0;
    },

    redondearMonto: (monto) => {
        const numero = Number(monto);
        return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
    },

    sumarMontos: (...montos) => {
        const totalCentavos = montos
            .flat(Infinity)
            .reduce((total, monto) => total + AppUtils.aCentavos(monto), 0);
        return AppUtils.aPesos(totalCentavos);
    },

    distribuirEnCuotas: (montoTotal, cantidadCuotas) => {
        const cuotas = Math.trunc(Number(cantidadCuotas));
        if (!Number.isInteger(cuotas) || cuotas <= 0) return [];

        const totalCentavos = AppUtils.aCentavos(montoTotal);
        const baseCentavos = Math.floor(totalCentavos / cuotas);
        const restoCentavos = totalCentavos % cuotas;

        return Array.from({ length: cuotas }, (_, indice) => (
            AppUtils.aPesos(baseCentavos + (indice < restoCentavos ? 1 : 0))
        ));
    }
};