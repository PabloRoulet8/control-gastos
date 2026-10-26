import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { HogarService } from "./services/HogarService.js";
import { PerfilPublicoService } from "./services/PerfilPublicoService.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const contenedorHogares = document.getElementById('contenedor-hogares');
    const saludoUsuario = document.getElementById('saludo-usuario');
    const displayAvatar = document.getElementById('display-avatar-header');
    
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

            const pendingCode = localStorage.getItem('pendingJoinCode');
            const pendingHogarId = localStorage.getItem('pendingJoinHogarId');

            if (pendingCode && pendingHogarId) {
                localStorage.removeItem('pendingJoinCode');
                localStorage.removeItem('pendingJoinHogarId');

                try {
                    await HogarService.consumirInvitacion(db, pendingHogarId, pendingCode, user.uid);
                    toast.mostrar("¡Te uniste al hogar! 🎉", 4000);
                } catch (error) {
                    toast.mostrar(error.message || "No se pudo unir al hogar.");
                }
            } else if (pendingCode || pendingHogarId) {
                localStorage.removeItem('pendingJoinCode');
                localStorage.removeItem('pendingJoinHogarId');
                toast.mostrar("El enlace de invitación no es válido.");
            }

            // Cargamos el dashboard (ahora incluirá el nuevo hogar si se unió)
            await cargarDashboard(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    async function cargarDashboard(uid) {
        if (!contenedorHogares) return;
        contenedorHogares.replaceChildren();
        
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

            PerfilPublicoService.sincronizar(
                db,
                uid,
                userData.nombre,
                userData.avatar_url || ''
            ).catch(error => {
                console.warn("No se pudo sincronizar el perfil público:", error);
            });

            // Si ya tiene nombre, seguimos dibujando el Dashboard normal
            if (saludoUsuario) saludoUsuario.textContent = `Hola, ${userData.nombre}`;
            if (displayAvatar) displayAvatar.textContent = userData.nombre ? userData.nombre.charAt(0).toUpperCase() : 'U';

             const crearTarjeta = (href, icono, titulo, claseExtra = '') => {
                 const card = document.createElement('div');
                 card.className = 'dashboard-card-wrapper';

                 const enlace = document.createElement('a');
                 enlace.href = href;
                 enlace.className = `dashboard-card-link${claseExtra ? ` ${claseExtra}` : ''}`;

                 const spanIcono = document.createElement('span');
                 spanIcono.className = 'icon';
                 const iconoElemento = document.createElement('i');
                 iconoElemento.setAttribute('data-lucide', icono);
                 spanIcono.appendChild(iconoElemento);

                 const spanTitulo = document.createElement('span');
                 spanTitulo.className = 'title';
                 spanTitulo.textContent = titulo;

                 enlace.append(spanIcono, spanTitulo);
                 card.appendChild(enlace);
                 return card;
             };

             // === TARJETA PERSONAL ===
             contenedorHogares.appendChild(
                 crearTarjeta('carga.html?v=9.5&ambito=personal', 'user', 'Mis Gastos')
             );

             // === TARJETAS HOGAR ===
             const hogaresRef = collection(db, "hogares");
             const q = query(hogaresRef, where("miembros", "array-contains", uid));
             const querySnapshot = await getDocs(q);

             querySnapshot.forEach((docHogar) => {
                 const hogar = docHogar.data();
                 const urlHogar = new URL('carga.html', window.location.href);
                 urlHogar.searchParams.set('v', '9.5');
                 urlHogar.searchParams.set('ambito', 'hogar');
                 urlHogar.searchParams.set('id', docHogar.id);
                 urlHogar.searchParams.set('nombre', hogar.nombre || '');

                 contenedorHogares.appendChild(
                     crearTarjeta(urlHogar.toString(), 'home', hogar.nombre || 'Hogar')
                 );
             });

             contenedorHogares.appendChild(
                 crearTarjeta('admin_hogar.html?v=9.5&id=nuevo', 'plus', 'Nuevo Hogar', 'card-add')
             );

        } catch (error) {
            console.error("Error al cargar el dashboard:", error);
            contenedorHogares.replaceChildren();
            const mensajeError = document.createElement('p');
            mensajeError.className = 'text-center';
            mensajeError.style.color = '#ef4444';
            mensajeError.style.padding = '20px';
            mensajeError.textContent = 'Error al cargar tus datos. Revisá tu conexión.';
            contenedorHogares.appendChild(mensajeError);
        }
    }
});