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
        const linksViejos = contenedorHogares.querySelectorAll('.dashboard-card-link');
        linksViejos.forEach(link => link.remove());

        const misHogares = await api.obtenerMisHogares();
        misHogares.forEach(hogar => {
            const card = document.createElement('a');
            card.href = `carga.html?ambito=hogar&id=${hogar.id}&nombre=${encodeURIComponent(hogar.nombre)}`;
            card.className = 'dashboard-card-link';
            card.innerHTML = `<span class="icon">🏘️</span><span class="title">${hogar.nombre}</span>`;
            contenedorHogares.insertBefore(card, btnAddHogar);
        });
    }
});