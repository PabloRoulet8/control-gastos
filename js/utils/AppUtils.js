/**
 * Cerebro de Utilidades - Centraliza lógica repetitiva para evitar Deuda Técnica
 */
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
    escapeHTML: (str) => {
        if (!str) return "";
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
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