import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    let currentUserUid = null;
    let userData = {};

    // Helper para capitalizar la primera letra (Pasa a Mayúscula automática)
    const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    // Elementos del DOM (Nuevos IDs)
    const inputNombre = document.getElementById('input-nombre');
    const inputEmoji = document.getElementById('input-emoji');
    const displayEmoji = document.getElementById('display-emoji');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');

    // Categorías
    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const listaCategoriasUI = document.getElementById('lista-categorias-personales');

    // Pagos
    const inputNuevoPago = document.getElementById('input-nuevo-pago');
    const btnAddPago = document.getElementById('btn-add-pago');
    const listaPagosUI = document.getElementById('lista-metodos-pago');

    // Fondos
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');
    const checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
    const listaFondosUI = document.getElementById('lista-fondos-personales');

    // LÓGICA DE DESPLIEGUE (TOGGLE FORMULARIOS)
    const setupToggle = (btnId, boxId) => {
        const btn = document.getElementById(btnId);
        const box = document.getElementById(boxId);
        if(btn && box) {
            btn.addEventListener('click', () => {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) btn.classList.add('is-active');
                else btn.classList.remove('is-active');
            });
        }
    };

    setupToggle('btn-toggle-cat', 'form-cat-box');
    setupToggle('btn-toggle-pago', 'form-pago-box');
    setupToggle('btn-toggle-fondo', 'form-fondo-box');

    // AUTH CHECK
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            await cargarDatosUsuario();
        } else {
            window.location.href = 'index.html';
        }
    });

    async function cargarDatosUsuario() {
        try {
            const docRef = doc(db, "usuarios", currentUserUid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                userData = docSnap.data();
            } else {
                userData = {
                    nombre: "",
                    emoji: "👤",
                    categorias_personales: [],
                    metodos_pago: ["Efectivo / Transferencia"],
                    fondos: []
                };
            }

            // Normalizar categorías viejas para evitar errores
            userData.categorias_personales = (userData.categorias_personales || []).map(c => 
                typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c
            );

            if (inputNombre) inputNombre.value = userData.nombre || "";
            if (inputEmoji) inputEmoji.value = userData.emoji || "👤";
            if (displayEmoji) displayEmoji.textContent = userData.emoji || "👤";

            renderizarCategorias();
            renderizarPagos();
            renderizarFondos();

        } catch (error) {
            console.error("Error al cargar perfil:", error);
            toast.mostrar("Error al cargar datos.");
        }
    }

    // --- 1. PERFIL BÁSICO ---
    if (inputEmoji) {
        inputEmoji.addEventListener('input', (e) => {
            displayEmoji.textContent = e.target.value || "👤";
        });
    }

    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', async () => {
            const nombre = capitalizar(inputNombre.value.trim()); // Capitalizado!
            const emoji = inputEmoji.value.trim() || "👤";
            
            if (!nombre) return toast.mostrar("Ingresá un nombre.");
            
            btnGuardarPerfil.textContent = "Guardando...";
            try {
                await updateDoc(doc(db, "usuarios", currentUserUid), { nombre, emoji });
                toast.mostrar("¡Perfil actualizado!");
                // Actualizamos el input para que el usuario vea la mayúscula aplicada
                inputNombre.value = nombre; 
            } catch (error) {
                toast.mostrar("Error al guardar.");
            } finally {
                btnGuardarPerfil.textContent = "Guardar Cambios";
            }
        });
    }

    // --- 2. CATEGORÍAS ---
    if (btnAddCat) {
        btnAddCat.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevaCat.value.trim()); // Capitalizado!
            if (!nombre) return;
            
            const existe = userData.categorias_personales.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
            if (existe) return toast.mostrar("Esa categoría ya existe");
            
            userData.categorias_personales.push({ nombre, es_fijo: false, lleva_stock: false });
            inputNuevaCat.value = '';
            
            await guardarDatosGenerales();
            renderizarCategorias();
        });
    }

    function renderizarCategorias() {
        if (!listaCategoriasUI) return;
        listaCategoriasUI.innerHTML = '';
        const cats = userData.categorias_personales || [];

        if (cats.length === 0) {
            listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">No tenés categorías.</li>';
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
                    <button class="btn-delete-icon btn-delete-cat" data-idx="${index}" title="Eliminar">🗑️</button>
                `;
                listaCategoriasUI.appendChild(li);
            });

            listaCategoriasUI.querySelectorAll('.toggle-fijo').forEach(chk => {
                chk.addEventListener('change', async (e) => {
                    userData.categorias_personales[e.target.dataset.idx].es_fijo = e.target.checked;
                    await guardarDatosGenerales();
                });
            });
            listaCategoriasUI.querySelectorAll('.toggle-stock').forEach(chk => {
                chk.addEventListener('change', async (e) => {
                    userData.categorias_personales[e.target.dataset.idx].lleva_stock = e.target.checked;
                    await guardarDatosGenerales();
                });
            });

            listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    userData.categorias_personales.splice(e.target.dataset.idx, 1);
                    await guardarDatosGenerales();
                    renderizarCategorias();
                });
            });
        }
        renderizarSeleccionCategoriasFondos();
    }

    // --- 3. MÉTODOS DE PAGO ---
    if (btnAddPago) {
        btnAddPago.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevoPago.value.trim()); // Capitalizado!
            if (!nombre) return;
            
            if (!userData.metodos_pago) userData.metodos_pago = [];
            if (userData.metodos_pago.find(p => p.toLowerCase() === nombre.toLowerCase())) return toast.mostrar("Ese método ya existe");
            
            userData.metodos_pago.push(nombre);
            inputNuevoPago.value = '';
            
            await guardarDatosGenerales();
            renderizarPagos();
        });
    }

    function renderizarPagos() {
        if (!listaPagosUI) return;
        listaPagosUI.innerHTML = '';
        const pagos = userData.metodos_pago || [];

        if (pagos.length === 0) {
            listaPagosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés métodos de pago.</li>';
            return;
        }

        pagos.forEach((pago, index) => {
            const li = document.createElement('li');
            li.className = 'flex-between border-bottom-gray';
            li.style.padding = '12px 15px';
            li.innerHTML = `
                <span class="text-bold-dark">${pago}</span>
                <button class="btn-delete-icon btn-delete-pago" data-idx="${index}" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">🗑️</button>
            `;
            listaPagosUI.appendChild(li);
        });

        listaPagosUI.querySelectorAll('.btn-delete-pago').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                userData.metodos_pago.splice(e.target.dataset.idx, 1);
                await guardarDatosGenerales();
                renderizarPagos();
            });
        });
    }

    // --- 4. FONDOS/PRESUPUESTOS ---
    function renderizarSeleccionCategoriasFondos() {
        if(!checkCategoriasUI) return;
        checkCategoriasUI.innerHTML = ''; 
        const cats = userData.categorias_personales || [];

        if (cats.length === 0) {
            checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1; padding: 15px;">Agregá categorías primero</span>';
            checkCategoriasUI.className = 'border bg-white'; 
            return;
        }

        if (cats.length <= 5) {
            checkCategoriasUI.className = 'grid-checkbox-fondos border bg-white';
            cats.forEach(cat => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" name="cat-vinculo-check" value="${cat.nombre}"> ${cat.nombre}`;
                checkCategoriasUI.appendChild(label);
            });
        } else {
            checkCategoriasUI.className = 'p-0 border-0 bg-transparent';
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
            checkCategoriasUI.innerHTML = htmlSelect;

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

    if(btnCrearFondo) {
        btnCrearFondo.addEventListener('click', async () => {
            const nombre = capitalizar(inputNombreFondo.value.trim()); // Capitalizado!
            const monto = parseFloat(inputMontoFondo.value);
            let seleccionadas = [];

            const checksGrid = document.querySelectorAll('input[name="cat-vinculo-check"]:checked');
            const checksCustom = document.querySelectorAll('input[name="cat-vinculo-custom"]:checked');

            if (checksGrid.length > 0) seleccionadas = Array.from(checksGrid).map(c => c.value);
            else if (checksCustom.length > 0) seleccionadas = Array.from(checksCustom).map(c => c.value);

            if (!nombre || isNaN(monto) || seleccionadas.length === 0) {
                return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
            }

            if(!userData.fondos) userData.fondos = [];
            userData.fondos.push({
                id: Date.now().toString(),
                nombre, monto, categorias: seleccionadas
            });

            inputNombreFondo.value = '';
            inputMontoFondo.value = '';
            document.querySelectorAll('input[name="cat-vinculo-check"], input[name="cat-vinculo-custom"]').forEach(chk => chk.checked = false);
            const textSpan = document.getElementById('dropdown-text');
            if(textSpan) textSpan.textContent = "Seleccionar categorías...";

            await guardarDatosGenerales();
            renderizarFondos();
            toast.mostrar("¡Presupuesto creado!");
        });
    }

    function renderizarFondos() {
        if (!listaFondosUI) return;
        listaFondosUI.innerHTML = '';
        const fondos = userData.fondos || [];

        if (fondos.length === 0) {
            listaFondosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés presupuestos.</li>';
            return;
        }

        fondos.forEach((f, index) => {
            const li = document.createElement('li');
            li.className = 'fondo-item mb-15'; 
            li.innerHTML = `
                <div class="fondo-info">
                    <strong class="fondo-titulo">${f.nombre}</strong>
                    <span class="fondo-cats">Aplica en: ${f.categorias.join(', ')}</span>
                </div>
                <div class="fondo-acciones text-right">
                    <span class="fondo-monto">$ ${f.monto.toLocaleString('es-AR')}</span>
                    <button class="btn-text-red btn-delete-fondo" data-idx="${index}">Eliminar</button>
                </div>
            `;
            listaFondosUI.appendChild(li);
        });

        listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                userData.fondos.splice(e.target.dataset.idx, 1);
                await guardarDatosGenerales();
                renderizarFondos();
            });
        });
    }

    async function guardarDatosGenerales() {
        try {
            await updateDoc(doc(db, "usuarios", currentUserUid), {
                categorias_personales: userData.categorias_personales,
                metodos_pago: userData.metodos_pago,
                fondos: userData.fondos
            });
        } catch(error) {
            console.error(error);
            toast.mostrar("Hubo un error al guardar.");
        }
    }
});