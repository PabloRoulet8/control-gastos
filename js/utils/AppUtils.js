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
    }
};