import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { GastoRepository } from "./api/GastoRepository.js";

document.addEventListener('DOMContentLoaded', () => {
    const saludoUI = document.getElementById('saludo-usuario');
    const avatarUI = document.getElementById('user-avatar');
    const contenedorHogares = document.getElementById('contenedor-hogares');
    const btnAddHogar = document.getElementById('btn-add-hogar');
    
    const api = new GastoRepository();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Mostrar nombre y la inicial en el cuadrado verde
            const nombre = user.displayName || "Usuario";
            saludoUI.textContent = `Hola, ${nombre}`;
            avatarUI.textContent = nombre.charAt(0).toUpperCase();

            // 2. Buscar si el usuario pertenece a algún hogar
            try {
                const misHogares = await api.obtenerMisHogares();
                
                misHogares.forEach(hogar => {
                    const card = document.createElement('a');
                    // Le pasamos por la URL a qué hogar estamos entrando
                    card.href = `carga.html?ambito=hogar&id=${hogar.id}&nombre=${encodeURIComponent(hogar.nombre)}`;
                    card.className = 'dashboard-card';
                    card.innerHTML = `
                        <span class="icon">🏘️</span>
                        <strong style="font-size: 1.05rem;">${hogar.nombre}</strong>
                    `;
                    // Insertamos la tarjeta del hogar antes del botón "+"
                    contenedorHogares.insertBefore(card, btnAddHogar);
                });
            } catch (error) {
                console.error("Error al cargar hogares:", error);
            }
        }
    });
});