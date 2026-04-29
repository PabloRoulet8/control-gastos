import { AppUtils } from '../utils/AppUtils.js';

export class HistorialRenderer {
    constructor() {
        this.listaGastosUI = document.getElementById('contenedor-gastos');
        this.filtroResponsable = document.getElementById('filtro-responsable');
        this.filtroCategoria = document.getElementById('filtro-categoria');
        this.modalFiltros = document.getElementById('modal-filtros');
        this.btnAbrirFiltros = document.getElementById('btn-abrir-filtros');
        this.btnCerrarFiltros = document.getElementById('btn-cerrar-filtros');
        this.btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
        this.btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
        
        this.initModalEvents();
        
        // Event Delegation para eliminación de gastos
        if (this.listaGastosUI) {
            this.listaGastosUI.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-icon-danger');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    if (id && this.onDeleteCallback) {
                        this.onDeleteCallback(id);
                    }
                }
            });
        }
    }

    initModalEvents() {
        if (this.btnAbrirFiltros && this.modalFiltros) {
            this.btnAbrirFiltros.addEventListener('click', () => {
                this.modalFiltros.classList.add('active');
                this.modalFiltros.querySelector('.modal-content').classList.add('active');
                if (window.lucide) window.lucide.createIcons();
            });
        }
        
        if (this.btnCerrarFiltros && this.modalFiltros) {
            this.btnCerrarFiltros.addEventListener('click', () => {
                this.cerrarModal();
            });
        }
        
        if (this.modalFiltros) {
            this.modalFiltros.addEventListener('click', (e) => {
                if (e.target === this.modalFiltros) {
                    this.cerrarModal();
                }
            });
        }
    }

    abrirModal() {
        if (this.modalFiltros) {
            this.modalFiltros.classList.add('active');
            this.modalFiltros.querySelector('.modal-content').classList.add('active');
            if (window.lucide) window.lucide.createIcons();
        }
    }
    
    cerrarModal() {
        if (this.modalFiltros) {
            this.modalFiltros.classList.remove('active');
            const content = this.modalFiltros.querySelector('.modal-content');
            if (content) content.classList.remove('active');
        }
    }
    
    getMapeoTipo(gasto) {
        if (gasto.tipo === 'pagoDeuda') {
            return { color: 'var(--primary-color)' };
        }
        
        const categoria = (gasto.categoria || '').toLowerCase();
        const mapeo = {
            'servicios': { color: '#dc2626' }, 
            'alquiler': { color: '#dc2626' },
            'expensas': { color: '#dc2626' },
            'luz': { color: '#dc2626' },
            'agua': { color: '#dc2626' },
            'gas': { color: '#dc2626' },
            'internet': { color: '#dc2626' },
            'stock': { color: '#d97706' },     
            'supermercado': { color: '#d97706' },
            'verduleria': { color: '#d97706' },
            'carniceria': { color: '#d97706' },
            'limpieza': { color: '#d97706' },
            'variable': { color: '#2563eb' },   
        };
        
        for (const [key, value] of Object.entries(mapeo)) {
            if (categoria.includes(key)) {
                return value;
            }
        }
        return { color: 'var(--text-main)' };
    }

    renderLista(gastosFiltrados, currentUser, ambitoActual, mapaNombres, onDeleteClick) {
        if (!this.listaGastosUI) return;
        this.listaGastosUI.innerHTML = '';
        this.onDeleteCallback = onDeleteClick;
        
        if (gastosFiltrados.length === 0) {
            this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20" style="color: var(--text-muted);">No hay movimientos con estos filtros.</p>';
            return;
        }
        
        // LÓGICA DE AGRUPACIÓN TEMPORAL (Pasado, Presente y Futuro)
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
        const haceUnaSemana = new Date(hoy); haceUnaSemana.setDate(hoy.getDate() - 7);
        
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const gruposMap = new Map();
        
        // Al usar un Map y recorrer el array que ya viene ordenado descendentemente, 
        // los grupos se van a crear y mostrar en el orden cronológico perfecto.
        gastosFiltrados.forEach(gasto => {
            if (!gasto.fecha) {
                if(!gruposMap.has('Anterior')) gruposMap.set('Anterior', []);
                gruposMap.get('Anterior').push(gasto);
                return;
            }
            
            // Forzamos la zona horaria para que no haya desfasaje de días
            const fechaGasto = new Date(gasto.fecha + 'T00:00:00');
            
            // Si el gasto es del futuro (Ej: Cuotas) o es más viejo que hace una semana, agrupamos por "Mes Año"
            if (fechaGasto > hoy || fechaGasto < haceUnaSemana) {
                const nombreMes = `${meses[fechaGasto.getMonth()]} ${fechaGasto.getFullYear()}`;
                if(!gruposMap.has(nombreMes)) gruposMap.set(nombreMes, []);
                gruposMap.get(nombreMes).push(gasto);
            } else if (fechaGasto.getTime() === hoy.getTime()) {
                if(!gruposMap.has('Hoy')) gruposMap.set('Hoy', []);
                gruposMap.get('Hoy').push(gasto);
            } else if (fechaGasto.getTime() === ayer.getTime()) {
                if(!gruposMap.has('Ayer')) gruposMap.set('Ayer', []);
                gruposMap.get('Ayer').push(gasto);
            } else {
                if(!gruposMap.has('Esta semana')) gruposMap.set('Esta semana', []);
                gruposMap.get('Esta semana').push(gasto);
            }
        });
        
        gruposMap.forEach((gastos, nombreGrupo) => {
            if (gastos.length === 0) return;
            
            const header = document.createElement('div');
            header.className = 'date-group-header';
            header.textContent = nombreGrupo;
            this.listaGastosUI.appendChild(header);
            
            gastos.forEach((gasto) => {
                const item = document.createElement('div');
                item.className = 'gasto-item';
                
                const parts = gasto.fecha ? gasto.fecha.split('-') : ['','',''];
                const fechaCorta = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : gasto.fecha;
                
                const esPago = gasto.tipo === 'pagoDeuda';
                const idDelResponsable = esPago ? gasto.pagador_id : gasto.responsable;
                
                const infoTipo = this.getMapeoTipo(gasto);
                const colorMonto = infoTipo.color;
                
                const etiquetaCategoria = esPago ? 'Pago de Deuda' : AppUtils.escapeHTML(gasto.categoria || 'Sin categoría');
                const metodoPago = gasto.metodo_pago ? ` • ${AppUtils.escapeHTML(gasto.metodo_pago)}` : '';
                
                // Extraemos la referencia / detalle de la cuota y la mostramos bonita debajo del título
                const refHtml = gasto.referencia ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${AppUtils.escapeHTML(gasto.referencia)}</div>` : '';
                
                item.innerHTML = `
                    <div class="gasto-info">
                        <strong>${etiquetaCategoria}</strong> 
                        ${refHtml}
                        <span class="fecha">${fechaCorta}${metodoPago}</span>
                    </div>
                    <div class="gasto-acciones">
                        <span class="monto" style="color: ${colorMonto};">$ ${AppUtils.formatearARS(gasto.monto)}</span>
                        <button class="btn-icon-danger" data-id="${gasto.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                    </div>
                `;
                this.listaGastosUI.appendChild(item);
            });
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
     
    renderizarFiltrosResponsables(mapaNombres) {
        const select = document.getElementById('filtro-responsable');
        if (!select) return;
        
        const valorActual = select.value;
        select.innerHTML = '<option value="todos">Todos</option>';
        
        if (mapaNombres) {
            Object.entries(mapaNombres).forEach(([uid, nombre]) => {
                const opt = document.createElement('option');
                opt.value = uid;
                opt.textContent = AppUtils.escapeHTML(nombre);
                select.appendChild(opt);
            });
        }
        
        if (valorActual && valorActual !== 'todos') {
            select.value = valorActual;
        }
    }
    
    renderizarFiltrosCategorias(categorias) {
        const select = document.getElementById('filtro-categoria');
        if (!select) return;
        
        const valorActual = select.value;
        select.innerHTML = '<option value="todas">Todas</option>';
        
        if (categorias && categorias.length > 0) {
            categorias.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = AppUtils.escapeHTML(cat);
                select.appendChild(opt);
            });
        }
        
        if (valorActual && valorActual !== 'todas') {
            select.value = valorActual;
        }
    }
    
    mostrarCargando() {
        if (this.listaGastosUI) {
            this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Cargando gastos...</p>';
        }
    }
    
    mostrarError() {
        if (this.listaGastosUI) {
            this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Error al cargar gastos.</p>';
        }
    }
}
