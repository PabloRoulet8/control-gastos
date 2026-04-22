import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const resumenService = new ResumenService();
    
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = urlParams.get('ambito') || 'personal';
    if (ambitoActual === 'individual') ambitoActual = 'personal';

    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');
    const contenedorDinamico = document.getElementById('contenedor-resumen-dinamico');
    const navContextual = document.getElementById('nav-contextual');

    const seccionGrafico = document.getElementById('seccion-grafico');
    const seccionChecklist = document.getElementById('seccion-checklist');
    const seccionStock = document.getElementById('seccion-stock');

    let tipoGraficoActual = 'barras'; 
    let rangoTiempoActual = '6M';
    let categoriaSeleccionada = 'todas';

    document.getElementById('btn-stock')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if(content) content.style.display = content.style.display === "block" ? "none" : "block";
    });

    if (ambitoActual === 'unificado') {
        if(tituloHeader) tituloHeader.textContent = "Resumen Unificado";
        if(navContextual) navContextual.innerHTML = `
            <a href="resumen.html?v=6.5&ambito=unificado" class="nav-item active">
                <span class="icon">📈</span><span class="label">Unificado</span>
            </a>`;
    } else {
        if(tituloHeader) tituloHeader.textContent = ambitoActual === 'hogar' ? "Resumen del Hogar" : "Mis Gastos Personales";
        const suffix = hogarId ? `&id=${hogarId}` : '';
        if(navContextual) navContextual.innerHTML = `
            <a href="carga.html?v=6.5&ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">➕</span><span class="label">Cargar</span>
            </a>
            <a href="historial.html?v=6.5&ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">📜</span><span class="label">Historial</span>
            </a>
            <a href="resumen.html?v=6.5&ambito=${ambitoActual}${suffix}" class="nav-item active">
                <span class="icon">📊</span><span class="label">Resumen</span>
            </a>`;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) await procesarPantalla(user.uid);
    });

    async function procesarPantalla(userId) {
        try {
            const hoy = new Date();
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
            const fechaAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            const mesAnterior = `${fechaAnterior.getFullYear()}-${String(fechaAnterior.getMonth() + 1).padStart(2, '0')}`;
            
            const userRef = doc(db, "usuarios", userId);
            const snapUser = await getDoc(userRef);
            const userData = snapUser.exists() ? snapUser.data() : {};
            const miNombre = userData.nombre || "Usuario";
            
            const rawCategorias = userData.categorias_personales || [];
            const categoriasPersonales = rawCategorias
                .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                .filter(c => c && c.nombre);

            let todosLosGastos = [];
            let kpisTotales = null;

            if (ambitoActual === 'personal') {
                todosLosGastos = await api.obtenerGastos('personal') || [];
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                const dataPersonal = resumenService.calcularPersonal(gastosMes, categoriasPersonales);
                
                kpisTotales = resumenService.calcularKPIsHistoricos(todosLosGastos);
                
                renderizarPersonal(dataPersonal, userData.fondos || [], gastosMes, kpisTotales);
                mostrarComunes(gastosMes, categoriasPersonales, true);

            } else if (ambitoActual === 'hogar' && hogarId) {
                const snapHogar = await getDoc(doc(db, "hogares", hogarId));
                const dataHogar = snapHogar.exists() ? snapHogar.data() : {};
                const nombreDelHogar = dataHogar.nombre || "Casa"; 
                const nombresMiembros = await obtenerNombresMiembros(dataHogar.miembros || []);
                
                const todos = await api.obtenerGastos(hogarId) || [];
                const gastosMesTodos = todos.filter(g => g.fecha?.startsWith(mesActual));
                
                // AISLAR COMPARTIDOS: Filtramos estrictamente los 'general'
                const gastosGeneralesHogar = todos.filter(g => g.tipo === 'general');
                const gastosGeneralesMes = gastosGeneralesHogar.filter(g => g.fecha?.startsWith(mesActual));
                
                kpisTotales = resumenService.calcularKPIsHistoricos(gastosGeneralesHogar);

                const dataHogarCalculada = resumenService.calcularHogar(gastosGeneralesMes, nombresMiembros);
                renderizarHogar(dataHogarCalculada, nombreDelHogar, kpisTotales);
                
                const catHogarNormalizadas = (dataHogar.categorias_compartidas || [])
                    .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                    .filter(c => c && c.nombre);
                mostrarComunes(gastosMesTodos, catHogarNormalizadas, true);

                todosLosGastos = gastosGeneralesHogar;

            } else if (ambitoActual === 'unificado') {
                const todosP = await api.obtenerGastos('personal') || [];
                const gastosP = todosP.filter(g => g.fecha?.startsWith(mesActual));
                
                const hogaresRef = collection(db, "hogares");
                const q = query(hogaresRef, where("miembros", "array-contains", userId));
                const querySnapshot = await getDocs(q);
                
                let miParteHogarTotal = 0;
                let todosHogaresAcumuladosParaGraficos = [];
                let gastosHogarAcumuladosParaListas = [];

                for (const hDoc of querySnapshot.docs) {
                    const hData = hDoc.data();
                    const nombresHogar = await obtenerNombresMiembros(hData.miembros || []);
                    const miembrosCount = nombresHogar.length > 0 ? nombresHogar.length : 1;
                    
                    const gH = await api.obtenerGastos(hDoc.id) || [];
                    
                    // Extraemos solo lo general para la matemática
                    const gastosHogarMesGenerales = gH.filter(g => g.tipo === 'general' && g.fecha?.startsWith(mesActual));
                    const dataHogar = resumenService.calcularHogar(gastosHogarMesGenerales, nombresHogar);
                    miParteHogarTotal += dataHogar.cuotaPorPersona;
                    
                    const gH_divididos = gH.filter(g => g.tipo === 'general').map(g => ({
                        ...g,
                        monto: (Number(g.monto) || 0) / miembrosCount
                    }));
                    todosHogaresAcumuladosParaGraficos.push(...gH_divididos);
                    
                    gastosHogarAcumuladosParaListas.push(...gH.filter(g => g.fecha?.startsWith(mesActual)));
                }

                todosLosGastos = [...todosP, ...todosHogaresAcumuladosParaGraficos];
                kpisTotales = resumenService.calcularKPIsHistoricos(todosLosGastos); 

                const personalInfo = resumenService.calcularPersonal(gastosP, categoriasPersonales);
                const dataUnificada = { 
                    totalBolsillo: personalInfo.total + miParteHogarTotal, 
                    desglosePersonal: personalInfo.total, 
                    desgloseHogar: miParteHogarTotal 
                };
                
                renderizarUnificado(dataUnificada, kpisTotales);
                mostrarComunes([...gastosP, ...gastosHogarAcumuladosParaListas], [], false);
            }

            inicializarControlesGrafico(todosLosGastos, mesActual, mesAnterior);

        } catch (error) {
            console.error("Error cargando resumen:", error);
            if(contenedorDinamico) contenedorDinamico.innerHTML = `<p class="text-center text-bold-dark p-20" style="color: #ef4444;">Ocurrió un error al calcular los números. Revisá la consola.</p>`;
        }
    }

    const generarHtmlKPIs = (kpis) => `
        <div class="kpi-grid">
            <div class="kpi-card"><span class="kpi-label">Mínimo</span><span class="kpi-value">$ ${Number(kpis.min).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
            <div class="kpi-card"><span class="kpi-label">Promedio</span><span class="kpi-value">$ ${Number(kpis.promedio).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
            <div class="kpi-card"><span class="kpi-label">Máximo</span><span class="kpi-value">$ ${Number(kpis.max).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
        </div>
    `;

    function renderizarPersonal(data, fondos, gastosMes, kpis) {
        let htmlFondos = '';
        if (fondos && fondos.length > 0) {
            htmlFondos = `<div class="mt-20"><span class="text-sm-gray" style="text-transform: uppercase;">Estado de Mis Presupuestos</span>`;
            fondos.forEach(f => {
                const gastado = gastosMes
                    .filter(g => f.categorias.includes(g.categoria))
                    .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
                const restante = Number(f.monto) - gastado;
                const colorTexto = restante < 0 ? '#ef4444' : 'var(--primary-color)';

                htmlFondos += `
                    <div class="flex-between mt-10" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                        <span style="font-weight: bold; color: var(--text-main);">${f.nombre}</span>
                        <span style="font-weight: 800; color: ${colorTexto};">$ ${restante.toLocaleString('es-AR')} Disp.</span>
                    </div>`;
            });
            htmlFondos += `</div>`;
        }

        if(contenedorDinamico) {
            contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Total Gastado (Mes)</span>
                        <span class="valor">$ ${Number(data.total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${generarHtmlKPIs(kpis)}
                    <div class="grid-2-col mt-15 gap-10">
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Fijos + Stock 🏠</span>
                            <span class="text-bold-dark text-lg">$ ${Number(data.fijos + data.fijosStock).toLocaleString('es-AR')}</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Variables 🍟</span>
                            <span class="text-bold-dark text-lg">$ ${Number(data.variables).toLocaleString('es-AR')}</span>
                        </div>
                    </div>
                    ${htmlFondos}
                </div>
            `;
        }
    }

    function renderizarHogar(data, nombreHogar, kpis) {
        let htmlDeudas = '';
        if (data.compensaciones.length === 0) {
            htmlDeudas = '<li class="text-center text-muted" style="padding: 20px 0;">¡Cuentas claras! Nadie debe nada este mes. 🙌</li>';
        } else {
            data.compensaciones.forEach(c => {
                htmlDeudas += `
                    <li class="flex-between border-bottom-gray" style="padding: 15px 0;">
                        <span><strong style="color: #ea580c;">${c.de}</strong> le paga a <strong>${c.para}</strong></span>
                        <span class="text-bold-dark" style="color: #d32f2f; font-size: 1.1rem;">$ ${Number(c.monto).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </li>`;
            });
        }

        if(contenedorDinamico) {
            contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total" style="border-bottom: none;">
                        <div style="display: flex; flex-direction: column;">
                            <span class="label">TOTAL GASTADO</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: -2px;">${nombreHogar}</span>
                        </div>
                        <span class="valor">$ ${Number(data.totalHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${generarHtmlKPIs(kpis)}
                    <div class="mt-15 text-center pt-10" style="border-top: 1px solid var(--border-color);">
                        <span class="text-sm-gray">A cada uno le corresponde poner:</span>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-main); margin-top: 5px;">$ ${Number(data.cuotaPorPersona).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                </div>

                <div class="card dashboard-card mt-20" style="border-top: 4px solid #ea580c;">
                    <h2 style="color: #ea580c; margin-bottom: 10px;">Liquidación de Deudas</h2>
                    <p class="text-sm-gray mb-15">Quién le transfiere a quién para quedar a mano:</p>
                    <ul class="lista-minimal">
                        ${htmlDeudas}
                    </ul>
                </div>
            `;
        }
    }

    function renderizarUnificado(data, kpis) {
        if(contenedorDinamico) {
            contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid #3b82f6; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Dinero Total de tu Bolsillo (Mes)</span>
                        <span class="valor" style="color: #1e3a8a; font-size: 2.5rem;">$ ${Number(data.totalBolsillo).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${generarHtmlKPIs(kpis)}
                </div>

                <h3 class="mt-20 mb-10 text-muted" style="font-size: 0.9rem; text-transform: uppercase; padding-left: 10px;">¿De dónde sale este número?</h3>
                
                <div class="grid-2-col gap-10 mb-30">
                    <div class="card dashboard-card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Gastos Personales</span>
                        <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(data.desglosePersonal).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="card dashboard-card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Tu parte del Hogar</span>
                        <span class="text-bold-dark text-lg" style="color: #ea580c;">$ ${Number(data.desgloseHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
            `;
        }
    }

    function inicializarControlesGrafico(gastosTotales, mesActual, mesAnterior) {
        if (gastosTotales.length === 0) {
            if(seccionGrafico) seccionGrafico.style.display = 'none';
            return;
        }

        if(seccionGrafico) seccionGrafico.style.display = 'block';

        const categoriasSet = new Set(gastosTotales.map(g => g.categoria || 'Sin Categoría'));
        const select = document.getElementById('filtro-cat-grafico');
        if (select) {
            select.innerHTML = '<option value="todas">Todas las categorías</option>';
            Array.from(categoriasSet).sort().forEach(cat => {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            });

            select.addEventListener('change', (e) => {
                categoriaSeleccionada = e.target.value;
                dibujarGrafico(gastosTotales, mesActual, mesAnterior);
            });
        }

        const switchGrafico = document.getElementById('switch-tipo-grafico');
        if (switchGrafico) {
            switchGrafico.addEventListener('change', (e) => {
                tipoGraficoActual = e.target.checked ? 'lineas' : 'barras';
                
                document.getElementById('tabs-tiempo-grafico').style.display = tipoGraficoActual === 'lineas' ? 'flex' : 'none';
                document.getElementById('filtro-cat-grafico').style.display = tipoGraficoActual === 'lineas' ? 'block' : 'none';
                
                dibujarGrafico(gastosTotales, mesActual, mesAnterior);
            });
        }

        document.querySelectorAll('.time-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                rangoTiempoActual = e.target.dataset.rango;
                dibujarGrafico(gastosTotales, mesActual, mesAnterior);
            });
        });

        dibujarGrafico(gastosTotales, mesActual, mesAnterior);
    }

    function dibujarGrafico(gastos, mesActual, mesAnterior) {
        const canvas = document.getElementById('graficoEstadisticas');
        if (!canvas) return;

        if (window.miGraficoEstadisticas) {
            window.miGraficoEstadisticas.destroy();
        }

        const ctx = canvas.getContext('2d');

        if (tipoGraficoActual === 'barras') {
            const gastosMesActual = gastos.filter(g => g.fecha?.startsWith(mesActual));
            const gastosMesAnterior = gastos.filter(g => g.fecha?.startsWith(mesAnterior));
            
            const data = resumenService.prepararDatosBarras(gastosMesActual, gastosMesAnterior);
            
            window.miGraficoEstadisticas = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [
                        {
                            label: 'Mes Actual',
                            data: data.dataActual,
                            backgroundColor: '#10b981',
                            borderRadius: 4
                        },
                        {
                            label: 'Mes Anterior',
                            data: data.dataAnterior,
                            backgroundColor: '#cbd5e1',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            });

        } else {
            const data = resumenService.prepararDatosLineas(gastos, categoriaSeleccionada, rangoTiempoActual);
            
            window.miGraficoEstadisticas = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: categoriaSeleccionada === 'todas' ? 'Gasto Total Historico' : categoriaSeleccionada,
                        data: data.data,
                        borderColor: '#3b82f6', 
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#3b82f6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }

    function mostrarComunes(gastos, catConfig, mostrarListasExtras) {
        if (!mostrarListasExtras) return;

        const categoriasFijas = catConfig.filter(c => c.activa !== false && c.es_fijo === true).map(c => c.nombre);

        if (categoriasFijas.length > 0 && seccionChecklist) {
            seccionChecklist.style.display = 'block';
            const ulCheck = document.getElementById('lista-checklist');
            if(ulCheck) {
                ulCheck.innerHTML = '';
                categoriasFijas.forEach(fija => {
                    const pagado = gastos.some(g => (g.categoria || "").toLowerCase().trim() === fija.toLowerCase().trim());
                    ulCheck.innerHTML += `
                        <li class="flex-between border-bottom-gray" style="padding: 12px 0; opacity: ${pagado ? '0.5' : '1'};">
                            <span>${pagado ? '✅' : '⭕'} ${fija}</span>
                            <span class="text-sm-gray">${pagado ? 'Pagado' : 'Pendiente'}</span>
                        </li>`;
                });
            }
        } else if (seccionChecklist) {
            seccionChecklist.style.display = 'none';
        }

        const itemsStock = gastos.flatMap(g => g.detalle_inventario || []);
        if (itemsStock.length > 0 && seccionStock) {
            seccionStock.style.display = 'block';
            const ulStock = document.getElementById('lista-stock-categorizada');
            if(ulStock) {
                ulStock.innerHTML = '';
                const stockAgrupado = itemsStock.reduce((acc, item) => {
                    const n = item.producto.toLowerCase();
                    if (!acc[n]) acc[n] = { cant: 0, unidad: item.unidad };
                    acc[n].cant += Number(item.cantidad) || 0;
                    return acc;
                }, {});
                for (const [nombre, info] of Object.entries(stockAgrupado)) {
                    ulStock.innerHTML += `
                        <div class="flex-between border-bottom-gray mb-10" style="padding: 8px 0;">
                            <span style="text-transform: capitalize;">${nombre}</span>
                            <span class="text-bold-dark">${info.cant} ${info.unidad}</span>
                        </div>`;
                }
            }
        } else if (seccionStock) {
            seccionStock.style.display = 'none';
        }
    }

    async function obtenerNombresMiembros(uids) {
        let nombres = [];
        for (const uid of uids) {
            const s = await getDoc(doc(db, "usuarios", uid));
            if (s.exists() && s.data().nombre) nombres.push(s.data().nombre);
        }
        return nombres;
    }
});