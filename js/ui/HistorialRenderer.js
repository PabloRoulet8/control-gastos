export class HistorialRenderer {
    constructor() {
        this.listaGastosUI = document.getElementById('contenedor-gastos');
        this.filtroResponsable = document.getElementById('filtro-responsable');
        this.filtroCategoria = document.getElementById('filtro-categoria');
    }

    renderizarFiltrosResponsables(mapaNombres) {
        if(!this.filtroResponsable) return;
        this.filtroResponsable.innerHTML = '<option value="todos">Todos los responsables</option>';
        Object.entries(mapaNombres).forEach(([id, nombre]) => {
            const opt = document.createElement('option');
            opt.value = id; // El filtro funciona por ID
            opt.textContent = nombre;
            this.filtroResponsable.appendChild(opt);
        });
    }

    renderizarFiltrosCategorias(categorias) {
        if(!this.filtroCategoria) return;
        this.filtroCategoria.innerHTML = '<option value="todas">Todas las categorías</option>';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat;
            this.filtroCategoria.appendChild(option);
        });
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
            const esMio = currentUser && gasto.responsable === currentUser.uid;
            
            let claseTipo = 'general';
            if (ambitoActual === 'personal') claseTipo = 'individual-pablo'; 
            else if (gasto.tipo === 'individual') claseTipo = esMio ? 'individual-pablo' : 'individual-yanet';

            item.className = `gasto-item ${claseTipo}`;
            const parts = gasto.fecha ? gasto.fecha.split('-') : ['','',''];
            const fechaCorta = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : gasto.fecha;
            
            // CAMBIO CLAVE: Buscamos el nombre en el mapa usando el ID
            const nombreResponsable = mapaNombres[gasto.responsable] || gasto.responsable || 'Usuario';

            item.innerHTML = `
                <div class="gasto-info">
                    <strong>${gasto.categoria || 'Sin categoría'}</strong> 
                    <span class="fecha">${fechaCorta} — ${nombreResponsable.toUpperCase()}</span>
                    ${gasto.referencia ? `<span class="fecha" style="font-style: italic; margin-top: 3px;">"${gasto.referencia}"</span>` : ''}
                </div>
                <div class="gasto-acciones">
                    <span class="monto">$ ${Number(gasto.monto).toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar">🗑️</button>
                </div>
            `;
            this.listaGastosUI.appendChild(item);
        });

        this.listaGastosUI.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', (e) => onDeleteClick(e.currentTarget.getAttribute('data-id')));
        });
    }

    mostrarCargando() { if(this.listaGastosUI) this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Cargando movimientos...</p>'; }
    mostrarError() { if(this.listaGastosUI) this.listaGastosUI.innerHTML = '<p class="text-center p-20" style="color:#d32f2f;">Error de conexión.</p>'; }
}