export class ResumenRenderer {
    constructor() {
        this.contenedorDinamico = document.getElementById('contenedor-resumen-dinamico');
        this.seccionChecklist = document.getElementById('seccion-checklist');
        this.seccionStock = document.getElementById('seccion-stock');
    }

    generarHtmlKPIs(kpis) {
        return `
            <div class="kpi-grid">
                <div class="kpi-card"><span class="kpi-label">Mínimo</span><span class="kpi-value">$ ${Number(kpis.min).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
                <div class="kpi-card"><span class="kpi-label">Promedio</span><span class="kpi-value">$ ${Number(kpis.promedio).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
                <div class="kpi-card"><span class="kpi-label">Máximo</span><span class="kpi-value">$ ${Number(kpis.max).toLocaleString('es-AR', {maximumFractionDigits:0})}</span></div>
            </div>
        `;
    }

    generarHtmlFondos(fondos, gastosMes) {
        if (!fondos || fondos.length === 0) return '';
        let htmlFondos = `<div class="mt-20"><span class="text-sm-gray" style="text-transform: uppercase;">Estado de Presupuestos</span>`;
        fondos.forEach(f => {
            const gastado = gastosMes
                .filter(g => f.categorias && f.categorias.includes(g.categoria))
                .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
            const restante = Number(f.monto) - gastado;
            const colorTexto = restante < 0 ? '#ef4444' : 'var(--primary-color)';

            htmlFondos += `
                <div class="flex-between mt-10" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="font-weight: bold; color: var(--text-main);">${f.nombre}</span>
                    <span style="font-weight: 800; color: ${colorTexto};">$ ${restante.toLocaleString('es-AR')}</span>
                </div>`;
        });
        htmlFondos += `</div>`;
        return htmlFondos;
    }

    renderizarPersonal(data, fondos, gastosMes, kpis) {
        if(this.contenedorDinamico) {
            this.contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Total Gastado (Mes)</span>
                        <span class="valor">$ ${Number(data.total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}
                    <div class="grid-2-col mt-15 gap-10">
                     <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                             <span class="text-sm-gray" style="display:block;">Fijos + Stock <i data-lucide="home"></i></span>
                             <span class="text-bold-dark text-lg">$ ${Number(data.fijos + data.fijosStock).toLocaleString('es-AR')}</span>
                         </div>
                         <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                             <span class="text-sm-gray" style="display:block;">Variables <i data-lucide="package"></i></span>
                             <span class="text-bold-dark text-lg">$ ${Number(data.variables).toLocaleString('es-AR')}</span>
                         </div>
                    </div>
                    
                    ${this.generarHtmlFondos(fondos, gastosMes)}

                </div>
            `;
        }
    }

    renderizarHogar(data, nombreHogar, kpis, fondos, gastosMes, currentUserId, categoriasHogar) {
        // Calculate Fijos + Stock and Variables using the category configuration
        const mapCategorias = {};
        (categoriasHogar || []).forEach(c => {
            mapCategorias[(c.nombre || '').toLowerCase()] = c;
        });
        
        let totalFijosStock = 0;
        let totalVariables = 0;
        
        gastosMes.forEach(g => {
            const catNorm = (g.categoria || '').toLowerCase().trim();
            const configCat = mapCategorias[catNorm] || {};
            const monto = Number(g.monto) || 0;
            
            // Verificamos por propiedad "tipo" directa o por la config de la categoría
            const tipoGasto = (g.tipo || '').toLowerCase().trim();
            
            if (tipoGasto === 'fijo' || tipoGasto === 'stock' || configCat.es_fijo === true) {
                totalFijosStock += monto;
            } else if (tipoGasto !== 'pagodeuda') { 
                // Ignoramos pagos de deuda para no inflar variables falsamente
                totalVariables += monto;
            }
        });
        let htmlDeudas = '';
        if (data.compensaciones.length === 0) {
             htmlDeudas = '<li class="text-center text-muted" style="padding: 20px 0;">¡Cuentas claras! Nadie debe nada este mes. <i data-lucide="check-circle"></i></li>';
        } else {
            data.compensaciones.forEach(c => {
                 const msj = encodeURIComponent(`Hola ${c.de}, te recuerdo que tenemos un saldo pendiente en la App de Gastos de $${Number(c.monto).toLocaleString('es-AR')}. ¡Avisame cuando puedas transferir! <i data-lucide="dollar-sign"></i>`);
                
                // Formateamos la fecha a DD/MM/YYYY si existe el pago
                const textoUltimoPago = c.ultimoPagoInfo 
                    ? `<span style="font-size: 0.75rem; color: #6b7280; display: block; margin-top: 4px;">Último pago: $${Number(c.ultimoPagoInfo.monto).toLocaleString('es-AR')} el ${c.ultimoPagoInfo.fecha.split('-').reverse().join('/')}</span>` 
                    : '';

                // REGLA DE SEGURIDAD: ¿Soy Yane o soy Mostri?
                const esInvolucrado = (currentUserId === c.de_id || currentUserId === c.para_id);
                
// Solo dibuja el botón verde si soy uno de los involucrados
                  const btnPagoHtml = esInvolucrado 
                      ? `<button type="button" class="btn-abrir-modal-pago" data-de-id="${c.de_id}" data-de-nombre="${c.de}" data-para-id="${c.para_id}" data-monto="${c.monto}" style="background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px;"><i data-lucide="dollar-sign"></i> Registrar Pago</button>`
                      : ``;

                // REGLA DE COLOR: Si vos debés = ROJO, si te deben = VERDE
                const colorDeudor = currentUserId === c.de_id ? '#DC2626' : '#64748b';
                const colorAcreedor = currentUserId === c.para_id ? '#10B981' : '#64748b';
                const labelStatus = currentUserId === c.de_id ? 'Vos debés' : (currentUserId === c.para_id ? 'Te deben' : '');

                htmlDeudas += `
                    <li class="flex-between border-bottom-gray" style="padding: 15px 0;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="display: inline-flex; align-items: center; gap: 6px; vertical-align: middle;">
                                <strong style="color: ${colorDeudor};">${c.de}</strong>
                                <span style="color:#64748b;">→</span>
                                <strong style="color: ${colorAcreedor};">${c.para}</strong>
                            </span>
                            ${labelStatus ? `<span style="font-size:0.75rem; color:${colorDeudor}; margin-top:4px;">${labelStatus}</span>` : ''}
                            <div style="display: flex; gap: 10px; margin-top: 8px; align-items: center;">
                                ${btnPagoHtml}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="text-bold-dark" style="color: #d32f2f; font-size: 1.1rem;">$ ${Number(c.monto).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            ${textoUltimoPago}
                        </div>
                    </li>`;
            });
        }

        if(this.contenedorDinamico) {
            this.contenedorDinamico.innerHTML = `
                <div class="card dashboard-card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total" style="border-bottom: none;">
                        <div style="display: flex; flex-direction: column;">
                            <span class="label">TOTAL GASTADO</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: -2px;">${nombreHogar}</span>
                        </div>
                        <span class="valor">$ ${Number(data.totalHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}
                    
                    <div class="grid-2-col mt-15 gap-10" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Fijos + Stock <i data-lucide="home"></i></span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(totalFijosStock).toLocaleString('es-AR')}</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Variables <i data-lucide="package"></i></span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(totalVariables).toLocaleString('es-AR')}</span>
                        </div>
                    </div>

                    ${this.generarHtmlFondos(fondos, gastosMes)}

                    <div class="mt-15 text-center pt-10" style="border-top: 1px solid var(--border-color);">
                        <span class="text-sm-gray">A cada uno le corresponde poner:</span>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-main); margin-top: 5px;">$ ${Number(data.cuotaPorPersona).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                </div>

                <div class="card dashboard-card mt-20" style="border-top: 4px solid var(--primary-color);">
                     <h2 style="color: var(--primary-color); margin-bottom: 10px;"><i data-lucide="credit-card"></i> Liquidación de Deudas</h2>
                     <p class="text-sm-gray mb-15">Quién le transfiere a quién para quedar a mano:</p>
                     <ul class="lista-minimal">
                         ${htmlDeudas}
                     </ul>
                </div>
            `;
        }
    }

    renderizarUnificado(data, kpis) {
        if(this.contenedorDinamico) {
            this.contenedorDinamico.innerHTML = `
                <div class="card" style="border-top: 4px solid var(--primary-color);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Dinero Total de tu Bolsillo (Mes)</span>
                        <span class="valor" style="color: var(--primary-color); font-size: 2.5rem;">$ ${Number(data.totalBolsillo).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}
                </div>

                <h3 class="mt-20 mb-10" style="font-size: 0.9rem; text-transform: uppercase; padding-left: 10px; color: var(--text-muted);">¿De dónde sale este número?</h3>
                
                <div class="contenedor-unificado">
                    <div class="grid-2-col gap-10 mb-30" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1.5rem;">
                    <div class="card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Gastos Personales</span>
                        <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(data.desglosePersonal).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Tu parte del Hogar</span>
                        <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(data.desgloseHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
            `;
        }
    }

mostrarComunes(gastos, catConfig, mostrarListasExtras) {
        if (!mostrarListasExtras) return;

        const categoriasFijas = catConfig.filter(c => c.activa !== false && c.es_fijo === true).map(c => c.nombre);

        if (categoriasFijas.length > 0 && this.seccionChecklist) {
            this.seccionChecklist.style.display = 'block';
            const ulCheck = document.getElementById('lista-checklist');
            if(ulCheck) {
                ulCheck.innerHTML = '';
                categoriasFijas.forEach(fija => {
                    const pagado = gastos.some(g => (g.categoria || "").toLowerCase().trim() === fija.toLowerCase().trim());
                    const icono = pagado 
                        ? '<i data-lucide="check-circle" style="color: #10b981;"></i>' 
                        : '<i data-lucide="x-circle" style="color: #ef4444;"></i>';
                    const estadoTexto = pagado ? 'Pagado' : 'Pendiente';
                    const estadoColor = pagado ? '#10b981' : '#ef4444';
                    
                    ulCheck.innerHTML += `
                        <li class="flex-between" style="padding: 14px 0; border-bottom: 1px solid var(--glass-border);">
                            <span style="display: flex; align-items: center; gap: 8px; color: var(--text-main);">
                                ${icono} ${fija}
                            </span>
                            <span style="font-weight: 600; font-size: 0.85rem; color: ${estadoColor};">${estadoTexto}</span>
                        </li>`;
                });
            }
        } else if (this.seccionChecklist) {
            this.seccionChecklist.style.display = 'none';
        }

        const itemsStock = gastos.flatMap(g => g.detalle_inventario || []);
        if (itemsStock.length > 0 && this.seccionStock) {
            this.seccionStock.style.display = 'block';
            const ulStock = document.getElementById('lista-stock-categorizada');
            if(ulStock) {
                ulStock.innerHTML = '';
                const stockAgrupado = itemsStock.reduce((acc, item) => {
                    const n = item.producto.toLowerCase();
                    if (!acc[n]) acc[n] = { cant: 0, unidad: item.unidad };
                    acc[n].cant += Number(item.cantidad) || 0;
                    return acc;
                }, {});
                for (const [nombre, info] of Object.entries(stockAgrupado)) {
                    ulStock.innerHTML += `
                        <div class="flex-between border-bottom-gray mb-10" style="padding: 8px 0;">
                            <span style="text-transform: capitalize;">${nombre}</span>
                            <span class="text-bold-dark">${info.cant} ${info.unidad}</span>
                        </div>`;
                }
            }
        } else if (this.seccionStock) {
            this.seccionStock.style.display = 'none';
        }
    }
}