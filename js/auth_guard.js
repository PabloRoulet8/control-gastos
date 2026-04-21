import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// 1. EL PATOVICA 
onAuthStateChanged(auth, async (user) => {
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!user) {
        // OPTIMIZACIÓN: Solo redirige si NO estás ya en la página de login (evita bucles)
        if (!isLoginPage) {
            window.location.href = "login.html"; 
        }
    } else if (user && !user.emailVerified) {
        alert("⚠️ Tu cuenta no está verificada. Por favor, revisá tu correo electrónico y hacé clic en el enlace de confirmación.");
        await signOut(auth);
        if (!isLoginPage) window.location.href = "login.html";
    }
});

// ==========================================
// 2. LÓGICA DEL BOTÓN DE CERRAR SESIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alert("Hubo un problema al intentar cerrar la sesión.");
            }
        });
    }
});