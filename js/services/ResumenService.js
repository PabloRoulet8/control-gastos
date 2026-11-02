import { AppUtils } from "../utils/AppUtils.js";

export class ResumenService {
    
    // 1. RESUMEN PERSONAL
    calcularPersonal(gastos, categoriasConfiguradas) {
        let totalCentavos = 0, fijosCentavos = 0, fijosStockCentavos = 0, variablesCentavos = 0;
        let listaFijos = [], listaStock = [];
        
        const normalizeCat = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const mapCategorias = {};
        categoriasConfiguradas.forEach(c => {
            const nombre = typeof c === 'string' ? c : c.nombre;
            mapCategorias[normalizeCat(nombre)] = c;
        });

        gastos.forEach(g => {
            const isIngreso = g.tipo === 'ingreso' || g.categoria === 'Ingreso';
            const isPagoDeuda = g.tipo === 'pagoDeuda' || g.categoria === 'Pago de Deuda';
            if (isIngreso || isPagoDeuda) return; 

            const montoCentavos = AppUtils.aCentavos(g.monto);
            totalCentavos += montoCentavos;
            const catNorm = normalizeCat(g.categoria);
            const configCat = mapCategorias[catNorm] || { es_fijo: false, lleva_stock: false };

            if (configCat.es_fijo || configCat.lleva_stock) {
                if (configCat.lleva_stock) { fijosStockCentavos += montoCentavos; listaStock.push(g); }
                else { fijosCentavos += montoCentavos; listaFijos.push(g); }
            } else {
                variablesCentavos += montoCentavos;
            }
        });
        return {
            total: AppUtils.aPesos(totalCentavos),
            fijos: AppUtils.aPesos(fijosCentavos),
            fijosStock: AppUtils.aPesos(fijosStockCentavos),
            variables: AppUtils.aPesos(variablesCentavos),
            listaFijos,
            listaStock
        };
    }

    // 2. PROYECCIÓN DE TARJETAS POR MES DE IMPUTACIÓN
    // Agrupa exclusivamente los consumos de tarjeta de crédito por el campo
    // `mes_imputacion`. Para registros legacy sin ese campo se usa el mes de
    // la fecha como fallback, sin alterar la regla de cierre.
    calcularProyeccionTarjetas(gastos, mesActual = '') {
        const proyeccion = new Map();
        let totalGeneralCentavos = 0;

        (gastos || []).forEach(g => {
            if (!g || !this._esTarjetaCredito(g)) return;
            if (this._esIngreso(g) || this._esPagoDeuda(g)) return;

            const mes = this._mesImputacion(g);
            if (!/^\d{4}-\d{2}$/.test(mes)) return;
            if (mesActual && mes < mesActual) return;

            const montoCentavos = AppUtils.aCentavos(g.monto);
            const acumulado = proyeccion.get(mes) || { mes, totalCentavos: 0, cantidad: 0 };
            acumulado.totalCentavos += montoCentavos;
            acumulado.cantidad += 1;
            proyeccion.set(mes, acumulado);
            totalGeneralCentavos += montoCentavos;
        });

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const detalle = Array.from(proyeccion.values())
            .sort((a, b) => a.mes.localeCompare(b.mes))
            .map(item => {
                const [anio, mes] = item.mes.split('-').map(Number);
                return {
                    mes: item.mes,
                    etiqueta: `${meses[mes - 1] || item.mes} ${anio}`,
                    cantidad: item.cantidad,
                    total: AppUtils.aPesos(item.totalCentavos)
                };
            });

        return {
            detalle,
            total: AppUtils.aPesos(totalGeneralCentavos)
        };
    }

    _esTarjetaCredito(gasto) {
        const metodo = this._normalizarCategoria(gasto?.metodo_pago).replace(/-/g, ' ');
        return metodo.includes('tarjeta') && metodo.includes('credito');
    }

    _mesImputacion(gasto) {
        const mesImputacion = String(gasto?.mes_imputacion || '').trim();
        if (/^\d{4}-\d{2}$/.test(mesImputacion)) return mesImputacion;

        const fecha = String(gasto?.fecha || '').trim();
        return /^\d{4}-\d{2}/.test(fecha) ? fecha.slice(0, 7) : '';
    }

    // 2. RESUMEN HOGAR (NUEVA LÓGICA DE DOBLE CONTABILIDAD)
    calcularHogar(gastosHogar, mapaNombres, fondos = []) {
        const {
            totalHogarCentavos,
            totalADividirCentavos,
            aportesCentavos,
            cuotasMiembro,
            balancesCentavos,
            baseCuotaCentavos,
            restoCuotaCentavos,
            idsMiembros
        } = this._calcularBalancePeriodo(gastosHogar, mapaNombres, fondos);

        const cuotaPorPersona = idsMiembros.length > 0
            ? AppUtils.aPesos(baseCuotaCentavos + (restoCuotaCentavos > 0 ? 1 : 0))
            : AppUtils.aPesos(totalADividirCentavos);

        const pagosRegistrados = (gastosHogar || []).filter(g => this._esPagoDeuda(g));
        const compensaciones = this._construirCompensaciones(balancesCentavos, mapaNombres, pagosRegistrados);

        const aportes = {};
        Object.entries(aportesCentavos).forEach(([id, centavos]) => {
            aportes[id] = AppUtils.aPesos(centavos);
        });

        const cuotas = {};
        Object.entries(cuotasMiembro).forEach(([id, centavos]) => {
            cuotas[id] = AppUtils.aPesos(centavos);
        });

        return {
            totalHogar: AppUtils.aPesos(totalHogarCentavos),
            cuotaPorPersona,
            cuotasMiembro: cuotas,
            aportes,
            compensaciones,
            totalADividir: AppUtils.aPesos(totalADividirCentavos)
        };
    }

    // 2.b DEUDAS ACUMULADAS ENTRE MIEMBROS (ARRASTRE DE SALDO)
    calcularDeudas(gastosHistoricos, mapaNombres, mesSeleccionado, fondos = []) {
        const nombres = mapaNombres || {};
        const idsMiembros = Object.keys(nombres);
        const balancesMesesAnteriores = {};
        const balancesMesSeleccionado = {};

        idsMiembros.forEach(id => {
            balancesMesesAnteriores[id] = 0;
            balancesMesSeleccionado[id] = 0;
        });

        const [anio, mes] = String(mesSeleccionado || '').split('-').map(Number);
        const respuestaVacia = {
            compensaciones: [],
            saldoTotal: 0,
            saldoTotalAcumulado: 0,
            saldoMesesAnteriores: 0,
            saldoMesSeleccionado: 0,
            hayArrastre: false
        };

        if (!anio || !mes) return respuestaVacia;

        const mesKey = `${anio}-${String(mes).padStart(2, '0')}`;
        const ultimoDiaMes = new Date(anio, mes, 0).getDate();
        const finMes = `${mesKey}-${String(ultimoDiaMes).padStart(2, '0')}`;

        // Ventana histórica completa hasta el último día del mes seleccionado.
        const gastosHastaMes = (gastosHistoricos || []).filter(g => g && g.fecha && g.fecha <= finMes);
        const gastosPorMes = {};

        gastosHastaMes.forEach(g => {
            const mesGasto = g.fecha.substring(0, 7);
            if (!gastosPorMes[mesGasto]) gastosPorMes[mesGasto] = [];
            gastosPorMes[mesGasto].push(g);
        });

        // Cada presupuesto es mensual: se recalcula mes a mes para no acumular
        // el escudo de un mes sobre los gastos de otro.
        Object.keys(gastosPorMes).sort().forEach(mesGasto => {
            const { balancesCentavos } = this._calcularBalancePeriodo(gastosPorMes[mesGasto], nombres, fondos);
            const destino = mesGasto < mesKey ? balancesMesesAnteriores : balancesMesSeleccionado;

            Object.entries(balancesCentavos).forEach(([id, balanceCentavos]) => {
                destino[id] = (destino[id] || 0) + balanceCentavos;
            });
        });

        const balancesTotales = {};
        const todosLosIds = new Set([
            ...Object.keys(balancesMesesAnteriores),
            ...Object.keys(balancesMesSeleccionado)
        ]);

        todosLosIds.forEach(id => {
            balancesTotales[id] = (balancesMesesAnteriores[id] || 0) + (balancesMesSeleccionado[id] || 0);
        });

        const sumarSaldosPositivos = (balances) => Object.values(balances)
            .reduce((total, balance) => total + (balance > 0 ? balance : 0), 0);

        const saldoTotalCentavos = sumarSaldosPositivos(balancesTotales);
        const saldoMesesAnterioresCentavos = sumarSaldosPositivos(balancesMesesAnteriores);
        const saldoMesSeleccionadoCentavos = saldoTotalCentavos - saldoMesesAnterioresCentavos;

        const pagosRegistrados = gastosHastaMes.filter(g => this._esPagoDeuda(g));
        const compensaciones = this._construirCompensaciones(balancesTotales, nombres, pagosRegistrados);

        return {
            compensaciones,
            saldoTotal: AppUtils.aPesos(saldoTotalCentavos),
            saldoTotalAcumulado: AppUtils.aPesos(saldoTotalCentavos),
            saldoMesesAnteriores: AppUtils.aPesos(saldoMesesAnterioresCentavos),
            saldoMesSeleccionado: AppUtils.aPesos(saldoMesSeleccionadoCentavos),
            hayArrastre: saldoMesesAnterioresCentavos !== 0
        };
    }

    _calcularBalancePeriodo(gastos, mapaNombres, fondos = []) {
        let totalHogarCentavos = 0;
        let totalADividirCentavos = 0;
        const aportesCentavos = {};
        const nombres = mapaNombres || {};
        const idsMiembros = Object.keys(nombres);
        idsMiembros.forEach(id => aportesCentavos[id] = 0);

        // Armamos las billeteras virtuales de cada presupuesto
        const saldosFondos = {};
        (fondos || []).forEach(f => {
            saldosFondos[f.id || f.nombre] = AppUtils.aCentavos(f.monto);
        });

        // Mapeamos qué categoría pertenece a qué billetera
        const catAFondo = {};
        (fondos || []).forEach(f => {
            (f.categorias || []).forEach(cat => {
                catAFondo[this._normalizarCategoria(cat)] = f.id || f.nombre;
            });
        });

        // Ordenamos los gastos desde el más viejo al más nuevo para descontar bien
        const gastosOrdenados = [...(gastos || [])].sort((a, b) => {
            const dateA = new Date(a.fecha + 'T00:00:00');
            const dateB = new Date(b.fecha + 'T00:00:00');
            return dateA - dateB;
        });

        gastosOrdenados.forEach(g => {
            const isPagoDeuda = this._esPagoDeuda(g);
            const isIngreso = this._esIngreso(g);

            if (isPagoDeuda) {
                const montoPagoCentavos = AppUtils.aCentavos(g.monto);
                if (aportesCentavos[g.pagador_id] !== undefined) aportesCentavos[g.pagador_id] += montoPagoCentavos;
                if (aportesCentavos[g.receptor_id] !== undefined) aportesCentavos[g.receptor_id] -= montoPagoCentavos;
            } else if (!isIngreso) {
                const montoOriginalCentavos = AppUtils.aCentavos(g.monto);

                // 1. SUMAMOS AL TOTAL VISUAL SIEMPRE (Representa el gasto total de la casa)
                totalHogarCentavos += montoOriginalCentavos;

                let montoAImputarCentavos = montoOriginalCentavos;
                const catNorm = this._normalizarCategoria(g.categoria);
                const fondoId = catAFondo[catNorm];
                const usaFondoComun = g.usar_fondo === true;

                // 2. APLICAMOS EL ESCUDO DEL PRESUPUESTO SOLO SI SE PAGÓ DEL FONDO.
                // Los gastos sin el campo (legacy) se consideran pagados del bolsillo.
                if (usaFondoComun && fondoId && saldosFondos[fondoId] > 0) {
                    const saldoDisponibleCentavos = saldosFondos[fondoId];
                    const montoCubiertoCentavos = Math.min(montoAImputarCentavos, saldoDisponibleCentavos);
                    saldosFondos[fondoId] -= montoCubiertoCentavos;
                    montoAImputarCentavos -= montoCubiertoCentavos;
                }

                // 3. SOLO LO QUE REBALSA SUMA A LA DIVISIÓN CONTABLE Y A LAS DEUDAS
                if (montoAImputarCentavos > 0) {
                    totalADividirCentavos += montoAImputarCentavos;
                    const responsableId = g.responsable || 'desconocido';
                    if (aportesCentavos[responsableId] === undefined) aportesCentavos[responsableId] = 0;
                    aportesCentavos[responsableId] += montoAImputarCentavos;
                }
            }
        });

        const cantidadMiembros = idsMiembros.length > 0 ? idsMiembros.length : 1;
        // LA CUOTA SE CALCULA SOBRE LO QUE REBALSÓ, NO SOBRE EL TOTAL GASTADO
        const baseCuotaCentavos = Math.floor(totalADividirCentavos / cantidadMiembros);
        const restoCuotaCentavos = totalADividirCentavos % cantidadMiembros;
        const cuotasMiembro = {};

        idsMiembros.forEach((id, indice) => {
            cuotasMiembro[id] = baseCuotaCentavos + (indice < restoCuotaCentavos ? 1 : 0);
        });

        const balancesCentavos = {};
        Object.entries(aportesCentavos).forEach(([id, aportadoCentavos]) => {
            const cuotaCentavos = cuotasMiembro[id] ?? baseCuotaCentavos;
            balancesCentavos[id] = aportadoCentavos - cuotaCentavos;
        });

        return {
            totalHogarCentavos,
            totalADividirCentavos,
            aportesCentavos,
            cuotasMiembro,
            balancesCentavos,
            baseCuotaCentavos,
            restoCuotaCentavos,
            idsMiembros
        };
    }

    _construirCompensaciones(balancesCentavos, mapaNombres, pagosRegistrados = []) {
        const nombres = mapaNombres || {};
        const deudores = [];
        const acreedores = [];

        Object.entries(balancesCentavos || {}).forEach(([id, balanceCentavos]) => {
            const nombreDisplay = nombres[id] || "Desconocido";
            if (balanceCentavos < 0) {
                deudores.push({ id, nombre: nombreDisplay, montoCentavos: Math.abs(balanceCentavos) });
            } else if (balanceCentavos > 0) {
                acreedores.push({ id, nombre: nombreDisplay, montoCentavos: balanceCentavos });
            }
        });

        deudores.sort((a, b) => b.montoCentavos - a.montoCentavos);
        acreedores.sort((a, b) => b.montoCentavos - a.montoCentavos);

        const compensaciones = [];
        let i = 0, j = 0;

        while (i < deudores.length && j < acreedores.length) {
            const deudor = deudores[i];
            const acreedor = acreedores[j];
            const montoTransferenciaCentavos = Math.min(deudor.montoCentavos, acreedor.montoCentavos);

            const pagosEntreEllos = (pagosRegistrados || []).filter(p =>
                p.pagador_id === deudor.id && p.receptor_id === acreedor.id
            );
            pagosEntreEllos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            const ultimoPago = pagosEntreEllos.length > 0 ? pagosEntreEllos[0] : null;

            compensaciones.push({
                de_id: deudor.id, de: deudor.nombre,
                para_id: acreedor.id, para: acreedor.nombre,
                monto: AppUtils.aPesos(montoTransferenciaCentavos),
                ultimoPagoInfo: ultimoPago ? { monto: ultimoPago.monto, fecha: ultimoPago.fecha } : null
            });

            deudor.montoCentavos -= montoTransferenciaCentavos;
            acreedor.montoCentavos -= montoTransferenciaCentavos;
            if (deudor.montoCentavos <= 0) i++;
            if (acreedor.montoCentavos <= 0) j++;
        }

        return compensaciones;
    }

    _esPagoDeuda(g) {
        return g.tipo === 'pagoDeuda' || g.categoria === 'Pago de Deuda';
    }

    _esIngreso(g) {
        return g.tipo === 'ingreso' || g.categoria === 'Ingreso';
    }

    _normalizarCategoria(str) {
        return (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    // 3. RESUMEN UNIFICADO
    calcularUnificado(gastosPersonales, gastosHogar, mapaNombres, presupuestosHogar = []) {
        const personalInfo = this.calcularPersonal(gastosPersonales, []);
        let miParteHogar = 0;
        if (gastosHogar && gastosHogar.length > 0) {
            const hogarInfo = this.calcularHogar(gastosHogar, mapaNombres, presupuestosHogar);
            miParteHogar = hogarInfo.cuotaPorPersona;
        }
        return {
            totalBolsillo: AppUtils.sumarMontos(personalInfo.total, miParteHogar),
            desglosePersonal: personalInfo.total,
            desgloseHogar: miParteHogar
        };
    }

    // 4. FUNCIONES ESTADÍSTICAS
    calcularKPIsHistoricos(todosLosGastos) {
        if (!todosLosGastos || !todosLosGastos.length) return { promedio: 0, max: 0, min: 0 };
        const gastosReales = todosLosGastos.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        
        const gastosAño = gastosReales.filter(g => {
            if (!g.fecha) return false;
            return parseInt(g.fecha.substring(0, 4)) === añoActual;
        });
        
        const mesesMap = {};
        for (let mes = 1; mes <= 12; mes++) { mesesMap[`${añoActual}-${String(mes).padStart(2, '0')}`] = 0; }
        
        gastosAño.forEach(g => {
            if (!g.fecha) return;
            const m = g.fecha.substring(0, 7);
            mesesMap[m] = (mesesMap[m] || 0) + AppUtils.aCentavos(g.monto);
        });
        
        const totalesMensuales = Object.values(mesesMap).filter(total => total > 0);
        if (!totalesMensuales.length) return { promedio: 0, max: 0, min: 0 };
        const totalAnualCentavos = totalesMensuales.reduce((a, b) => a + b, 0);
        return { 
            promedio: AppUtils.aPesos(Math.round(totalAnualCentavos / totalesMensuales.length)),
            max: AppUtils.aPesos(Math.max(...totalesMensuales)),
            min: AppUtils.aPesos(Math.min(...totalesMensuales))
        };
    }

    prepararDatosBarras(gastosMesActual, gastosMesAnterior) {
        const gastosAct = gastosMesActual.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        const gastosAnt = gastosMesAnterior.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        
        const mapActual = {}, mapAnterior = {}, categoriasUnicas = new Set();
        gastosAct.forEach(g => { const cat = g.categoria || 'Sin Categoría'; mapActual[cat] = (mapActual[cat] || 0) + AppUtils.aCentavos(g.monto); categoriasUnicas.add(cat); });
        gastosAnt.forEach(g => { const cat = g.categoria || 'Sin Categoría'; mapAnterior[cat] = (mapAnterior[cat] || 0) + AppUtils.aCentavos(g.monto); categoriasUnicas.add(cat); });
        
        const categoriasOrdenadas = Array.from(categoriasUnicas).sort((a, b) => (mapActual[b] || 0) - (mapActual[a] || 0));
        const top5 = categoriasOrdenadas.slice(0, 5);
        
        let otrosActual = 0, otrosAnterior = 0;
        categoriasOrdenadas.slice(5).forEach(c => { otrosActual += (mapActual[c] || 0); otrosAnterior += (mapAnterior[c] || 0); });

        const labels = [...top5];
        const dataActual = top5.map(c => AppUtils.aPesos(mapActual[c] || 0));
        const dataAnterior = top5.map(c => AppUtils.aPesos(mapAnterior[c] || 0));
        if (categoriasOrdenadas.length > 5) {
            labels.push('Resto (Otras)');
            dataActual.push(AppUtils.aPesos(otrosActual));
            dataAnterior.push(AppUtils.aPesos(otrosAnterior));
        }
        return { labels, dataActual, dataAnterior };
    }

    prepararDatosLineas(todosLosGastos, categoriaSeleccionada, rangoStr) {
        const gastosReales = todosLosGastos.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        let gastos = categoriaSeleccionada === 'todas' ? gastosReales : gastosReales.filter(g => (g.categoria || 'Sin Categoría') === categoriaSeleccionada);
        const mesesMap = {};
        gastos.forEach(g => { if(g.fecha) { const m = g.fecha.substring(0, 7); mesesMap[m] = (mesesMap[m] || 0) + AppUtils.aCentavos(g.monto); }});
        const mesesOrdenados = Object.keys(mesesMap).sort();
        let cantidad = 6;
        if(rangoStr === '1M') cantidad = 1; if(rangoStr === '1A') cantidad = 12; if(rangoStr === '3A') cantidad = 36;
        const filtrados = rangoStr === 'MAX' ? mesesOrdenados : mesesOrdenados.slice(-cantidad);
        return { 
            labels: filtrados.map(m => { const [y, mm] = m.split('-'); return new Date(y, mm - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }); }), 
            data: filtrados.map(m => AppUtils.aPesos(mesesMap[m]))
        };
    }
}