import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";// NUEVO: Importamos el repositorio y el Toast para gestionar la unión
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const contenedorHogares = document.getElementById('contenedor-hogares');
    const saludoUsuario = document.getElementById('saludo-usuario');
    const displayAvatar = document.getElementById('display-avatar-header');
    
    const api = new GastoRepository();
    const toast = new ToastManager();

    // 1. GESTIÓN DE NAVEGACIÓN (Protección contra sobreescritura de URL)
    const actualizarEnlacesNavegacion = () => {
        document.querySelectorAll('.bottom-nav a').forEach(link => {
            if (link.href.includes('ambito=unificado') || link.id === 'btn-unificado-fijo') {
                link.href = "resumen.html?v=9.5&ambito=unificado";
                return; 
            }
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('v', '9.5');
            link.href = url.toString();
        });
    };

    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = 'login.html');
        });
    }
    
    // Toggle theme en header (botón moon/sun) - ID corregido
    const btnToggleTheme = document.getElementById('theme-toggle-btn');
    if (btnToggleTheme) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const iconEl = btnToggleTheme.querySelector('i');
        
        if (iconEl) {
            if (currentTheme === 'light') {
                iconEl.setAttribute('data-lucide', 'sun');
            } else {
                iconEl.setAttribute('data-lucide', 'moon');
            }
        }
        
        // Ejecutar después de Lucide para evitar null
        setTimeout(() => {
            if (window.lucide) window.lucide.createIcons();
        }, 100);
        
        btnToggleTheme.addEventListener('click', () => {
            const html = document.documentElement;
            const isDark = html.getAttribute('data-theme') === 'dark';
            const icon = btnToggleTheme.querySelector('i');
            
            if (isDark) {
                html.setAttribute('data-theme', 'light');
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                if (icon) icon.setAttribute('data-lucide', 'sun');
            } else {
                html.setAttribute('data-theme', 'dark');
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                if (icon) icon.setAttribute('data-lucide', 'moon');
            }
            
            setTimeout(() => {
                if (window.lucide) window.lucide.createIcons();
            }, 50);
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            actualizarEnlacesNavegacion();

            // NUEVO: Revisamos si hay un código de invitación pendiente en la mochila
            const pendingCode = localStorage.getItem('pendingJoinCode');
            if (pendingCode) {
                localStorage.removeItem('pendingJoinCode'); // Vaciamos la mochila
                try {
                    const nombreHogar = await api.unirseAHogar(pendingCode);
                    toast.mostrar(`¡Bienvenido al hogar: ${nombreHogar}! 🎉`, 4000);
                } catch (error) {
                    toast.mostrar(error.message || "No se pudo unir al hogar.");
                }
            }

            // Cargamos el dashboard (ahora incluirá el nuevo hogar si se unió)
            await cargarDashboard(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    async function cargarDashboard(uid) {
        if (!contenedorHogares) return;
        contenedorHogares.innerHTML = '';
        
        try {
            const userRef = doc(db, "usuarios", uid);
            const userSnap = await getDoc(userRef);
            let userData = {};
            let necesitaNombre = false;
            
            // Verificamos si el usuario existe y si tiene un nombre guardado
            if (userSnap.exists()) {
                userData = userSnap.data();
                if (!userData.nombre || userData.nombre.trim() === "") necesitaNombre = true;
            } else {
                necesitaNombre = true; // Si no existe el documento, necesita nombre
            }

            // === LÓGICA DEL CARTEL OBLIGATORIO ===
            if (necesitaNombre) {
                const modalOnboarding = document.getElementById('modal-onboarding');
                const btnGuardarOnboarding = document.getElementById('btn-guardar-onboarding');
                const inputNombreOnboarding = document.getElementById('input-nombre-onboarding');

                if (modalOnboarding) modalOnboarding.style.display = 'flex';

                // Usamos onclick para no duplicar eventos si la función se llama varias veces
                btnGuardarOnboarding.onclick = async () => {
                    const nuevoNombre = inputNombreOnboarding.value.trim();
                    if (!nuevoNombre) return toast.mostrar("Por favor, ingresá cómo querés llamarte.");
                    
                    btnGuardarOnboarding.disabled = true;
                    btnGuardarOnboarding.textContent = "Guardando...";

                    try {
                        // setDoc con merge: true crea el doc si no existe, o lo actualiza si existe
                        await setDoc(userRef, { 
                            nombre: nuevoNombre.charAt(0).toUpperCase() + nuevoNombre.slice(1) 
                        }, { merge: true });
                        
                        modalOnboarding.style.display = 'none';
                        toast.mostrar("¡Excelente! Ya podés usar la app.");
                        
                        // Recargamos el dashboard para que se dibuje todo correctamente
                        await cargarDashboard(uid);
                    } catch (error) {
                        toast.mostrar("Error al guardar.");
                        btnGuardarOnboarding.disabled = false;
                        btnGuardarOnboarding.textContent = "Comenzar a usar la app";
                    }
                };
                
                // Cortamos la ejecución acá para que no dibuje el dashboard de fondo
                return; 
            }
            // ===================================

            // Si ya tiene nombre, seguimos dibujando el Dashboard normal
            if (saludoUsuario) saludoUsuario.textContent = `Hola, ${userData.nombre}`;
            if (displayAvatar) displayAvatar.textContent = userData.nombre ? userData.nombre.charAt(0).toUpperCase() : 'U';

             // === TARJETA PERSONAL (LIMPIA) ===
             const cardPersonal = document.createElement('div');
             cardPersonal.className = 'dashboard-card-wrapper';
             cardPersonal.innerHTML = `
                 <a href="carga.html?v=9.5&ambito=personal" class="dashboard-card-link">
                     <span class="icon"><i data-lucide="user"></i></span>
                     <span class="title">Mis Gastos</span>
                 </a>
             `;
             contenedorHogares.appendChild(cardPersonal);

             // === TARJETAS HOGAR (CORREGIDAS) ===
             const hogaresRef = collection(db, "hogares");
             const q = query(hogaresRef, where("miembros", "array-contains", uid));
             const querySnapshot = await getDocs(q);

             // === TARJETAS HOGAR (LIMPIAS) ===
             querySnapshot.forEach((docHogar) => {
                 const hogar = docHogar.data();
                 const cardHogar = document.createElement('div');
                 cardHogar.className = 'dashboard-card-wrapper';
                 
                 cardHogar.innerHTML = `
                     <a href="carga.html?v=9.5&ambito=hogar&id=${docHogar.id}&nombre=${encodeURIComponent(hogar.nombre)}" class="dashboard-card-link">
                         <span class="icon"><i data-lucide="home"></i></span>
                         <span class="title">${hogar.nombre}</span>
                     </a>
                 `;
                 contenedorHogares.appendChild(cardHogar);
             });

             const cardNuevo = document.createElement('div');
             cardNuevo.className = 'dashboard-card-wrapper';
             cardNuevo.innerHTML = `
                 <a href="admin_hogar.html?v=9.5&id=nuevo" class="dashboard-card-link card-add">
                     <span class="icon"><i data-lucide="plus"></i></span>
                     <span class="title">Nuevo Hogar</span>
                 </a>
             `;
             contenedorHogares.appendChild(cardNuevo);

        } catch (error) {
            console.error("Error al cargar el dashboard:", error);
            contenedorHogares.innerHTML = '<p class="text-center" style="color:#ef4444; padding: 20px;">Error al cargar tus datos. Revisá tu conexión.</p>';
        }
    }
});