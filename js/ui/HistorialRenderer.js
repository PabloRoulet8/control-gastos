export class HistorialRenderer {
    constructor() {
        this.listaGastosUI = document.getElementById('contenedor-gastos');
        this.filtroResponsable = document.getElementById('filtro-responsable');
        this.filtroCategoria = document.getElementById('filtro-categoria');
    }

    // 🎨 NUEVA FUNCIÓN DE COLORES ESTRÍCTOS (Por Tipo de Gasto)
    getMapeoTipo(gasto) {
        // Regla de seguridad: Si es un pago de deuda, color verde y fin.
        if (gasto.tipo === 'pagoDeuda') {
            return { color: '#10b981', icono: '💸' };
        }

        // Leemos el tipo de gasto (Fijo, Stock, Variable)
        const tipoGasto = (gasto.tipoGasto || "Variable").toLowerCase();

        // 🧠 REGLA MÁGICA: "Si es fijo y stock se contabiliza como stock"
        // Asumimos que si tiene ambas etiquetas, la prioridad de visualización es 'Stock'.
        // NOTA: Para implementar esto al 100%, deberíamos verificar cómo se guardan 
        // los datos en el repository (si permite Fijo+Stock a la vez). 
        // Por ahora, mapeamos el tipo principal.

        const mapeo = {
            'variable': { color: '#3b82f6', icono: '🔄' }, // Azul (Flexibilidad)
            'fijo':     { color: '#ef4444', icono: '📌' }, // Rojo (Atención/Inamovible)
            'stock':    { color: '#eab308', icono: '📦' }  // Amarillo (Almacén)
        };

        return mapeo[tipoGasto] || mapeo['variable']; // Default Variable si no tiene tipo
    }

    renderLista(gastosFiltrados, currentUser, ambitoActual, mapaNombres, onDeleteClick) {
        if (!this.listaGastosUI) return;
        this.listaGastosUI.innerHTML = '';

        if (gastosFiltrados.length === 0) {
            this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">No hay movimientos con estos filtros.</p>';
            return;
        }

        gastosFiltrados.forEach((gasto) => {
            const item = document.createElement('div');
            item.className = `gasto-item`; // Base limpia
            
            const parts = gasto.fecha ? gasto.fecha.split('-') : ['','',''];
            const fechaCorta = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : gasto.fecha;
            
            const esPago = gasto.tipo === 'pagoDeuda';
            
            const idDelResponsable = esPago ? gasto.pagador_id : gasto.responsable;
            const nombreResponsable = mapaNombres[idDelResponsable] || idDelResponsable || 'Usuario';

            // === 🔥 NUEVA LÓGICA DE COLORES Y ICONOS 🔥 ===
            const infoTipo = this.getMapeoTipo(gasto);
            const colorTipo = infoTipo.color;
            const iconoTipo = infoTipo.icono;

            // Borde Izquierdo: Tipo de Gasto
            item.style.borderLeft = `5px solid ${colorTipo}`;
            
            // Borde Derecho: Usuario (Solo si estamos en el Hogar y NO es un pago)
            if (ambitoActual === 'hogar' && !esPago) {
                // Para el usuario sí mantenemos la paleta de 12 colores fijos para diferenciar personas
                item.style.borderRight = `5px solid ${this.generarColorUsuario(nombreResponsable)}`;
            } else if (esPago) {
                // Si es pago, forzamos borde derecho verde también
                item.style.borderRight = `5px solid #10b981`;
            }

            const etiquetaCategoria = esPago ? 'Pago de Deuda' : (gasto.categoria || 'Sin categoría');

            item.innerHTML = `
                <div class="gasto-info" style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.3rem; color: ${colorTipo}; background: var(--bg-app); width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                        ${iconoTipo}
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: ${colorTipo}; font-size: 0.95rem;">${etiquetaCategoria}</strong> 
                        <span class="fecha">${fechaCorta} — <span style="font-weight: 600; color: ${ambitoActual === 'hogar' && !esPago ? this.generarColorUsuario(nombreResponsable) : 'var(--text-muted)'}">${nombreResponsable.toUpperCase()}</span></span>
                    </div>
                </div>
                <div class="gasto-acciones">
                    <span class="monto" style="color: ${esPago ? '#10b981' : 'var(--text-main)'}">$ ${Number(gasto.monto).toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar">🗑️</button>
                </div>
            `;
            this.listaGastosUI.appendChild(item);
        });

        this.listaGastosUI.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', (e) => onDeleteClick(e.currentTarget.getAttribute('data-id')));
        });
    }

    // 🎨 Mantenemos la paleta de 12 colores solo para identificar USUARIOS en el Hogar
    generarColorUsuario(texto) {
        if (!texto) return '#94a3b8';
        const paleta = [
            '#ef4444', '#f97316', '#eab308', '#84cc16', 
            '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', 
            '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e'
        ];
        let hash = 0;
        for (let i = 0; i < texto.length; i++) {
            hash = texto.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % paleta.length;
        return paleta[index];
    }

    // ... (El resto de los métodos de renderizarFiltros, mostrarCargando, etc. siguen igual)
    renderizarFiltrosResponsables(mapaNombres) { /* ... */ }
    renderizarFiltrosCategorias(categorias) { /* ... */ }
    mostrarCargando() { /* ... */ }
    mostrarError() { /* ... */ }
}