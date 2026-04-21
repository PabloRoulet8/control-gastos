export class ResumenService {
    
    // ==========================================
    // 1. RESUMEN PERSONAL
    // ==========================================
    calcularPersonal(gastos, categoriasConfiguradas) {
        let total = 0;
        let fijos = 0;
        let fijosStock = 0;
        let variables = 0;
        let listaFijos = [];
        let listaStock = [];

        // Armamos un diccionario para buscar rápido si una categoría es fija o lleva stock
        const mapCategorias = {};
        categoriasConfiguradas.forEach(c => {
            const nombreNorm = (typeof c === 'string' ? c : c.nombre).toLowerCase();
            mapCategorias[nombreNorm] = c;
        });

        gastos.forEach(g => {
            total += g.monto;
            const catNorm = g.categoria ? g.categoria.toLowerCase() : '';
            const configCat = mapCategorias[catNorm] || { es_fijo: false, lleva_stock: false };

            if (configCat.es_fijo) {
                if (configCat.lleva_stock) {
                    fijosStock += g.monto;
                    listaStock.push(g);
                } else {
                    fijos += g.monto;
                    listaFijos.push(g);
                }
            } else {
                variables += g.monto;
            }
        });

        return { total, fijos, fijosStock, variables, listaFijos, listaStock };
    }

    // ==========================================
    // 2. RESUMEN HOGAR (Algoritmo de N-Personas)
    // ==========================================
    calcularHogar(gastosHogar, nombresMiembrosActuales) {
        let totalHogar = 0;
        let aportes = {};

        // 1. Inicializamos en 0 a todos los miembros que viven actualmente en la casa
        nombresMiembrosActuales.forEach(m => aportes[m.toLowerCase()] = 0);

        // 2. Sumamos lo que puso cada uno
        gastosHogar.forEach(g => {
            if (g.tipo === 'general') {
                totalHogar += g.monto;
                const responsable = g.responsable ? g.responsable.toLowerCase() : 'desconocido';
                
                // Si pagó alguien que ya no está en la casa, lo agregamos a la ecuación para que la matemática no se rompa
                if (aportes[responsable] === undefined) aportes[responsable] = 0;
                aportes[responsable] += g.monto;
            }
        });

        const personasInvolucradas = Object.keys(aportes);
        const cuotaPorPersona = personasInvolucradas.length > 0 ? (totalHogar / personasInvolucradas.length) : 0;

        let deudores = [];
        let acreedores = [];

        // 3. Calculamos los saldos netos (Lo que puso menos lo que le tocaba poner)
        for (const [persona, aportado] of Object.entries(aportes)) {
            const balance = aportado - cuotaPorPersona;
            
            if (balance < -0.01) {
                deudores.push({ nombre: persona, monto: Math.abs(balance) });
            } else if (balance > 0.01) {
                acreedores.push({ nombre: persona, monto: balance });
            }
        }

        // 4. Ordenamos para que los que más deben le paguen a los que más pusieron
        deudores.sort((a, b) => b.monto - a.monto);
        acreedores.sort((a, b) => b.monto - a.monto);

        let compensaciones = [];
        let i = 0; // Índice de deudores
        let j = 0; // Índice de acreedores

        // 5. Compensación cruzada
        while (i < deudores.length && j < acreedores.length) {
            let deudor = deudores[i];
            let acreedor = acreedores[j];

            let montoTransferencia = Math.min(deudor.monto, acreedor.monto);

            compensaciones.push({
                de: deudor.nombre,
                para: acreedor.nombre,
                monto: montoTransferencia
            });

            deudor.monto -= montoTransferencia;
            acreedor.monto -= montoTransferencia;

            if (deudor.monto < 0.01) i++;
            if (acreedor.monto < 0.01) j++;
        }

        return { 
            totalHogar, 
            cuotaPorPersona, 
            aportes, 
            compensaciones 
        };
    }

    // ==========================================
    // 3. RESUMEN UNIFICADO
    // ==========================================
    calcularUnificado(gastosPersonales, gastosHogar, miNombre, categoriasPersonales, nombresMiembrosHogar) {
        const personalInfo = this.calcularPersonal(gastosPersonales, categoriasPersonales);
        
        let miParteHogar = 0;
        
        if (gastosHogar && gastosHogar.length > 0 && nombresMiembrosHogar.length > 0) {
            const hogarInfo = this.calcularHogar(gastosHogar, nombresMiembrosHogar);
            miParteHogar = hogarInfo.cuotaPorPersona;
        }

        const totalBolsillo = personalInfo.total + miParteHogar;

        return {
            totalBolsillo,
            desglosePersonal: personalInfo.total,
            desgloseHogar: miParteHogar
        };
    }
}