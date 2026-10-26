import { GastoRepository } from "./api/GastoRepository.js";
import { HistorialRenderer } from "./ui/HistorialRenderer.js";
import { PerfilPublicoService } from "./services/PerfilPublicoService.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { AppUtils } from "./utils/AppUtils.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const renderer = new HistorialRenderer();
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = NavigationBuilder.normalizeAmbito(urlParams.get('ambito'));
    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');

    NavigationBuilder.buildConfigButton(ambitoActual, hogarId);
    NavigationBuilder.buildNav(ambitoActual, hogarId, 'historial');
    
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroResponsable = document.getElementById('filtro-responsable');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroTipoGroup = document.getElementById('filtro-tipo-group');
    const filtroResponsableGroup = document.getElementById('filtro-responsable-group');

    let todosLosGastos = [], mapaNombres = {}, categoriasGlobales = [];
    let cargaActual = 0;

    const obtenerOpcionesConsulta = () => {
        const mes = filtroMes?.value;

        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const [anio, numeroMes] = mes.split('-').map(Number);
            const inicio = new Date(anio, numeroMes - 1, 1);
            const fin = new Date(anio, numeroMes, 0);
            return {
                fechaInicio: AppUtils.getFechaLocal(inicio),
                fechaFin: AppUtils.getFechaLocal(fin),
                orden: 'desc'
            };
        }

        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 35, 1);
        return {
            fechaInicio: AppUtils.getFechaLocal(inicio),
            fechaFin: '9999-12-31',
            limite: 500,
            orden: 'desc'
        };
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (ambitoActual === 'hogar' && hogarId) {
                const hogar = await api.obtenerHogar(hogarId);
                if (hogar) {
                    if (tituloHeader) tituloHeader.textContent = hogar.nombre;
                    for (const uid of hogar.miembros || []) {
                        const perfil = await PerfilPublicoService.obtener(uid);
                        mapaNombres[uid] = perfil?.nombre || "Usuario";
                    }
                }
                if(filtroTipoGroup) filtroTipoGroup.style.display = 'block';
                if(filtroResponsableGroup) filtroResponsableGroup.style.display = 'block';
                
                renderer.renderizarFiltrosResponsables(mapaNombres);
            } else {
                if(filtroTipoGroup) filtroTipoGroup.style.display = 'none';
                if(filtroResponsableGroup) filtroResponsableGroup.style.display = 'none';
            }
            
            await cargarFiltroCategorias(user.uid);
            cargarDatos();
        }
    });

    const cargarFiltroCategorias = async (userId) => {
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const ambitoCat = ambitoActual === 'hogar' ? 'hogar' : 'personal';
        categoriasGlobales = await api.obtenerCategorias(contextoId, ambitoCat) || [];
        
        if (categoriasGlobales.length === 0 && todosLosGastos.length > 0) {
            const catsUnicas = [...new Set(todosLosGastos.map(g => g.categoria).filter(c => c))];
            categoriasGlobales = catsUnicas.sort().map(nombre => ({ nombre, es_fijo: false, lleva_stock: false }));
        }
        
        if (categoriasGlobales.length > 0) {
            const nombresCats = categoriasGlobales.map(c => typeof c === 'string' ? c : c.nombre);
            renderer.renderizarFiltrosCategorias([...new Set(nombresCats)].sort());
        }
    };

    const procesarFiltrosYRenderizar = () => {
        let gastosFiltrados = todosLosGastos.filter(gasto => {
            let cumpleTipo = true;
            if (filtroTipo && filtroTipo.style.display !== 'none' && filtroTipo.value !== 'todos') {
                const catConfig = categoriasGlobales.find(c => (typeof c === 'string' ? c : c.nombre) === gasto.categoria) || {};
                const esFijo = catConfig.es_fijo === true;
                const llevaStock = catConfig.lleva_stock === true;
                
                if (filtroTipo.value === 'fijo') cumpleTipo = esFijo && !llevaStock;
                else if (filtroTipo.value === 'stock') cumpleTipo = llevaStock;
                else if (filtroTipo.value === 'variable') cumpleTipo = !esFijo && !llevaStock;
            }
            
            const cumpleResp = (filtroResponsable && filtroResponsable.style.display !== 'none' && filtroResponsable.value !== 'todos') ? gasto.responsable === filtroResponsable.value : true;
            const cumpleMes = (filtroMes && filtroMes.value) ? gasto.fecha.startsWith(filtroMes.value) : true;
            const cumpleCat = (filtroCategoria && filtroCategoria.value !== 'todas') ? (gasto.categoria === filtroCategoria.value) : true;
            
            return cumpleTipo && cumpleResp && cumpleMes && cumpleCat;
        });

        renderer.renderLista(gastosFiltrados, auth.currentUser, ambitoActual, mapaNombres, (id) => {
            const gastoABorrar = todosLosGastos.find(g => g.id === id);
            const contexto = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
            
            // BORRADO INTELIGENTE: Verificamos si es una cuota que pertenece a una compra grupal
            if (gastoABorrar && gastoABorrar.es_cuota && gastoABorrar.compra_id) {
                Swal.fire({
                    title: 'Compra en Cuotas 💳',
                    text: '¿Querés eliminar SOLO esta cuota o TODA la compra completa?',
                    icon: 'warning',
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Borrar TODAS',
                    denyButtonText: 'Solo ESTA',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#ef4444',
                    denyButtonColor: '#f59e0b',
                    background: "var(--bg-app)",
                    color: "var(--text-main)"
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        // Borrar TODAS las cuotas que comparten el mismo ID de compra
                        const cuotas = await api.obtenerGastosPorCompra(gastoABorrar.compra_id, contexto);
                        Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                        await Promise.all(cuotas.map(c => api.eliminarGasto(c.id, contexto)));
                        Swal.close();
                        cargarDatos();
                    } else if (result.isDenied) {
                        // Borrar SOLO la cuota seleccionada
                        await api.eliminarGasto(id, contexto);
                        cargarDatos();
                    }
                });
            } else {
                // Borrado normal para gastos de 1 solo pago
                Swal.fire({
                    title: '¿Eliminar movimiento?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#ef4444',
                    background: "var(--bg-app)",
                    color: "var(--text-main)"
                }).then((result) => {
                    if (result.isConfirmed) {
                        api.eliminarGasto(id, contexto).then(() => cargarDatos());
                    }
                });
            }
        });
    };

    async function cargarDatos() {
        const idCarga = ++cargaActual;
        const contexto = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
        const gastos = await api.obtenerGastosPorRango(contexto, obtenerOpcionesConsulta()) || [];

        if (idCarga !== cargaActual) return;

        todosLosGastos = gastos;

        if (todosLosGastos.length > 0) {
            todosLosGastos.sort((a, b) => {
                const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.fecha).getTime() / 1000;
                const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.fecha).getTime() / 1000;
                return timeB - timeA;
            });
        }
        
        procesarFiltrosYRenderizar();
    }

    [filtroTipo, filtroResponsable, filtroCategoria].forEach(f => f?.addEventListener('change', procesarFiltrosYRenderizar));
    filtroMes?.addEventListener('change', () => cargarDatos());
    
    const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', () => {
            procesarFiltrosYRenderizar();
            renderer.cerrarModal();
        });
    }
    
    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
    if (btnLimpiarFiltros) {
        btnLimpiarFiltros.addEventListener('click', () => {
            if (filtroMes) filtroMes.value = '';
            if (filtroCategoria) filtroCategoria.value = 'todas';
            if (filtroResponsable) filtroResponsable.value = 'todos';
            if (filtroTipo) filtroTipo.value = 'todos';
            cargarDatos();
            renderer.cerrarModal();
        });
    }
});