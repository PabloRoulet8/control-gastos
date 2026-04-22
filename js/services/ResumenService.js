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
    calcularHogar(gastosHogar, nombresMiembrosActuales) {
        let totalHogar = 0;
        let aportes = {};
        
        nombresMiembrosActuales.forEach(m => aportes[m] = 0);

        gastosHogar.forEach(g => {
            // FILTRO ESTRICTO: Solo sumamos a la deuda si es un gasto compartido
            if (g.tipo === 'general') {
                const monto = Number(g.monto) || 0;
                totalHogar += monto;
                const responsable = g.responsable || 'Desconocido';
                if (aportes[responsable] === undefined) aportes[responsable] = 0;
                aportes[responsable] += monto;
            }
        });

        const personasInvolucradas = Object.keys(aportes);
        const cantidadMiembros = personasInvolucradas.length > 0 ? personasInvolucradas.length : 1;
        const cuotaPorPersona = totalHogar / cantidadMiembros;

        let deudores = [], acreedores = [];
        for (const [persona, aportado] of Object.entries(aportes)) {
            const balance = aportado - cuotaPorPersona;
            if (balance < -0.01) deudores.push({ nombre: persona, monto: Math.abs(balance) });
            else if (balance > 0.01) acreedores.push({ nombre: persona, monto: balance });
        }

        deudores.sort((a, b) => b.monto - a.monto);
        acreedores.sort((a, b) => b.monto - a.monto);

        let compensaciones = [];
        let i = 0, j = 0;
        while (i < deudores.length && j < acreedores.length) {
            let deudor = deudores[i];
            let acreedor = acreedores[j];
            let montoTransferencia = Math.min(deudor.monto, acreedor.monto);

            compensaciones.push({ de: deudor.nombre, para: acreedor.nombre, monto: montoTransferencia });
            deudor.monto -= montoTransferencia;
            acreedor.monto -= montoTransferencia;
            if (deudor.monto < 0.01) i++;
            if (acreedor.monto < 0.01) j++;
        }

        return { totalHogar, cuotaPorPersona, aportes, compensaciones };
    }

    // 3. RESUMEN UNIFICADO
    calcularUnificado(gastosPersonales, gastosHogar, miNombre, categoriasPersonales, nombresMiembrosHogar) {
        const personalInfo = this.calcularPersonal(gastosPersonales, categoriasPersonales);
        let miParteHogar = 0;
        if (gastosHogar && gastosHogar.length > 0 && nombresMiembrosHogar.length > 0) {
            const hogarInfo = this.calcularHogar(gastosHogar, nombresMiembrosHogar);
            miParteHogar = hogarInfo.cuotaPorPersona;
        }
        return { totalBolsillo: personalInfo.total + miParteHogar, desglosePersonal: personalInfo.total, desgloseHogar: miParteHogar };
    }

    // 4. NUEVAS FUNCIONES ESTADÍSTICAS Y GRÁFICOS
    calcularKPIsHistoricos(todosLosGastos) {
        const meses = {};
        todosLosGastos.forEach(g => {
            if (!g.fecha) return;
            const mes = g.fecha.substring(0, 7); 
            meses[mes] = (meses[mes] || 0) + (Number(g.monto) || 0);
        });

        const valores = Object.values(meses);
        if (valores.length === 0) return { min: 0, max: 0, promedio: 0 };

        const max = Math.max(...valores);
        const min = Math.min(...valores);
        const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

        return { min, max, promedio };
    }

    prepararDatosBarras(gastosMesActual, gastosMesAnterior) {
        const mapActual = {};
        const mapAnterior = {};
        const categoriasUnicas = new Set();

        gastosMesActual.forEach(g => {
            const cat = g.categoria || 'Sin Categoría';
            mapActual[cat] = (mapActual[cat] || 0) + (Number(g.monto) || 0);
            categoriasUnicas.add(cat);
        });

        gastosMesAnterior.forEach(g => {
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
        let gastos = categoriaSeleccionada === 'todas' 
            ? todosLosGastos 
            : todosLosGastos.filter(g => (g.categoria || 'Sin Categoría') === categoriaSeleccionada);

        const mesesMap = {};
        gastos.forEach(g => {
            if(!g.fecha) return;
            const m = g.fecha.substring(0, 7);
            mesesMap[m] = (mesesMap[m] || 0) + (Number(g.monto) || 0);
        });

        const mesesOrdenados = Object.keys(mesesMap).sort();
        let mesesFiltrados = mesesOrdenados;

        let cantidad = mesesOrdenados.length;
        if(rangoStr === '1M') cantidad = 1;
        if(rangoStr === '6M') cantidad = 6;
        if(rangoStr === '1A') cantidad = 12;
        if(rangoStr === '3A') cantidad = 36;

        if (rangoStr !== 'MAX') {
            mesesFiltrados = mesesOrdenados.slice(-cantidad);
        }

        const data = mesesFiltrados.map(m => mesesMap[m]);
        
        const labelsFormateados = mesesFiltrados.map(m => {
            const [yyyy, mm] = m.split('-');
            const date = new Date(yyyy, mm - 1);
            return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
        });

        return { labels: labelsFormateados, data };
    }
}