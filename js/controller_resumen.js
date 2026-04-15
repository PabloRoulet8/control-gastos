import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const calculador = new ResumenService();
    const toast = new ToastManager();

    // Selectores
    const txtDeudor = document.getElementById('txt-deudor');
    const valDeuda = document.getElementById('val-deuda');
    const switchSaldado = document.getElementById('switch-saldado');
    const labelSwitch = document.getElementById('label-switch-saldado');
    const valDeudaAnteriorDetalle = document.getElementById('val-deuda-mes-anterior');
    const selectorGrafico = document.getElementById('selector-grafico');
    const listaChecklist = document.getElementById('lista-checklist');
    const valTotalCasa = document.getElementById('val-total-casa');
    const valFondo = document.querySelector('.valor-fondo');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');

    // Acordeones
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
        const fechaAnterior = new Date();
        fechaAnterior.setMonth(fechaAnterior.getMonth() - 1);
        const mesAnterior = fechaAnterior.toISOString().slice(0, 7);

        const gastos = await api.obtenerGastos();
        const estadoDeudas = await api.obtenerEstadoDeudas();
        const res = calculador.calcularResumen(gastos, mesActual, mesAnterior, estadoDeudas);

        // 1. DEUDA Y SWITCH
        if(labelSwitch) labelSwitch.textContent = `¿Mes de ${mesAnterior} saldado?`;
        switchSaldado.checked = res.estadoMesAnterior;
        
        if (valDeudaAnteriorDetalle) {
            valDeudaAnteriorDetalle.textContent = res.estadoMesAnterior ? formatoARS(0) : formatoARS(Math.abs(res.deudaMesAnterior));
            valDeudaAnteriorDetalle.style.color = res.estadoMesAnterior ? "#2e7d32" : "#d32f2f";
        }

        if (Math.abs(res.deudaAcumulada) < 1) {
            txtDeudor.textContent = "¡Cuentas al día! 🎉";
            valDeuda.textContent = "$ 0";
            valDeuda.style.color = "#2e7d32";
        } else {
            txtDeudor.textContent = res.deudaAcumulada > 0 ? "Mostri debe a Mostrina:" : "Mostrina debe a Mostri:";
            valDeuda.textContent = formatoARS(Math.abs(res.deudaAcumulada));
            valDeuda.style.color = "#d32f2f";
        }

        switchSaldado.addEventListener('change', async (e) => {
            try {
                await api.guardarEstadoDeuda(mesAnterior, e.target.checked);
                toast.mostrar(e.target.checked ? `Cuentas de ${mesAnterior} cerradas ✅` : "Cuentas reabiertas ❌");
                setTimeout(() => location.reload(), 1200);
            } catch (error) { toast.mostrar("Error al guardar"); e.target.checked = !e.target.checked; }
        });

        // 2. CHECKLIST
        const emojis = { alquiler: '🏠', expensas: '🏢', epe: '⚡', agua: '💧', tgi: '📝', gas: '🔥', wifi: '🌐' };
        listaChecklist.innerHTML = '';
        for (const [servicio, estaPagado] of Object.entries(res.checklist)) {
            const status = estaPagado ? '<span style="color:#2e7d32; font-weight:bold;">✅ Pagado</span>' : '<span style="color:#d32f2f;">❌ Pendiente</span>';
            listaChecklist.innerHTML += `<li><span>${emojis[servicio] || '📌'} <span style="text-transform: capitalize;">${servicio}</span></span> ${status}</li>`;
        }

        // 3. GRÁFICO DE BARRAS COMPARATIVO
        datosGraficoActuales = res.graficos;
        const dibujarGrafico = (tipo) => {
            const datosMap = datosGraficoActuales[tipo];
            const ctx = document.getElementById('graficoTorta').getContext('2d');
            if (miGrafico) miGrafico.destroy();
            
            const etiquetas = Object.keys(datosMap);
            miGrafico = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: etiquetas,
                    datasets: [
                        { label: 'Mes Anterior', data: etiquetas.map(c => datosMap[c].anterior), backgroundColor: '#bdc3c7', borderRadius: 5 },
                        { label: 'Mes Actual', data: etiquetas.map(c => datosMap[c].actual), backgroundColor: '#2e7d32', borderRadius: 5 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top' } } }
            });
        };
        dibujarGrafico('general');
        selectorGrafico.addEventListener('change', (e) => dibujarGrafico(e.target.value));

        // 4. BALANCES
        valTotalCasa.textContent = formatoARS(res.totales.general);
        if (valFondo) valFondo.textContent = formatoARS(res.totales.fondoRestante);
        valTotalMostri.textContent = formatoARS(res.totales.mostri);
        valTotalMostrina.textContent = formatoARS(res.totales.mostrina);
        valAlimentacion.textContent = formatoARS(res.totales.alimentacion);
        valFijos.textContent = formatoARS(res.totales.fijos);

        // 5. ACORDEONES
        const renderList = (datos, ui) => {
            ui.innerHTML = Object.keys(datos).length ? '' : '<li>Sin gastos</li>';
            Object.entries(datos).sort().forEach(([cat, val]) => {
                ui.innerHTML += `<li><span>${cat}</span> <strong>${formatoARS(val)}</strong></li>`;
            });
        };
        renderList(res.individuales.mostri, listaMostriUI);
        renderList(res.individuales.mostrina, listaMostrinaUI);

        listaStockUI.innerHTML = '';
        for (const [cat, prods] of Object.entries(res.inventario)) {
            listaStockUI.innerHTML += `<h4 style="color:#2e7d32; margin-top:10px;">${cat}</h4>`;
            const ul = document.createElement('ul');
            ul.className = 'lista-minimal';
            Object.values(prods).forEach(p => {
                ul.innerHTML += `<li><span>${p.nombre}</span> <strong>${p.cantidad} ${p.unidad}</strong></li>`;
            });
            listaStockUI.appendChild(ul);
        }

    } catch (error) { console.error("Error:", error); }
});