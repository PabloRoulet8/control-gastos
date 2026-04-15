import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const calculador = new ResumenService();
    const toast = new ToastManager();

    // Selectores de Deuda y Switch
    const txtDeudor = document.getElementById('txt-deudor');
    const valDeuda = document.getElementById('val-deuda');
    const switchSaldado = document.getElementById('switch-saldado');
    
    // Selectores de Gráficos y Checklist
    const selectorGrafico = document.getElementById('selector-grafico');
    const listaChecklist = document.getElementById('lista-checklist');
    
    // Selectores de Balances (Los que restauramos)
    const valTotalCasa = document.getElementById('val-total-casa');
    const valFondo = document.querySelector('.valor-fondo');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    
    // Selectores de Listas (Acordeones)
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');

    // Lógica visual de Acordeones
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.nextElementSibling;
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
    });

    const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    let miGrafico = null;
    let datosGraficoActuales = {}; 

    try {
        const fechaHoy = new Date();
        const mesActual = fechaHoy.toISOString().slice(0, 7); 

        const gastos = await api.obtenerGastos();
        const estadoDeudas = await api.obtenerEstadoDeudas();
        
        const res = calculador.calcularResumen(gastos, mesActual, estadoDeudas);

        // 1. RENDERIZAR DEUDA ACUMULADA
        switchSaldado.checked = res.estadoMesActual;
        if (res.deudaAcumulada > 0) {
            txtDeudor.textContent = "Mostri debe a Mostrina:";
            valDeuda.textContent = formatoARS(res.deudaAcumulada);
            valDeuda.style.color = "#d32f2f";
        } else if (res.deudaAcumulada < 0) {
            txtDeudor.textContent = "Mostrina debe a Mostri:";
            valDeuda.textContent = formatoARS(Math.abs(res.deudaAcumulada));
            valDeuda.style.color = "#d32f2f";
        } else {
            txtDeudor.textContent = "¡Cuentas al día! 🎉";
            valDeuda.textContent = "$ 0";
            valDeuda.style.color = "#2e7d32";
        }

        switchSaldado.addEventListener('change', async (e) => {
            try {
                await api.guardarEstadoDeuda(mesActual, e.target.checked);
                toast.mostrar(e.target.checked ? "Mes saldado ✅" : "Deuda reabierta ❌");
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                toast.mostrar("Error al guardar");
                e.target.checked = !e.target.checked;
            }
        });

        // 2. RENDERIZAR CHECKLIST
        const emojis = { alquiler: '🏠', expensas: '🏢', epe: '⚡', agua: '💧', tgi: '📝', gas: '🔥', wifi: '🌐' };
        if (listaChecklist) {
            listaChecklist.innerHTML = '';
            for (const [servicio, estaPagado] of Object.entries(res.checklist)) {
                const status = estaPagado ? '<span style="color:#2e7d32; font-weight:bold;">✅ Pagado</span>' : '<span style="color:#d32f2f;">❌ Pendiente</span>';
                listaChecklist.innerHTML += `<li><span>${emojis[servicio] || '📌'} <span style="text-transform: capitalize;">${servicio}</span></span> ${status}</li>`;
            }
        }

        // 3. RENDERIZAR GRÁFICO
        datosGraficoActuales = res.graficos;
        const dibujarGrafico = (tipo) => {
            const datos = datosGraficoActuales[tipo];
            const ctx = document.getElementById('graficoTorta').getContext('2d');
            if (miGrafico) miGrafico.destroy();
            
            if (!datos || Object.keys(datos).length === 0) {
                miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] } });
                return;
            }

            miGrafico = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(datos),
                    datasets: [{
                        data: Object.values(datos),
                        backgroundColor: ['#2e7d32', '#1976d2', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548'],
                        borderWidth: 2
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        };
        dibujarGrafico('general');
        selectorGrafico.addEventListener('change', (e) => dibujarGrafico(e.target.value));

        // 4. RENDERIZAR BALANCES
        valTotalCasa.textContent = formatoARS(res.totales.general);
        if (valFondo) valFondo.textContent = formatoARS(res.totales.fondoRestante);
        if (valTotalMostri) valTotalMostri.textContent = formatoARS(res.totales.mostri);
        if (valTotalMostrina) valTotalMostrina.textContent = formatoARS(res.totales.mostrina);
        if (valAlimentacion) valAlimentacion.textContent = formatoARS(res.totales.alimentacion);
        if (valFijos) valFijos.textContent = formatoARS(res.totales.fijos);

        // 5. RENDERIZAR LISTAS (INDIVIDUALES)
        const renderIndividual = (datos, uiElement) => {
            if (!uiElement) return;
            uiElement.innerHTML = '';
            let items = Object.entries(datos).sort((a, b) => a[0].localeCompare(b[0]));
            
            const idxColectivo = items.findIndex(i => i[0].toLowerCase().includes("colectivo"));
            if (idxColectivo > -1) {
                const [itemColectivo] = items.splice(idxColectivo, 1);
                items.unshift(itemColectivo);
            }

            if (items.length === 0) {
                uiElement.innerHTML = '<li style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">Sin gastos.</li>';
            } else {
                items.forEach(([cat, total]) => {
                    uiElement.innerHTML += `<li><span>${cat}</span> <strong>${formatoARS(total)}</strong></li>`;
                });
            }
        };
        renderIndividual(res.individuales.mostri, listaMostriUI);
        renderIndividual(res.individuales.mostrina, listaMostrinaUI);

        // 6. RENDERIZAR LISTAS (STOCK)
        if (listaStockUI) {
            listaStockUI.innerHTML = '';
            if (Object.keys(res.inventario).length === 0) {
                listaStockUI.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">No hay productos.</p>';
            } else {
                for (const [categoria, productos] of Object.entries(res.inventario)) {
                    const catTitle = document.createElement('h4');
                    catTitle.style.cssText = "color: #2e7d32; border-bottom: 1px solid #a5d6a7; padding-bottom: 5px; margin-top: 15px; margin-bottom: 10px;";
                    catTitle.textContent = categoria;
                    listaStockUI.appendChild(catTitle);

                    const ul = document.createElement('ul');
                    ul.className = "lista-minimal";
                    Object.values(productos).sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>${item.nombre}</span> <span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">${item.cantidad} ${item.unidad}</span>`;
                        ul.appendChild(li);
                    });
                    listaStockUI.appendChild(ul);
                }
            }
        }

    } catch (error) {
        console.error("Error crítico:", error);
    }
});