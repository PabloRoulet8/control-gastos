export class ResumenService {
    
    // 1. RESUMEN PERSONAL
    calcularPersonal(gastos, categoriasConfiguradas) {
        let total = 0, fijos = 0, fijosStock = 0, variables = 0;
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

            const monto = Number(g.monto) || 0; 
            total += monto;
            const catNorm = normalizeCat(g.categoria);
            const configCat = mapCategorias[catNorm] || { es_fijo: false, lleva_stock: false };

            if (configCat.es_fijo || configCat.lleva_stock) {
                if (configCat.lleva_stock) { fijosStock += monto; listaStock.push(g); } 
                else { fijos += monto; listaFijos.push(g); }
            } else {
                variables += monto;
            }
        });
        return { total, fijos, fijosStock, variables, listaFijos, listaStock };
    }

    // 2. RESUMEN HOGAR (NUEVA LÓGICA DE DOBLE CONTABILIDAD)
    calcularHogar(gastosHogar, mapaNombres, fondos = []) {
        let totalHogar = 0; // El gasto real, físico y total de la casa (El número gigante de arriba)
        let totalADividir = 0; // La plata "huérfana" que rebalsa de los fondos y hay que dividir
        let aportes = {};
        Object.keys(mapaNombres).forEach(id => aportes[id] = 0);

        const normalizeCat = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // Armamos las billeteras virtuales de cada presupuesto
        const saldosFondos = {};
        fondos.forEach(f => {
            saldosFondos[f.id || f.nombre] = Number(f.monto) || 0;
        });

        // Mapeamos qué categoría pertenece a qué billetera
        const catAFondo = {};
        fondos.forEach(f => {
            (f.categorias || []).forEach(cat => {
                catAFondo[normalizeCat(cat)] = f.id || f.nombre;
            });
        });

        // Ordenamos los gastos desde el más viejo al más nuevo para descontar bien
        const gastosOrdenados = [...gastosHogar].sort((a, b) => {
            const dateA = new Date(a.fecha + 'T00:00:00');
            const dateB = new Date(b.fecha + 'T00:00:00');
            return dateA - dateB;
        });

        gastosOrdenados.forEach(g => {
            const isPagoDeuda = g.tipo === 'pagoDeuda' || g.categoria === 'Pago de Deuda';
            const isIngreso = g.tipo === 'ingreso' || g.categoria === 'Ingreso';

            if (isPagoDeuda) {
                const montoPago = Number(g.monto) || 0;
                if (aportes[g.pagador_id] !== undefined) aportes[g.pagador_id] += montoPago;
                if (aportes[g.receptor_id] !== undefined) aportes[g.receptor_id] -= montoPago;
            } else if (!isIngreso) {
                const montoOriginal = Number(g.monto) || 0;
                
                // 1. SUMAMOS AL TOTAL VISUAL SIEMPRE (Representa el gasto total de la casa)
                totalHogar += montoOriginal; 

                let montoAImputar = montoOriginal;
                const catNorm = normalizeCat(g.categoria);
                const fondoId = catAFondo[catNorm];

                // 2. APLICAMOS EL ESCUDO DEL PRESUPUESTO
                if (fondoId && saldosFondos[fondoId] > 0) {
                    const saldoDisponible = saldosFondos[fondoId];
                    const montoCubierto = Math.min(montoAImputar, saldoDisponible);
                    saldosFondos[fondoId] -= montoCubierto;
                    montoAImputar -= montoCubierto; // Descontamos lo que cubrió el fondo
                }

                // 3. SOLO LO QUE REBALSA SUMA A LA DIVISIÓN CONTABLE Y A LAS DEUDAS
                if (montoAImputar > 0) {
                    totalADividir += montoAImputar; 
                    const responsableId = g.responsable || 'desconocido';
                    if (aportes[responsableId] === undefined) aportes[responsableId] = 0;
                    aportes[responsableId] += montoAImputar;
                }
            }
        });

        const cantidadMiembros = Object.keys(mapaNombres).length > 0 ? Object.keys(mapaNombres).length : 1;
        
        // LA CUOTA SE CALCULA SOBRE LO QUE REBALSÓ, NO SOBRE EL TOTAL GASTADO
        const cuotaPorPersona = totalADividir / cantidadMiembros;

        let deudores = [], acreedores = [];
        for (const [id, aportado] of Object.entries(aportes)) {
            const balance = aportado - cuotaPorPersona;
            const nombreDisplay = mapaNombres[id] || "Desconocido";
            if (balance < -0.01) deudores.push({ id, nombre: nombreDisplay, monto: Math.abs(balance) });
            else if (balance > 0.01) acreedores.push({ id, nombre: nombreDisplay, monto: balance });
        }

        deudores.sort((a, b) => b.monto - a.monto);
        acreedores.sort((a, b) => b.monto - a.monto);

        const pagosRegistrados = gastosHogar.filter(g => g.tipo === 'pagoDeuda' || g.categoria === 'Pago de Deuda');

        let compensaciones = [];
        let i = 0, j = 0;
        while (i < deudores.length && j < acreedores.length) {
            let deudor = deudores[i];
            let acreedor = acreedores[j];
            let montoTransferencia = Math.min(deudor.monto, acreedor.monto);
            
            const pagosEntreEllos = pagosRegistrados.filter(p => 
                p.pagador_id === deudor.id && p.receptor_id === acreedor.id
            );
            pagosEntreEllos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            const ultimoPago = pagosEntreEllos.length > 0 ? pagosEntreEllos[0] : null;

            compensaciones.push({ 
                de_id: deudor.id, de: deudor.nombre, 
                para_id: acreedor.id, para: acreedor.nombre, 
                monto: montoTransferencia,
                ultimoPagoInfo: ultimoPago ? { monto: ultimoPago.monto, fecha: ultimoPago.fecha } : null
            });
            
            deudor.monto -= montoTransferencia;
            acreedor.monto -= montoTransferencia;
            if (deudor.monto < 0.01) i++;
            if (acreedor.monto < 0.01) j++;
        }

        return { totalHogar, cuotaPorPersona, aportes, compensaciones };
    }

    // 3. RESUMEN UNIFICADO
    calcularUnificado(gastosPersonales, gastosHogar, mapaNombres, presupuestosHogar = []) {
        const personalInfo = this.calcularPersonal(gastosPersonales, []);
        let miParteHogar = 0;
        if (gastosHogar && gastosHogar.length > 0) {
            const hogarInfo = this.calcularHogar(gastosHogar, mapaNombres, presupuestosHogar);
            miParteHogar = hogarInfo.cuotaPorPersona;
        }
        return { totalBolsillo: personalInfo.total + miParteHogar, desglosePersonal: personalInfo.total, desgloseHogar: miParteHogar };
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
            mesesMap[m] = (mesesMap[m] || 0) + (Number(g.monto) || 0);
        });
        
        const totalesMensuales = Object.values(mesesMap).filter(total => total > 0);
        if (!totalesMensuales.length) return { promedio: 0, max: 0, min: 0 };
        return { 
            promedio: totalesMensuales.reduce((a, b) => a + b, 0) / totalesMensuales.length, 
            max: Math.max(...totalesMensuales), 
            min: Math.min(...totalesMensuales) 
        };
    }

    prepararDatosBarras(gastosMesActual, gastosMesAnterior) {
        const gastosAct = gastosMesActual.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        const gastosAnt = gastosMesAnterior.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        
        const mapActual = {}, mapAnterior = {}, categoriasUnicas = new Set();
        gastosAct.forEach(g => { const cat = g.categoria || 'Sin Categoría'; mapActual[cat] = (mapActual[cat] || 0) + (Number(g.monto) || 0); categoriasUnicas.add(cat); });
        gastosAnt.forEach(g => { const cat = g.categoria || 'Sin Categoría'; mapAnterior[cat] = (mapAnterior[cat] || 0) + (Number(g.monto) || 0); categoriasUnicas.add(cat); });
        
        const categoriasOrdenadas = Array.from(categoriasUnicas).sort((a, b) => (mapActual[b] || 0) - (mapActual[a] || 0));
        const top5 = categoriasOrdenadas.slice(0, 5);
        
        let otrosActual = 0, otrosAnterior = 0;
        categoriasOrdenadas.slice(5).forEach(c => { otrosActual += (mapActual[c] || 0); otrosAnterior += (mapAnterior[c] || 0); });

        const labels = [...top5]; const dataActual = top5.map(c => mapActual[c] || 0); const dataAnterior = top5.map(c => mapAnterior[c] || 0);
        if (categoriasOrdenadas.length > 5) { labels.push('Resto (Otras)'); dataActual.push(otrosActual); dataAnterior.push(otrosAnterior); }
        return { labels, dataActual, dataAnterior };
    }

    prepararDatosLineas(todosLosGastos, categoriaSeleccionada, rangoStr) {
        const gastosReales = todosLosGastos.filter(g => g.tipo !== 'pagoDeuda' && g.tipo !== 'ingreso');
        let gastos = categoriaSeleccionada === 'todas' ? gastosReales : gastosReales.filter(g => (g.categoria || 'Sin Categoría') === categoriaSeleccionada);
        const mesesMap = {};
        gastos.forEach(g => { if(g.fecha) { const m = g.fecha.substring(0, 7); mesesMap[m] = (mesesMap[m] || 0) + (Number(g.monto) || 0); }});
        const mesesOrdenados = Object.keys(mesesMap).sort();
        let cantidad = 6;
        if(rangoStr === '1M') cantidad = 1; if(rangoStr === '1A') cantidad = 12; if(rangoStr === '3A') cantidad = 36;
        const filtrados = rangoStr === 'MAX' ? mesesOrdenados : mesesOrdenados.slice(-cantidad);
        return { 
            labels: filtrados.map(m => { const [y, mm] = m.split('-'); return new Date(y, mm - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }); }), 
            data: filtrados.map(m => mesesMap[m]) 
        };
    }
}