import { AppUtils } from "../utils/AppUtils.js";

export class InventarioService {
    static normalizarUnidadInventario(unidad) {
        const u = String(unidad || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return 'kg';
        if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'litro';
        if (['pack', 'paquete', 'paquetes'].includes(u)) return 'pack';
        return 'unid';
    }

    static normalizarNombreProducto(nombre) {
        const nombreLimpio = String(nombre || '').trim();
        if (!nombreLimpio) return '';
        return nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1);
    }

    static agregarItem(inventarioActual, nuevoItem) {
        const inventario = Array.isArray(inventarioActual) ? [...inventarioActual] : [];
        const nombre = String(nuevoItem?.producto || '').trim();
        const cant = parseFloat(nuevoItem?.cantidad);
        const precioNum = parseFloat(nuevoItem?.precio);

        if (!nombre || !Number.isFinite(cant) || cant <= 0) return inventario;

        const nombreLimpio = this.normalizarNombreProducto(nombre);
        const unidad = this.normalizarUnidadInventario(nuevoItem?.unidad);
        const precio = Number.isFinite(precioNum) ? AppUtils.redondearMonto(precioNum) : 0;

        const indiceExistente = inventario.findIndex(item => {
            if (!item) return false;
            const nombreExistente = String(item.producto || '').trim().toLowerCase();
            const unidadExistente = this.normalizarUnidadInventario(item.unidad);
            return nombreExistente === nombreLimpio.toLowerCase() && unidadExistente === unidad;
        });

        if (indiceExistente >= 0) {
            const itemExistente = { ...inventario[indiceExistente] };
            const cantidadExistente = parseFloat(itemExistente.cantidad) || 0;
            itemExistente.cantidad = cantidadExistente + cant;

            if (precio > 0) {
                itemExistente.precio = AppUtils.sumarMontos(itemExistente.precio, precio);
            }

            inventario[indiceExistente] = itemExistente;
            return inventario;
        }

        inventario.push({ producto: nombreLimpio, cantidad: cant, unidad, precio });
        return inventario;
    }

    static eliminarItem(inventarioActual, indice) {
        const inventario = Array.isArray(inventarioActual) ? [...inventarioActual] : [];
        const idx = Number(indice);
        if (!Number.isInteger(idx) || idx < 0 || idx >= inventario.length) return inventario;
        inventario.splice(idx, 1);
        return inventario;
    }

    static calcularTotal(inventarioActual) {
        const inventario = Array.isArray(inventarioActual) ? inventarioActual : [];
        return AppUtils.sumarMontos(inventario.map(item => item?.precio ?? 0));
    }
}
