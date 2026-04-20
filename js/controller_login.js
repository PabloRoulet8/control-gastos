import { auth } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const form = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const btnSubmit = document.getElementById('btn-accion'); // <-- Corregido para que coincida con tu HTML
    const btnToggle = document.getElementById('btn-toggle-mode');
    const toggleText = document.getElementById('toggle-text');
    const formTitle = document.getElementById('form-title');
    const btnGoogle = document.getElementById('btn-google');

    let isLoginMode = true; // Empieza en modo Login

    // ==========================================
    // ALTERNAR ENTRE LOGIN Y REGISTRO
    // ==========================================
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

    // ==========================================
    // INGRESO Y REGISTRO CLÁSICO (Correo/Contraseña)
    // ==========================================
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
                // INICIAR SESIÓN
                await signInWithEmailAndPassword(auth, email, password);
                toast.mostrar("¡Sesión iniciada! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } else {
                // REGISTRARSE
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // 1. Mandamos el mail de verificación
                await sendEmailVerification(userCredential.user);
                
                // 2. Avisamos y cerramos la sesión temporalmente para obligarlo a verificar
                alert("¡Cuenta creada! Por favor, revisá tu correo (y la carpeta de SPAM) para verificar tu cuenta antes de ingresar.");
                await signOut(auth);
                
                // 3. Limpiamos el formulario y lo devolvemos a la pantalla de "Iniciar Sesión"
                form.reset(); 
                btnToggle.click(); // Simula un clic para cambiar la vista a Login automáticamente
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

    // ==========================================
    // INICIO DE SESIÓN CON GOOGLE
    // ==========================================
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                // Abre la ventanita emergente de Google
                const resultado = await signInWithPopup(auth, provider);
                
                // Las cuentas de Google ya vienen verificadas, pasan directo
                toast.mostrar("¡Sesión iniciada con Google! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } catch (error) {
                console.error("Error con Google:", error);
                
                // Evitamos mostrar error si el usuario simplemente se arrepintió y cerró la ventanita
                if (error.code !== 'auth/popup-closed-by-user') {
                    toast.mostrar("No se pudo iniciar sesión con Google.");
                }
            }
        });
    }
});