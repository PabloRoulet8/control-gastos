import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";

document.addEventListener('DOMContentLoaded', async () => {
    const repositorio = new GastoRepository();
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager();
    
    const listaGastosUI = document.getElementById('lista-gastos');
    
    // Selectores de filtros
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroResponsable = document.getElementById('filtro-responsable');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMes = document.getElementById('filtro-mes');

    let todosLosGastos = [];

    // Función para poblar el select de categorías dinámicamente
    const cargarFiltroCategorias = async () => {
        const categoriasMap = await repositorio.obtenerCategorias();
        if (!categoriasMap) return;

        // Unimos todas las listas (general, mostri, mostrina) y quitamos duplicados
        const todasLasCats = [
            ...categoriasMap.general,
            ...categoriasMap.mostri,
            ...categoriasMap.mostrina
        ];
        const catsUnicas = [...new Set(todasLasCats)].sort();

        catsUnicas.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; // Filtramos por el nombre exacto que se guarda en el gasto
            option.textContent = cat;
            filtroCategoria.appendChild(option);
        });
    };

    const renderizarHistorial = () => {
        listaGastosUI.innerHTML = '';
        
        let gastosFiltrados = todosLosGastos.filter(gasto => {
            const cumpleTipo = filtroTipo.value === 'todos' || gasto.tipo === filtroTipo.value;
            const cumpleResp = filtroResponsable.value === 'todos' || gasto.responsable === filtroResponsable.value;
            const cumpleMes = !filtroMes.value || gasto.fecha.startsWith(filtroMes.value);
            
            // LÓGICA DE FILTRO POR CATEGORÍA
            const cumpleCat = filtroCategoria.value === 'todas' || gasto.categoria === filtroCategoria.value;
            
            return cumpleTipo && cumpleResp && cumpleMes && cumpleCat;
        });

        if (gastosFiltrados.length === 0) {
            listaGastosUI.innerHTML = '<p style="text-align:center; padding:20px;">No se encontraron movimientos.</p>';
            return;
        }

        gastosFiltrados.forEach((gasto) => {
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
            listaGastosUI.appendChild(item);
        });

        // Eventos de eliminar
        document.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', async (e) => {
                const idGasto = e.currentTarget.getAttribute('data-id');
                if (await confirmacion.preguntar("Eliminar Gasto", "¿Estás seguro de borrar este registro?")) {
                    try {
                        await repositorio.eliminarGasto(idGasto);
                        toast.mostrar("Gasto eliminado");
                        cargarDatosIniciales();
                    } catch (error) {
                        toast.mostrar("Error al borrar");
                    }
                }
            });
        });
    };

    const cargarDatosIniciales = async () => {
        listaGastosUI.innerHTML = '<p style="text-align:center; padding:20px;">Cargando movimientos...</p>';
        try {
            todosLosGastos = await repositorio.obtenerGastos({ ordenPor: "timestamp", ordenDireccion: "desc" });
            renderizarHistorial();
        } catch (error) {
            listaGastosUI.innerHTML = '<p>Error de conexión.</p>';
        }
    };

    // Escuchar cambios en los filtros
    filtroTipo.addEventListener('change', renderizarHistorial);
    filtroResponsable.addEventListener('change', renderizarHistorial);
    filtroCategoria.addEventListener('change', renderizarHistorial);
    filtroMes.addEventListener('change', renderizarHistorial);

    // Inicialización
    await cargarFiltroCategorias();
    await cargarDatosIniciales();
});