import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    
    // Selectores Datos
    const inputNombre = document.getElementById('input-nombre');
    const inputEmoji = document.getElementById('input-emoji');
    const avatarPreview = document.getElementById('avatar-preview');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    
    // Selectores Categorías
    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const listaCategorias = document.getElementById('lista-categorias-personales');

    // Selectores Pagos
    const inputNuevoPago = document.getElementById('input-nuevo-pago');
    const btnAddPago = document.getElementById('btn-add-pago');
    const listaPagos = document.getElementById('lista-pagos-personales');

    // Selectores Fondos Dinámicos
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');
    const listaFondosUI = document.getElementById('lista-fondos-personales');

    const modalConfirm = document.getElementById('custom-confirm');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const btnConfirmOk = document.getElementById('confirm-ok');
    const btnConfirmCancel = document.getElementById('confirm-cancel');

    let currentUser = null;

    inputEmoji.addEventListener('input', (e) => {
        avatarPreview.textContent = e.target.value || '👤';
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            cargarDatosUsuario(user.uid);
        }
    });

    function confirmarAccion(titulo, mensaje) {
        return new Promise((resolve) => {
            confirmTitle.textContent = titulo;
            confirmMessage.textContent = mensaje;
            modalConfirm.style.display = 'flex';

            const handleOk = () => { cleanup(); resolve(true); };
            const handleCancel = () => { cleanup(); resolve(false); };

            const cleanup = () => {
                modalConfirm.style.display = 'none';
                btnConfirmOk.removeEventListener('click', handleOk);
                btnConfirmCancel.removeEventListener('click', handleCancel);
            };

            btnConfirmOk.addEventListener('click', handleOk);
            btnConfirmCancel.addEventListener('click', handleCancel);
        });
    }

    async function cargarDatosUsuario(uid) {
        try {
            const userRef = doc(db, "usuarios", uid);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                inputNombre.value = data.nombre || '';
                inputEmoji.value = data.emoji || '👤';
                avatarPreview.textContent = data.emoji || '👤';
                
                const categoriasActuales = data.categorias_personales || [];
                
                // Usamos la nueva función inteligente para las categorías
                renderizarListaCategorias(categoriasActuales);
                
                // Mantenemos la función básica para los pagos
                renderizarLista(data.metodos_pago || [], listaPagos, eliminarPago);
                
                // Fondos
                actualizarChecksCategorias(categoriasActuales);
                renderizarFondos(data.fondos || []);

            } else {
                const catsDefault = [
                    { nombre: 'Alquiler', es_fijo: true, lleva_stock: false },
                    { nombre: 'Supermercado', es_fijo: true, lleva_stock: true },
                    { nombre: 'Salidas', es_fijo: false, lleva_stock: false }
                ];
                renderizarListaCategorias(catsDefault);
                renderizarLista(['Efectivo', 'MercadoPago', 'Tarjeta Crédito'], listaPagos, eliminarPago);
                actualizarChecksCategorias(catsDefault);
                renderizarFondos([]);
            }
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            toast.mostrar("Error al cargar tus datos.");
        }
    }

    btnGuardarPerfil.addEventListener('click', async () => {
        if (!currentUser) return;
        const nombre = inputNombre.value.trim();
        const emoji = inputEmoji.value.trim() || '👤';

        btnGuardarPerfil.disabled = true;
        btnGuardarPerfil.textContent = "Guardando...";

        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            await setDoc(userRef, { nombre: nombre, emoji: emoji }, { merge: true });
            toast.mostrar("¡Perfil actualizado! ✅");
        } catch (error) {
            toast.mostrar("Error al guardar.");
        } finally {
            btnGuardarPerfil.disabled = false;
            btnGuardarPerfil.textContent = "Guardar Cambios";
        }
    });

    // ==========================================
    // NUEVA GESTIÓN DE CATEGORÍAS (OBJETOS)
    // ==========================================
    function renderizarListaCategorias(categorias) {
        listaCategorias.innerHTML = '';
        if (categorias.length === 0) {
            listaCategorias.innerHTML = '<li class="text-center text-muted">No tenés categorías.</li>';
            return;
        }

        categorias.sort((a, b) => {
            const nameA = typeof a === 'string' ? a : a.nombre;
            const nameB = typeof b === 'string' ? b : b.nombre;
            return nameA.localeCompare(nameB);
        }).forEach(cat => {
            // Migración al vuelo para datos viejos
            const c = typeof cat === 'string' ? { nombre: cat, es_fijo: false, lleva_stock: false } : cat;
            
            const li = document.createElement('li');
            li.className = 'flex-between mb-10';
            li.style.padding = "10px";
            li.style.background = "#f9f9f9";
            li.style.borderRadius = "8px";
            
            li.innerHTML = `
                <span class="text-bold-dark" style="flex: 2;">${c.nombre}</span>
                <div style="flex: 1; text-align: center;">
                    <button class="btn-toggle" data-nombre="${c.nombre}" data-prop="es_fijo" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">
                        ${c.es_fijo ? '✅' : '⬜'}
                    </button>
                </div>
                <div style="flex: 1; text-align: center;">
                    <button class="btn-toggle" data-nombre="${c.nombre}" data-prop="lleva_stock" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">
                        ${c.lleva_stock ? '✅' : '⬜'}
                    </button>
                </div>
                <button class="btn-icon-white btn-delete-cat" data-cat="${c.nombre}" style="color: #d32f2f; font-size: 1.2rem; width: 40px;">🗑️</button>
            `;
            listaCategorias.appendChild(li);
        });

        listaCategorias.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', () => togglePropiedad(btn.dataset.nombre, btn.dataset.prop));
        });

        listaCategorias.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', (e) => eliminarCategoria(e.currentTarget.dataset.cat));
        });
    }

    async function togglePropiedad(nombreCat, propiedad) {
        if (!currentUser) return;
        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            const docSnap = await getDoc(userRef);
            const categorias = docSnap.data().categorias_personales || [];
            
            const nuevasCats = categorias.map(c => {
                const obj = typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c;
                if (obj.nombre === nombreCat) {
                    return { ...obj, [propiedad]: !obj[propiedad] };
                }
                return obj;
            });

            await updateDoc(userRef, { categorias_personales: nuevasCats });
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al actualizar."); }
    }

    btnAddCat.addEventListener('click', async () => {
        const nuevaCat = inputNuevaCat.value.trim();
        if (!nuevaCat || !currentUser) return;
        
        // Ahora guardamos un objeto completo
        const nuevoObjeto = { nombre: nuevaCat, es_fijo: false, lleva_stock: false };

        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            await setDoc(userRef, { categorias_personales: arrayUnion(nuevoObjeto) }, { merge: true });
            toast.mostrar(`Agregada: ${nuevaCat}`);
            inputNuevaCat.value = '';
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al agregar."); }
    });

    async function eliminarCategoria(nombreCat) {
        if (!currentUser) return;
        const confirmado = await confirmarAccion("Eliminar Categoría", `¿Borrar la categoría "${nombreCat}"?`);
        if (!confirmado) return;

        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            const docSnap = await getDoc(userRef);
            const categorias = docSnap.data().categorias_personales || [];
            
            // Filtramos manualmente para evitar errores de referencias de objetos
            const nuevasCats = categorias.filter(c => {
                const n = typeof c === 'string' ? c : c.nombre;
                return n !== nombreCat;
            });
            
            await updateDoc(userRef, { categorias_personales: nuevasCats });
            toast.mostrar(`Eliminada: ${nombreCat}`);
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al eliminar."); }
    }


    // ==========================================
    // LISTAS SIMPLES (Pagos)
    // ==========================================
    function renderizarLista(arrayDatos, elementoUI, funcionEliminar) {
        elementoUI.innerHTML = '';
        if (arrayDatos.length === 0) {
            elementoUI.innerHTML = '<li class="text-center text-muted">Lista vacía.</li>';
            return;
        }

        arrayDatos.sort().forEach(item => {
            const li = document.createElement('li');
            li.className = 'flex-between border-bottom-gray mb-15';
            li.style.paddingBottom = "10px";
            li.innerHTML = `
                <span class="text-bold-dark">${item}</span>
                <button class="btn-icon-white btn-delete-item" data-item="${item}" style="color: #d32f2f; font-size: 1.5rem;" title="Eliminar">🗑️</button>
            `;
            elementoUI.appendChild(li);
        });

        elementoUI.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => funcionEliminar(e.currentTarget.dataset.item));
        });
    }

    btnAddPago.addEventListener('click', async () => {
        const nuevoPago = inputNuevoPago.value.trim();
        if (!nuevoPago || !currentUser) return;
        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            await setDoc(userRef, { metodos_pago: arrayUnion(nuevoPago) }, { merge: true });
            toast.mostrar(`Agregado: ${nuevoPago}`);
            inputNuevoPago.value = '';
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al agregar."); }
    });

    async function eliminarPago(pago) {
        if (!currentUser) return;
        const confirmado = await confirmarAccion("Eliminar Método", `¿Borrar el método de pago "${pago}"?`);
        if (!confirmado) return;

        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            await updateDoc(userRef, { metodos_pago: arrayRemove(pago) });
            toast.mostrar(`Eliminado: ${pago}`);
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al eliminar."); }
    }

    // ==========================================
    // FONDOS
    // ==========================================
    function actualizarChecksCategorias(categorias) {
        if (!checkCategoriasUI) return;
        checkCategoriasUI.innerHTML = '';
        categorias.sort((a, b) => {
            const nA = typeof a === 'string' ? a : a.nombre;
            const nB = typeof b === 'string' ? b : b.nombre;
            return nA.localeCompare(nB);
        }).forEach(cat => {
            const n = typeof cat === 'string' ? cat : cat.nombre;
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '5px';
            label.style.fontSize = '0.9rem';
            label.innerHTML = `<input type="checkbox" name="cat-vinculo" value="${n}" class="checkbox-lg" style="width: 18px; height: 18px;"> ${n}`;
            checkCategoriasUI.appendChild(label);
        });
    }

    function renderizarFondos(fondos) {
        if (!listaFondosUI) return;
        listaFondosUI.innerHTML = '';
        if (fondos.length === 0) {
            listaFondosUI.innerHTML = '<li class="text-center text-muted">No tenés fondos configurados.</li>';
            return;
        }
        
        fondos.forEach(f => {
            const li = document.createElement('li');
            li.className = 'card mb-15'; 
            li.style.borderLeft = '5px solid #2e7d32';
            li.style.padding = '15px';
            li.innerHTML = `
                <div class="flex-between">
                    <div>
                        <strong style="font-size: 1.1rem; color: #1b5e20;">${f.nombre}</strong><br>
                        <span class="text-sm-gray" style="display: block; margin-top: 5px;">Aplica en: ${f.categorias.join(', ')}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-weight: bold; font-size: 1.2rem; color: #333;">$ ${f.monto.toLocaleString()}</span>
                        <button class="btn-delete-fondo" data-id="${f.id}" style="background: none; border: none; color: #d32f2f; cursor: pointer; padding: 5px; margin-top: 5px; font-weight: bold;">Eliminar</button>
                    </div>
                </div>
            `;
            listaFondosUI.appendChild(li);
        });

        listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', (e) => eliminarFondo(e.target.dataset.id));
        });
    }

    if (btnCrearFondo) {
        btnCrearFondo.addEventListener('click', async () => {
            const nombre = inputNombreFondo.value.trim();
            const monto = parseFloat(inputMontoFondo.value);
            const seleccionadas = Array.from(document.querySelectorAll('input[name="cat-vinculo"]:checked')).map(c => c.value);

            if(!nombre || isNaN(monto) || seleccionadas.length === 0) {
                return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
            }

            const nuevoFondo = {
                id: Date.now().toString(),
                nombre,
                monto,
                categorias: seleccionadas
            };

            btnCrearFondo.disabled = true;
            btnCrearFondo.textContent = "Creando...";

            try {
                const userRef = doc(db, "usuarios", currentUser.uid);
                await setDoc(userRef, { fondos: arrayUnion(nuevoFondo) }, { merge: true });
                toast.mostrar(`¡Fondo "${nombre}" creado!`);
                inputNombreFondo.value = '';
                inputMontoFondo.value = '';
                cargarDatosUsuario(currentUser.uid);
            } catch (error) { 
                toast.mostrar("Error al crear fondo."); 
            } finally {
                btnCrearFondo.disabled = false;
                btnCrearFondo.textContent = "Crear Fondo";
            }
        });
    }

    async function eliminarFondo(idFondo) {
        if (!currentUser) return;
        const confirmado = await confirmarAccion("Eliminar Fondo", "¿Seguro que querés eliminar este presupuesto?");
        if (!confirmado) return;
        
        try {
            const userRef = doc(db, "usuarios", currentUser.uid);
            const docSnap = await getDoc(userRef);
            const fondosActuales = docSnap.data().fondos || [];
            const nuevosFondos = fondosActuales.filter(f => f.id !== idFondo);
            
            await updateDoc(userRef, { fondos: nuevosFondos });
            toast.mostrar("Fondo eliminado.");
            cargarDatosUsuario(currentUser.uid);
        } catch (error) { toast.mostrar("Error al eliminar."); }
    }
});