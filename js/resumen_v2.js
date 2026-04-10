import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKqmEWdxbUZKDPdUIghdrtgGkGdEudFr8",
    authDomain: "control-gastos-cf09c.firebaseapp.com",
    projectId: "control-gastos-cf09c",
    storageBucket: "control-gastos-cf09c.firebasestorage.app",
    messagingSenderId: "350200153131",
    appId: "1:350200153131:web:e11a4b4fc5e5ba0310966e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const valTotal = document.querySelector('.monto-total .valor');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    
    // NUEVO SELECTOR: El fondo de compras
    const valFondo = document.querySelector('.valor-fondo');
    
    const valTarjeta = document.querySelector('.monto-tarjeta .valor');
    const valDeuda = document.querySelector('.valor-deuda');
    const txtDeuda = document.querySelector('.deuda-principal p');
    const desgloseDeuda = document.querySelector('.desglose-deuda');
    
    const listaInventarioUI = document.getElementById('lista-inventario-mensual');
    const listaInventarioAntUI = document.getElementById('lista-inventario-anterior');
    const btnToggleInvAnt = document.getElementById('btn-toggle-inventario-ant');
    const contenedorInvAnt = document.getElementById('contenedor-inventario-ant');

    const contenedorDeudaAnt = document.getElementById('contenedor-deuda-anterior');
    const txtDeudaAnt = document.getElementById('txt-deuda-anterior');
    const valDeudaAnt = document.getElementById('val-deuda-anterior');

    if (btnToggleInvAnt && contenedorInvAnt) {
        btnToggleInvAnt.addEventListener('click', () => {
            if (contenedorInvAnt.style.display === 'none') {
                contenedorInvAnt.style.display = 'block';
                btnToggleInvAnt.textContent = 'Ocultar stock del mes pasado ⬆️';
            } else {
                contenedorInvAnt.style.display = 'none';
                btnToggleInvAnt.textContent = 'Ver stock del mes pasado ⬇️';
            }
        });
    }

    let totalGeneral = 0, totalIndividual = 0, proyeccionTarjeta = 0;
    let pagoEfectivoGeneralMostri = 0, individualEnTarjetaMostri = 0;
    let inventarioAcumulado = {};
    
    let individualPropioMostri = 0;
    let individualPropioMostrina = 0;
    let gastoAlimentacion = 0, gastoFijos = 0;

    let totalGeneralAnt = 0;
    let pagoEfectivoGeneralAntMostri = 0, individualEnTarjetaAntMostri = 0;
    let inventarioAcumuladoAnt = {}; 

    // CONSTANTE: El monto definido para el fondo de comestibles
    const FONDO_INICIAL = 300000;

    const fechaHoy = new Date();
    const mesActual = fechaHoy.toISOString().slice(0, 7); 
    fechaHoy.setMonth(fechaHoy.getMonth() - 1); 
    const mesAnterior = fechaHoy.toISOString().slice(0, 7);

    try {
        const querySnapshot = await getDocs(collection(db, "gastos"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const esMostri = (data.responsable === 'pablo' || data.responsable === 'mostri');
            const esMostrina = (data.responsable === 'yanet' || data.responsable === 'mostrina');
            
            // LÓGICA MES ACTUAL
            if (data.fecha.startsWith(mesActual)) {
                
                if (data.detalle_inventario && Array.isArray(data.detalle_inventario)) {
                    data.detalle_inventario.forEach(item => {
                        if (item.producto && item.cantidad !== undefined) {
                            const nombreNorm = item.producto.toString().trim().toLowerCase();
                            const unidadNorm = (item.unidad || 'unid').trim();
                            const key = `${nombreNorm}-${unidadNorm}`;

                            if (!inventarioAcumulado[key]) {
                                inventarioAcumulado[key] = { nombre: item.producto.toString().trim(), cantidad: 0, unidad: unidadNorm };
                            }
                            inventarioAcumulado[key].cantidad += parseFloat(item.cantidad);
                        }
                    });
                }

                if (data.tipo === 'general') {
                    totalGeneral += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') { proyeccionTarjeta += data.monto; }
                    else if (esMostri) { pagoEfectivoGeneralMostri += data.monto; }
                } else if (data.tipo === 'individual') {
                    totalIndividual += data.monto;
                    
                    if (esMostri) { individualPropioMostri += data.monto; } 
                    else if (esMostrina) { individualPropioMostrina += data.monto; }

                    if (data.metodo_pago === 'tarjeta-credito') {
                        proyeccionTarjeta += data.monto;
                        if (esMostri) { individualEnTarjetaMostri += data.monto; }
                    }
                }

                if (data.categoria) {
                    const catNormalizada = data.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const catsAlimentacion = ['supermercado', 'carniceria', 'verduleria'];
                    const catsFijos = ['alquiler', 'expensas', 'gas', 'epe', 'wifi', 'agua', 'tgi'];

                    if (catsAlimentacion.includes(catNormalizada)) { gastoAlimentacion += data.monto; } 
                    else if (catsFijos.includes(catNormalizada)) { gastoFijos += data.monto; }
                }
            } 
            // LÓGICA MES ANTERIOR
            else if (data.fecha.startsWith(mesAnterior)) {
                if (data.detalle_inventario && Array.isArray(data.detalle_inventario)) {
                    data.detalle_inventario.forEach(item => {
                        if (item.producto && item.cantidad !== undefined) {
                            const nombreNorm = item.producto.toString().trim().toLowerCase();
                            const unidadNorm = (item.unidad || 'unid').trim();
                            const key = `${nombreNorm}-${unidadNorm}`;
                            if (!inventarioAcumuladoAnt[key]) {
                                inventarioAcumuladoAnt[key] = { nombre: item.producto.toString().trim(), cantidad: 0, unidad: unidadNorm };
                            }
                            inventarioAcumuladoAnt[key].cantidad += parseFloat(item.cantidad);
                        }
                    });
                }

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

        // NUEVO: Cálculo del Fondo de Comestibles
        let fondoRestante = FONDO_INICIAL - gastoAlimentacion;

        const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // --- PINTAR DATOS EN PANTALLA ---
        valTotal.textContent = formatoARS(totalGeneral + totalIndividual);
        if(valTotalMostri) valTotalMostri.textContent = formatoARS(gastoTotalMostri);
        if(valTotalMostrina) valTotalMostrina.textContent = formatoARS(gastoTotalMostrina);
        if(valAlimentacion) valAlimentacion.textContent = formatoARS(gastoAlimentacion);
        if(valFijos) valFijos.textContent = formatoARS(gastoFijos);
        valTarjeta.textContent = formatoARS(proyeccionTarjeta);

        // Lógica visual para el fondo de compras
        if (valFondo) {
            valFondo.textContent = formatoARS(fondoRestante);
            
            const contenedorFondo = document.querySelector('.monto-fondo');
            const labelFondo = document.querySelector('.monto-fondo .label');
            
            if (fondoRestante < 0) {
                // Si se pasaron de los 300 mil, se pone todo en alerta roja
                valFondo.style.color = "#c62828";
                labelFondo.textContent = "Fondo Comestibles (¡Se pasaron!)";
                labelFondo.style.color = "#d32f2f";
                contenedorFondo.style.backgroundColor = "#ffebee";
                contenedorFondo.style.border = "1px solid #ffcdd2";
            } else {
                // Estado normal azulado
                valFondo.style.color = "#01579b";
                labelFondo.textContent = "Fondo Comestibles";
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

        const renderInventario = (inventarioObj, uiElement) => {
            if (!uiElement) return; 
            uiElement.innerHTML = '';
            const items = Object.values(inventarioObj);

            if (items.length === 0) {
                uiElement.innerHTML = '<li style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">No hay productos registrados.</li>';
            } else {
                items.sort((a, b) => a.nombre.localeCompare(b.nombre));
                items.forEach(item => {
                    const li = document.createElement('li');
                    li.style.cssText = "display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 0.95rem; text-transform: capitalize;";
                    li.innerHTML = `<span>${item.nombre}</span><span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">${item.cantidad} ${item.unidad}</span>`;
                    uiElement.appendChild(li);
                });
            }
        };

        renderInventario(inventarioAcumulado, listaInventarioUI);
        renderInventario(inventarioAcumuladoAnt, listaInventarioAntUI);

    } catch (error) {
        console.error("Error: ", error);
        valDeuda.textContent = "Error";
    }
});