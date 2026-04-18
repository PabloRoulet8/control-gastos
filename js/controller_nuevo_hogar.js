import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();

    // Elementos de CREAR
    const formCrear = document.getElementById('form-crear-hogar');
    const inputNombre = document.getElementById('input-nombre-hogar');
    const btnCrear = document.getElementById('btn-crear');
    const panelResultado = document.getElementById('resultado-codigo');
    const textoCodigo = document.getElementById('texto-codigo');

    // Elementos de UNIRSE
    const formUnirse = document.getElementById('form-unirse-hogar');
    const inputCodigo = document.getElementById('input-codigo-hogar');
    const btnUnirse = document.getElementById('btn-unirse');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            
            // ACCIÓN 1: CREAR HOGAR
            formCrear.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nombre = inputNombre.value.trim();
                if (!nombre) return;

                btnCrear.textContent = "Creando...";
                btnCrear.disabled = true;

                try {
                    const resultado = await api.crearHogar(nombre);
                    toast.mostrar("¡Hogar creado con éxito!");
                    
                    // Mostramos el código mágico en pantalla
                    textoCodigo.textContent = resultado.codigo;
                    panelResultado.style.display = 'block';
                    inputNombre.value = '';
                    
                } catch (error) {
                    console.error(error);
                    toast.mostrar("Error al crear el hogar.");
                } finally {
                    btnCrear.textContent = "Crear y Generar Código";
                    btnCrear.disabled = false;
                }
            });

            // ACCIÓN 2: UNIRSE A HOGAR
            formUnirse.addEventListener('submit', async (e) => {
                e.preventDefault();
                const codigo = inputCodigo.value.trim();
                if (!codigo) return;

                btnUnirse.textContent = "Verificando...";
                btnUnirse.disabled = true;

                try {
                    const nombreHogar = await api.unirseAHogar(codigo);
                    toast.mostrar(`¡Te uniste a ${nombreHogar}! 🎉`);
                    
                    // Lo mandamos al inicio en 2 segundos para que vea su nueva tarjeta
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                    
                } catch (error) {
                    console.error(error);
                    // Mostramos el error específico (ej: Código inválido)
                    toast.mostrar(error.message);
                } finally {
                    btnUnirse.textContent = "Unirse al Hogar";
                    btnUnirse.disabled = false;
                }
            });
        }
    });
});