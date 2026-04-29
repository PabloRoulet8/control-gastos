export class ResumenService {
    
    // 1. RESUMEN PERSONAL
    calcularPersonal(gastos, categoriasConfiguradas) {
        let total = 0, fijos = 0, fijosStock = 0, variables = 0;
        let listaFijos = [], listaStock = [];
        const mapCategorias = {};
        categoriasConfiguradas.forEach(c => mapCategorias[typeof c === 'string' ? c : c.nombre] = c);

        gastos.forEach(g => {
            const monto = Number(g.monto) || 0; 
            total += monto;
            const catNorm = g.categoria || '';
            const configCat = mapCategorias[catNorm] || { es_fijo: false, lleva_stock: false };

            if (configCat.es_fijo) {
                if (configCat.lleva_stock) { fijosStock += monto; listaStock.push(g); } 
                else { fijos += monto; listaFijos.push(g); }
            } else {
                variables += monto;
            }
        });
        return { total, fijos, fijosStock, variables, listaFijos, listaStock };
    }

    // 2. RESUMEN HOGAR 
    calcularHogar(gastosHogar, mapaNombres) {
        let totalHogar = 0;
        let aportes = {};
        Object.keys(mapaNombres).forEach(id => aportes[id] = 0);

        gastosHogar.forEach(g => {
            if (g.tipo === 'general' || !g.tipo) {
                const monto = Number(g.monto) || 0; 
                totalHogar += monto;
                const responsableId = g.responsable || 'desconocido';
                if (aportes[responsableId] === undefined) aportes[responsableId] = 0;
                aportes[responsableId] += monto;
            } 
            // 🔥 LA MAGIA: Ajustamos los saldos si hay un pago registrado
            else if (g.tipo === 'pagoDeuda') {
                const montoPago = Number(g.monto) || 0;
                if (aportes[g.pagador_id] !== undefined) aportes[g.pagador_id] += montoPago;
                if (aportes[g.receptor_id] !== undefined) aportes[g.receptor_id] -= montoPago;
            }
        });

        const cantidadMiembros = Object.keys(mapaNombres).length > 0 ? Object.keys(mapaNombres).length : 1;
        const cuotaPorPersona = totalHogar / cantidadMiembros;

        let deudores = [], acreedores = [];
        for (const [id, aportado] of Object.entries(aportes)) {
            const balance = aportado - cuotaPorPersona;
            const nombreDisplay = mapaNombres[id] || "Desconocido";
            // AHORA GUARDAMOS EL ID DEL USUARIO TAMBIÉN
            if (balance < -0.01) deudores.push({ id, nombre: nombreDisplay, monto: Math.abs(balance) });
            else if (balance > 0.01) acreedores.push({ id, nombre: nombreDisplay, monto: balance });
        }

        deudores.sort((a, b) => b.monto - a.monto);
        acreedores.sort((a, b) => b.monto - a.monto);

        // 🔥 MAGIA: Filtramos todos los pagos registrados para tenerlos a mano
        const pagosRegistrados = gastosHogar.filter(g => g.tipo === 'pagoDeuda');

        let compensaciones = [];
        let i = 0, j = 0;
        while (i < deudores.length && j < acreedores.length) {
            let deudor = deudores[i];
            let acreedor = acreedores[j];
            let montoTransferencia = Math.min(deudor.monto, acreedor.monto);
            
            // Buscamos si existe un pago de este deudor a este acreedor
            const pagosEntreEllos = pagosRegistrados.filter(p => 
                p.pagador_id === deudor.id && p.receptor_id === acreedor.id
            );
            // Ordenamos para agarrar el más reciente
            pagosEntreEllos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            const ultimoPago = pagosEntreEllos.length > 0 ? pagosEntreEllos[0] : null;

            // Agregamos la data del último pago a la respuesta
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
    calcularUnificado(gastosPersonales, gastosHogar, mapaNombres) {
        const personalInfo = this.calcularPersonal(gastosPersonales, []);
        let miParteHogar = 0;
        if (gastosHogar && gastosHogar.length > 0) {
            const hogarInfo = this.calcularHogar(gastosHogar, mapaNombres);
            miParteHogar = hogarInfo.cuotaPorPersona;
        }
        return { totalBolsillo: personalInfo.total + miParteHogar, desglosePersonal: personalInfo.total, desgloseHogar: miParteHogar };
    }

    // 4. FUNCIONES ESTADÍSTICAS - ALGORITMO ANUAL BASADO EN PROMEDIOS MENSUALES
    calcularKPIsHistoricos(todosLosGastos) {
        if (!todosLosGastos || !todosLosGastos.length) return { promedio: 0, max: 0, min: 0 };
        
        const gastosReales = todosLosGastos.filter(g => g.tipo !== 'pagoDeuda');
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        
        // A) Filtrar todos los gastos del año que el usuario está visualizando
        const gastosAño = gastosReales.filter(g => {
            if (!g.fecha) return false;
            const añoGasto = parseInt(g.fecha.substring(0, 4));
            return añoGasto === añoActual;
        });
        
        // B) Agrupar y sumar los gastos por mes (del mes 1 al 12)
        const mesesMap = {};
        for (let mes = 1; mes <= 12; mes++) {
            const mesStr = `${añoActual}-${String(mes).padStart(2, '0')}`;
            mesesMap[mesStr] = 0;
        }
        
        gastosAño.forEach(g => {
            if (!g.fecha) return;
            const m = g.fecha.substring(0, 7);
            mesesMap[m] = (mesesMap[m] || 0) + (Number(g.monto) || 0);
        });
        
        // C) Crear un array solo con los totales de los meses que tengan gastos mayores a 0
        const totalesMensuales = Object.values(mesesMap).filter(total => total > 0);
        
        if (!totalesMensuales.length) return { promedio: 0, max: 0, min: 0 };
        
        // D) Calcular el Mínimo, Máximo y Promedio
        const min = Math.min(...totalesMensuales);
        const max = Math.max(...totalesMensuales);
        const sum = totalesMensuales.reduce((a, b) => a + b, 0);
        const promedio = sum / totalesMensuales.length;
        
        return { promedio, max, min };
    }

    prepararDatosBarras(gastosMesActual, gastosMesAnterior) {
        const gastosAct = gastosMesActual.filter(g => g.tipo !== 'pagoDeuda');
        const gastosAnt = gastosMesAnterior.filter(g => g.tipo !== 'pagoDeuda');
        
        const mapActual = {}, mapAnterior = {}, categoriasUnicas = new Set();
        gastosAct.forEach(g => {
            const cat = g.categoria || 'Sin Categoría';
            mapActual[cat] = (mapActual[cat] || 0) + (Number(g.monto) || 0);
            categoriasUnicas.add(cat);
        });
        gastosAnt.forEach(g => {
            const cat = g.categoria || 'Sin Categoría';
            mapAnterior[cat] = (mapAnterior[cat] || 0) + (Number(g.monto) || 0);
            categoriasUnicas.add(cat);
        });
        
        const categoriasOrdenadas = Array.from(categoriasUnicas).sort((a, b) => (mapActual[b] || 0) - (mapActual[a] || 0));
        const top5 = categoriasOrdenadas.slice(0, 5);
        
        let otrosActual = 0;
        let otrosAnterior = 0;
        categoriasOrdenadas.slice(5).forEach(c => {
            otrosActual += (mapActual[c] || 0);
            otrosAnterior += (mapAnterior[c] || 0);
        });

        const labels = [...top5];
        const dataActual = top5.map(c => mapActual[c] || 0);
        const dataAnterior = top5.map(c => mapAnterior[c] || 0);

        if (categoriasOrdenadas.length > 5) {
            labels.push('Resto (Otras)');
            dataActual.push(otrosActual);
            dataAnterior.push(otrosAnterior);
        }

        return { labels, dataActual, dataAnterior };
    }

    prepararDatosLineas(todosLosGastos, categoriaSeleccionada, rangoStr) {
        const gastosReales = todosLosGastos.filter(g => g.tipo !== 'pagoDeuda');
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