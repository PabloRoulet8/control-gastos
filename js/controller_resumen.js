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

    document.getElementById('btn-stock')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if(content) content.style.display = content.style.display === "block" ? "none" : "block";
    });

    if (ambitoActual === 'unificado') {
        if(tituloHeader) tituloHeader.textContent = "Resumen Unificado";
        if(navContextual) navContextual.innerHTML = `
            <a href="resumen.html?ambito=unificado" class="nav-item active">
                <span class="icon">📈</span><span class="label">Unificado</span>
            </a>`;
    } else {
        if(tituloHeader) tituloHeader.textContent = ambitoActual === 'hogar' ? "Resumen del Hogar" : "Mis Gastos Personales";
        const suffix = hogarId ? `&id=${hogarId}` : '';
        if(navContextual) navContextual.innerHTML = `
            <a href="carga.html?ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">➕</span><span class="label">Cargar</span>
            </a>
            <a href="historial.html?ambito=${ambitoActual}${suffix}" class="nav-item">
                <span class="icon">📜</span><span class="label">Historial</span>
            </a>
            <a href="resumen.html?ambito=${ambitoActual}${suffix}" class="nav-item active">
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
            
            const userRef = doc(db, "usuarios", userId);
            const snapUser = await getDoc(userRef);
            const userData = snapUser.exists() ? snapUser.data() : {};
            const miNombre = userData.nombre || "Usuario";
            
            const rawCategorias = userData.categorias_personales || [];
            const categoriasPersonales = rawCategorias
                .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                .filter(c => c && c.nombre);

            if (ambitoActual === 'personal') {
                const todos = await api.obtenerGastos('personal') || [];
                const gastosMes = todos.filter(g => g.fecha?.startsWith(mesActual));
                const dataPersonal = resumenService.calcularPersonal(gastosMes, categoriasPersonales);
                
                renderizarPersonal(dataPersonal, userData.fondos || [], gastosMes);
                mostrarComunes(gastosMes, categoriasPersonales, true);

            } else if (ambitoActual === 'hogar' && hogarId) {
                const snapHogar = await getDoc(doc(db, "hogares", hogarId));
                const dataHogar = snapHogar.exists() ? snapHogar.data() : {};
                
                // NUEVO: Rescatamos el nombre real del hogar para el UI
                const nombreDelHogar = dataHogar.nombre || "Casa"; 
                const nombresMiembros = await obtenerNombresMiembros(dataHogar.miembros || []);
                
                const todos = await api.obtenerGastos(hogarId) || [];
                const gastosMes = todos.filter(g => g.fecha?.startsWith(mesActual));
                
                const dataHogarCalculada = resumenService.calcularHogar(gastosMes, nombresMiembros);
                renderizarHogar(dataHogarCalculada, nombreDelHogar); // Se lo pasamos a la función
                
                const catHogarNormalizadas = (dataHogar.categorias_compartidas || [])
                    .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                    .filter(c => c && c.nombre);
                mostrarComunes(gastosMes, catHogarNormalizadas, true);

            } else if (ambitoActual === 'unificado') {
                const todosP = await api.obtenerGastos('personal') || [];
                const gastosP = todosP.filter(g => g.fecha?.startsWith(mesActual));
                
                const hogaresRef = collection(db, "hogares");
                const q = query(hogaresRef, where("miembros", "array-contains", userId));
                const querySnapshot = await getDocs(q);
                
                let gastosHogarAcumulados = [];
                let todosLosNombres = new Set();

                for (const hDoc of querySnapshot.docs) {
                    const hData = hDoc.data();
                    const n = await obtenerNombresMiembros(hData.miembros || []);
                    n.forEach(nombre => todosLosNombres.add(nombre));
                    
                    const gH = await api.obtenerGastos(hDoc.id) || [];
                    gastosHogarAcumulados.push(...gH.filter(g => g.fecha?.startsWith(mesActual)));
                }

                const dataUnificada = resumenService.calcularUnificado(
                    gastosP, gastosHogarAcumulados, miNombre, categoriasPersonales, Array.from(todosLosNombres)
                );
                
                renderizarUnificado(dataUnificada);
                mostrarComunes([...gastosP, ...gastosHogarAcumulados], [], false);
            }

        } catch (error) {
            console.error("Error cargando resumen:", error);
            if(contenedorDinamico) contenedorDinamico.innerHTML = `<p class="text-center text-bold-dark p-20" style="color: #ef4444;">Ocurrió un error al calcular los números. Revisá la consola.</p>`;
        }
    }

    // --- RENDERIZADO DE VISTAS ---
    function renderizarPersonal(data, fondos, gastosMes) {
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
                        <span style="font-weight: 800; color: ${colorTexto};">$ ${restante.toLocaleString('es-AR')} Disponible</span>
                    </div>`;
            });
            htmlFondos += `</div>`;
        }

        if(contenedorDinamico) {
            contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total">
                        <span class="label">Total Gastado (Mes)</span>
                        <span class="valor">$ ${Number(data.total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
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

    // NUEVO: renderizarHogar ahora recibe el nombre de la casa para la UI
    function renderizarHogar(data, nombreHogar) {
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
                    <div class="monto-total">
                        <div style="display: flex; flex-direction: column;">
                            <span class="label">TOTAL GASTADO</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: -2px;">${nombreHogar}</span>
                        </div>
                        <span class="valor">$ ${Number(data.totalHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="mt-15 text-center">
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

    function renderizarUnificado(data) {
        if(contenedorDinamico) {
            contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid #3b82f6; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Dinero Total de tu Bolsillo (Mes)</span>
                        <span class="valor" style="color: #1e3a8a; font-size: 2.5rem;">$ ${Number(data.totalBolsillo).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>

                <h3 class="mt-20 mb-10 text-muted" style="font-size: 0.9rem; text-transform: uppercase; padding-left: 10px;">¿De dónde sale este número?</h3>
                
                <div class="grid-2-col gap-10">
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

    function mostrarComunes(gastos, catConfig, mostrarListasExtras) {
        // 1. Gráfico de Torta (Se mantiene igual, muestra lo que se gastó)
        const dataMap = gastos.reduce((acc, g) => {
            const cat = g.categoria || 'Sin Categoría';
            acc[cat] = (acc[cat] || 0) + (Number(g.monto) || 0);
            return acc;
        }, {});
        
        if (Object.keys(dataMap).length > 0 && seccionGrafico) {
            seccionGrafico.style.display = 'block';
            const canvas = document.getElementById('graficoTorta');
            if (canvas) {
                if (window.miGraficoTorta) window.miGraficoTorta.destroy();
                window.miGraficoTorta = new Chart(canvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(dataMap),
                        datasets: [{ data: Object.values(dataMap), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
            }
        } else if (seccionGrafico) {
            seccionGrafico.style.display = 'none';
        }

        if (!mostrarListasExtras) return;

        // 2. CORRECCIÓN DEL CHECKLIST (Solo categorías ACTIVA y FIJO)
        const categoriasFijas = catConfig
            .filter(c => c.activa !== false && c.es_fijo === true) // Filtro estricto
            .map(c => c.nombre);

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

        // 3. Stock (Se mantiene igual, solo muestra si hay ítems)
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