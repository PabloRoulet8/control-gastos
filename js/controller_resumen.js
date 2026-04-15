import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const calculador = new ResumenService();
    const toast = new ToastManager();

    // Referencias del DOM
    const txtDeudor = document.getElementById('txt-deudor');
    const valDeuda = document.getElementById('val-deuda');
    const switchSaldado = document.getElementById('switch-saldado');
    const selectorGrafico = document.getElementById('selector-grafico');
    const listaChecklist = document.getElementById('lista-checklist');
    const valTotalCasa = document.getElementById('val-total-casa');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    const valFondo = document.querySelector('.valor-fondo');
    
    // Referencias Acordeones
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');

    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.nextElementSibling;
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
    });

    const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    let miGrafico = null; // Instancia de Chart.js
    let datosGraficoActuales = {}; 

    try {
        const fechaHoy = new Date();
        const mesActual = fechaHoy.toISOString().slice(0, 7); 

        // Traemos TODOS los gastos y el estado de las deudas
        const gastos = await api.obtenerGastos();
        const estadoDeudas = await api.obtenerEstadoDeudas();
        
        const res = calculador.calcularResumen(gastos, mesActual, estadoDeudas);

        // 1. RENDERIZAR DEUDA ACUMULADA
        switchSaldado.checked = res.estadoMesActual;

        if (res.deudaAcumulada > 0) {
            txtDeudor.textContent = "Mostri debe a Mostrina:";
            valDeuda.textContent = formatoARS(res.deudaAcumulada);
            valDeuda.style.color = "#d32f2f"; // Rojo
        } else if (res.deudaAcumulada < 0) {
            txtDeudor.textContent = "Mostrina debe a Mostri:";
            valDeuda.textContent = formatoARS(Math.abs(res.deudaAcumulada));
            valDeuda.style.color = "#d32f2f"; 
        } else {
            txtDeudor.textContent = "¡Cuentas al día! 🎉";
            valDeuda.textContent = "$ 0";
            valDeuda.style.color = "#2e7d32"; // Verde
        }

        // EVENTO DEL SWITCH
        switchSaldado.addEventListener('change', async (e) => {
            try {
                await api.guardarEstadoDeuda(mesActual, e.target.checked);
                toast.mostrar(e.target.checked ? "Mes marcado como saldado ✅" : "Deuda reabierta ❌");
                setTimeout(() => location.reload(), 1500); // Recarga para recalcular
            } catch (error) {
                toast.mostrar("Error al guardar estado");
                e.target.checked = !e.target.checked; // Revertir visualmente
            }
        });

        // 2. RENDERIZAR CHECKLIST
        const emojisCheck = { alquiler: '🏠', expensas: '🏢', epe: '⚡', agua: '💧', tgi: '📝', gas: '🔥', wifi: '🌐' };
        listaChecklist.innerHTML = '';
        for (const [servicio, estaPagado] of Object.entries(res.checklist)) {
            const icono = estaPagado ? '<span style="color:#2e7d32; font-weight:bold;">✅ Pagado</span>' : '<span style="color:#d32f2f;">❌ Pendiente</span>';
            listaChecklist.innerHTML += `<li><span>${emojisCheck[servicio] || '📌'} <span style="text-transform: capitalize;">${servicio}</span></span> ${icono}</li>`;
        }

        // 3. RENDERIZAR GRÁFICOS (CHART.JS)
        datosGraficoActuales = res.graficos;
        
        const dibujarGrafico = (tipo) => {
            const datos = datosGraficoActuales[tipo];
            const ctx = document.getElementById('graficoTorta').getContext('2d');
            
            if (miGrafico) miGrafico.destroy(); // Destruir gráfico anterior si existe
            
            if (Object.keys(datos).length === 0) {
                // Si no hay datos, mostramos un gráfico vacío gris
                miGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] } });
                return;
            }

            miGrafico = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(datos),
                    datasets: [{
                        data: Object.values(datos),
                        backgroundColor: ['#2e7d32', '#1976d2', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548', '#8bc34a', '#f44336', '#3f51b5'],
                        borderWidth: 2
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        };

        dibujarGrafico('general'); // Inicializar con General
        selectorGrafico.addEventListener('change', (e) => dibujarGrafico(e.target.value));

        // 4. RENDERIZAR RESTO DEL RESUMEN
        valTotalCasa.textContent = formatoARS(res.totales.general);
        if (valFondo) valFondo.textContent = formatoARS(res.totales.fondoRestante);
        
        // Estas son las 4 líneas nuevas que restauran la data:
        if(valTotalMostri) valTotalMostri.textContent = formatoARS(res.totales.mostri);
        if(valTotalMostrina) valTotalMostrina.textContent = formatoARS(res.totales.mostrina);
        if(valAlimentacion) valAlimentacion.textContent = formatoARS(res.totales.alimentacion);
        if(valFijos) valFijos.textContent = formatoARS(res.totales.fijos);

    } catch (error) {
        console.error("Error al cargar datos: ", error);
    }
});