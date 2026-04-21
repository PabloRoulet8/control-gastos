import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const urlParams = new URLSearchParams(window.location.search);
    
    // Helper para capitalizar la primera letra
    const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    let hogarId = urlParams.get('id');
    const esModoCreacion = (hogarId === 'nuevo');

    let categoriasBorrador = [];
    let presupuestosBorrador = [];

    const seccionNombre = document.getElementById('seccion-nombre-hogar');
    const inputNombreHogar = document.getElementById('input-nombre-hogar');
    const btnAccionFinal = document.getElementById('btn-final');
    
    const btnToggleAddCat = document.getElementById('btn-toggle-add-cat');
    const formAddCatBox = document.getElementById('form-add-cat-box');
    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const listaCategoriasUI = document.getElementById('lista-categorias-hogar');

    const btnToggleAddFondo = document.getElementById('btn-toggle-add-fondo');
    const formAddFondoBox = document.getElementById('form-add-fondo-box');
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');
    const listaFondosUI = document.getElementById('lista-fondos-hogar');

    const setupToggle = (btn, box) => {
        if(!btn || !box) return;
        btn.addEventListener('click', () => {
            const isHidden = box.style.display === 'none';
            box.style.display = isHidden ? 'block' : 'none';
            if (isHidden) btn.classList.add('is-active');
            else btn.classList.remove('is-active');
        });
    }

    setupToggle(btnToggleAddCat, formAddCatBox);
    setupToggle(btnToggleAddFondo, formAddFondoBox);

    if (esModoCreacion) {
        document.getElementById('header-titulo').textContent = "Nuevo Hogar";
        if(seccionNombre) seccionNombre.style.display = 'block';
        btnAccionFinal.textContent = "Crear Hogar y Generar Link";
        
        listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay categorías</li>';
        checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1;">Agregá categorías primero</span>';
        
        if(formAddCatBox) {
             formAddCatBox.style.display = 'block';
             btnToggleAddCat.classList.add('is-active');
        }
    } else {
        if(seccionNombre) seccionNombre.style.display = 'none';
        btnAccionFinal.textContent = "Guardar Cambios";
    }

    onAuthStateChanged(auth, async (user) => {
        if (user && !esModoCreacion) {
            const snap = await getDoc(doc(db, "hogares", hogarId));
            if (snap.exists()) {
                const data = snap.data();
                
                // 1. Verificar si soy admin
                const esAdmin = data.administradores && data.administradores.includes(user.uid);
                if (!esAdmin) {
                    toast.mostrar("⚠️ Acceso denegado.");
                    setTimeout(() => window.location.href = 'index.html', 1500);
                    return;
                }
                
                // 2. Cargar Categorías y Presupuestos
                categoriasBorrador = (data.categorias_compartidas || []).map(c => ({
                    ...c, activa: c.activa !== false 
                }));
                presupuestosBorrador = data.presupuestos_compartidos || [];

                // 3. MOSTRAR INTEGRANTES (NUEVA LÓGICA)
                const listaIntegrantesUI = document.getElementById('lista-integrantes');
                const seccionIntegrantes = document.getElementById('seccion-integrantes');
                if (listaIntegrantesUI) {
                    seccionIntegrantes.classList.remove('hidden');
                    listaIntegrantesUI.innerHTML = '';
                    for (const uid of data.miembros || []) {
                        const userSnap = await getDoc(doc(db, "usuarios", uid));
                        const nombreM = userSnap.exists() ? userSnap.data().nombre : "Usuario";
                        const li = document.createElement('li');
                        li.className = 'flex-between p-10 border-bottom-gray';
                        li.innerHTML = `<span>${nombreM}</span> <span class="text-sm-gray">${uid === data.creador_id ? '👑 Dueño' : 'Miembro'}</span>`;
                        listaIntegrantesUI.appendChild(li);
                    }
                }

                renderizarCategorias();
                renderizarSeleccionCategoriasFondos();
                renderizarPresupuestos();
            }
        }
    });

    btnAddCat.addEventListener('click', () => {
        const nombre = capitalizar(inputNuevaCat.value.trim()); // Capitalizado!
        if (!nombre) return;
        
        const catExistente = categoriasBorrador.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (catExistente) {
            if (catExistente.activa === false) {
                catExistente.activa = true;
                toast.mostrar("Categoría restaurada.");
            } else {
                return toast.mostrar("Esa categoría ya existe");
            }
        } else {
            categoriasBorrador.push({ nombre, es_fijo: false, lleva_stock: false, activa: true });
        }

        inputNuevaCat.value = '';
        renderizarCategorias();
        renderizarSeleccionCategoriasFondos(); 
    });

    function renderizarCategorias() {
        listaCategoriasUI.innerHTML = '';
        const categoriasVisibles = categoriasBorrador.filter(c => c.activa !== false);

        if (categoriasVisibles.length === 0) {
            listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay categorías</li>';
            return;
        }

        categoriasVisibles.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'cat-item flex-between mb-10';
            
            li.innerHTML = `
                <span class="text-bold-dark flex-2">${cat.nombre}</span>
                <div class="flex-1 text-center">
                    <input type="checkbox" class="cat-checkbox toggle-prop" data-nombre="${cat.nombre}" data-prop="es_fijo" ${cat.es_fijo ? 'checked' : ''}>
                </div>
                <div class="flex-1 text-center">
                    <input type="checkbox" class="cat-checkbox toggle-prop" data-nombre="${cat.nombre}" data-prop="lleva_stock" ${cat.lleva_stock ? 'checked' : ''}>
                </div>
                <button class="btn-delete-icon btn-delete-cat" data-nombre="${cat.nombre}" title="Eliminar">🗑️</button>
            `;
            listaCategoriasUI.appendChild(li);
        });

        listaCategoriasUI.querySelectorAll('.toggle-prop').forEach(check => {
            check.addEventListener('change', (e) => {
                const nombre = e.target.dataset.nombre;
                const prop = e.target.dataset.prop;
                const catIndex = categoriasBorrador.findIndex(c => c.nombre === nombre);
                if (catIndex > -1) {
                    categoriasBorrador[catIndex][prop] = e.target.checked;
                }
            });
        });

        listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const catAEliminar = categoriasBorrador.find(c => c.nombre === btn.dataset.nombre);
                if(catAEliminar) {
                    catAEliminar.activa = false;
                    renderizarCategorias();
                    renderizarSeleccionCategoriasFondos(); 
                }
            });
        });
    }

    function renderizarSeleccionCategoriasFondos() {
        const contenedor = checkCategoriasUI;
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
                label.innerHTML = `<input type="checkbox" name="cat-vinculo-check" value="${cat.nombre}"> ${cat.nombre}`;
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
                        <input type="checkbox" name="cat-vinculo-custom" value="${cat.nombre}">
                        ${cat.nombre}
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
            
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                options.classList.toggle('show');
                header.classList.toggle('open');
            });

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

    btnCrearFondo.addEventListener('click', () => {
        const nombre = capitalizar(inputNombreFondo.value.trim()); // Capitalizado!
        const monto = parseFloat(inputMontoFondo.value);
        let seleccionadas = [];

        const checksGrid = document.querySelectorAll('input[name="cat-vinculo-check"]:checked');
        const checksCustom = document.querySelectorAll('input[name="cat-vinculo-custom"]:checked');

        if (checksGrid.length > 0) {
            seleccionadas = Array.from(checksGrid).map(c => c.value);
        } else if (checksCustom.length > 0) {
            seleccionadas = Array.from(checksCustom).map(c => c.value);
        }

        if (!nombre || isNaN(monto) || seleccionadas.length === 0) {
            return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
        }

        presupuestosBorrador.push({
            id: Date.now().toString(),
            nombre, monto, categorias: seleccionadas
        });

        inputNombreFondo.value = '';
        inputMontoFondo.value = '';
        
        document.querySelectorAll('input[name="cat-vinculo-check"], input[name="cat-vinculo-custom"]').forEach(chk => chk.checked = false);
        const textSpan = document.getElementById('dropdown-text');
        if(textSpan) textSpan.textContent = "Seleccionar categorías...";

        renderizarPresupuestos();
        toast.mostrar("¡Presupuesto creado!");
    });

    function renderizarPresupuestos() {
        listaFondosUI.innerHTML = '';
        if (presupuestosBorrador.length === 0) {
            listaFondosUI.innerHTML = '<li class="text-center text-muted p-20">Aún no hay presupuestos.</li>';
            return;
        }

        presupuestosBorrador.forEach(f => {
            const li = document.createElement('li');
            li.className = 'fondo-item mb-15'; 
            li.innerHTML = `
                <div class="fondo-info">
                    <strong class="fondo-titulo">${f.nombre}</strong>
                    <span class="fondo-cats">Aplica en: ${f.categorias.join(', ')}</span>
                </div>
                <div class="fondo-acciones text-right">
                    <span class="fondo-monto">$ ${f.monto.toLocaleString('es-AR')}</span>
                    <button class="btn-text-red btn-delete-fondo" data-id="${f.id}">Eliminar</button>
                </div>
            `;
            listaFondosUI.appendChild(li);
        });

        listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                presupuestosBorrador = presupuestosBorrador.filter(p => p.id !== e.target.dataset.id);
                renderizarPresupuestos();
            });
        });
    }

    if (btnAccionFinal) {
        btnAccionFinal.addEventListener('click', async () => {
            btnAccionFinal.disabled = true;
            const textoOriginal = btnAccionFinal.textContent;
            
            try {
                if (esModoCreacion) {
                    const nombreHogar = capitalizar(inputNombreHogar.value.trim()); // Capitalizado!
                    if (!nombreHogar) {
                        toast.mostrar("⚠️ Ingresá el nombre del hogar");
                        inputNombreHogar.focus();
                        btnAccionFinal.disabled = false;
                        return;
                    }

                    btnAccionFinal.textContent = "Guardando...";
                    const nuevoHogar = await api.crearHogar(nombreHogar);
                    const nuevoId = nuevoHogar.id;

                    await setDoc(doc(db, "hogares", nuevoId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador,
                        administradores: [auth.currentUser.uid] 
                    }, { merge: true });

                    const snapHogar = await getDoc(doc(db, "hogares", nuevoId));
                    const codigoGenerado = snapHogar.data().codigo_invitacion;
                    
                    const urlBase = window.location.origin + window.location.pathname.replace('admin_hogar.html', 'index.html');
                    const linkFinal = `${urlBase}?join=${codigoGenerado}`;

                    document.getElementById('modal-link-invitacion').style.display = 'flex'; 
                    document.getElementById('input-link-generado').value = linkFinal;

                    document.getElementById('btn-copiar-link-modal').onclick = () => {
                        navigator.clipboard.writeText(linkFinal);
                        toast.mostrar("¡Link copiado! 🔗");
                    };

                    document.getElementById('btn-cerrar-modal-link').onclick = () => {
                        window.location.href = 'index.html'; 
                    };

                } else {
                    btnAccionFinal.textContent = "Guardando...";
                    
                    await updateDoc(doc(db, "hogares", hogarId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador
                    });
                    
                    toast.mostrar("¡Configuración actualizada! ✅");
                    setTimeout(() => window.location.href = `config_hogar.html?id=${hogarId}`, 1000);
                }

            } catch (error) {
                toast.mostrar("Error al guardar");
                btnAccionFinal.disabled = false;
                btnAccionFinal.textContent = textoOriginal;
            }
        });
    }
});