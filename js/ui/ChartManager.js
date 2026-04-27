export class ChartManager {
     constructor(resumenService) {
         this.resumenService = resumenService;
         this.tipoGraficoActual = 'barras'; 
         this.rangoTiempoActual = '6M';
         this.categoriaSeleccionada = 'todas';
         this.seccionGrafico = document.getElementById('seccion-grafico');
         this.chartInstance = null;
 
         this.gastos = [];
         this.mesActual = '';
         this.mesAnterior = '';
         
         this.setupEventListeners();
     }
 
     // Obtener configuración de colores basada en el tema actual
     getChartColors() {
         const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
         return {
             textColor: isDark ? '#f8fafc' : '#0f172a',
             gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
             primaryColor: isDark ? '#10b981' : '#10b981',
             secondaryColor: isDark ? '#cbd5e1' : '#cbd5e1',
             tooltipBg: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
             tooltipBorder: isDark ? '#10b981' : '#10b981'
         };
     }

    setupEventListeners() {
        const select = document.getElementById('filtro-cat-grafico');
        if (select) {
            select.addEventListener('change', (e) => {
                this.categoriaSeleccionada = e.target.value;
                this.dibujarGrafico();
            });
        }

        const switchGrafico = document.getElementById('switch-tipo-grafico');
        if (switchGrafico) {
            switchGrafico.addEventListener('change', (e) => {
                this.tipoGraficoActual = e.target.checked ? 'lineas' : 'barras';
                document.getElementById('tabs-tiempo-grafico').style.display = this.tipoGraficoActual === 'lineas' ? 'flex' : 'none';
                document.getElementById('filtro-cat-grafico').style.display = this.tipoGraficoActual === 'lineas' ? 'block' : 'none';
                this.dibujarGrafico();
            });
        }

        document.querySelectorAll('.time-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.rangoTiempoActual = e.target.dataset.rango;
                this.dibujarGrafico();
            });
        });
    }

    inicializar(gastosTotales, mesActual, mesAnterior) {
        this.gastos = gastosTotales;
        this.mesActual = mesActual;
        this.mesAnterior = mesAnterior;

        if (this.gastos.length === 0) {
            if(this.seccionGrafico) this.seccionGrafico.style.display = 'none';
            return;
        }

        if(this.seccionGrafico) this.seccionGrafico.style.display = 'block';

        const categoriasSet = new Set(this.gastos.map(g => g.categoria || 'Sin Categoría'));
        const select = document.getElementById('filtro-cat-grafico');
        if (select) {
            select.innerHTML = '<option value="todas">Todas las categorías</option>';
            Array.from(categoriasSet).sort().forEach(cat => {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        this.dibujarGrafico();
    }

     dibujarGrafico() {
         const canvas = document.getElementById('graficoEstadisticas');
         if (!canvas) return;
 
         if (this.chartInstance) {
             this.chartInstance.destroy();
         }
 
         const ctx = canvas.getContext('2d');
         const colors = this.getChartColors();
 
         if (this.tipoGraficoActual === 'barras') {
             const gastosMesActual = this.gastos.filter(g => g.fecha?.startsWith(this.mesActual));
             const gastosMesAnterior = this.gastos.filter(g => g.fecha?.startsWith(this.mesAnterior));
             
             const data = this.resumenService.prepararDatosBarras(gastosMesActual, gastosMesAnterior);
             
             this.chartInstance = new Chart(ctx, {
                 type: 'bar',
                 data: {
                     labels: data.labels,
                     datasets: [
                         { label: 'Mes Actual', data: data.dataActual, backgroundColor: colors.primaryColor, borderRadius: 4 },
                         { label: 'Mes Anterior', data: data.dataAnterior, backgroundColor: colors.secondaryColor, borderRadius: 4 }
                     ]
                 },
                 options: {
                     responsive: true, 
                     maintainAspectRatio: false, 
                     plugins: {
                         legend: { 
                             position: 'bottom',
                             labels: {
                                 color: colors.textColor,
                                 font: { size: 14 }
                             }
                         },
                         tooltip: {
                             backgroundColor: colors.tooltipBg,
                             titleColor: colors.textColor,
                             bodyColor: colors.textColor,
                             borderColor: colors.tooltipBorder,
                             borderWidth: 1,
                             padding: 8,
                             displayColors: false
                         }
                     }, 
                     scales: {
                         x: {
                             grid: {
                                 color: colors.gridColor
                             },
                             ticks: {
                                 color: colors.textColor === '#f8fafc' ? '#94a3b8' : '#64748b'
                             }
                         },
                         y: {
                             grid: {
                                 color: colors.gridColor
                             },
                             ticks: {
                                 color: colors.textColor === '#f8fafc' ? '#94a3b8' : '#64748b'
                             },
                             beginAtZero: true
                         }
                     }
                 }
             });
 
         } else {
             const data = this.resumenService.prepararDatosLineas(this.gastos, this.categoriaSeleccionada, this.rangoTiempoActual);
             
             this.chartInstance = new Chart(ctx, {
                 type: 'line',
                 data: {
                     labels: data.labels,
                     datasets: [{
                         label: this.categoriaSeleccionada === 'todas' ? 'Gasto Total Histórico' : this.categoriaSeleccionada,
                         data: data.data,
                         borderColor: colors.primaryColor, 
                         backgroundColor: `rgba(${colors.primaryColor === '#10b981' ? '16, 185, 129' : '16, 185, 129'}, 0.1)`,
                         borderWidth: 3,
                         tension: 0.4,
                         pointBackgroundColor: colors.primaryColor,
                         pointBorderColor: colors.textColor === '#f8fafc' ? '#f8fafc' : '#ffffff',
                         pointBorderWidth: 3,
                         pointRadius: 5,
                         pointHoverRadius: 8,
                         pointHoverBackgroundColor: colors.textColor === '#f8fafc' ? '#f8fafc' : '#ffffff',
                         pointHoverBorderColor: colors.primaryColor
                     }]
                 },
                 options: {
                     responsive: true, 
                     maintainAspectRatio: false, 
                     plugins: {
                         legend: { 
                             position: 'bottom',
                             labels: {
                                 color: colors.textColor,
                                 font: { size: 14 }
                             }
                         },
                         tooltip: {
                             backgroundColor: colors.tooltipBg,
                             titleColor: colors.textColor,
                             bodyColor: colors.textColor,
                             borderColor: colors.tooltipBorder,
                             borderWidth: 1,
                             padding: 8,
                             displayColors: false
                         }
                     }, 
                     scales: {
                         x: {
                             grid: {
                                 color: colors.gridColor
                             },
                             ticks: {
                                 color: colors.textColor === '#f8fafc' ? '#94a3b8' : '#64748b'
                             }
                         },
                         y: {
                             grid: {
                                 color: colors.gridColor
                             },
                             ticks: {
                                 color: colors.textColor === '#f8fafc' ? '#94a3b8' : '#64748b'
                             },
                             beginAtZero: true
                         }
                     }
                 }
             });
         }
     }
}