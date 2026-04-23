export class HistorialRenderer {
    constructor() {
        this.listaGastosUI = document.getElementById('contenedor-gastos');
        this.filtroResponsable = document.getElementById('filtro-responsable');
        this.filtroCategoria = document.getElementById('filtro-categoria');
    }

    // 🎨 FUNCIÓN DE COLORES (Por Categoría)
    getMapeoTipo(gasto) {
        // Regla de seguridad: Si es un pago de deuda, color verde y fin.
        if (gasto.tipo === 'pagoDeuda') {
            return { color: '#10b981', icono: '' };
        }

        // Leemos la categoría para determinar el color
        const categoria = (gasto.categoria || '').toLowerCase();
        
        const mapeo = {
            'servicios': { color: '#ef4444', icono: '' },      // Rojo (cuentas)
            'alquiler': { color: '#ef4444', icono: '' },
            'expensas': { color: '#ef4444', icono: '' },
            'luz': { color: '#ef4444', icono: '' },
            'agua': { color: '#ef4444', icono: '' },
            'gas': { color: '#ef4444', icono: '' },
            'internet': { color: '#ef4444', icono: '' },
            'stock': { color: '#eab308', icono: '' },    // Amarillo (compras)
            'supermercado': { color: '#eab308', icono: '' },
            'verduleria': { color: '#eab308', icono: '' },
            'carniceria': { color: '#eab308', icono: '' },
            'limpieza': { color: '#eab308', icono: '' },
            'variable': { color: '#3b82f6', icono: '' },  // Azul (otros)
        };

        // Buscar coincidencia parcial en las claves del mapeo
        for (const [key, value] of Object.entries(mapeo)) {
            if (categoria.includes(key)) {
                return value;
            }
        }

        // Default si no encuentra categoría
        return { color: '#64748b', icono: '' };
    }

    renderLista(gastosFiltrados, currentUser, ambitoActual, mapaNombres, onDeleteClick) {
        if (!this.listaGastosUI) return;
        this.listaGastosUI.innerHTML = '';

        if (gastosFiltrados.length === 0) {
            this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">No hay movimientos con estos filtros.</p>';
            return;
        }

        // === AGRUPAR POR FECHA (Estilo Splitwise: Hoy, Ayer, Esta semana, Earlier) ===
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
        const haceUnaSemana = new Date(hoy); haceUnaSemana.setDate(hoy.getDate() - 7);

        const grupos = { 'Hoy': [], 'Ayer': [], 'Esta semana': [], 'Anterior': [] };
        
        gastosFiltrados.forEach(gasto => {
            if (!gasto.fecha) {
                grupos['Anterior'].push(gasto);
                return;
            }
            const fechaGasto = new Date(gasto.fecha + 'T00:00:00');
            if (fechaGasto.getTime() === hoy.getTime()) {
                grupos['Hoy'].push(gasto);
            } else if (fechaGasto.getTime() === new Date(hoy.getTime() - 86400000).getTime()) { // Yesterday
                grupos['Ayer'].push(gasto);
            } else if (fechaGasto >= haceUnaSemana) {
                grupos['Esta semana'].push(gasto);
            } else {
                grupos['Anterior'].push(gasto);
            }
        });

        // Renderizar cada grupo
        Object.entries(grupos).forEach(([nombreGrupo, gastos]) => {
            if (gastos.length === 0) return;
            
            // Header del grupo
            const header = document.createElement('div');
            header.className = 'date-group-header';
            header.textContent = nombreGrupo;
            this.listaGastosUI.appendChild(header);

            gastos.forEach((gasto) => {
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
                <div class="gasto-info" style="display: flex; align-items: center;">
                    <div style="display: flex; flex-direction: column; padding-left: 8px;">
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