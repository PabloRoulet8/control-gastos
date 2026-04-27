export class PerfilRenderer {
    constructor(onDataChange) {
        this.listaCategoriasUI = document.getElementById('lista-categorias-personales');
        this.listaPagosUI = document.getElementById('lista-metodos-pago');
        this.listaFondosUI = document.getElementById('lista-fondos-personales');
        this.checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
        // Este callback es clave: le avisa al controlador cuándo tiene que guardar en Firebase
        this.onDataChange = onDataChange; 
    }

    renderizarCategorias(userData) {
        if (!this.listaCategoriasUI) return;
        this.listaCategoriasUI.innerHTML = '';
        const cats = userData.categorias_personales || [];

        if (cats.length === 0) {
            this.listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">No tenés categorías.</li>';
        } else {
            cats.forEach((cat, index) => {
                const li = document.createElement('li');
                li.className = 'cat-item flex-between mb-10';
                li.innerHTML = `
                    <span class="text-bold-dark flex-2">${cat.nombre}</span>
                    <div class="flex-1 text-center">
                        <input type="checkbox" class="cat-checkbox toggle-fijo" data-idx="${index}" ${cat.es_fijo ? 'checked' : ''}>
                    </div>
                    <div class="flex-1 text-center">
                        <input type="checkbox" class="cat-checkbox toggle-stock" data-idx="${index}" ${cat.lleva_stock ? 'checked' : ''}>
                    </div>
                    <button class="btn-icon-danger btn-delete-cat" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                `;
                this.listaCategoriasUI.appendChild(li);
            });

            this.listaCategoriasUI.querySelectorAll('.toggle-fijo').forEach(chk => {
                chk.addEventListener('change', async (e) => {
                    userData.categorias_personales[e.target.dataset.idx].es_fijo = e.target.checked;
                    await this.onDataChange();
                });
            });
            this.listaCategoriasUI.querySelectorAll('.toggle-stock').forEach(chk => {
                chk.addEventListener('change', async (e) => {
                    userData.categorias_personales[e.target.dataset.idx].lleva_stock = e.target.checked;
                    await this.onDataChange();
                });
            });

this.listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    userData.categorias_personales.splice(e.currentTarget.dataset.idx, 1);
                    await this.onDataChange();
                    this.renderizarCategorias(userData);
                });
            });
            
            if (window.lucide) window.lucide.createIcons();
            });
        }
        this.renderizarSeleccionCategoriasFondos(userData);
    }

    renderizarPagos(userData) {
        if (!this.listaPagosUI) return;
        this.listaPagosUI.innerHTML = '';
        const pagos = userData.metodos_pago || [];

        if (pagos.length === 0) {
            this.listaPagosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés métodos de pago.</li>';
            return;
        }

        pagos.forEach((pago, index) => {
            const li = document.createElement('li');
            li.className = 'flex-between border-bottom-gray';
            li.style.padding = '12px 15px';
            li.innerHTML = `
                <span class="text-bold-dark">${pago}</span>
                <button class="btn-icon-danger btn-delete-pago" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
            `;
            this.listaPagosUI.appendChild(li);
        });

        this.listaPagosUI.querySelectorAll('.btn-delete-pago').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                userData.metodos_pago.splice(e.currentTarget.dataset.idx, 1);
                await this.onDataChange();
                this.renderizarPagos(userData);
            });
        });
        
        if (window.lucide) window.lucide.createIcons();
    }

    renderizarSeleccionCategoriasFondos(userData) {
        if(!this.checkCategoriasUI) return;
        this.checkCategoriasUI.innerHTML = ''; 
        const cats = userData.categorias_personales || [];

        if (cats.length === 0) {
            this.checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1; padding: 15px;">Agregá categorías primero</span>';
            this.checkCategoriasUI.className = 'border bg-white'; 
            return;
        }

        if (cats.length <= 5) {
            this.checkCategoriasUI.className = 'grid-checkbox-fondos border bg-white';
            cats.forEach(cat => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" name="cat-vinculo-check" value="${cat.nombre}"> ${cat.nombre}`;
                this.checkCategoriasUI.appendChild(label);
            });
        } else {
            this.checkCategoriasUI.className = 'p-0 border-0 bg-transparent';
            let htmlSelect = `
                <div class="custom-multi-select" id="dropdown-categorias">
                    <div class="select-header" id="dropdown-header">
                        <span id="dropdown-text" style="pointer-events: none;">Seleccionar categorías...</span>
                    </div>
                    <div class="select-options" id="dropdown-options">
            `;
            cats.forEach(cat => {
                htmlSelect += `
                    <label class="option-label">
                        <input type="checkbox" name="cat-vinculo-custom" value="${cat.nombre}">
                        ${cat.nombre}
                    </label>
                `;
            });
            htmlSelect += `</div></div>`;
            this.checkCategoriasUI.innerHTML = htmlSelect;

            const header = document.getElementById('dropdown-header');
            const options = document.getElementById('dropdown-options');
            const textSpan = document.getElementById('dropdown-text');
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
        }
    }

    renderizarFondos(userData) {
        if (!this.listaFondosUI) return;
        this.listaFondosUI.innerHTML = '';
        const fondos = userData.fondos || [];

        if (fondos.length === 0) {
            this.listaFondosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés presupuestos.</li>';
            return;
        }

        fondos.forEach((f, index) => {
            const li = document.createElement('li');
            li.className = 'fondo-item mb-15'; 
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            
            const catsText = f.categorias && f.categorias.length > 0 ? f.categorias.join(', ') : 'Sin categorías';
            
            li.innerHTML = `
                <div style="display: flex; flex-direction: column; text-align: left;">
                    <strong style="font-size: 1rem; color: var(--text-main);">${f.nombre}</strong>
                    <span class="text-xs-gray" style="margin: 2px 0 0 0;">Aplica en: ${catsText}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 700; color: var(--text-main);">$ ${f.monto.toLocaleString('es-AR')}</span>
                    <button class="btn-icon-danger btn-delete-fondo" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            this.listaFondosUI.appendChild(li);
        });

        this.listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                userData.fondos.splice(e.currentTarget.dataset.idx, 1);
                await this.onDataChange();
                this.renderizarFondos(userData);
            });
        });
        
        if (window.lucide) window.lucide.createIcons();
    }
}