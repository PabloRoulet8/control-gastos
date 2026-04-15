export class ResumenService {
    constructor(fondoInicial = 300000) {
        this.fondoInicial = fondoInicial;
    }

    calcularResumen(gastos, mesActual, mesAnterior, estadoDeudas) {
        let totales = { general: 0, mostri: 0, mostrina: 0, alimentacion: 0, fijos: 0, tarjeta: 0 };
        let inventario = {}; 
        let resumenIndividual = { mostri: {}, mostrina: {} }; 
        
        // Estructura para gráfico de barras comparativo
        let graficos = { general: {}, mostri: {}, mostrina: {}, servicios: {}, comestibles: {} }; 
        
        let checklistFijos = { alquiler: false, expensas: false, epe: false, agua: false, tgi: false, gas: false, wifi: false };
        let balancePorMes = {};
        let deudaHistoricaAcumulada = 0;
        let deudaMesAnteriorReal = 0;

        gastos.forEach((data) => {
            const mesGasto = data.fecha.substring(0, 7);
            const esMostri = (data.responsable === 'mostri' || data.responsable === 'pablo');
            const respKey = esMostri ? 'mostri' : 'mostrina';
            const catNorm = data.categoria ? data.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
            
            // 1. REGISTRO POR MES PARA DEUDAS
            if (!balancePorMes[mesGasto]) balancePorMes[mesGasto] = { general: 0, pagadoMostri: 0, tarjetaMostri: 0 };
            
            if (data.tipo === 'general') {
                balancePorMes[mesGasto].general += data.monto;
                if (data.metodo_pago !== 'tarjeta-credito' && esMostri) balancePorMes[mesGasto].pagadoMostri += data.monto;
            } else if (data.tipo === 'individual' && data.metodo_pago === 'tarjeta-credito' && esMostri) {
                balancePorMes[mesGasto].tarjetaMostri += data.monto;
            }

            // 2. LÓGICA DE GRÁFICOS COMPARATIVOS (Actual vs Anterior)
            const procesarGrafico = (cajon, cat, monto, esMesActual) => {
                if (!graficos[cajon][cat]) graficos[cajon][cat] = { actual: 0, anterior: 0 };
                if (esMesActual) graficos[cajon][cat].actual += monto;
                else graficos[cajon][cat].anterior += monto;
            };

            if (mesGasto === mesActual || mesGasto === mesAnterior) {
                const esActual = (mesGasto === mesActual);
                
                if (data.tipo === 'general') {
                    procesarGrafico('general', data.categoria, data.monto, esActual);
                    if (['supermercado', 'carniceria', 'verduleria'].includes(catNorm)) {
                        procesarGrafico('comestibles', data.categoria, data.monto, esActual);
                    } else if (['expensas', 'gas', 'epe', 'wifi', 'agua', 'tgi'].includes(catNorm)) {
                        procesarGrafico('servicios', data.categoria, data.monto, esActual);
                    }
                } else {
                    procesarGrafico(respKey, data.categoria, data.monto, esActual);
                }
            }

            // 3. DATOS EXCLUSIVOS DEL MES ACTUAL (Checklist, Stock y Totales)
            if (mesGasto === mesActual) {
                if (data.tipo === 'general' && checklistFijos.hasOwnProperty(catNorm)) checklistFijos[catNorm] = true;

                if (data.detalle_inventario && ['supermercado', 'carniceria', 'verduleria'].includes(catNorm)) {
                    if (!inventario[data.categoria]) inventario[data.categoria] = {};
                    data.detalle_inventario.forEach(item => {
                        const key = `${item.producto.toLowerCase()}-${item.unidad}`;
                        if (!inventario[data.categoria][key]) inventario[data.categoria][key] = { nombre: item.producto, cantidad: 0, unidad: item.unidad };
                        inventario[data.categoria][key].cantidad += parseFloat(item.cantidad);
                    });
                }

                if (data.tipo === 'individual') {
                    resumenIndividual[respKey][data.categoria] = (resumenIndividual[respKey][data.categoria] || 0) + data.monto;
                    totales[respKey] += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') totales.tarjeta += data.monto;
                }

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

        // 4. CÁLCULO DE DEUDA ACUMULADA Y ESPECÍFICA
        for (const [mes, bal] of Object.entries(balancePorMes)) {
            let deudaDelMes = ((bal.general / 2) - bal.pagadoMostri) + bal.tarjetaMostri;
            if (mes === mesAnterior) deudaMesAnteriorReal = deudaDelMes;
            if (estadoDeudas[mes] === true) continue; 
            deudaHistoricaAcumulada += deudaDelMes;
        }

        return {
            totales: { ...totales, fondoRestante: this.fondoInicial - totales.alimentacion },
            deudaAcumulada: deudaHistoricaAcumulada,
            deudaMesAnterior: deudaMesAnteriorReal,
            estadoMesAnterior: estadoDeudas[mesAnterior] || false,
            graficos,
            checklist: checklistFijos,
            inventario,
            individuales: resumenIndividual
        };
    }
}