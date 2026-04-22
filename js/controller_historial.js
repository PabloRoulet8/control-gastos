import { GastoRepository } from "./api/GastoRepository.js";
import { HistorialRenderer } from "./ui/HistorialRenderer.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const renderer = new HistorialRenderer();
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = urlParams.get('ambito') || 'personal';
    if (ambitoActual === 'individual') ambitoActual = 'personal';
    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroResponsable = document.getElementById('filtro-responsable');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMes = document.getElementById('filtro-mes');

    // === NAVEGACIÓN INFERIOR PARA QUE NO SE PIERDA EL HOGAR ===
    const navContextual = document.getElementById('nav-contextual');
    if (navContextual) {
        if (ambitoActual === 'unificado') {
            navContextual.innerHTML = `<a href="resumen.html?v=9.0&ambito=unificado" class="nav-item active"><span class="icon">📈</span><span class="label">Unificado</span></a>`;
        } else {
            const suffix = hogarId ? `&id=${hogarId}` : '';
            navContextual.innerHTML = `
                <a href="carga.html?v=9.0&ambito=${ambitoActual}${suffix}" class="nav-item"><span class="icon">➕</span><span class="label">Cargar</span></a>
                <a href="historial.html?v=9.0&ambito=${ambitoActual}${suffix}" class="nav-item active"><span class="icon">📜</span><span class="label">Historial</span></a>
                <a href="resumen.html?v=9.0&ambito=${ambitoActual}${suffix}" class="nav-item"><span class="icon">📊</span><span class="label">Resumen</span></a>`;
        }
    }

    let todosLosGastos = [], mapaNombres = {};

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (ambitoActual === 'hogar' && hogarId) {
                const snap = await getDoc(doc(db, "hogares", hogarId));
                if(snap.exists()) {
                    if (tituloHeader) tituloHeader.textContent = `Historial: ${snap.data().nombre}`;
                    for (const uid of snap.data().miembros || []) {
                        const u = await getDoc(doc(db, "usuarios", uid));
                        if (u.exists()) mapaNombres[uid] = u.data().nombre;
                    }
                }
                // Mostramos los filtros porque estamos en el hogar
                if(filtroResponsable) filtroResponsable.style.display = 'block';
                if(filtroTipo) filtroTipo.style.display = 'block';
            } else {
                if (tituloHeader) tituloHeader.textContent = `Mis Gastos Personales`;
                const u = await getDoc(doc(db, "usuarios", user.uid));
                mapaNombres[user.uid] = u.exists() ? u.data().nombre : "Yo";
                // Ocultamos los filtros porque estamos en personal
                if(filtroResponsable) filtroResponsable.style.display = 'none';
                if(filtroTipo) filtroTipo.style.display = 'none';
            }
            
            cargarFiltroCategorias(user.uid);
            cargarDatos();
        }
    });

    const cargarFiltroCategorias = async (userId) => {
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const ambitoCat = ambitoActual === 'hogar' ? 'hogar' : 'personal';
        const categoriasList = await api.obtenerCategorias(contextoId, ambitoCat);
        if (categoriasList) {
            const nombresCats = categoriasList.map(c => typeof c === 'string' ? c : c.nombre);
            renderer.renderizarFiltrosCategorias([...new Set(nombresCats)].sort());
        }
    };

    const procesarFiltrosYRenderizar = () => {
        let gastosFiltrados = todosLosGastos.filter(gasto => {
            let cumpleTipo = true;
            if (filtroTipo && filtroTipo.style.display !== 'none' && filtroTipo.value !== 'todos') {
                cumpleTipo = (filtroTipo.value === 'general') ? (gasto.tipo === 'general' || !gasto.tipo) : (gasto.tipo === filtroTipo.value);
            }
            const cumpleResp = (filtroResponsable && filtroResponsable.style.display !== 'none' && filtroResponsable.value !== 'todos') ? gasto.responsable === filtroResponsable.value : true;
            const cumpleMes = (filtroMes && filtroMes.value) ? gasto.fecha.startsWith(filtroMes.value) : true;
            const cumpleCat = (filtroCategoria && filtroCategoria.value !== 'todas') ? (gasto.categoria === filtroCategoria.value) : true;
            return cumpleTipo && cumpleResp && cumpleMes && cumpleCat;
        });

        renderer.renderLista(gastosFiltrados, auth.currentUser, ambitoActual, mapaNombres, (id) => {
            const contexto = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
            api.eliminarGasto(id, contexto).then(() => cargarDatos());
        });
    };

    async function cargarDatos() {
        const contexto = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
        todosLosGastos = await api.obtenerGastos(contexto) || [];
        
        if (todosLosGastos.length > 0) {
            todosLosGastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }
        
        procesarFiltrosYRenderizar();
    }

    [filtroTipo, filtroResponsable, filtroCategoria, filtroMes].forEach(f => f?.addEventListener('change', procesarFiltrosYRenderizar));
});