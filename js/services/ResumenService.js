export class ResumenService {
    constructor(fondoInicial = 300000) {
        this.fondoInicial = fondoInicial;
    }

    calcularResumen(gastos, mesActual, mesAnterior) {
        let totalGeneral = 0, proyeccionTarjeta = 0;
        let pagoEfectivoGeneralMostri = 0, individualEnTarjetaMostri = 0;
        let inventarioCategorizado = {}; 
        let resumenIndividual = { mostri: {}, mostrina: {} }; 
        let individualPropioMostri = 0, individualPropioMostrina = 0;
        let gastoAlimentacion = 0, gastoFijos = 0;
        let totalGeneralAnt = 0, pagoEfectivoGeneralAntMostri = 0, individualEnTarjetaAntMostri = 0;

        gastos.forEach((data) => {
            const esMostri = (data.responsable === 'pablo' || data.responsable === 'mostri');
            const esMostrina = (data.responsable === 'yanet' || data.responsable === 'mostrina');
            const respKey = esMostri ? 'mostri' : 'mostrina';
            
            // LÓGICA MES ACTUAL
            if (data.fecha.startsWith(mesActual)) {
                // 1. Stock (Solo Alimentos)
                const catsStock = ['Supermercado', 'Carnicería', 'Verdulería'];
                const catNormalizadaStock = data.categoria ? data.categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
                const esAlimentacion = catsStock.some(c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === catNormalizadaStock);
                
                if (data.detalle_inventario && esAlimentacion) {
                    const catName = data.categoria;
                    if (!inventarioCategorizado[catName]) inventarioCategorizado[catName] = {};

                    data.detalle_inventario.forEach(item => {
                        if (item.producto && item.cantidad !== undefined) {
                            const nombreNorm = item.producto.toString().trim().toLowerCase();
                            const unidadNorm = (item.unidad || 'unid').trim();
                            const key = `${nombreNorm}-${unidadNorm}`;

                            if (!inventarioCategorizado[catName][key]) {
                                inventarioCategorizado[catName][key] = { nombre: item.producto.toString().trim(), cantidad: 0, unidad: unidadNorm };
                            }
                            inventarioCategorizado[catName][key].cantidad += parseFloat(item.cantidad);
                        }
                    });
                }

                // 2. Gastos Individuales
                if (data.tipo === 'individual') {
                    const cat = data.categoria;
                    if (!resumenIndividual[respKey][cat]) resumenIndividual[respKey][cat] = 0;
                    resumenIndividual[respKey][cat] += data.monto;

                    if (esMostri) { individualPropioMostri += data.monto; } 
                    else if (esMostrina) { individualPropioMostrina += data.monto; }

                    if (data.metodo_pago === 'tarjeta-credito') {
                        proyeccionTarjeta += data.monto;
                        if (esMostri) { individualEnTarjetaMostri += data.monto; }
                    }
                }

                // 3. Gastos Generales
                if (data.tipo === 'general') {
                    totalGeneral += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') { proyeccionTarjeta += data.monto; }
                    else if (esMostri) { pagoEfectivoGeneralMostri += data.monto; }
                }

                // 4. Sumatorias por categoría visual
                if (data.categoria) {
                    const catNormalizada = data.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const catsAlimentacionArr = ['supermercado', 'carniceria', 'verduleria'];
                    const catsFijosArr = ['alquiler', 'expensas', 'gas', 'epe', 'wifi', 'agua', 'tgi'];

                    if (catsAlimentacionArr.includes(catNormalizada)) { gastoAlimentacion += data.monto; } 
                    else if (catsFijosArr.includes(catNormalizada)) { gastoFijos += data.monto; }
                }
            } 
            // LÓGICA MES ANTERIOR
            else if (data.fecha.startsWith(mesAnterior)) {
                if (data.tipo === 'general') {
                    totalGeneralAnt += data.monto;
                    if (data.metodo_pago !== 'tarjeta-credito' && esMostri) { pagoEfectivoGeneralAntMostri += data.monto; }
                } else if (data.tipo === 'individual') {
                    if (data.metodo_pago === 'tarjeta-credito' && esMostri) { individualEnTarjetaAntMostri += data.monto; }
                }
            }
        });

        // Retornamos un objeto limpio con toda la matemática resuelta
        return {
            totales: {
                general: totalGeneral,
                mostri: (totalGeneral / 2) + individualPropioMostri,
                mostrina: (totalGeneral / 2) + individualPropioMostrina,
                alimentacion: gastoAlimentacion,
                fijos: gastoFijos,
                tarjeta: proyeccionTarjeta,
                fondoRestante: this.fondoInicial - gastoAlimentacion
            },
            deuda: {
                actual: ((totalGeneral / 2) - pagoEfectivoGeneralMostri) + individualEnTarjetaMostri,
                desgloseGeneral: ((totalGeneral / 2) - pagoEfectivoGeneralMostri),
                desgloseTarjeta: individualEnTarjetaMostri,
                anterior: ((totalGeneralAnt / 2) - pagoEfectivoGeneralAntMostri) + individualEnTarjetaAntMostri
            },
            inventario: inventarioCategorizado,
            individuales: resumenIndividual
        };
    }
}