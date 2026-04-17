import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// El "Patovica": Escucha constantemente el estado del usuario
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Si no hay usuario logueado, lo pateamos sin piedad a la pantalla de login
        window.location.replace("login.html");
    } else {
        console.log("Sesión activa de:", user.email);
    }
});

// Función global para cerrar sesión (la conectaremos a un botón enseguida)
window.cerrarSesion = () => {
    signOut(auth).then(() => {
        window.location.replace("login.html");
    }).catch((error) => {
        console.error("Error al cerrar sesión", error);
    });
};