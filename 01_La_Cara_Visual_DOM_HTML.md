### ARCHIVO index.html

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Inicio - Finanzas</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css?v=11.1">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        // Evitar FOUC aplicando tema guardado ANTES de que renderice el body
        const temaGuardado = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', temaGuardado);
        if (temaGuardado === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    </script>
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#10b981">
</head>
<body>
    <header class="header flex-between">
        <button id="theme-toggle-btn" class="btn-icon-white" title="Cambiar Tema">
            <i data-lucide="moon"></i>
        </button> 
        <button id="btn-cerrar-sesion" class="btn-icon-white" title="Cerrar Sesión"><i data-lucide="log-out"></i></button>
    </header>

    <main class="container mt-15" style="padding-bottom: calc(90px + env(safe-area-inset-bottom));"> 
        <div class="dashboard-header">
            <div class="avatar-square" id="display-avatar-header" style="display: flex; align-items: center; justify-content: center; font-size: 2.2rem;"><i data-lucide="user"></i></div>
            <div>
                <h2 class="greeting-text" id="saludo-usuario">Cargando...</h2>
                <p class="subtitle-text">¿Dónde vamos a anotar hoy?</p>
            </div>
        </div>

        <div class="grid-cards" id="contenedor-hogares">
            </div>
    </main>

    <nav class="bottom-nav">
        <a href="resumen.html?v=11.1&ambito=unificado" class="nav-item" id="btn-unificado-fijo">
            <span class="icon"><i data-lucide="trending-up"></i></span>
            <span class="label">Gastos Unificados</span>
        </a>
    </nav>

    <div id="modal-onboarding" class="modal-overlay" style="display: none; z-index: 9999; background: rgba(0,0,0,0.85);">
        <div class="modal-content" style="max-width: 320px; text-align: center;">
            <h2 style="color: var(--primary-color); margin-top: 0; font-size: 1.8rem;">¡Bienvenido! 👋</h2>
            <p class="text-sm-gray mb-20">Para empezar a llevar el control de tus gastos, decinos cómo te llamás:</p>
            
            <input type="text" id="input-nombre-onboarding" class="form-control mb-15 text-center" placeholder="Tu nombre o apodo..." style="font-size: 1.1rem;">
            
            <button id="btn-guardar-onboarding" class="btn-primary w-100">Comenzar a usar la app</button>
        </div>
    </div>

    <script type="module" src="js/auth_guard.js?v=11.1"></script>
    <script type="module" src="js/controller_dashboard.js?v=11.1"></script>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>

### ARCHIVO resumen.html

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Resumen de Gastos</title>
    <link rel="stylesheet" href="css/styles.css?v=11.1">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#10b981">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        document.documentElement.setAttribute(
            'data-theme', 
            localStorage.getItem('theme') || 'dark'
        );
    </script>
</head>
<body>
    <header class="header flex-between">
        <button onclick="window.location.href='index.html'" class="btn-icon-white" title="Volver al Inicio"><i data-lucide="home"></i></button>
        <h1 id="titulo-header" class="text-center flex-1">Cargando...</h1>
        
        <!-- Nuevo contenedor para el botón de Ingresos -->
        <div id="contenedor-btn-ingresos" style="min-width: 80px; text-align: right; display: flex; justify-content: flex-end; align-items: center;">
            <button id="btn-header-ingresos" style="display: none; background: none; border: none; color: var(--primary-color); font-weight: bold; cursor: pointer; font-size: 0.95rem;">
                Ingresos
            </button>
        </div>
    </header>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <main class="container mt-15" style="padding-bottom: calc(90px + env(safe-area-inset-bottom));">
        <div id="contenedor-resumen-dinamico">
            <p class="text-center text-muted mt-30">Calculando números...</p>
        </div>

        <section class="card dashboard-card mt-20" id="seccion-grafico" style="display: none;">
            <div class="flex-between mb-15">
                <h2 style="margin: 0;">Estadísticas</h2>
                <select id="filtro-cat-grafico" class="form-select-sm" style="display: none; max-width: 150px;">
                    <option value="todas">Todas</option>
                </select>
            </div>

            <div class="flex-center mb-15" style="gap: 10px;">
                 <span class="text-sm-gray" id="label-barras" style="font-weight: bold; color: var(--primary-color);"><i data-lucide="bar-chart-2"></i> Barras</span>
                 <label class="switch">
                     <input type="checkbox" id="switch-tipo-grafico">
                     <span class="slider"></span>
                 </label>
                 <span class="text-sm-gray" id="label-lineas"><i data-lucide="trending-up"></i> Líneas</span>
             </div>

            <div class="chart-container" style="height: 300px; position: relative;">
                <canvas id="graficoEstadisticas"></canvas>
            </div>

            <div class="time-tabs mt-15" id="tabs-tiempo-grafico" style="display: none;">
                <button class="time-tab active" data-rango="1M">1M</button>
                <button class="time-tab" data-rango="6M">6M</button>
                <button class="time-tab" data-rango="1A">1A</button>
                <button class="time-tab" data-rango="3A">3A</button>
                <button class="time-tab" data-rango="MAX">MAX</button>
            </div>
        </section>

        <section class="card dashboard-card" id="seccion-checklist" style="display: none;">
            <h2>Checklist de Fijos del Mes</h2>
            <ul id="lista-checklist" class="lista-minimal"></ul>
        </section>

        <section class="card dashboard-card" id="seccion-stock" style="display: none;">
             <div class="accordion-item">
                 <button class="accordion-header" id="btn-stock"><i data-lucide="shopping-cart"></i> Stock Comestibles <span><i data-lucide="chevron-down"></i></span></button>
                 <div class="accordion-content" id="content-stock" style="display: none;">
                     <div id="lista-stock-categorizada"></div>
                 </div>
             </div>
         </section>

        <div id="modal-pago-deuda" class="modal-overlay" style="display: none; z-index: 9999;">
            <div class="modal-content" style="max-width: 350px;">
                <div class="flex-between mb-15">
                    <h3 style="margin: 0; color: var(--primary-color);"><i data-lucide="dollar-sign"></i> Registrar Pago</h3>
                    <button type="button" id="btn-cerrar-modal-pago" class="btn-cerrar-modal" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i data-lucide="x"></i></button>
                </div>
                <p id="texto-info-pago" class="text-sm-gray mb-15">Ingresá el monto Transferido</p>
                
                <div class="form-group">
                    <label>Monto ($)</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="number" id="input-monto-pago" class="form-control" placeholder="0,00" step="0.01" onkeydown="if(event.key==='Enter')event.preventDefault()" style="flex: 1;">
                        <button type="button" id="btn-max-monto" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; font-size: 0.75rem; cursor: pointer; color: var(--text-muted); white-space: nowrap;">MAX</button>
                    </div>
                </div>
                
                <input type="hidden" id="hidden-deudor-id">
                <input type="hidden" id="hidden-acreedor-id">
                <input type="hidden" id="hidden-monto-deuda">

                <button type="button" id="btn-confirmar-pago" class="btn-primary w-100 mt-10" style="background-color: #10b981;">Confirmar Pago</button>
            </div>
        </div>
    </main>
<!-- MODAL PARA REGISTRAR INGRESOS -->
    <div id="modal-ingreso" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000;">
        <div class="modal-content card" style="width: 90%; max-width: 400px; padding: 20px; background: var(--bg-app);">
            <h3 style="color: var(--primary-color); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="trending-up"></i> Registrar Ingreso
            </h3>
            
            <div class="form-group mb-15">
                <label style="color: var(--text-main);">Concepto</label>
                <input type="text" id="input-concepto-ingreso" class="form-control" placeholder="Ej: Sueldo, Venta, Bono..." autocomplete="off">
            </div>
            
            <div class="form-group mb-15">
                <label style="color: var(--text-main);">Monto</label>
                <div class="input-monto-giant" style="margin: 0;">
                    <span class="monto-prefix" style="font-size: 1.5rem; color: var(--primary-color);">$</span>
                    <input type="number" id="input-monto-ingreso" class="monto-giant-input" style="font-size: 1.8rem;" placeholder="0" step="0.01">
                </div>
            </div>
            
            <div class="flex-between gap-10 mt-20">
                <button id="btn-cerrar-modal-ingreso" type="button" class="btn-secondary flex-1">Cancelar</button>
                <button id="btn-guardar-ingreso" type="button" class="btn-primary flex-1">Guardar</button>
            </div>
        </div>
    </div>
    <div id="toast-container" class="toast"></div>
    <nav class="bottom-nav" id="nav-contextual"></nav>
    <script type="module" src="js/auth_guard.js?v=11.1"></script>
    <script type="module" src="js/controller_resumen.js?v=11.1"></script>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>

### ARCHIVO carga.html

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Cargar Gasto</title>
    <link rel="stylesheet" href="css/styles.css?v=11.1">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#2e7d32">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        document.documentElement.setAttribute(
            'data-theme', 
            localStorage.getItem('theme') || 'dark'
        );
    </script>
</head>
<body>
    <header class="header flex-between">
        <button onclick="window.location.href='index.html'" class="btn-icon-white" title="Volver al Inicio"><i data-lucide="home"></i></button>
        <h1 id="titulo-header" class="text-center flex-1">Nuevo Gasto</h1>
        <div class="header-spacer"></div>
    </header>

    <main class="container" style="padding-bottom: calc(90px + env(safe-area-inset-bottom));">
        <div class="text-center mt-15 mb-20">
            <h2 id="saludo-usuario" class="card-title-green">Cargando...</h2>
            <p class="card-subtitle">¿Qué gasto querés anotar?</p>
        </div>

        <form id="expense-form" class="card">
            
            <div class="form-group toggle-group" id="selector-tipo-gasto" style="display: none;">
                <input type="radio" id="tipo-general" name="tipoGasto" value="general" checked>
                <label for="tipo-general">General</label>
                <input type="radio" id="tipo-individual" name="tipoGasto" value="individual">
                <label for="tipo-individual">Individual</label>
            </div>

            <div class="form-group" id="responsable-group">
                <label>¿Quién lo pagó?</label>
                <select id="responsable" name="responsable" class="form-control">
                    <option value="" disabled selected>Seleccioná quién pagó</option>
                </select>
            </div>

            <div class="form-group">
                <label for="categoria">Categoría</label>
                <select id="categoria" name="categoria" class="form-control" required>
                    <option value="" disabled selected>Cargando categorías...</option>
                </select>
            </div>

            <div class="form-group box-info mb-15" id="fondo-group" style="display: none;">
                <label class="box-info-toggle">
                     ¿Pagado con tarjeta del Fondo? <i data-lucide="credit-card"></i>
                     <input type="checkbox" id="pagado-fondo" name="pagadoFondo" checked class="checkbox-lg">
                </label>
                <small class="box-info-desc">Si marcás esto, se descuenta del pozo compartido.</small>
            </div>

            <div class="form-group" id="referencia-group" style="display: none;">
                <label for="referencia">Detalle o Referencia</label>
                <input type="text" id="referencia" class="form-control" placeholder="Ej: Cena en el centro, regalo de cumple..." autocomplete="off">
            </div>

            <div class="form-group">
                <label for="metodo-pago">Método de Pago</label>
                <select id="metodo-pago" name="metodoPago" class="form-control" required>
                    <option value="efectivo">Efectivo / Transferencia</option>
                    <option value="tarjeta-credito">Tarjeta de Crédito</option>
                </select>
            </div>

            <div id="seccion-inventario" class="form-group border-top-thick" style="display: none;">
                 <label class="text-sm-green-bold"><i data-lucide="shopping-cart"></i> Carga de Inventario</label>
                <div class="grid-inv-row">
                    <input type="text" id="inv-prod" placeholder="Producto" class="form-control-sm">
                    <input type="number" id="inv-cant" placeholder="Cant." step="0.01" class="form-control-sm">
                    <select id="inv-unid" class="form-control-sm">
                        <option value="kg">KG</option>
                        <option value="unid">Unid.</option>
                        <option value="litro">Lt.</option>
                        <option value="pack">Pack</option>
                    </select>
                </div>
                <div class="flex-between mb-15 gap-10">
                    <input type="number" id="inv-precio" placeholder="Precio Total ($)" step="0.01" class="form-control flex-2">
                    <button type="button" id="btn-add-inv" class="btn-primary flex-1">Agregar</button>
                </div>
                <ul id="lista-inventario" class="lista-minimal"></ul>
            </div>

            <!-- MONTO PROMINENTE (ubicado antes del botón guardar) -->
            <div class="input-monto-giant">
                <span class="monto-prefix">$</span>
                <input type="number" id="monto" name="monto" placeholder="0" step="0.01" class="monto-giant-input" required>
            </div>

            <div id="contenedor-opcion-cuotas" class="card" style="display: none; margin-bottom: 20px;">
                <div class="flex-between" style="align-items: center;">
                    <span style="font-weight: 600; color: var(--text-main);"><i data-lucide="credit-card"></i> Pago en Cuotas</span>
                    <label class="switch">
                        <input type="checkbox" id="check-es-cuotas">
                        <span class="slider"></span>
                    </label>
                </div>

                <div id="div-cuotas-config" style="display: none; margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <div class="form-group">
                        <label>Cantidad de Cuotas</label>
                        <input type="number" id="input-cantidad-cuotas" class="form-control" min="2" max="36" placeholder="Ej: 3">
                    </div>
                    <div class="flex-between mt-15" style="align-items: center;">
                        <span class="text-sm-gray">Comprado post-cierre (Pasa al mes sig.)</span>
                        <input type="checkbox" id="check-post-cierre" style="transform: scale(1.3);">
                    </div>
                </div>
            </div>

            <button type="submit" class="btn-primary mt-15 w-100">Guardar Gasto</button>
        </form>
    </main>

    <nav class="bottom-nav" id="nav-contextual"></nav>

    <div id="toast-container" class="toast"></div>

    <script type="module" src="js/auth_guard.js?v=11.1"></script>
    <script type="module" src="js/controller_carga.js?v=11.1"></script>   
</body>
</html>

### ARCHIVO js/ui/ResumenRenderer.js

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

### ARCHIVO js/ui/PerfilRenderer.js

import { AppUtils } from '../utils/AppUtils.js';

export class PerfilRenderer {
    constructor(onDataChange) {
        this.listaCategoriasUI = document.getElementById('lista-categorias-personales');
        this.listaPagosUI = document.getElementById('lista-metodos-pago');
        this.listaFondosUI = document.getElementById('lista-fondos-personales');
        this.checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
        this.onDataChange = onDataChange;
    }

    renderizarCategorias(userData) {
        if (!this.listaCategoriasUI) return;
        this.listaCategoriasUI.innerHTML = '';
        const cats = userData.categorias_personales || [];
        
        if (cats.length === 0) {
            this.listaCategoriasUI.innerHTML = '<li class="text-center text-muted p-20">No tenés categorías.</li>';
            return;
        }
        
        cats.forEach((cat, index) => {
            const li = document.createElement('li');
            li.className = 'cat-item mb-10'; // Le sacamos flex-between
            
            // Inyectamos la grilla estricta: 1 fracción para el texto, 70px fijos para los checks, 40px fijos para el tacho
            li.style.display = 'grid';
            li.style.gridTemplateColumns = '1fr 70px 70px 40px'; 
            li.style.alignItems = 'center';
            li.style.gap = '5px';
            
            li.innerHTML = `
                <span style="color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${AppUtils.escapeHTML(cat.nombre)}</span>
                <div class="text-center">
                    <input type="checkbox" class="cat-checkbox toggle-fijo" data-idx="${index}" ${cat.es_fijo ? 'checked' : ''}>
                </div>
                <div class="text-center">
                    <input type="checkbox" class="cat-checkbox toggle-stock" data-idx="${index}" ${cat.lleva_stock ? 'checked' : ''}>
                </div>
                <div style="text-align: right;">
                    <button type="button" class="btn-icon-danger btn-delete-cat" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            this.listaCategoriasUI.appendChild(li);
        });
        
        this.listaCategoriasUI.querySelectorAll('.toggle-fijo').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                userData.categorias_personales[e.target.dataset.idx].es_fijo = e.target.checked;
                await this.onDataChange();
            });
        });
        this.listaCategoriasUI.querySelectorAll('.toggle-stock').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                userData.categorias_personales[e.target.dataset.idx].lleva_stock = e.target.checked;
                await this.onDataChange();
            });
        });
        
        this.listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                userData.categorias_personales.splice(e.currentTarget.dataset.idx, 1);
                await this.onDataChange();
                this.renderizarCategorias(userData);
            });
        });
        
        if (window.lucide) window.lucide.createIcons();
    }

    renderizarPagos(userData) {
        if (!this.listaPagosUI) return;
        this.listaPagosUI.innerHTML = '';
        const pagos = userData.metodos_pago || [];
        
        if (pagos.length === 0) {
            this.listaPagosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés métodos de pago.</li>';
            return;
        }
        
        pagos.forEach((pago, index) => {
            const li = document.createElement('li');
            li.className = 'flex-between border-bottom-gray';
            li.style.padding = '12px 15px';
            li.innerHTML = `
                <span class="text-bold-dark">${AppUtils.escapeHTML(pago)}</span>
                <button class="btn-icon-danger btn-delete-pago" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
            `;
            this.listaPagosUI.appendChild(li);
        });
        
        this.listaPagosUI.querySelectorAll('.btn-delete-pago').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                userData.metodos_pago.splice(e.currentTarget.dataset.idx, 1);
                await this.onDataChange();
                this.renderizarPagos(userData);
            });
        });
        
        if (window.lucide) window.lucide.createIcons();
    }

    renderizarSeleccionCategoriasFondos(userData) {
        if(!this.checkCategoriasUI) return;
        this.checkCategoriasUI.innerHTML = '';
        const cats = userData.categorias_personales || [];
        
        if (cats.length === 0) {
            this.checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1; padding: 15px;">Agregá categorías primero</span>';
            this.checkCategoriasUI.className = 'border bg-white';
            return;
        }
        
        if (cats.length <= 5) {
            this.checkCategoriasUI.className = 'grid-checkbox-fondos border bg-white';
            cats.forEach(cat => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" name="cat-vinculo-check" value="${AppUtils.escapeHTML(cat.nombre)}"> ${AppUtils.escapeHTML(cat.nombre)}`;
                this.checkCategoriasUI.appendChild(label);
            });
        } else {
            this.checkCategoriasUI.className = 'p-0 border-0 bg-transparent';
            let htmlSelect = `
                <div class="custom-multi-select" id="dropdown-categorias">
                    <div class="select-header" id="dropdown-header">
                        <span id="dropdown-text" style="pointer-events: none;">Seleccionar categorías...</span>
                    </div>
                    <div class="select-options" id="dropdown-options">
            `;
            cats.forEach(cat => {
                htmlSelect += `
                    <label class="option-label">
                        <input type="checkbox" name="cat-vinculo-custom" value="${AppUtils.escapeHTML(cat.nombre)}">
                        ${AppUtils.escapeHTML(cat.nombre)}
                    </label>
                `;
            });
            htmlSelect += `</div></div>`;
            this.checkCategoriasUI.innerHTML = htmlSelect;
            
            const header = document.getElementById('dropdown-header');
            const options = document.getElementById('dropdown-options');
            const textSpan = document.getElementById('dropdown-text');
            const customChecks = document.querySelectorAll('input[name="cat-vinculo-custom"]');
            
            if(header) {
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.classList.toggle('show');
                    header.classList.toggle('open');
                });
            }
            
            customChecks.forEach(chk => {
                chk.addEventListener('change', () => {
                    const seleccionados = Array.from(customChecks).filter(c => c.checked).map(c => c.value);
                    if (seleccionados.length === 0) textSpan.textContent = "Seleccionar categorías...";
                    else if (seleccionados.length === 1) textSpan.textContent = seleccionados[0];
                    else textSpan.textContent = `${seleccionados.length} seleccionadas`;
                });
            });
            
            document.addEventListener('click', function cerrarDropdown(e) {
                if (!header.contains(e.target)) {
                    options.classList.remove('show');
                    header.classList.remove('open');
                    document.removeEventListener('click', cerrarDropdown);
                }
            });
        }
    }

    renderizarFondos(userData) {
        if (!this.listaFondosUI) return;
        this.listaFondosUI.innerHTML = '';
        const fondos = userData.fondos || [];
        
        if (fondos.length === 0) {
            this.listaFondosUI.innerHTML = '<li class="text-center text-muted p-20">No tenés presupuestos.</li>';
            return;
        }
        
        fondos.forEach((f, index) => {
            const li = document.createElement('li');
            li.className = 'fondo-item mb-15';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            
            const catsText = f.categorias && f.categorias.length > 0 ? f.categorias.map(c => AppUtils.escapeHTML(c)).join(', ') : 'Sin categorías';
            
            li.innerHTML = `
                <div style="display: flex; flex-direction: column; text-align: left;">
                    <strong style="font-size: 1rem; color: var(--text-main);">${AppUtils.escapeHTML(f.nombre)}</strong>
                    <span class="text-xs-gray" style="margin: 2px 0 0 0;">Aplica en: ${catsText}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 700; color: var(--text-main);">$ ${AppUtils.formatearARS(f.monto)}</span>
                    <button class="btn-icon-danger btn-delete-fondo" data-idx="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            this.listaFondosUI.appendChild(li);
        });
        
        this.listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                userData.fondos.splice(e.currentTarget.dataset.idx, 1);
                await this.onDataChange();
                this.renderizarFondos(userData);
            });
        });
        
        if (window.lucide) window.lucide.createIcons();
    }
}
