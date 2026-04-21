import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager(); 
    
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = urlParams.get('ambito') || 'personal';
    if (ambitoActual === 'individual') ambitoActual = 'personal';
    
    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');
    const navContextual = document.getElementById('nav-contextual');
    
    const listaGastosUI = document.getElementById('contenedor-gastos');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroResponsable = document.getElementById('filtro-responsable');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMes = document.getElementById('filtro-mes');

    let todosLosGastos = [];
    let currentUser = null;

    // 1. NAVEGACIÓN DINÁMICA
    if (ambitoActual === 'unificado') {
        if(tituloHeader) tituloHeader.textContent = "Historial Unificado";
        if(navContextual) navContextual.innerHTML = `
            <a href="resumen.html?ambito=unificado" class="nav-item">
                <span class="icon">📈</span><span class="label">Unificado</span>
            </a>`;
    } else {
        const suffix = hogarId ? `&id=${hogarId}` : '';
        if(navContextual) navContextual.innerHTML = `
            <a href="carga.html?ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">➕</span><span class="label">Cargar</span>
            </a>
            <a href="historial.html?ambito=${ambitoActual}${suffix}" class="nav-item active">
                <span class="icon">📜</span><span class="label">Historial</span>
            </a>
            <a href="resumen.html?ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">📊</span><span class="label">Resumen</span>
            </a>`;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            if (ambitoActual === 'hogar' && hogarId) {
                const snap = await getDoc(doc(db, "hogares", hogarId));
                if(snap.exists()) {
                    if(tituloHeader) tituloHeader.textContent = `Historial: ${snap.data().nombre}`;
                    cargarResponsables(snap.data().miembros || []);
                }
            } else {
                if(tituloHeader) tituloHeader.textContent = 'Mis Gastos Personales';
            }

            if (ambitoActual === 'personal') {
                if(filtroResponsable) filtroResponsable.style.display = 'none';
                if(filtroTipo) filtroTipo.style.display = 'none';
            } else {
                if(filtroResponsable) filtroResponsable.style.display = 'block';
                if(filtroTipo) filtroTipo.style.display = 'block';
            }
            
            await cargarFiltroCategorias(user.uid);
            await cargarDatosIniciales();
        }
    });

    async function cargarResponsables(uids) {
        if(!filtroResponsable) return;
        filtroResponsable.innerHTML = '<option value="todos">Todos los responsables</option>';
        for (const uid of uids) {
            const s = await getDoc(doc(db, "usuarios", uid));
            if (s.exists() && s.data().nombre) {
                const opt = document.createElement('option');
                opt.value = s.data().nombre;
                opt.textContent = s.data().nombre;
                filtroResponsable.appendChild(opt);
            }
        }
    }

    const cargarFiltroCategorias = async (userId) => {
        if(!filtroCategoria) return;
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const ambitoCat = ambitoActual === 'hogar' ? 'hogar' : 'personal';
        const categoriasList = await api.obtenerCategorias(contextoId, ambitoCat);

        if (categoriasList) {
            const nombresCats = categoriasList.map(c => typeof c === 'string' ? c : c.nombre);
            const catsUnicas = [...new Set(nombresCats)].sort();
            
            filtroCategoria.innerHTML = '<option value="todas">Todas las categorías</option>';
            catsUnicas.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat; 
                option.textContent = cat;
                filtroCategoria.appendChild(option);
            });
        }
    };

    const renderizarHistorial = () => {
        if (!listaGastosUI) return; 
        listaGastosUI.innerHTML = '';
        
        let gastosFiltrados = todosLosGastos.filter(gasto => {
            const cumpleTipo = (filtroTipo && filtroTipo.style.display !== 'none' && filtroTipo.value !== 'todos') ? gasto.tipo === filtroTipo.value : true;
            const cumpleResp = (filtroResponsable && filtroResponsable.style.display !== 'none' && filtroResponsable.value !== 'todos') ? gasto.responsable === filtroResponsable.value : true;
            const cumpleMes = (filtroMes && filtroMes.value) ? gasto.fecha.startsWith(filtroMes.value) : true;
            const cumpleCat = (filtroCategoria && filtroCategoria.value !== 'todas') ? (gasto.categoria === filtroCategoria.value || (gasto.categoria === '' && filtroCategoria.value === 'Sin categoría')) : true;
            return cumpleTipo && cumpleResp && cumpleMes && cumpleCat;
        });

        if (gastosFiltrados.length === 0) {
            listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">No hay movimientos con estos filtros.</p>';
            return;
        }

        gastosFiltrados.forEach((gasto) => {
            const item = document.createElement('div');
            
            let esMio = false;
            if (currentUser && (gasto.responsable === currentUser.displayName || gasto.responsable === currentUser.uid)) {
                esMio = true;
            }

            let claseTipo = 'general';
            if (ambitoActual === 'personal') {
                claseTipo = 'individual-pablo'; 
            } else if (gasto.tipo === 'individual') {
                claseTipo = esMio ? 'individual-pablo' : 'individual-yanet';
            }

            item.className = `gasto-item ${claseTipo}`;
            
            const parts = gasto.fecha ? gasto.fecha.split('-') : ['','',''];
            const fechaCorta = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : gasto.fecha;

            item.innerHTML = `
                <div class="gasto-info">
                    <strong>${gasto.categoria || 'Sin categoría'}</strong> 
                    <span class="fecha">${fechaCorta} — ${gasto.responsable ? gasto.responsable.toUpperCase() : 'USUARIO'}</span>
                    ${gasto.referencia ? `<span class="fecha" style="font-style: italic; margin-top: 3px;">"${gasto.referencia}"</span>` : ''}
                </div>
                <div class="gasto-acciones">
                    <span class="monto">$ ${Number(gasto.monto).toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar">🗑️</button>
                </div>
            `;
            listaGastosUI.appendChild(item);
        });

        document.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', async (e) => {
                const idGasto = e.currentTarget.getAttribute('data-id');
                
                const confirmarBorrado = confirmacion && confirmacion.preguntar 
                    ? await confirmacion.preguntar("Eliminar Gasto", "¿Estás seguro de borrar este registro?") 
                    : confirm("¿Estás seguro de borrar este registro?");

                if (confirmarBorrado) {
                    try {
                        const contextoEnvio = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
                        await api.eliminarGasto(idGasto, contextoEnvio);
                        toast.mostrar("Gasto eliminado");
                        await cargarDatosIniciales();
                    } catch (error) { toast.mostrar("Error al borrar"); }
                }
            });
        });
    };

    const cargarDatosIniciales = async () => {
        if (!listaGastosUI) return; 
        listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Cargando movimientos...</p>';
        try {
            const contextoConsulta = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
            todosLosGastos = await api.obtenerGastos(contextoConsulta) || [];
            
            if (todosLosGastos.length > 0) {
                todosLosGastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            }

            renderizarHistorial();
        } catch (error) {
            console.error(error);
            listaGastosUI.innerHTML = '<p class="text-center p-20" style="color:#d32f2f;">Error al cargar los datos. Revisá tu conexión.</p>';
        }
    };

    // Event Listeners protegidos para los Filtros
    if(filtroTipo) filtroTipo.addEventListener('change', renderizarHistorial);
    if(filtroResponsable) filtroResponsable.addEventListener('change', renderizarHistorial);
    if(filtroCategoria) filtroCategoria.addEventListener('change', renderizarHistorial);
    if(filtroMes) filtroMes.addEventListener('change', renderizarHistorial);
});