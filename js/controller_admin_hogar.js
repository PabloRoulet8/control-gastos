import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { AdminHogarRenderer } from "./ui/AdminHogarRenderer.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const renderer = new AdminHogarRenderer();
    const urlParams = new URLSearchParams(window.location.search);
    
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

    const btnToggleAddFondo = document.getElementById('btn-toggle-add-fondo');
    const formAddFondoBox = document.getElementById('form-add-fondo-box');
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');

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

    // Callbacks para que el Renderer notifique al Controlador
    const actualizarCategorias = () => {
        renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
    };

    const eliminarPresupuesto = (idAEliminar) => {
        presupuestosBorrador = presupuestosBorrador.filter(p => p.id !== idAEliminar);
        renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
    };

    if (esModoCreacion) {
        document.getElementById('header-titulo').textContent = "Nuevo Hogar";
        if(seccionNombre) seccionNombre.style.display = 'block';
        btnAccionFinal.textContent = "Crear Hogar y Generar Link";
        
        renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
        
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
                
                const esAdmin = data.administradores && data.administradores.includes(user.uid);
                if (!esAdmin) {
                    toast.mostrar("⚠️ Acceso denegado.");
                    setTimeout(() => window.location.href = 'index.html', 1500);
                    return;
                }
                
                categoriasBorrador = (data.categorias_compartidas || []).map(c => ({
                    ...c, activa: c.activa !== false 
                }));
                presupuestosBorrador = data.presupuestos_compartidos || [];

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

                renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
                renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
            }
        }
    });

    btnAddCat.addEventListener('click', () => {
        const nombre = capitalizar(inputNuevaCat.value.trim()); 
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
        actualizarCategorias();
    });

    btnCrearFondo.addEventListener('click', () => {
        const nombre = capitalizar(inputNombreFondo.value.trim()); 
        const monto = parseFloat(inputMontoFondo.value);
        let seleccionadas = [];

        const checksGrid = document.querySelectorAll('input[name="cat-vinculo-check"]:checked');
        const checksCustom = document.querySelectorAll('input[name="cat-vinculo-custom"]:checked');

        if (checksGrid.length > 0) seleccionadas = Array.from(checksGrid).map(c => c.value);
        else if (checksCustom.length > 0) seleccionadas = Array.from(checksCustom).map(c => c.value);

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

        renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
        toast.mostrar("¡Presupuesto creado!");
    });

    if (btnAccionFinal) {
        btnAccionFinal.addEventListener('click', async () => {
            btnAccionFinal.disabled = true;
            const textoOriginal = btnAccionFinal.textContent;
            
            try {
                if (esModoCreacion) {
                    const nombreHogar = capitalizar(inputNombreHogar.value.trim()); 
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