import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const contenedorHogares = document.getElementById('contenedor-hogares');
    const saludoUsuario = document.getElementById('saludo-usuario');
    const displayAvatar = document.getElementById('display-avatar-header');

    // 1. GESTIÓN DE NAVEGACIÓN (Protección contra sobreescritura de URL)
    const actualizarEnlacesNavegacion = () => {
        document.querySelectorAll('.bottom-nav a').forEach(link => {
            // 1. Si es el botón de UNIFICADO, forzamos la ruta correcta y salimos
            if (link.href.includes('ambito=unificado') || link.id === 'btn-unificado-fijo') {
                link.href = "resumen.html?v=5.6&ambito=unificado";
                return; 
            }
            
            // 2. Para los demás, solo nos aseguramos de que tengan la versión de caché
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('v', '5.6');
            link.href = url.toString();
        });
    };

    // Botón de cerrar sesión
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = 'login.html');
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            actualizarEnlacesNavegacion();
            await cargarDashboard(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    async function cargarDashboard(uid) {
        if (!contenedorHogares) return;
        contenedorHogares.innerHTML = '';
        
        try {
            // 1. OBTENER DATOS DEL USUARIO
            const userRef = doc(db, "usuarios", uid);
            const userSnap = await getDoc(userRef);
            let userData = { nombre: "Usuario", emoji: "👤" };
            
            if (userSnap.exists()) {
                userData = userSnap.data();
            }
            
            // Actualizar el header con su nombre y emoji
            if (saludoUsuario) saludoUsuario.textContent = `Hola, ${userData.nombre}`;
            if (displayAvatar) displayAvatar.textContent = userData.emoji || "👤";

            // 2. TARJETA: MIS GASTOS (Personal)
            const cardPersonal = document.createElement('div');
            cardPersonal.className = 'dashboard-card-wrapper';
            cardPersonal.innerHTML = `
                <a href="carga.html?v=5.5&ambito=personal" class="dashboard-card-link">
                    <span class="icon">${userData.emoji || "👤"}</span>
                    <span class="title">Mis Gastos</span>
                </a>
                <a href="perfil.html?v=5.5" class="btn-config-gear" title="Configurar Mis Gastos">⚙️</a>
            `;
            contenedorHogares.appendChild(cardPersonal);

            // 3. TARJETAS: HOGARES
            const hogaresRef = collection(db, "hogares");
            const q = query(hogaresRef, where("miembros", "array-contains", uid));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((docHogar) => {
                const hogar = docHogar.data();
                const cardHogar = document.createElement('div');
                cardHogar.className = 'dashboard-card-wrapper';
                
                const esAdmin = hogar.administradores && hogar.administradores.includes(uid);
                
                cardHogar.innerHTML = `
                    <a href="carga.html?v=5.5&ambito=hogar&id=${docHogar.id}&nombre=${encodeURIComponent(hogar.nombre)}" class="dashboard-card-link">
                        <span class="icon">🏠</span>
                        <span class="title">${hogar.nombre}</span>
                    </a>
                    ${esAdmin ? `<a href="config_hogar.html?v=5.5&id=${docHogar.id}" class="btn-config-gear" title="Configurar Hogar">⚙️</a>` : ''}
                `;
                contenedorHogares.appendChild(cardHogar);
            });

            // 4. TARJETA: NUEVO HOGAR
            const cardNuevo = document.createElement('div');
            cardNuevo.className = 'dashboard-card-wrapper';
            cardNuevo.innerHTML = `
                <a href="admin_hogar.html?v=5.5&id=nuevo" class="dashboard-card-link card-add">
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