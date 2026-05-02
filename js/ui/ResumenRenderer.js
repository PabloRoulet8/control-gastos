import { AppUtils } from '../utils/AppUtils.js';

export class ResumenRenderer {
    constructor() {
        this.contenedorDinamico = document.getElementById('contenedor-resumen-dinamico');
        this.seccionChecklist = document.getElementById('seccion-checklist');
        this.seccionStock = document.getElementById('seccion-stock');
    }

    generarHtmlKPIs(kpis) {
        return `
            <div class="kpi-grid">
                <div class="kpi-card"><span class="kpi-label">Mínimo</span><span class="kpi-value">${AppUtils.formatearARS(kpis.minimo)}</span></div>
                <div class="kpi-card"><span class="kpi-label">Prom. Mensual</span><span class="kpi-value">${AppUtils.formatearARS(kpis.promedio)}</span></div>
                <div class="kpi-card"><span class="kpi-label">Máximo</span><span class="kpi-value">${AppUtils.formatearARS(kpis.maximo)}</span></div>
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
                    <span style="font-weight: bold; color: var(--text-main);">${AppUtils.escapeHTML(f.nombre)}</span>
                    <span style="font-weight: 800; color: ${colorTexto};">${AppUtils.formatearARS(restante)}</span>
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
                        <span class="valor">${AppUtils.formatearARS(data.total)}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}

                    <div class="grid-2-col mt-15 gap-10">
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Fijos + Stock <i data-lucide="home"></i></span>
                            <span class="text-bold-dark text-lg">${AppUtils.formatearARS(data.fijos + data.fijosStock)}</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Variables <i data-lucide="package"></i></span>
                            <span class="text-bold-dark text-lg">${AppUtils.formatearARS(data.variables)}</span>
                        </div>
                    </div>

                    <div class="grid-2-col gap-10" style="margin-top: 15px;">
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Tarjetas (Este Mes) <i data-lucide="credit-card" style="width:14px; height:14px;"></i></span>
                            <span class="text-bold-dark text-lg" id="monto-tarjetas-mes" style="color: var(--primary-color);">...</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Deuda Total Tarjetas <i data-lucide="calendar" style="width:14px; height:14px;"></i></span>
                            <span class="text-bold-dark text-lg" id="monto-tarjetas-total" style="color: var(--primary-color);">...</span>
                        </div>
                    </div>

                    ${this.generarHtmlFondos(fondos, gastosMes)}
                </div>
            `;
        }
    }

    renderizarHogar(data, nombreHogar, kpis, fondos, gastosMes, currentUserId, categoriasHogar) {
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
            const tipoGasto = (g.tipo || '').toLowerCase().trim();
            
            if (tipoGasto === 'fijo' || tipoGasto === 'stock' || configCat.es_fijo === true) {
                totalFijosStock += monto;
            } else if (tipoGasto !== 'pagodeuda' && tipoGasto !== 'ingreso') { 
                totalVariables += monto;
            }
        });

        let htmlDeudas = '';
        if (data.compensaciones.length === 0) {
             htmlDeudas = '<li class="text-center text-muted" style="padding: 20px 0;">¡Cuentas claras! Nadie debe nada este mes. <i data-lucide="check-circle"></i></li>';
        } else {
            data.compensaciones.forEach(c => {
                const msj = encodeURIComponent(`Hola ${c.de}, te recuerdo que tenemos un saldo pendiente en la App de Gastos de ${AppUtils.formatearARS(c.monto)}. ¡Avisame cuando puedas transferir! <i data-lucide="dollar-sign"></i>`);
                
                const textoUltimoPago = c.ultimoPagoInfo 
                    ? `<span style="font-size: 0.75rem; color: #6b7280; display: block; margin-top: 4px;">Último pago: ${AppUtils.formatearARS(c.ultimoPagoInfo.monto)} el ${c.ultimoPagoInfo.fecha.split('-').reverse().join('/')}</span>` 
                    : '';
                
                const esInvolucrado = (currentUserId === c.de_id || currentUserId === c.para_id);
                
                const btnPagoHtml = esInvolucrado 
                      ? `<button type="button" class="btn-abrir-modal-pago" data-de-id="${c.de_id}" data-de-nombre="${AppUtils.escapeHTML(c.de)}" data-para-id="${c.para_id}" data-monto="${c.monto}" style="background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px;"><i data-lucide="dollar-sign"></i> Registrar Pago</button>`
                      : ``;

                const colorDeudor = currentUserId === c.de_id ? '#DC2626' : '#64748b';
                const colorAcreedor = currentUserId === c.para_id ? '#10B981' : '#64748b';
                const labelStatus = currentUserId === c.de_id ? 'Vos debés' : (currentUserId === c.para_id ? 'Te deben' : '');
                
                htmlDeudas += `
                    <li class="flex-between border-bottom-gray" style="padding: 15px 0;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="display: inline-flex; align-items: center; gap: 6px; vertical-align: middle;">
                                <strong style="color: ${colorDeudor};">${AppUtils.escapeHTML(c.de)}</strong>
                                <span style="color:#64748b;">→</span>
                                <strong style="color: ${colorAcreedor};">${AppUtils.escapeHTML(c.para)}</strong>
                            </span>
                            ${labelStatus ? `<span style="font-size:0.75rem; color:${colorDeudor}; margin-top:4px;">${labelStatus}</span>` : ''}
                            <div style="display: flex; gap: 10px; margin-top: 8px; align-items: center;">
                                ${btnPagoHtml}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="text-bold-dark" style="color: #d32f2f; font-size: 1.1rem;">${AppUtils.formatearARS(c.monto)}</span>
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
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: -2px;">${AppUtils.escapeHTML(nombreHogar)}</span>
                        </div>
                        <span class="valor">${AppUtils.formatearARS(data.totalHogar)}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}

                    <div class="grid-2-col mt-15 gap-10" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Fijos + Stock <i data-lucide="home"></i></span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">${AppUtils.formatearARS(totalFijosStock)}</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Variables <i data-lucide="package"></i></span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">${AppUtils.formatearARS(totalVariables)}</span>
                        </div>
                    </div>

                    <div class="grid-2-col gap-10" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                         <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                              <span class="text-sm-gray" style="display:block;">Tarjetas (Este Mes) <i data-lucide="credit-card" style="width:14px; height:14px;"></i></span>
                              <span class="text-bold-dark text-lg" id="monto-tarjetas-mes" style="color: var(--primary-color);">...</span>
                          </div>
                          <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                              <span class="text-sm-gray" style="display:block;">Deuda Total Tarjetas <i data-lucide="calendar" style="width:14px; height:14px;"></i></span>
                              <span class="text-bold-dark text-lg" id="monto-tarjetas-total" style="color: var(--primary-color);">...</span>
                          </div>
                    </div>

                    ${this.generarHtmlFondos(fondos, gastosMes)}

                    <div class="mt-15 text-center pt-10" style="border-top: 1px solid var(--border-color);">
                        <span class="text-sm-gray">A cada uno le corresponde poner:</span>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-main); margin-top: 5px;">${AppUtils.formatearARS(data.cuotaPorPersona)}</div>
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

    renderizarUnificado(data, kpis, totalIngresos = 0) {
        let htmlSaldo = '';
        if (totalIngresos > 0) {
            const saldo = totalIngresos - data.totalBolsillo;
            const colorSaldo = saldo >= 0 ? 'var(--primary-color)' : '#ef4444';
            htmlSaldo = `
                <div class="text-center" style="border-bottom: 1px dashed var(--border-color); padding-bottom: 15px; margin-bottom: 15px;">
                    <span style="display: block; font-size: 1.1rem; color: var(--text-main); font-weight: 600;">Saldo</span>
                    <span style="display: block; color: ${colorSaldo}; font-size: clamp(1.8rem, 8vw, 3.2rem); font-weight: 800; line-height: 1.1; word-break: break-word; padding: 0 5px;">${AppUtils.formatearARS(saldo)}</span>
                </div>
            `;
        }

        if(this.contenedorDinamico) {
            this.contenedorDinamico.innerHTML = `
                <div class="card" style="border-top: 4px solid var(--primary-color);">
                    ${htmlSaldo}
                    <div class="monto-total text-center" style="border-bottom: none; padding-top: ${totalIngresos > 0 ? '5px' : '20px'};">
                        <span class="label" style="font-size: ${totalIngresos > 0 ? '0.75rem' : '0.85rem'};">Total gastado</span>
                        <span class="valor" style="color: var(--primary-color); font-size: clamp(1.5rem, 6vw, ${totalIngresos > 0 ? '1.8rem' : '2.5rem'}); word-break: break-word;">${AppUtils.formatearARS(data.totalBolsillo)}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}
                </div>

                <h3 class="mt-20 mb-10" style="font-size: 0.9rem; text-transform: uppercase; padding-left: 10px; color: var(--text-muted);">¿De dónde sale este número?</h3>
                <div class="contenedor-unificado">
                    <div class="grid-2-col gap-10 mb-30" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1.5rem;">
                        <div class="card p-15" style="margin:0;">
                            <span class="text-sm-gray" style="display:block;">Gastos Personales</span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">${AppUtils.formatearARS(data.desglosePersonal)}</span>
                        </div>
                        <div class="card p-15" style="margin:0;">
                            <span class="text-sm-gray" style="display:block;">Tu parte del Hogar</span>
                            <span class="text-bold-dark text-lg" style="color: var(--primary-color);">${AppUtils.formatearARS(data.desgloseHogar)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    mostrarComunes(gastos, catConfig, mostrarListasExtras, gastosMesAnterior = []) {
        if (!mostrarListasExtras) return;

        // 1. DIBUJAR CHECKLIST
        const categoriasFijas = catConfig
            .map(c => typeof c === 'string' ? {nombre: c, es_fijo: false} : c)
            .filter(c => c.activa !== false && c.es_fijo === true)
            .map(c => c.nombre);

        if (categoriasFijas.length > 0 && this.seccionChecklist) {
            this.seccionChecklist.style.display = 'block';
            const ulCheck = document.getElementById('lista-checklist');
            if(ulCheck) {
                ulCheck.innerHTML = '';
                categoriasFijas.forEach(fija => {
                    const pagado = gastos.some(g => (g.categoria || "").toLowerCase().trim() === fija.toLowerCase().trim());
                    const icono = pagado ? '<i data-lucide="check-circle" style="color: #10b981;"></i>' : '<i data-lucide="x-circle" style="color: #ef4444;"></i>';
                    const estadoTexto = pagado ? 'Pagado' : 'Pendiente';
                    const estadoColor = pagado ? '#10b981' : '#ef4444';

                    ulCheck.innerHTML += `
                        <li class="flex-between" style="padding: 14px 0; border-bottom: 1px solid var(--glass-border);">
                            <span style="display: flex; align-items: center; gap: 8px; color: var(--text-main);">${icono} ${AppUtils.escapeHTML(fija)}</span>
                            <span style="font-weight: 600; font-size: 0.85rem; color: ${estadoColor};">${estadoTexto}</span>
                        </li>`;
                });
            }
        } else if (this.seccionChecklist) {
            this.seccionChecklist.style.display = 'none';
        }

        // 2. DIBUJAR STOCK CON ACORDEONES ANIDADOS
        const catsMarcadas = catConfig
            .map(c => typeof c === 'string' ? {nombre: c, lleva_stock: false} : c)
            .filter(c => c.activa !== false && c.lleva_stock === true)
            .map(c => c.nombre);

        const todosLosGastos = [...gastos, ...gastosMesAnterior];
        const gastosConInventario = todosLosGastos.filter(g => g.detalle_inventario && g.detalle_inventario.length > 0);
        const catsConInventario = gastosConInventario.map(g => g.categoria);

        const categoriasStockSet = new Set();
        [...catsMarcadas, ...catsConInventario].forEach(c => {
            if(c) categoriasStockSet.add(c.toLowerCase().trim());
        });

        const categoriasStockFinales = Array.from(categoriasStockSet);

        if (categoriasStockFinales.length > 0 && this.seccionStock) {
            this.seccionStock.style.display = 'block';
            this.seccionStock.innerHTML = ''; 

            let hayProductos = false;
            
            // ACORDEÓN PRINCIPAL: "Stock Mensual"
            let htmlStock = `
                <div class="card dashboard-card" style="padding: 15px; border-top: 4px solid var(--primary-color);">
                    <div class="flex-between toggle-stock-main" style="cursor: pointer; user-select: none;">
                        <h2 style="color: var(--text-main); margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="package"></i> Stock Mensual
                        </h2>
                        <i data-lucide="chevron-down" class="chevron-main" style="transition: transform 0.3s ease; color: var(--text-muted);"></i>
                    </div>
                    
                    <div class="content-stock-main" style="display: none; padding-top: 15px; margin-top: 15px; border-top: 1px solid var(--border-color);">
            `;

            categoriasStockFinales.forEach(catNombreNorm => {
                const gastoRef = gastosConInventario.find(g => (g.categoria || '').toLowerCase().trim() === catNombreNorm);
                const nombreCatReal = gastoRef ? gastoRef.categoria : (catNombreNorm.charAt(0).toUpperCase() + catNombreNorm.slice(1));

                const agruparProductos = (listaGastos) => {
                    const items = listaGastos
                        .filter(g => (g.categoria || "").toLowerCase().trim() === catNombreNorm)
                        .flatMap(g => g.detalle_inventario || []);
                    
                    return items.reduce((acc, item) => {
                        const n = item.producto.toLowerCase().trim();
                        if (!acc[n]) acc[n] = { cant: 0, unidad: item.unidad || 'u' };
                        acc[n].cant += Number(item.cantidad) || 0;
                        return acc;
                    }, {});
                };

                const stockActual = agruparProductos(gastos);
                const stockAnterior = agruparProductos(gastosMesAnterior);
                const todosLosProductos = new Set([...Object.keys(stockActual), ...Object.keys(stockAnterior)]);

                if (todosLosProductos.size > 0) {
                    hayProductos = true;
                    
                    // ACORDEÓN SECUNDARIO: Categoría (Ej: Supermercado)
                    htmlStock += `
                        <div class="dashboard-card mb-15" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0; border-radius: 8px; overflow: hidden;">
                            <div class="flex-between toggle-stock-cat" style="background: var(--bg-app); padding: 12px 15px; cursor: pointer; user-select: none;">
                                <h3 style="color: var(--primary-color); margin: 0; font-size: 0.95rem; text-transform: uppercase;">
                                    ${AppUtils.escapeHTML(nombreCatReal)}
                                </h3>
                                <i data-lucide="chevron-down" class="chevron-cat" style="transition: transform 0.3s ease; color: var(--text-muted);"></i>
                            </div>
                            
                            <div class="content-stock-cat" style="display: none;">
                                <div class="flex-between text-xs-gray" style="padding: 8px 15px; background: rgba(0,0,0,0.1); border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
                                    <span>Producto</span>
                                    <span>Mes Act. <span style="color:var(--glass-border); margin:0 5px;">|</span> Mes Ant.</span>
                                </div>
                                <ul class="lista-minimal" style="padding: 0 15px;">
                    `;

                    Array.from(todosLosProductos).sort().forEach(prod => {
                        const act = stockActual[prod] || { cant: 0, unidad: (stockAnterior[prod]?.unidad || '') };
                        const ant = stockAnterior[prod] || { cant: 0, unidad: act.unidad };
                        
                        const cantActFmt = act.cant % 1 === 0 ? act.cant : act.cant.toFixed(2);
                        const cantAntFmt = ant.cant % 1 === 0 ? ant.cant : ant.cant.toFixed(2);
                        const colorAct = act.cant > 0 ? 'var(--primary-color)' : 'var(--text-muted)';

                        htmlStock += `
                            <li class="flex-between" style="padding: 12px 0; border-bottom: 1px solid var(--glass-border);">
                                <span style="text-transform: capitalize; color: var(--text-main); font-weight: 500;">${AppUtils.escapeHTML(prod)}</span>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-weight: 700; color: ${colorAct}; font-size: 1rem;">${cantActFmt} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">${act.unidad}</span></span>
                                    <span style="color: var(--glass-border);">|</span>
                                    <span style="color: var(--text-muted); font-size: 0.85rem;">${cantAntFmt}</span>
                                </div>
                            </li>
                        `;
                    });
                    htmlStock += `</ul></div></div>`; 
                }
            });

            htmlStock += `</div></div>`; // Cierra acordeón principal

            if (hayProductos) {
                this.seccionStock.innerHTML = htmlStock;

                // Re-renderizar iconos de Lucide porque inyectamos HTML nuevo
                if (window.lucide) {
                    window.lucide.createIcons();
                }

                // --- LÓGICA DE CLICS PARA LOS ACORDEONES ---
                
                // 1. Acordeón Principal (Stock Mensual)
                const mainToggle = this.seccionStock.querySelector('.toggle-stock-main');
                const mainContent = this.seccionStock.querySelector('.content-stock-main');
                const mainChevron = this.seccionStock.querySelector('.chevron-main');

                if(mainToggle && mainContent) {
                    mainToggle.addEventListener('click', () => {
                        const isVisible = mainContent.style.display === 'block';
                        mainContent.style.display = isVisible ? 'none' : 'block';
                        if(mainChevron) {
                            mainChevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                        }
                    });
                }

                // 2. Acordeones Secundarios (Categorías)
                const catToggles = this.seccionStock.querySelectorAll('.toggle-stock-cat');
                catToggles.forEach(toggle => {
                    toggle.addEventListener('click', (e) => {
                        const content = e.currentTarget.nextElementSibling;
                        const chevron = e.currentTarget.querySelector('.chevron-cat');
                        
                        if (content) {
                            const isVisible = content.style.display === 'block';
                            content.style.display = isVisible ? 'none' : 'block';
                            if (chevron) {
                                chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                            }
                        }
                    });
                });

            } else {
                this.seccionStock.style.display = 'none';
            }

        } else if (this.seccionStock) {
            this.seccionStock.style.display = 'none';
        }
    }
}