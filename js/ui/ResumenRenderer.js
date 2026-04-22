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

    renderizarPersonal(data, fondos, gastosMes, kpis) {
        let htmlFondos = '';
        if (fondos && fondos.length > 0) {
            htmlFondos = `<div class="mt-20"><span class="text-sm-gray" style="text-transform: uppercase;">Estado de Mis Presupuestos</span>`;
            fondos.forEach(f => {
                const gastado = gastosMes
                    .filter(g => f.categorias.includes(g.categoria))
                    .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
                const restante = Number(f.monto) - gastado;
                const colorTexto = restante < 0 ? '#ef4444' : 'var(--primary-color)';

                htmlFondos += `
                    <div class="flex-between mt-10" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                        <span style="font-weight: bold; color: var(--text-main);">${f.nombre}</span>
                        <span style="font-weight: 800; color: ${colorTexto};">$ ${restante.toLocaleString('es-AR')} Disp.</span>
                    </div>`;
            });
            htmlFondos += `</div>`;
        }

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
                            <span class="text-sm-gray" style="display:block;">Fijos + Stock 🏠</span>
                            <span class="text-bold-dark text-lg">$ ${Number(data.fijos + data.fijosStock).toLocaleString('es-AR')}</span>
                        </div>
                        <div class="text-center" style="background: var(--bg-app); padding: 15px; border-radius: 8px;">
                            <span class="text-sm-gray" style="display:block;">Variables 🍟</span>
                            <span class="text-bold-dark text-lg">$ ${Number(data.variables).toLocaleString('es-AR')}</span>
                        </div>
                    </div>
                    ${htmlFondos}
                </div>
            `;
        }
    }

    renderizarHogar(data, nombreHogar, kpis) {
        let htmlDeudas = '';
        if (data.compensaciones.length === 0) {
            htmlDeudas = '<li class="text-center text-muted" style="padding: 20px 0;">¡Cuentas claras! Nadie debe nada este mes. 🙌</li>';
        } else {
            data.compensaciones.forEach(c => {
                htmlDeudas += `
                    <li class="flex-between border-bottom-gray" style="padding: 15px 0;">
                        <span><strong style="color: #ea580c;">${c.de}</strong> le paga a <strong>${c.para}</strong></span>
                        <span class="text-bold-dark" style="color: #d32f2f; font-size: 1.1rem;">$ ${Number(c.monto).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                    <div class="mt-15 text-center pt-10" style="border-top: 1px solid var(--border-color);">
                        <span class="text-sm-gray">A cada uno le corresponde poner:</span>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-main); margin-top: 5px;">$ ${Number(data.cuotaPorPersona).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                </div>

                <div class="card dashboard-card mt-20" style="border-top: 4px solid #ea580c;">
                    <h2 style="color: #ea580c; margin-bottom: 10px;">Liquidación de Deudas</h2>
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
                <div class="card dashboard-card" style="border-top: 4px solid #3b82f6; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);">
                    <div class="monto-total" style="border-bottom: none;">
                        <span class="label">Dinero Total de tu Bolsillo (Mes)</span>
                        <span class="valor" style="color: #1e3a8a; font-size: 2.5rem;">$ ${Number(data.totalBolsillo).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    ${this.generarHtmlKPIs(kpis)}
                </div>

                <h3 class="mt-20 mb-10 text-muted" style="font-size: 0.9rem; text-transform: uppercase; padding-left: 10px;">¿De dónde sale este número?</h3>
                
                <div class="grid-2-col gap-10 mb-30">
                    <div class="card dashboard-card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Gastos Personales</span>
                        <span class="text-bold-dark text-lg" style="color: var(--primary-color);">$ ${Number(data.desglosePersonal).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="card dashboard-card p-15" style="margin:0;">
                        <span class="text-sm-gray" style="display:block;">Tu parte del Hogar</span>
                        <span class="text-bold-dark text-lg" style="color: #ea580c;">$ ${Number(data.desgloseHogar).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                    ulCheck.innerHTML += `
                        <li class="flex-between border-bottom-gray" style="padding: 12px 0; opacity: ${pagado ? '0.5' : '1'};">
                            <span>${pagado ? '✅' : '⭕'} ${fija}</span>
                            <span class="text-sm-gray">${pagado ? 'Pagado' : 'Pendiente'}</span>
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