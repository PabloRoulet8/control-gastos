import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
// NUEVO: Importamos el repositorio y el Toast para gestionar la unión
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
                link.href = "resumen.html?v=9.0&ambito=unificado";
                return; 
            }
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('v', '9.0');
            link.href = url.toString();
        });
    };

    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = 'login.html');
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
            let userData = { nombre: "Usuario", emoji: "👤" };
            
            if (userSnap.exists()) {
                userData = userSnap.data();
            }
            
            if (saludoUsuario) saludoUsuario.textContent = `Hola, ${userData.nombre}`;
            if (displayAvatar) displayAvatar.textContent = userData.emoji || "👤";

            const cardPersonal = document.createElement('div');
            cardPersonal.className = 'dashboard-card-wrapper';
            cardPersonal.innerHTML = `
                <a href="carga.html?v=9.0&ambito=personal" class="dashboard-card-link">
                    <span class="icon">${userData.emoji || "👤"}</span>
                    <span class="title">Mis Gastos</span>
                </a>
                <a href="perfil.html?v=9.0" class="btn-config-gear" title="Configurar Mis Gastos">⚙️</a>
            `;
            contenedorHogares.appendChild(cardPersonal);

            const hogaresRef = collection(db, "hogares");
            const q = query(hogaresRef, where("miembros", "array-contains", uid));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((docHogar) => {
                const hogar = docHogar.data();
                const cardHogar = document.createElement('div');
                cardHogar.className = 'dashboard-card-wrapper';
                
                const esAdmin = hogar.administradores && hogar.administradores.includes(uid);
                
                cardHogar.innerHTML = `
                    <a href="carga.html?v=9.0&ambito=hogar&id=${docHogar.id}&nombre=${encodeURIComponent(hogar.nombre)}" class="dashboard-card-link">
                        <span class="icon">🏠</span>
                        <span class="title">${hogar.nombre}</span>
                    </a>
                    ${esAdmin ? `<a href="config_hogar.html?v=9.0&id=${docHogar.id}" class="btn-config-gear" title="Configurar Hogar">⚙️</a>` : ''}
                `;
                contenedorHogares.appendChild(cardHogar);
            });

            const cardNuevo = document.createElement('div');
            cardNuevo.className = 'dashboard-card-wrapper';
            cardNuevo.innerHTML = `
                <a href="admin_hogar.html?v=9.0&id=nuevo" class="dashboard-card-link card-add">
                    <span class="icon">➕</span>
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