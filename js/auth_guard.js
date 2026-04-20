import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// 1. EL PATOVICA (Esto ya lo tenías)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html"; 
    } else if (user && !user.emailVerified) {
        alert("⚠️ Tu cuenta no está verificada. Por favor, revisá tu correo electrónico y hacé clic en el enlace de confirmación.");
        await signOut(auth);
        window.location.href = "login.html";
    }
});

// ==========================================
// 2. LÓGICA DEL BOTÓN DE CERRAR SESIÓN (Lo Nuevo)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            try {
                // Le pedimos a Firebase que cierre la sesión
                await signOut(auth);
                // ¡Magia! No hace falta redirigir acá, porque al cerrarse la sesión, 
                // el "Patovica" de arriba se da cuenta al instante y lo patea al login.
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alert("Hubo un problema al intentar cerrar la sesión.");
            }
        });
    }
});