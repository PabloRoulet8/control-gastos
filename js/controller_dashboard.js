import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const saludoUI = document.getElementById('saludo-usuario');
    const avatarUI = document.getElementById('user-avatar');
    const contenedorHogares = document.getElementById('contenedor-hogares');
    const btnAddHogar = document.getElementById('btn-add-hogar');
    
    const api = new GastoRepository();
    const toast = new ToastManager();

    // Cambiamos el link para que vaya a admin en modo "creación"
    if (btnAddHogar) {
        btnAddHogar.href = 'admin_hogar.html?id=nuevo';
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // DETECTOR DE INVITACIÓN POR LINK (?join=CODIGO)
                const urlParams = new URLSearchParams(window.location.search);
                const codigoInvitacion = urlParams.get('join');

                if (codigoInvitacion) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    if (confirm("Te invitaron a un nuevo Hogar. ¿Querés unirte?")) {
                        await api.unirseAHogar(codigoInvitacion);
                        toast.mostrar("¡Bienvenido al hogar! 🎉");
                    }
                }

                // Carga de datos de perfil
                const userRef = doc(db, "usuarios", user.uid);
                const docSnap = await getDoc(userRef);
                let nombre = user.displayName || "Usuario";
                let emoji = nombre.charAt(0).toUpperCase();

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.nombre) nombre = data.nombre;
                    if (data.emoji) emoji = data.emoji;
                }

                saludoUI.textContent = `Hola, ${nombre}`;
                avatarUI.textContent = emoji;

                renderizarHogares();

            } catch (error) {
                console.error("Error:", error);
            }
        }
    });

    async function renderizarHogares() {
        // 1. Limpiamos el contenedor por completo
        contenedorHogares.innerHTML = '';

        // 2. CREAMOS TU TARJETA INDIVIDUAL
        const cardPersonal = document.createElement('a');
        cardPersonal.href = `carga.html?ambito=individual`; 
        cardPersonal.className = 'dashboard-card-link';
        cardPersonal.innerHTML = `
            <span class="icon">👤</span>
            <span class="title">Mis Gastos</span>
        `;
        contenedorHogares.appendChild(cardPersonal);

        // 3. Traemos los hogares compartidos
        const misHogares = await api.obtenerMisHogares();
        
        // 4. Dibujamos las tarjetas de los hogares ya creados
        misHogares.forEach(hogar => {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'dashboard-card-wrapper'; 

            // Verificamos si el usuario actual está en la lista de admins
            const esAdmin = hogar.administradores && hogar.administradores.includes(auth.currentUser.uid);

            cardWrapper.innerHTML = `
                <a href="carga.html?ambito=hogar&id=${hogar.id}&nombre=${encodeURIComponent(hogar.nombre)}" class="dashboard-card-link">
                    <span class="icon">🏘️</span>
                    <span class="title">${hogar.nombre}</span>
                </a>
                ${esAdmin ? `<a href="config_hogar.html?id=${hogar.id}" class="btn-config-gear" title="Panel de Control">⚙️</a>` : ''}
            `;
            // Agregamos la tarjeta al final de la lista actual
            contenedorHogares.appendChild(cardWrapper);
        });

        // 5. CREAMOS EL BOTÓN DE "+ NUEVO HOGAR" AL FINAL DE TODO
        const btnAddNuevo = document.createElement('a');
        btnAddNuevo.href = 'admin_hogar.html?id=nuevo';
        btnAddNuevo.className = 'dashboard-card-link card-add';
        btnAddNuevo.id = 'btn-add-hogar'; 
        btnAddNuevo.innerHTML = `
            <span class="icon">➕</span>
            <span class="title">Nuevo Hogar</span>
        `;
        contenedorHogares.appendChild(btnAddNuevo);
    }
});