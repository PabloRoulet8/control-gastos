import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { PerfilPublicoService } from "./services/PerfilPublicoService.js";
import { ToastManager } from "./ui/ToastManager.js";
import { PerfilRenderer } from "./ui/PerfilRenderer.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    let currentUserUid = null;
    let userData = {};

    const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    const displayNombre = document.getElementById('display-nombre-perfil');
    const inputNombre = document.getElementById('input-nombre');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    const btnToggleEditNombre = document.getElementById('btn-toggle-edit-nombre');
    const boxEditNombre = document.getElementById('box-edit-nombre');

    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const inputNuevoPago = document.getElementById('input-nuevo-pago');
    const btnAddPago = document.getElementById('btn-add-pago');
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');

    const renderer = new PerfilRenderer(async () => await guardarDatosGenerales());

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

    // Lógica del lápiz para el nombre
    const viewModeNombre = document.getElementById('view-mode-nombre');
    const editModeNombre = document.getElementById('edit-mode-nombre');
    const btnCancelarEdit = document.getElementById('btn-cancelar-edit');

    if (btnToggleEditNombre) {
        btnToggleEditNombre.addEventListener('click', () => {
            viewModeNombre.style.display = 'none';
            editModeNombre.style.display = 'flex';
            inputNombre.focus(); // Autoselecciona el input para escribir directo
        });
    }

if (btnCancelarEdit) {
        btnCancelarEdit.addEventListener('click', () => {
            editModeNombre.style.display = 'none';
            viewModeNombre.style.display = 'flex';
            inputNombre.value = displayNombre.textContent;
        });
    }

    NavigationBuilder.buildNav('personal', null);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            await cargarDatosUsuario();
        } else {
            window.location.href = 'login.html'; 
        }
    });

    async function cargarDatosUsuario() {
        try {
            userData = await api.obtenerUsuario(currentUserUid) || { nombre: "", categorias_personales: [], metodos_pago: ["Efectivo / Transferencia"], fondos: [] };

            userData.categorias_personales = (userData.categorias_personales || []).map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c);

            if (displayNombre) displayNombre.textContent = userData.nombre || "Usuario";
            if (inputNombre) inputNombre.value = userData.nombre || "";

            renderer.renderizarCategorias(userData);
            renderer.renderizarPagos(userData);
            renderer.renderizarFondos(userData);
        } catch (error) { toast.mostrar("Error al cargar datos."); }
    }

    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', async () => {
            const nombre = capitalizar(inputNombre.value.trim()); 
            if (!nombre) return toast.mostrar("Ingresá un nombre.");
            
            btnGuardarPerfil.textContent = "Guardando...";
            try {
                await api.actualizarUsuario(currentUserUid, { nombre });
                userData.nombre = nombre;

                try {
                    await PerfilPublicoService.sincronizar(currentUserUid, nombre, userData.avatar_url || '');
                } catch (error) {
                    console.warn("No se pudo sincronizar el perfil público:", error);
                }

                toast.mostrar("¡Nombre actualizado!");
                displayNombre.textContent = nombre;
                editModeNombre.style.display = 'none';
                viewModeNombre.style.display = 'flex';
            } catch (error) { toast.mostrar("Error al guardar."); } 
            finally { btnGuardarPerfil.textContent = "Guardar"; }
        });
    }

    if (btnAddCat) {
        btnAddCat.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevaCat.value.trim());
            if (!nombre) return;
            
            // BLINDAJE 1: Nos aseguramos de que el array exista antes de buscar nada
            if (!userData.categorias_personales) {
                userData.categorias_personales = [];
            }
            
            // BLINDAJE 2: Buscamos de forma segura, incluso si la categoría guardada es un texto simple en vez de un objeto
            const existe = userData.categorias_personales.find(c => {
                const nombreCat = typeof c === 'string' ? c : c.nombre;
                return nombreCat && nombreCat.toLowerCase() === nombre.toLowerCase();
            });
            
            if (existe) return toast.mostrar("Esa categoría ya existe");
            
            // BLINDAJE 3: Forzamos el guardado de la nueva categoría como un objeto
            userData.categorias_personales.push({ nombre: nombre, es_fijo: false, lleva_stock: false });
            inputNuevaCat.value = '';
            
            try {
                // Guardamos, notificamos y re-dibujamos
                await guardarDatosGenerales();
                renderer.renderizarCategorias(userData);
                toast.mostrar("¡Categoría agregada!"); // Le damos feedback visual a Yane
            } catch (error) {
                console.error("Error al guardar la categoría:", error);
                toast.mostrar("Error al guardar en la nube.");
            }
        });
    }

    if (btnAddPago) {
        btnAddPago.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevoPago.value.trim());
            if (!nombre) return;
            
            if (!userData.metodos_pago) userData.metodos_pago = [];
            if (userData.metodos_pago.find(p => p.toLowerCase() === nombre.toLowerCase())) return toast.mostrar("Ese método ya existe");
            
            userData.metodos_pago.push(nombre);
            inputNuevoPago.value = '';
            
            await guardarDatosGenerales();
            renderer.renderizarPagos(userData);
        });
    }

     if(btnCrearFondo) {
         btnCrearFondo.addEventListener('click', async () => {
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

             if(!userData.fondos) userData.fondos = [];
             userData.fondos.push({ id: Date.now().toString(), nombre, monto, categorias: seleccionadas });

             inputNombreFondo.value = '';
             inputMontoFondo.value = '';
             document.querySelectorAll('input[name="cat-vinculo-check"], input[name="cat-vinculo-custom"]').forEach(chk => chk.checked = false);
             const textSpan = document.getElementById('dropdown-text');
             if(textSpan) textSpan.textContent = "Seleccionar categorías...";

             await guardarDatosGenerales();
             renderer.renderizarFondos(userData);
toast.mostrar("¡Presupuesto creado!");
          });
      }

    async function guardarDatosGenerales() {
         try {
             // 1. EL BLINDAJE: Nos aseguramos de que NINGÚN dato viaje como "undefined".
             // Si no existen, le mandamos un array vacío a Firebase para que no se cuelgue.
             const datosLimpios = {
                 categorias_personales: userData.categorias_personales || [],
                 metodos_pago: userData.metodos_pago || ["Efectivo / Transferencia"],
                 fondos: userData.fondos || []
             };

             // 2. Guardamos en Firebase usando los datos limpios
             await api.actualizarUsuario(currentUserUid, datosLimpios);

             if (userData.nombre) {
                 try {
                     await PerfilPublicoService.sincronizar(currentUserUid, userData.nombre, userData.avatar_url || '');
                 } catch (error) {
                     console.warn("No se pudo sincronizar el perfil público:", error);
                 }
             }
             
             // Si llega hasta acá, Firebase lo aceptó perfecto.
             console.log("Guardado exitoso en Firebase");
             
         } catch(error) {
             console.error(error);
             
             // 3. LA SONDA DE DIAGNÓSTICO: Este cartelito feo va a saltar en el medio 
             // de la pantalla del iPhone de Yane gritándonos cuál es el problema real.
             alert("⚠️ ERROR DE FIREBASE: " + error.message);
             
             toast.mostrar("Hubo un error al guardar.");
         }
    }
});