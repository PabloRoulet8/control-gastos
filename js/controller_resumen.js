import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ResumenRenderer } from "./ui/ResumenRenderer.js";
import { ChartManager } from "./ui/ChartManager.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const resumenService = new ResumenService();
    const renderer = new ResumenRenderer();
    const chartManager = new ChartManager(resumenService);
    
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = urlParams.get('ambito') || 'personal';
    if (ambitoActual === 'individual') ambitoActual = 'personal';

    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');
    const contenedorDinamico = document.getElementById('contenedor-resumen-dinamico');

    document.getElementById('btn-stock')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if(content) content.style.display = content.style.display === "block" ? "none" : "block";
    });

    // === NAVEGACIÓN INFERIOR ===
    const navContextual = document.getElementById('nav-contextual');
    if (navContextual) {
        if (ambitoActual === 'unificado') {
            navContextual.innerHTML = `<a href="resumen.html?v=8.5&ambito=unificado" class="nav-item active"><span class="icon">📈</span><span class="label">Unificado</span></a>`;
        } else {
            const suffix = hogarId ? `&id=${hogarId}` : '';
            navContextual.innerHTML = `
                <a href="carga.html?v=8.5&ambito=${ambitoActual}${suffix}" class="nav-item"><span class="icon">➕</span><span class="label">Cargar</span></a>
                <a href="historial.html?v=8.5&ambito=${ambitoActual}${suffix}" class="nav-item"><span class="icon">📜</span><span class="label">Historial</span></a>
                <a href="resumen.html?v=8.5&ambito=${ambitoActual}${suffix}" class="nav-item active"><span class="icon">📊</span><span class="label">Resumen</span></a>`;
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) await procesarPantalla(user.uid);
    });

    async function procesarPantalla(userId) {
        try {
            const hoy = new Date();
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
            const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().substring(0, 7);
            
            const snapUser = await getDoc(doc(db, "usuarios", userId));
            const userData = snapUser.exists() ? snapUser.data() : {};
            
            const categoriasPersonales = (userData.categorias_personales || [])
                .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                .filter(c => c && c.nombre);

            let todosLosGastos = [];
            let kpisTotales = null;
            let mapaNombres = {};

            if (ambitoActual === 'personal') {
                if (tituloHeader) tituloHeader.textContent = "Mis Gastos Personales";
                todosLosGastos = await api.obtenerGastos('personal') || [];
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                kpisTotales = resumenService.calcularKPIsHistoricos(todosLosGastos);
                renderer.renderizarPersonal(resumenService.calcularPersonal(gastosMes, categoriasPersonales), userData.fondos || [], gastosMes, kpisTotales);
                renderer.mostrarComunes(gastosMes, categoriasPersonales, true);

            } else if (ambitoActual === 'hogar' && hogarId) {
                const snapHogar = await getDoc(doc(db, "hogares", hogarId));
                const dataHogar = snapHogar.exists() ? snapHogar.data() : {};
                if (tituloHeader) tituloHeader.textContent = `Resumen: ${dataHogar.nombre || 'Hogar'}`;
                
                for (const uid of dataHogar.miembros || []) {
                    const u = await getDoc(doc(db, "usuarios", uid));
                    if (u.exists()) mapaNombres[uid] = u.data().nombre;
                }
                
                todosLosGastos = (await api.obtenerGastos(hogarId) || []).filter(g => g.tipo === 'general' || !g.tipo);
                kpisTotales = resumenService.calcularKPIsHistoricos(todosLosGastos);
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                renderer.renderizarHogar(resumenService.calcularHogar(gastosMes, mapaNombres), dataHogar.nombre, kpisTotales);
                renderer.mostrarComunes(gastosMes, dataHogar.categorias_compartidas || [], true);

            } else if (ambitoActual === 'unificado') {
                if (tituloHeader) tituloHeader.textContent = "Resumen Unificado";
                const todosP = await api.obtenerGastos('personal') || [];
                const q = query(collection(db, "hogares"), where("miembros", "array-contains", userId));
                const hogaresSnap = await getDocs(q);
                
                let miParteHogarTotal = 0, todosHogaresParaGraficos = [], gastosHogarMesListas = [];

                for (const hDoc of hogaresSnap.docs) {
                    const hData = hDoc.data();
                    const nHogar = {};
                    for (const uid of hData.miembros || []) {
                        const u = await getDoc(doc(db, "usuarios", uid));
                        if (u.exists()) nHogar[uid] = u.data().nombre;
                    }
                    const gH = await api.obtenerGastos(hDoc.id) || [];
                    const gH_Generales = gH.filter(g => g.tipo === 'general' || !g.tipo);
                    const cuota = resumenService.calcularHogar(gH_Generales.filter(g => g.fecha?.startsWith(mesActual)), nHogar).cuotaPorPersona;
                    miParteHogarTotal += cuota;
                    
                    todosHogaresParaGraficos.push(...gH_Generales.map(g => ({ ...g, monto: Number(g.monto) / (hData.miembros?.length || 1) })));
                    gastosHogarMesListas.push(...gH.filter(g => g.fecha?.startsWith(mesActual)));
                }

                todosLosGastos = [...todosP, ...todosHogaresParaGraficos];
                kpisTotales = resumenService.calcularKPIsHistoricos(todosLosGastos);
                renderer.renderizarUnificado({ 
                    totalBolsillo: resumenService.calcularPersonal(todosP.filter(g => g.fecha?.startsWith(mesActual)), []).total + miParteHogarTotal,
                    desglosePersonal: resumenService.calcularPersonal(todosP.filter(g => g.fecha?.startsWith(mesActual)), []).total,
                    desgloseHogar: miParteHogarTotal
                }, kpisTotales);
                renderer.mostrarComunes([...todosP.filter(g => g.fecha?.startsWith(mesActual)), ...gastosHogarMesListas], [], false);
            }

            chartManager.inicializar(todosLosGastos, mesActual, mesAnterior);
        } catch (error) { 
            console.error(error); 
            if(contenedorDinamico) contenedorDinamico.innerHTML = `<p class="text-center p-20" style="color:#ef4444;">Error cargando datos.</p>`;
        }
    }
});