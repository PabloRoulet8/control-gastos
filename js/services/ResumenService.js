export class ResumenService {
    constructor(fondoInicial = 300000) {
        this.fondoInicial = fondoInicial;
    }

    calcularResumen(gastos, mesActual, estadoDeudas) {
        let totales = { general: 0, mostri: 0, mostrina: 0, alimentacion: 0, fijos: 0, tarjeta: 0 };
        let inventario = {}; 
        let resumenIndividual = { mostri: {}, mostrina: {} }; 
        let graficos = { general: {}, mostri: {}, mostrina: {} }; // Para Chart.js
        let checklistFijos = { alquiler: false, expensas: false, epe: false, agua: false, tgi: false, gas: false, wifi: false };
        
        let balancePorMes = {};
        let deudaHistoricaAcumulada = 0;

        gastos.forEach((data) => {
            const mesGasto = data.fecha.substring(0, 7);
            const esMostri = (data.responsable === 'pablo' || data.responsable === 'mostri');
            const respKey = esMostri ? 'mostri' : 'mostrina';
            
            // 1. REGISTRO HISTÓRICO PARA CALCULAR DEUDA ACUMULADA
            if (!balancePorMes[mesGasto]) balancePorMes[mesGasto] = { general: 0, pagadoMostri: 0, tarjetaMostri: 0 };
            
            if (data.tipo === 'general') {
                balancePorMes[mesGasto].general += data.monto;
                if (data.metodo_pago !== 'tarjeta-credito' && esMostri) balancePorMes[mesGasto].pagadoMostri += data.monto;
            } else if (data.tipo === 'individual' && data.metodo_pago === 'tarjeta-credito' && esMostri) {
                balancePorMes[mesGasto].tarjetaMostri += data.monto;
            }

            // 2. LÓGICA DEL MES ACTUAL (Gráficos, Checklist y Totales)
            if (mesGasto === mesActual) {
                const catNorm = data.categoria ? data.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
                
                // Preparar datos para Gráficos
                if (data.tipo === 'general') {
                    graficos.general[data.categoria] = (graficos.general[data.categoria] || 0) + data.monto;
                } else {
                    graficos[respKey][data.categoria] = (graficos[respKey][data.categoria] || 0) + data.monto;
                }

                // Checklist Automático de Servicios Fijos
                if (data.tipo === 'general' && checklistFijos.hasOwnProperty(catNorm)) {
                    checklistFijos[catNorm] = true;
                }

                // Stock (Solo Alimentos)
                if (data.detalle_inventario && ['supermercado', 'carniceria', 'verduleria'].includes(catNorm)) {
                    if (!inventario[data.categoria]) inventario[data.categoria] = {};
                    data.detalle_inventario.forEach(item => {
                        const key = `${item.producto.toLowerCase()}-${item.unidad}`;
                        if (!inventario[data.categoria][key]) inventario[data.categoria][key] = { nombre: item.producto, cantidad: 0, unidad: item.unidad };
                        inventario[data.categoria][key].cantidad += parseFloat(item.cantidad);
                    });
                }

                // Agrupar Individuales
                if (data.tipo === 'individual') {
                    if (!resumenIndividual[respKey][data.categoria]) resumenIndividual[respKey][data.categoria] = 0;
                    resumenIndividual[respKey][data.categoria] += data.monto;
                    totales[respKey] += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') totales.tarjeta += data.monto;
                }

                // Totales Generales
                if (data.tipo === 'general') {
                    totales.general += data.monto;
                    totales.mostri += (data.monto / 2);
                    totales.mostrina += (data.monto / 2);
                    if (data.metodo_pago === 'tarjeta-credito') totales.tarjeta += data.monto;
                }

                if (['supermercado', 'carniceria', 'verduleria'].includes(catNorm)) totales.alimentacion += data.monto;
                if (['alquiler', 'expensas', 'gas', 'epe', 'wifi', 'agua', 'tgi'].includes(catNorm)) totales.fijos += data.monto;
            }
        });

        // 3. CÁLCULO FINAL DE DEUDA ACUMULADA
        for (const [mes, bal] of Object.entries(balancePorMes)) {
            // Si el switch está activado, ese mes NO suma deuda
            if (estadoDeudas[mes] === true) continue; 
            
            let deudaDelMes = ((bal.general / 2) - bal.pagadoMostri) + bal.tarjetaMostri;
            deudaHistoricaAcumulada += deudaDelMes;
        }

        return {
            totales: { ...totales, fondoRestante: this.fondoInicial - totales.alimentacion },
            deudaAcumulada: deudaHistoricaAcumulada,
            estadoMesActual: estadoDeudas[mesActual] || false,
            graficos,
            checklist: checklistFijos,
            inventario,
            individuales: resumenIndividual
        };
    }
}