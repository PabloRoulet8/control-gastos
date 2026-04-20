import { GastoRepository } from "./api/GastoRepository.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    
    const urlParams = new URLSearchParams(window.location.search);
    const ambitoActual = urlParams.get('ambito') || 'personal';
    const hogarId = urlParams.get('id');

    document.querySelectorAll('.bottom-nav a').forEach(link => {
        const baseHref = link.getAttribute('href').split('?')[0];
        if (baseHref !== 'index.html') {
            link.href = `${baseHref}?ambito=${ambitoActual}${hogarId ? `&id=${hogarId}` : ''}`;
        }
    });

    const valTotalCasa = document.getElementById('val-total-casa');
    const contenedorFondo = document.querySelector('.box-info'); 
    const listaChecklist = document.getElementById('lista-checklist');
    const listaStockUI = document.getElementById('lista-stock-categorizada');

    let miNombre = "Usuario";

    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            const content = button.nextElementSibling;
            content.style.display = content.style.display === "block" ? "none" : "block";
        });
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) miNombre = userSnap.data().nombre || user.displayName || "Usuario";

            await inicializarResumen(user.uid);
        }
    });

    async function inicializarResumen(userId) {
        try {
            const hoy = new Date();
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
            const contextoConsulta = ambitoActual === 'hogar' ? hogarId : 'personal';
            
            // 1. Extraemos los gastos del mes
            const todosLosGastos = await api.obtenerGastos(contextoConsulta) || [];
            const gastos = todosLosGastos.filter(g => g && g.fecha && g.fecha.startsWith(mesActual));

            // 2. Extraemos la configuración de etiquetas desde tu Perfil
            const userRef = doc(db, "usuarios", userId);
            const snap = await getDoc(userRef);
            const rawCategorias = snap.exists() ? (snap.data().categorias_personales || []) : [];
            // Normalizamos para asegurar que todo sea un objeto con los interruptores leíbles
            const catConfig = rawCategorias.map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c);

            if (ambitoActual === 'personal') {
                await procesarResumenPersonal(userId, gastos, catConfig, snap);
            } else {
                await procesarResumenHogar(hogarId, gastos); // Lo actualizaremos luego
            }

            renderizarGrafico(gastos);
            renderizarStock(gastos);
            renderizarChecklist(gastos, catConfig);

        } catch (error) {
            console.error("Error al inicializar resumen:", error);
        }
    }

    async function procesarResumenPersonal(userId, gastos, catConfig, snap) {
        const highlightCard = document.querySelector('.highlight-card');
        if(highlightCard) highlightCard.style.display = 'none'; 
        
        const gridMostri = document.querySelector('.grid-2-col.mt-15');
        if(gridMostri) gridMostri.style.display = 'none'; 

        const labelTotal = document.querySelector('.monto-total .label');
        if(labelTotal) labelTotal.textContent = "Total Gastado en el Mes";

        const selectorGrafico = document.getElementById('selector-grafico');
        if(selectorGrafico) {
            Array.from(selectorGrafico.options).forEach(opt => {
                if(opt.value === 'mostri' || opt.value === 'mostrina') opt.style.display = 'none';
                if(opt.value === 'general') opt.textContent = 'Todos mis gastos';
            });
        }

        const totalMes = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
        if(valTotalCasa) valTotalCasa.textContent = `$ ${totalMes.toLocaleString()}`;

        // LÓGICA INTELIGENTE 🛒: Sumamos las que marcaste que Llevan Stock
        const catsConStock = catConfig.filter(c => c.lleva_stock).map(c => c.nombre.toLowerCase().trim());
        const gastoAlimentacion = gastos
            .filter(g => catsConStock.includes((g.categoria || "").toLowerCase().trim()))
            .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
        const valAlim = document.querySelector('.valor-alimentacion');
        if(valAlim) valAlim.textContent = `$ ${gastoAlimentacion.toLocaleString()}`;

        // LÓGICA INTELIGENTE 🏠: Sumamos las que marcaste como Fijas (Y que no son stock)
        const catsFijas = catConfig.filter(c => c.es_fijo && !c.lleva_stock).map(c => c.nombre.toLowerCase().trim());
        const gastoFijos = gastos
            .filter(g => catsFijas.includes((g.categoria || "").toLowerCase().trim()))
            .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
        const valFijos = document.querySelector('.valor-fijos');
        if(valFijos) valFijos.textContent = `$ ${gastoFijos.toLocaleString()}`;

        const fondos = snap.exists() ? (snap.data().fondos || []) : [];
        if (fondos.length > 0) {
            if(contenedorFondo) {
                contenedorFondo.style.display = 'block';
                contenedorFondo.innerHTML = '<span class="box-info-label" style="text-transform: uppercase;">Estado de mis Presupuestos</span>';
                fondos.forEach(f => {
                    const gastadoEnFondo = gastos
                        .filter(g => f.categorias.includes(g.categoria))
                        .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
                    
                    const restante = f.monto - gastadoEnFondo;
                    const color = restante < 0 ? '#d32f2f' : '#01579b';

                    contenedorFondo.innerHTML += `
                        <div class="flex-between mt-15" style="border-bottom: 1px solid #bbdefb; padding-bottom: 5px;">
                            <span style="font-weight: bold; color: #0277bd;">${f.nombre}</span>
                            <span style="font-weight: 800; color: ${color};">$ ${restante.toLocaleString()}</span>
                        </div>
                    `;
                });
            }
        } else {
            if(contenedorFondo) contenedorFondo.style.display = 'none';
        }
    }

    async function procesarResumenHogar(idHogar, gastos) {
        // Acá programaremos la lógica del pozo común
    }

    function renderizarStock(gastos) {
        if(!listaStockUI) return;
        listaStockUI.innerHTML = '';
        
        const items = gastos.flatMap(g => g.detalle_inventario || []);
        if (items.length === 0) {
            listaStockUI.innerHTML = '<p class="text-center text-muted">No hay compras de stock este mes.</p>';
            return;
        }

        const stockAgrupado = items.reduce((acc, item) => {
            const nombre = item.producto.toLowerCase();
            if (!acc[nombre]) acc[nombre] = { cant: 0, unidad: item.unidad };
            acc[nombre].cant += item.cantidad;
            return acc;
        }, {});

        for (const [nombre, info] of Object.entries(stockAgrupado)) {
            const div = document.createElement('div');
            div.className = 'flex-between border-bottom-gray mb-15';
            div.style.padding = "8px 0";
            div.innerHTML = `
                <span style="text-transform: capitalize;">${nombre}</span>
                <span class="text-bold-dark">${info.cant} ${info.unidad}</span>
            `;
            listaStockUI.appendChild(div);
        }
    }

    // El checklist ahora se dibuja usando las categorías que marcaste con la casita 🏠
    function renderizarChecklist(gastos, catConfig) {
        if(!listaChecklist) return;
        
        const categoriasFijas = catConfig.filter(c => c.es_fijo).map(c => c.nombre);
        listaChecklist.innerHTML = '';

        if (categoriasFijas.length === 0) {
            listaChecklist.innerHTML = '<li class="text-center text-muted" style="padding: 10px;">No marcaste ninguna categoría como Fija 🏠.</li>';
            return;
        }

        categoriasFijas.forEach(fija => {
            const pagado = gastos.some(g => (g.categoria || "").toLowerCase().trim() === fija.toLowerCase().trim());
            const li = document.createElement('li');
            li.style.opacity = pagado ? '0.5' : '1';
            li.innerHTML = `
                <span>${pagado ? '✅' : '⭕'} ${fija}</span>
                <span class="text-sm-gray">${pagado ? 'Pagado' : 'Pendiente'}</span>
            `;
            listaChecklist.appendChild(li);
        });
    }

    function renderizarGrafico(gastos) {
        const canvas = document.getElementById('graficoTorta');
        if(!canvas) return;

        const dataMap = gastos.reduce((acc, g) => {
            acc[g.categoria] = (acc[g.categoria] || 0) + (Number(g.monto) || 0);
            return acc;
        }, {});

        if (Object.keys(dataMap).length === 0) return;

        new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(dataMap),
                datasets: [{
                    data: Object.values(dataMap),
                    backgroundColor: ['#2e7d32', '#1976d2', '#ff9800', '#9c27b0', '#f44336', '#00bcd4', '#e91e63']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
});