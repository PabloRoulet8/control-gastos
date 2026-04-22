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

        if (this.tipoGraficoActual === 'barras') {
            const gastosMesActual = this.gastos.filter(g => g.fecha?.startsWith(this.mesActual));
            const gastosMesAnterior = this.gastos.filter(g => g.fecha?.startsWith(this.mesAnterior));
            
            const data = this.resumenService.prepararDatosBarras(gastosMesActual, gastosMesAnterior);
            
            this.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [
                        { label: 'Mes Actual', data: data.dataActual, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Mes Anterior', data: data.dataAnterior, backgroundColor: '#cbd5e1', borderRadius: 4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
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
                        borderColor: '#3b82f6', 
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#3b82f6'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
            });
        }
    }
}