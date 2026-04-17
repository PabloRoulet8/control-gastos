import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const form = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const btnSubmit = document.getElementById('btn-submit');
    const btnToggle = document.getElementById('btn-toggle-mode');
    const toggleText = document.getElementById('toggle-text');
    const formTitle = document.getElementById('form-title');

    let isLoginMode = true; // Empieza en modo Login

    // Lógica para alternar entre Login y Registro
    btnToggle.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            formTitle.textContent = 'Iniciar Sesión';
            btnSubmit.textContent = 'Ingresar';
            toggleText.textContent = '¿No tenés cuenta?';
            btnToggle.textContent = 'Registrate acá';
        } else {
            formTitle.textContent = 'Crear Cuenta Nueva';
            btnSubmit.textContent = 'Registrarse';
            toggleText.textContent = '¿Ya tenés cuenta?';
            btnToggle.textContent = 'Ingresá acá';
        }
    });

    // Lógica al enviar el formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            toast.mostrar("Completá todos los campos.");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Cargando...";

        try {
            if (isLoginMode) {
                // Iniciar sesión
                await signInWithEmailAndPassword(auth, email, password);
                toast.mostrar("¡Sesión iniciada! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } else {
                // Registrarse
                await createUserWithEmailAndPassword(auth, email, password);
                toast.mostrar("¡Cuenta creada exitosamente! 🎉");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            }
        } catch (error) {
            console.error("Auth error:", error);
            let mensajeError = "Error de autenticación.";
            
            // Traducimos los errores más comunes de Firebase
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                mensajeError = "Correo o contraseña incorrectos.";
            } else if (error.code === 'auth/email-already-in-use') {
                mensajeError = "El correo ya está registrado.";
            } else if (error.code === 'auth/weak-password') {
                mensajeError = "La contraseña debe tener al menos 6 caracteres.";
            }
            
            toast.mostrar(mensajeError);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = isLoginMode ? 'Ingresar' : 'Registrarse';
        }
    });
});