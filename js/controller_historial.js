import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Instanciamos nuestras capas (Datos y UI)
    const repositorio = new GastoRepository();
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager();
    
    const listaGastos = document.getElementById('lista-gastos');

    // 2. Función principal
    const renderizarHistorial = async () => {
        listaGastos.innerHTML = '<p style="text-align:center; padding:20px;">Cargando movimientos...</p>';
        
        try {
            const gastos = await repositorio.obtenerGastos({ ordenPor: "timestamp", ordenDireccion: "desc" });
            listaGastos.innerHTML = ''; 

            if (gastos.length === 0) {
                listaGastos.innerHTML = '<p style="text-align:center; padding:20px;">No hay gastos registrados aún.</p>';
                return;
            }

            gastos.forEach((gasto) => {
                const item = document.createElement('div');
                const esMostri = (gasto.responsable === 'pablo' || gasto.responsable === 'mostri');
                let claseTipo = gasto.tipo === 'individual' ? (esMostri ? 'individual-pablo' : 'individual-yanet') : 'general';
                
                item.className = `gasto-item ${claseTipo}`;
                item.innerHTML = `
                    <div class="gasto-info">
                        <strong>${gasto.categoria}</strong> 
                        <span class="fecha">${gasto.fecha} — ${gasto.responsable.toUpperCase()}</span>
                    </div>
                    <div class="gasto-acciones">
                        <span class="monto">$ ${gasto.monto.toLocaleString('es-AR')}</span>
                        <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar">🗑️</button>
                    </div>
                `;
                listaGastos.appendChild(item);
            });

            // Agregamos el evento de eliminar
            document.querySelectorAll('.btn-eliminar').forEach(boton => {
                boton.addEventListener('click', async (e) => {
                    const idGasto = e.currentTarget.getAttribute('data-id');
                    
                    // USAMOS NUESTRO GESTOR VISUAL EN VEZ DE confirm()
                    const quiereBorrar = await confirmacion.preguntar(
                        "Eliminar Gasto", 
                        "¿Estás seguro de que querés borrar este registro de la base de datos?"
                    );
                    
                    if (quiereBorrar) {
                        try {
                            await repositorio.eliminarGasto(idGasto);
                            toast.mostrar("Gasto eliminado correctamente"); // USAMOS TOAST EN VEZ DE alert()
                            renderizarHistorial(); 
                        } catch (error) {
                            toast.mostrar("Error al borrar: " + error.message);
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error:", error);
            listaGastos.innerHTML = '<p>Error al conectar. Revisá tu conexión.</p>';
        }
    };

    renderizarHistorial();
});