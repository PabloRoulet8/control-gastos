export class DraftService {
    static getBorradorKey(userId, ambito, hogarId) {
        const scope = ambito || 'personal';
        const hogar = hogarId || 'personal';
        return `borrador_v2_${userId}_${scope}_${hogar}`;
    }

    static guardarBorrador(userId, ambito, hogarId, datos) {
        try {
            if (!userId) return false;
            const key = this.getBorradorKey(userId, ambito, hogarId);
            const estado = {
                items: Array.isArray(datos?.items) ? datos.items : [],
                monto: datos?.monto ?? '',
                categoria: datos?.categoria ?? '',
                metodoPago: datos?.metodoPago ?? 'efectivo'
            };
            localStorage.setItem(key, JSON.stringify(estado));
            return true;
        } catch (error) {
            console.warn('No se pudo guardar el borrador:', error);
            return false;
        }
    }

    static cargarBorrador(userId, ambito, hogarId) {
        try {
            if (!userId) return null;
            const key = this.getBorradorKey(userId, ambito, hogarId);
            const guardado = localStorage.getItem(key);
            if (!guardado) return null;
            const estado = JSON.parse(guardado);
            return {
                items: Array.isArray(estado?.items) ? estado.items : [],
                monto: estado?.monto ?? '',
                categoria: estado?.categoria ?? '',
                metodoPago: estado?.metodoPago ?? 'efectivo'
            };
        } catch (error) {
            console.error('Error leyendo borrador:', error);
            return null;
        }
    }

    static limpiarBorrador(userId, ambito, hogarId) {
        try {
            if (!userId) return false;
            const key = this.getBorradorKey(userId, ambito, hogarId);
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('No se pudo limpiar el borrador:', error);
            return false;
        }
    }

    static limpiarBorradorLegacy() {
        try {
            localStorage.removeItem('borrador_stock');
        } catch (error) {
            console.warn('No se pudo limpiar borrador legacy:', error);
        }
    }
}
