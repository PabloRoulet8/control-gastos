import { AppUtils } from '../utils/AppUtils.js';

export class AdminHogarRenderer {
    constructor() {
        this.listaCategoriasUI = document.getElementById('lista-categorias-hogar');
        this.checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
        this.listaFondosUI = document.getElementById('lista-fondos-hogar');
        // NUEVO: Vinculamos la lista de pagos del hogar
        this.listaPagosUI = document.getElementById('lista-metodos-pago-hogar'); 
    }

    renderizarCategorias(categoriasBorrador, onListChange) {
        if (!this.listaCategoriasUI) return;
        this.listaCategoriasUI.innerHTML = '';
        const categoriasVisibles = categoriasBorrador.filter(c => c.activa !== false);
        
        if (categoriasVisibles.length === 0) {
            this.listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay categorías</li>';
            this.renderizarSeleccionCategoriasFondos(categoriasBorrador);
            return;
        }
        
        categoriasVisibles.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'cat-item flex-between mb-10';
            
            li.innerHTML = `
                <span class="flex-2" style="color: var(--text-main); font-weight: 600;">${AppUtils.escapeHTML(cat.nombre)}</span>
                <div class="flex-1 text-center">
                    <input type="checkbox" class="cat-checkbox toggle-prop" data-nombre="${AppUtils.escapeHTML(cat.nombre)}" data-prop="es_fijo" ${cat.es_fijo ? 'checked' : ''}>
                </div>
                <div class="flex-1 text-center">
                    <input type="checkbox" class="cat-checkbox toggle-prop" data-nombre="${AppUtils.escapeHTML(cat.nombre)}" data-prop="lleva_stock" ${cat.lleva_stock ? 'checked' : ''}>
                </div>
                <button class="btn-icon-danger btn-delete-cat" data-nombre="${AppUtils.escapeHTML(cat.nombre)}" title="Eliminar"><i data-lucide="trash-2"></i></button>
            `;
            this.listaCategoriasUI.appendChild(li);
        });
        
        this.listaCategoriasUI.querySelectorAll('.toggle-prop').forEach(check => {
            check.addEventListener('change', (e) => {
                const nombre = e.target.dataset.nombre;
                const prop = e.target.dataset.prop;
                const catIndex = categoriasBorrador.findIndex(c => c.nombre === nombre);
                if (catIndex > -1) {
                    categoriasBorrador[catIndex][prop] = e.target.checked;
                }
            });
        });
        
        this.listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const catAEliminar = categoriasBorrador.find(c => c.nombre === btn.dataset.nombre);
                if(catAEliminar) {
                    catAEliminar.activa = false;
                    onListChange();
                }
            });
        });
        
        this.renderizarSeleccionCategoriasFondos(categoriasBorrador);
    }
    
    renderizarSeleccionCategoriasFondos(categoriasBorrador) {
        const contenedor = this.checkCategoriasUI;
        if(!contenedor) return;
        contenedor.innerHTML = ''; 
        const categoriasVisibles = categoriasBorrador.filter(c => c.activa !== false);
        
        if (categoriasVisibles.length === 0) {
            contenedor.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1; padding: 15px;">Agregá categorías primero</span>';
            contenedor.classList.remove('grid-checkbox-fondos', 'p-0', 'border-0', 'bg-transparent');
            contenedor.classList.add('border', 'bg-white'); 
            return;
        }
        
        if (categoriasVisibles.length <= 5) {
            contenedor.classList.add('grid-checkbox-fondos', 'border', 'bg-white');
            contenedor.classList.remove('p-0', 'border-0', 'bg-transparent'); 
            
            categoriasVisibles.forEach(cat => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" name="cat-vinculo-check" value="${AppUtils.escapeHTML(cat.nombre)}"> ${AppUtils.escapeHTML(cat.nombre)}`;
                contenedor.appendChild(label);
            });
        } else {
            contenedor.classList.remove('grid-checkbox-fondos', 'border', 'bg-white');
            contenedor.classList.add('p-0', 'border-0', 'bg-transparent'); 
            
            let htmlSelect = `
                <div class="custom-multi-select" id="dropdown-categorias">
                    <div class="select-header" id="dropdown-header">
                        <span id="dropdown-text" style="pointer-events: none;">Seleccionar categorías...</span>
                    </div>
                    <div class="select-options" id="dropdown-options">
            `;
            
            categoriasVisibles.forEach(cat => {
                htmlSelect += `
                    <label class="option-label">
                        <input type="checkbox" name="cat-vinculo-custom" value="${AppUtils.escapeHTML(cat.nombre)}">
                        ${AppUtils.escapeHTML(cat.nombre)}
                    </label>
                `;
            });
            
            htmlSelect += `</div></div>`;
            contenedor.innerHTML = htmlSelect;
            
            const header = document.getElementById('dropdown-header');
            const options = document.getElementById('dropdown-options');
            const textSpan = document.getElementById('dropdown-text');
            const dropdownContainer = document.getElementById('dropdown-categorias');
            const customChecks = document.querySelectorAll('input[name="cat-vinculo-custom"]');
            
            if(header) {
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.classList.toggle('show');
                    header.classList.toggle('open');
                });
            }
            
            customChecks.forEach(chk => {
                chk.addEventListener('change', () => {
                    const seleccionados = Array.from(customChecks).filter(c => c.checked).map(c => c.value);
                    if (seleccionados.length === 0) textSpan.textContent = "Seleccionar categorías...";
                    else if (seleccionados.length === 1) textSpan.textContent = seleccionados[0];
                    else textSpan.textContent = `${seleccionados.length} seleccionadas`;
                });
            });
            
            document.addEventListener('click', (e) => {
                if (dropdownContainer && !dropdownContainer.contains(e.target)) {
                    options.classList.remove('show');
                    header.classList.remove('open');
                }
            });
        }
    }
    
    renderizarPresupuestos(presupuestosBorrador, onListChange) {
        if (!this.listaFondosUI) return;
        this.listaFondosUI.innerHTML = '';
        
        if (presupuestosBorrador.length === 0) {
            this.listaFondosUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay presupuestos.</li>';
            return;
        }
        
        presupuestosBorrador.forEach(f => {
            const li = document.createElement('li');
            li.className = 'fondo-item mb-15'; 
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px solid var(--glass-border)';
            
            const catsText = f.categorias && f.categorias.length > 0 ? f.categorias.map(c => AppUtils.escapeHTML(c)).join(', ') : 'Sin categorías';
            
            li.innerHTML = `
                <div style="display: flex; flex-direction: column; text-align: left; flex: 1; padding-right: 15px; overflow: hidden;">
                    <h3 style="margin: 0; font-size: 1rem; color: var(--text-main); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${AppUtils.escapeHTML(f.nombre)}</h3>
                    <p class="text-xs-gray" style="margin: 2px 0 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">Aplica en: ${catsText}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                    <span style="font-weight: 700; color: var(--text-main); font-size: 1rem; white-space: nowrap;">$ ${AppUtils.formatearARS(f.monto)}</span>
                    <button class="btn-icon-danger btn-delete-fondo" data-id="${f.id}" title="Eliminar">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            this.listaFondosUI.appendChild(li);
        });
        
        this.listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idAEliminar = e.currentTarget.dataset.id;
                onListChange(idAEliminar);
            });
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    // NUEVO MÉTODO: Renderizar Medios de Pago en el Hogar
    renderizarPagos(pagosBorrador, onListChange) {
        if (!this.listaPagosUI) return;
        this.listaPagosUI.innerHTML = '';
        
        if (pagosBorrador.length === 0) {
            this.listaPagosUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay medios de pago.</li>';
            return;
        }
        
        pagosBorrador.forEach((pago, index) => {
            const li = document.createElement('li');
            li.className = 'flex-between border-bottom-gray';
            li.style.padding = '12px 15px';
            li.innerHTML = `
                <span class="text-bold-dark">${AppUtils.escapeHTML(pago)}</span>
                <button class="btn-icon-danger btn-delete-pago-hogar" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
            `;
            this.listaPagosUI.appendChild(li);
        });
        
        this.listaPagosUI.querySelectorAll('.btn-delete-pago-hogar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(e.currentTarget.dataset.idx);
                onListChange(idx);
            });
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}
