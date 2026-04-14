import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const valTotal = document.querySelector('.monto-total .valor');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    const valFondo = document.querySelector('.valor-fondo');
    const valTarjeta = document.querySelector('.monto-tarjeta .valor');
    const valDeuda = document.querySelector('.valor-deuda');
    const txtDeuda = document.querySelector('.deuda-principal p');
    const desgloseDeuda = document.querySelector('.desglose-deuda');
    const contenedorDeudaAnt = document.getElementById('contenedor-deuda-anterior');
    const txtDeudaAnt = document.getElementById('txt-deuda-anterior');
    const valDeudaAnt = document.getElementById('val-deuda-anterior');

    // Listas Acordeones
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');

    // Lógica Acordeones UI
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.nextElementSibling;
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
    });

    let totalGeneral = 0, proyeccionTarjeta = 0;
    let pagoEfectivoGeneralMostri = 0, individualEnTarjetaMostri = 0;
    
    let inventarioCategorizado = {}; 
    let resumenIndividual = { mostri: {}, mostrina: {} }; // Para agrupar
    
    let individualPropioMostri = 0, individualPropioMostrina = 0;
    let gastoAlimentacion = 0, gastoFijos = 0;

    let totalGeneralAnt = 0, pagoEfectivoGeneralAntMostri = 0, individualEnTarjetaAntMostri = 0;

    const FONDO_INICIAL = 300000;
    const fechaHoy = new Date();
    const mesActual = fechaHoy.toISOString().slice(0, 7); 
    fechaHoy.setMonth(fechaHoy.getMonth() - 1); 
    const mesAnterior = fechaHoy.toISOString().slice(0, 7);

    // Solo pedimos los datos desde el mes pasado
    const primerDiaFiltro = mesAnterior + "-01";
    const q = query(collection(db, "gastos"), where("fecha", ">=", primerDiaFiltro));

    try {
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const esMostri = (data.responsable === 'pablo' || data.responsable === 'mostri');
            const esMostrina = (data.responsable === 'yanet' || data.responsable === 'mostrina');
            const respKey = esMostri ? 'mostri' : 'mostrina';
            
            // LÓGICA MES ACTUAL
            if (data.fecha.startsWith(mesActual)) {
                
                // 1. STOCK FILTRADO (Solo Super, Carnicería, Verdulería)
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

                // 2. AGRUPAMIENTO DE GASTOS INDIVIDUALES
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

                if (data.tipo === 'general') {
                    totalGeneral += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') { proyeccionTarjeta += data.monto; }
                    else if (esMostri) { pagoEfectivoGeneralMostri += data.monto; }
                }

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

        // --- CÁLCULOS ---
        let deudaGeneralMostri = (totalGeneral / 2) - pagoEfectivoGeneralMostri; 
        let deudaTotalMostri = deudaGeneralMostri + individualEnTarjetaMostri;
        let deudaTotalMostriAnt = ((totalGeneralAnt / 2) - pagoEfectivoGeneralAntMostri) + individualEnTarjetaAntMostri;

        let gastoTotalMostri = (totalGeneral / 2) + individualPropioMostri;
        let gastoTotalMostrina = (totalGeneral / 2) + individualPropioMostrina;
        let fondoRestante = FONDO_INICIAL - gastoAlimentacion;

        const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        valTotal.textContent = formatoARS(totalGeneral); // Solo generales
        
        if(valTotalMostri) valTotalMostri.textContent = formatoARS(gastoTotalMostri);
        if(valTotalMostrina) valTotalMostrina.textContent = formatoARS(gastoTotalMostrina);
        if(valAlimentacion) valAlimentacion.textContent = formatoARS(gastoAlimentacion);
        if(valFijos) valFijos.textContent = formatoARS(gastoFijos);
        valTarjeta.textContent = formatoARS(proyeccionTarjeta);

        if (valFondo) {
            valFondo.textContent = formatoARS(fondoRestante);
            const contenedorFondo = document.querySelector('.monto-fondo');
            const labelFondo = document.querySelector('.monto-fondo .label');
            if (fondoRestante < 0) {
                valFondo.style.color = "#c62828";
                labelFondo.textContent = "Fondo Comestibles (¡Se pasaron!)";
                labelFondo.style.color = "#d32f2f";
                contenedorFondo.style.backgroundColor = "#ffebee";
                contenedorFondo.style.border = "1px solid #ffcdd2";
            } else {
                valFondo.style.color = "#01579b";
                labelFondo.textContent = "Fondo Comestibles (Quedan de $300.000)";
                labelFondo.style.color = "#0277bd";
                contenedorFondo.style.backgroundColor = "#e3f2fd";
                contenedorFondo.style.border = "1px solid #bbdefb";
            }
        }

        if (deudaTotalMostri > 0) {
            txtDeuda.textContent = "Mostri transfiere a Mostrina:";
            valDeuda.textContent = formatoARS(deudaTotalMostri);
            desgloseDeuda.innerHTML = `
                <li>Por mitad de generales pendientes: <span>${formatoARS(deudaGeneralMostri)}</span></li>
                <li>Por consumos en su tarjeta: <span>${formatoARS(individualEnTarjetaMostri)}</span></li>
            `;
        } else if (deudaTotalMostri < 0) {
            txtDeuda.textContent = "Mostrina transfiere a Mostri:";
            valDeuda.textContent = formatoARS(Math.abs(deudaTotalMostri));
            desgloseDeuda.innerHTML = `<li>Ajuste a favor de Mostri por generales.</li>`;
        } else {
            txtDeuda.textContent = "¡Cuentas al día!";
            valDeuda.textContent = "$ 0";
            desgloseDeuda.innerHTML = `<li>Nadie debe nada este mes.</li>`;
        }

        if (Math.abs(deudaTotalMostriAnt) > 1) {
            contenedorDeudaAnt.style.display = 'block';
            if (deudaTotalMostriAnt > 0) {
                txtDeudaAnt.textContent = "Mostri le debía a Mostrina:";
                valDeudaAnt.textContent = formatoARS(deudaTotalMostriAnt);
            } else {
                txtDeudaAnt.textContent = "Mostrina le debía a Mostri:";
                valDeudaAnt.textContent = formatoARS(Math.abs(deudaTotalMostriAnt));
                valDeudaAnt.style.color = "#1b5e20"; 
            }
        }

        // 3. RENDER INDIVIDUAL ORDENADO
        const renderResumenIndividual = (datos, uiElement) => {
            if (!uiElement) return;
            uiElement.innerHTML = '';
            let items = Object.entries(datos);
            
            // Ordenar alfabéticamente
            items.sort((a, b) => a[0].localeCompare(b[0]));

            // Anclar "Tarjeta de colectivo" arriba
            const idxColectivo = items.findIndex(i => i[0].toLowerCase().includes("colectivo"));
            if (idxColectivo > -1) {
                const [itemColectivo] = items.splice(idxColectivo, 1);
                items.unshift(itemColectivo);
            }

            if (items.length === 0) {
                uiElement.innerHTML = '<li style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">Sin gastos registrados.</li>';
            } else {
                items.forEach(([cat, total]) => {
                    uiElement.innerHTML += `<li><span>${cat}</span> <strong>$${total.toLocaleString('es-AR')}</strong></li>`;
                });
            }
        };

        renderResumenIndividual(resumenIndividual.mostri, document.getElementById('lista-gastos-mostri'));
        renderResumenIndividual(resumenIndividual.mostrina, document.getElementById('lista-gastos-mostrina'));

        // RENDER DE INVENTARIO CATEGORIZADO (Corregido sin corchete extra)
        if (listaStockUI) {
            listaStockUI.innerHTML = '';
            if (Object.keys(inventarioCategorizado).length === 0) {
                listaStockUI.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">No hay productos registrados en comestibles.</p>';
            } else {
                for (const [categoria, productos] of Object.entries(inventarioCategorizado)) {
                    const catTitle = document.createElement('h4');
                    catTitle.style.cssText = "color: #2e7d32; border-bottom: 1px solid #a5d6a7; padding-bottom: 5px; margin-top: 15px; margin-bottom: 10px;";
                    catTitle.textContent = categoria;
                    listaStockUI.appendChild(catTitle);

                    const ul = document.createElement('ul');
                    ul.className = "lista-minimal";
                    
                    const items = Object.values(productos).sort((a, b) => a.nombre.localeCompare(b.nombre));
                    items.forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>${item.nombre}</span> <span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">${item.cantidad} ${item.unidad}</span>`;
                        ul.appendChild(li);
                    });
                    listaStockUI.appendChild(ul);
                }
            }
        }

    } catch (error) {
        console.error("Error al cargar datos: ", error);
        valDeuda.textContent = "Error al cargar";
    }
});