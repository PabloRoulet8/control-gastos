import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const urlParams = new URLSearchParams(window.location.search);
    
    let hogarId = urlParams.get('id');
    const esModoCreacion = (hogarId === 'nuevo');

    // --- SELECTORES ---
    const tituloPantalla = document.getElementById('titulo-hogar');
    const inputNombreHogar = document.getElementById('input-nombre-hogar');
    
    // El botón del final (reemplazando al rojo de Salir)
    const btnAccionFinal = document.querySelector('.btn-danger');

    // --- 1. CONFIGURACIÓN DEL FORMULARIO DE CREACIÓN ---
    if (esModoCreacion) {
        tituloPantalla.textContent = "Crear Nuevo Hogar";
        
        // Transformación del botón rojo al botón verde de creación al final
        if (btnAccionFinal) {
            btnAccionFinal.textContent = "Crear Hogar y Generar Link";
            btnAccionFinal.classList.remove('btn-danger');
            btnAccionFinal.classList.add('btn-success', 'btn-lg', 'w-100', 'mt-4');
        }

        // Ocultamos secciones que no pertenecen a la creación
        const seccionLink = document.getElementById('seccion-link-invitacion');
        const seccionIntegrantes = document.getElementById('seccion-integrantes');
        const btnGuardarArriba = document.getElementById('btn-guardar-nombre');

        if (seccionLink) seccionLink.style.display = 'none';
        if (seccionIntegrantes) seccionIntegrantes.style.display = 'none';
        if (btnGuardarArriba) btnGuardarArriba.style.display = 'none';
    }

    // --- 2. LÓGICA DE CREACIÓN INTEGRAL ---
    if (btnAccionFinal) {
        btnAccionFinal.addEventListener('click', async () => {
            if (!esModoCreacion) return; // Si no es creación, aquí iría la lógica de Salir

            const nombre = inputNombreHogar.value.trim();
            if (!nombre) {
                toast.mostrar("⚠️ Por favor, ingresá el nombre del hogar");
                inputNombreHogar.focus();
                return;
            }

            try {
                btnAccionFinal.disabled = true;
                btnAccionFinal.textContent = "Guardando Hogar...";

                // PASO A: Crear el hogar en Firebase (Obtenemos el ID y Código)
                const nuevoHogar = await api.crearHogar(nombre);
                const nuevoId = nuevoHogar.id;

                // PASO B: Capturar Categorías y Presupuestos del formulario
                // Aquí recorremos tus inputs de categorías y presupuestos actuales
                const categoriasInputs = document.querySelectorAll('.input-categoria-dinamica');
                const presupuestosInputs = document.querySelectorAll('.input-presupuesto-dinamico');
                
                let categoriasConfiguradas = [];
                let presupuestosConfigurados = {};

                categoriasInputs.forEach((input, index) => {
                    const catNombre = input.value.trim();
                    if (catNombre) {
                        categoriasConfiguradas.push(catNombre);
                        // Vinculamos el presupuesto si existe para esa categoría
                        if (presupuestosInputs[index]) {
                            presupuestosConfigurados[catNombre] = Number(presupuestosInputs[index].value) || 0;
                        }
                    }
                });

                // PASO C: Actualizamos el documento recién creado con la configuración
                await setDoc(doc(db, "hogares", nuevoId), {
                    categorias: categoriasConfiguradas,
                    presupuestos: presupuestosConfigurados
                }, { merge: true });

                toast.mostrar("¡Hogar y configuración guardados! 🏠");

                // PASO D: Redirigimos a la pantalla de "Éxito/Gestión" para ver el link
                setTimeout(() => {
                    window.location.href = `admin_hogar.html?id=${nuevoId}`;
                }, 1000);

            } catch (error) {
                console.error("Error en creación:", error);
                toast.mostrar("Error al crear el hogar");
                btnAccionFinal.disabled = false;
                btnAccionFinal.textContent = "Crear Hogar y Generar Link";
            }
        });
    }

    // --- 3. CARGA DE MODO EDICIÓN (Solo si ya existe el ID) ---
    onAuthStateChanged(auth, async (user) => {
        if (user && !esModoCreacion) {
            const docRef = doc(db, "hogares", hogarId);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const data = snap.data();
                tituloPantalla.textContent = data.nombre;
                inputNombreHogar.value = data.nombre;
                
                // Aquí mostraríamos el botón de Copiar Link que antes estaba oculto
                const seccionLink = document.getElementById('seccion-link-invitacion');
                if (seccionLink) seccionLink.style.display = 'block';
            }
        }
    });
});