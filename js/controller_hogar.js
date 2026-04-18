import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const formFondo = document.getElementById('fondo-form');
    const inputFondo = document.getElementById('input-fondo');
    const btnGuardarFondo = document.getElementById('btn-guardar-fondo');

    // Escuchamos que haya sesión iniciada
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Leemos si ya hay un fondo guardado
                const docRef = doc(db, "config", "hogar_default_1");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists() && docSnap.data().fondo_comun) {
                    inputFondo.value = docSnap.data().fondo_comun;
                }
            } catch (error) {
                console.error("Error al cargar configuración:", error);
            }
        }
    });

    // Guardar el nuevo monto del fondo
    formFondo.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnGuardarFondo.textContent = "Guardando...";
        btnGuardarFondo.disabled = true;

        const nuevoMonto = parseFloat(inputFondo.value);

        try {
            await setDoc(doc(db, "config", "hogar_default_1"), { 
                fondo_comun: nuevoMonto 
            }, { merge: true });
            
            toast.mostrar("¡Fondo actualizado con éxito! 🏦");
        } catch (error) {
            toast.mostrar("Error al guardar.");
            console.error(error);
        } finally {
            btnGuardarFondo.textContent = "Guardar Configuración";
            btnGuardarFondo.disabled = false;
        }
    });
});