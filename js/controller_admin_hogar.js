import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { HogarService } from "./services/HogarService.js";
import { ToastManager } from "./ui/ToastManager.js";
import { AdminHogarRenderer } from "./ui/AdminHogarRenderer.js";
import { AppUtils } from "./utils/AppUtils.js";

document.addEventListener("DOMContentLoaded", () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const renderer = new AdminHogarRenderer();
    const urlParams = new URLSearchParams(window.location.search);
    
    let hogarId = urlParams.get("id");
    const esModoCreacion = hogarId === "nuevo";
    
    let categoriasBorrador = [];
    let presupuestosBorrador = [];
    let metodosPagoBorrador = [];
    
    const seccionNombre = document.getElementById("seccion-nombre-hogar");
    const inputNombreHogar = document.getElementById("input-nombre-hogar");
    const btnAccionFinal = document.getElementById("btn-final");
    
    const btnToggleAddCat = document.getElementById("btn-toggle-add-cat");
    const formAddCatBox = document.getElementById("form-add-cat-box");
    const inputNuevaCat = document.getElementById("input-nueva-cat");
    const btnAddCat = document.getElementById("btn-add-cat");
    
    const btnToggleAddFondo = document.getElementById("btn-toggle-add-fondo");
    const formAddFondoBox = document.getElementById("form-add-fondo-box");
    const inputNombreFondo = document.getElementById("input-nombre-fondo");
    const inputMontoFondo = document.getElementById("input-monto-fondo");
    const btnCrearFondo = document.getElementById("btn-crear-fondo");
    
    const setupToggle = (btn, box) => {
        if(!btn || !box) return;
        btn.addEventListener("click", () => {
            const isHidden = box.style.display === "none";
            box.style.display = isHidden ? "block" : "none";
            if (isHidden) btn.classList.add("is-active");
            else btn.classList.remove("is-active");
        });
    };
    
    setupToggle(btnToggleAddCat, formAddCatBox);
    setupToggle(btnToggleAddFondo, formAddFondoBox);
    
    const actualizarCategorias = () => {
        renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
    };
    
    const eliminarPresupuesto = (idAEliminar) => {
        presupuestosBorrador = presupuestosBorrador.filter(p => p.id !== idAEliminar);
        renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
    };
    
    // Callback limpio y correcto para los métodos de pago
    const onListChangePago = (idx) => {
        metodosPagoBorrador.splice(idx, 1);
        renderer.renderizarPagos(metodosPagoBorrador, onListChangePago);
    };
    
    if (esModoCreacion) {
        const headerTitulo = document.getElementById("header-titulo");
        if(headerTitulo) headerTitulo.textContent = "Nuevo Hogar";
        if(seccionNombre) seccionNombre.style.display = "block";
        if(btnAccionFinal) btnAccionFinal.textContent = "Crear Hogar y Generar Link";
        
        renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
        
        if(formAddCatBox && btnToggleAddCat) {
             formAddCatBox.style.display = "block";
             btnToggleAddCat.classList.add("is-active");
        }
    } else {
        if(seccionNombre) seccionNombre.style.display = "none";
        if(btnAccionFinal) btnAccionFinal.textContent = "Guardar";
    }

    let hogarCreado = false;
    let modalInvitacionVisible = false;
    
    onAuthStateChanged(auth, async (user) => {
        if (hogarCreado || modalInvitacionVisible) return;

        if (user && !esModoCreacion) {
            const snap = await getDoc(doc(db, "hogares", hogarId));
            if (snap.exists()) {
                const data = snap.data();
                
                const esAdmin = data.administradores && data.administradores.includes(user.uid);
                if (!esAdmin) {
                    toast.mostrar("⚠️ Acceso denegado.");
                    setTimeout(() => window.location.href = "index.html", 1500);
                    return;
                }
                
                categoriasBorrador = (data.categorias_compartidas || []).map(c => ({
                    ...c, activa: c.activa !== false 
                }));
                presupuestosBorrador = data.presupuestos_compartidos || [];
                metodosPagoBorrador = data.metodos_pago || [];
                
                renderer.renderizarCategorias(categoriasBorrador, actualizarCategorias);
                renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
                renderer.renderizarPagos(metodosPagoBorrador, onListChangePago);
            }
        }
    });
    
    btnAddCat.addEventListener("click", () => {
        const nombre = AppUtils.capitalizar(inputNuevaCat.value.trim());
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
        
        inputNuevaCat.value = "";
        actualizarCategorias();
    });
    
    btnCrearFondo.addEventListener("click", () => {
        const nombre = AppUtils.capitalizar(inputNombreFondo.value.trim()); 
        const monto = parseFloat(inputMontoFondo.value);
        let seleccionadas = [];
        
        const checksGrid = document.querySelectorAll("input[name=cat-vinculo-check]:checked");
        const checksCustom = document.querySelectorAll("input[name=cat-vinculo-custom]:checked");
        
        if (checksGrid.length > 0) seleccionadas = Array.from(checksGrid).map(c => c.value);
        else if (checksCustom.length > 0) seleccionadas = Array.from(checksCustom).map(c => c.value);
        
        if (!nombre || isNaN(monto) || seleccionadas.length === 0) {
            return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
        }
        
        presupuestosBorrador.push({
            id: Date.now().toString(),
            nombre, monto, categorias: seleccionadas
        });
        
        inputNombreFondo.value = "";
        inputMontoFondo.value = "";
        
        document.querySelectorAll("input[name=cat-vinculo-check], input[name=cat-vinculo-custom]").forEach(chk => chk.checked = false);
        const textSpan = document.getElementById("dropdown-text");
        if(textSpan) textSpan.textContent = "Seleccionar categorías...";
        
        renderer.renderizarPresupuestos(presupuestosBorrador, eliminarPresupuesto);
        toast.mostrar("¡Presupuesto creado!");
    });
    
    const btnAgregarPago = document.getElementById("btn-agregar-pago-hogar");
    if (btnAgregarPago) {
        btnAgregarPago.addEventListener("click", (e) => {
            e.preventDefault();
            Swal.fire({
                title: "Nuevo Medio de Pago",
                input: "text",
                inputPlaceholder: "Ej: Transferencia Conjunta...",
                showCancelButton: true,
                confirmButtonText: "Agregar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#10b981",
                cancelButtonColor: "#64748b",
                background: "var(--bg-app)",
                color: "var(--text-main)",
                customClass: {
                    popup: "card",
                    title: "text-bold-dark"
                }
            }).then((result) => {
                if (result.isConfirmed && result.value.trim() !== "") {
                    const nombre = AppUtils.capitalizar(result.value.trim());
                    metodosPagoBorrador.push(nombre);
                    renderer.renderizarPagos(metodosPagoBorrador, onListChangePago);
                    toast.mostrar("¡Medio de pago agregado!");
                }
            });
        });
    }
    
    if (btnAccionFinal) {
        btnAccionFinal.addEventListener("click", async () => {
            if (btnAccionFinal.disabled || modalInvitacionVisible) return;

            btnAccionFinal.disabled = true;
            const textoOriginal = btnAccionFinal.textContent;

            const forzarDesbloqueoUI = () => {
                document.querySelectorAll(
                    '#loading-overlay, #overlay-carga, #loader, #modal-loading, .loading-overlay, .page-loader, [data-loading-overlay]'
                ).forEach(overlay => {
                    overlay.style.display = 'none';
                    overlay.setAttribute('aria-hidden', 'true');
                });

                document.body.classList.remove('loading', 'is-loading');
                document.documentElement.classList.remove('loading', 'is-loading');
                document.body.style.removeProperty('overflow');

                if (btnAccionFinal) {
                    btnAccionFinal.disabled = false;
                    btnAccionFinal.textContent = textoOriginal;
                }
            };
            
            try {
                if (esModoCreacion) {
                    const nombreHogar = AppUtils.capitalizar(inputNombreHogar.value.trim());

                    if (!nombreHogar) {
                        toast.mostrar("⚠️ Ingresá el nombre del hogar");
                        inputNombreHogar.focus();
                        return;
                    }
                    
                    btnAccionFinal.textContent = "Guardando...";
                    const nuevoHogar = await api.crearHogar(nombreHogar);
                    const nuevoId = nuevoHogar.id;
                    hogarCreado = true;

                    const urlActual = new URL(window.location.href);
                    urlActual.searchParams.set("id", nuevoId);
                    window.history.replaceState(null, "", urlActual.toString());
                    
                    await setDoc(doc(db, "hogares", nuevoId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador,
                        metodos_pago: metodosPagoBorrador,
                        miembros: [auth.currentUser.uid],
                        administradores: [auth.currentUser.uid]
                    }, { merge: true });
                    
                    const invitacion = await HogarService.generarInvitacion(db, nuevoId, auth.currentUser.uid);
                    const urlInvitacion = new URL("index.html", window.location.href);
                    urlInvitacion.searchParams.set("hogarId", nuevoId);
                    urlInvitacion.searchParams.set("join", invitacion.codigo);
                    const linkFinal = urlInvitacion.toString();
                    
                    const modalLink = document.getElementById("modal-link-invitacion");
                    const inputLink = document.getElementById("input-link-generado");
                    if (modalLink && inputLink) {
                        modalInvitacionVisible = true;
                        forzarDesbloqueoUI();
                        modalLink.style.display = "flex";
                        inputLink.value = linkFinal;
                        
                        const btnCopiar = document.getElementById("btn-copiar-link-modal");
                        const btnCerrar = document.getElementById("btn-cerrar-modal-link");
                        
                        if(btnCopiar) btnCopiar.onclick = () => {
                            navigator.clipboard.writeText(linkFinal);
                            toast.mostrar("¡Link copiado! 🔗");
                        };
                        
                        if(btnCerrar) btnCerrar.onclick = () => {
                            window.location.href = "index.html"; 
                        };
                    } else {
                        console.error("No se encontraron los elementos del modal de invitación");
                    }
                    
                } else {
                    btnAccionFinal.textContent = "Guardando...";
                    
                    await updateDoc(doc(db, "hogares", hogarId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador,
                        metodos_pago: metodosPagoBorrador
                    });
                    
                    toast.mostrar("¡Configuración actualizada! ✅");
                    setTimeout(() => window.location.href = `config_hogar.html?id=${hogarId}`, 1000);
                }
                
            } catch (error) {
                console.error("Error al guardar la configuración del hogar:", error);
                toast.mostrar("Error al guardar");
            } finally {
                try {
                    forzarDesbloqueoUI();
                } catch (error) {
                    console.error("No se pudo restaurar la UI:", error);
                }
            }
        });
    }
});