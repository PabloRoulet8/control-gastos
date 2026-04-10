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
    // Selectores del Balance
    const valTotal = document.querySelector('.monto-total .valor');
    const valTotalPablo = document.querySelector('.pablo-total');
    const valTotalYanet = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    
    // Selectores de Deuda y Tarjeta
    const valTarjeta = document.querySelector('.monto-tarjeta .valor');
    const valDeuda = document.querySelector('.valor-deuda');
    const txtDeuda = document.querySelector('.deuda-principal p');
    const desgloseDeuda = document.querySelector('.desglose-deuda');
    
    // Selectores del Inventario
    const listaInventarioUI = document.getElementById('lista-inventario-mensual');
    const listaInventarioAntUI = document.getElementById('lista-inventario-anterior');
    const btnToggleInvAnt = document.getElementById('btn-toggle-inventario-ant');
    const contenedorInvAnt = document.getElementById('contenedor-inventario-ant');

    // Elementos del mes anterior (Deudas)
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

    // Variables Mes Actual
    let totalGeneral = 0, totalIndividual = 0, proyeccionTarjeta = 0;
    let pabloPagoEfectivoGeneral = 0, pabloIndividualEnTarjeta = 0;
    let inventarioAcumulado = {};
    
    // NUEVAS Variables para los cálculos nuevos
    let totalIndividualPablo = 0;
    let totalIndividualYanet = 0;
    let gastoAlimentacion = 0;
    let gastoFijos = 0;

    // Variables Mes Anterior
    let totalGeneralAnt = 0;
    let pabloPagoEfectivoGeneralAnt = 0, pabloIndividualEnTarjetaAnt = 0;
    let inventarioAcumuladoAnt = {}; 

    // Calcular strings de fechas
    const fechaHoy = new Date();
    const mesActual = fechaHoy.toISOString().slice(0, 7); 
    fechaHoy.setMonth(fechaHoy.getMonth() - 1); 
    const mesAnterior = fechaHoy.toISOString().slice(0, 7);

    try {
        const querySnapshot = await getDocs(collection(db, "gastos"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // LÓGICA MES ACTUAL
            if (data.fecha.startsWith(mesActual)) {
                
                // INVENTARIO ACTUAL
                if (data.detalle_inventario && Array.isArray(data.detalle_inventario)) {
                    data.detalle_inventario.forEach(item => {
                        if (item.producto && item.cantidad !== undefined) {
                            const nombreNorm = item.producto.toString().trim().toLowerCase();
                            const unidadNorm = (item.unidad || 'unid').trim();
                            const key = `${nombreNorm}-${unidadNorm}`;

                            if (!inventarioAcumulado[key]) {
                                inventarioAcumulado[key] = {
                                    nombre: item.producto.toString().trim(),
                                    cantidad: 0,
                                    unidad: unidadNorm
                                };
                            }
                            inventarioAcumulado[key].cantidad += parseFloat(item.cantidad);
                        }
                    });
                }

                // CÁLCULOS DE DINERO ACTUAL
                if (data.tipo === 'general') {
                    totalGeneral += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') { proyeccionTarjeta += data.monto; }
                    else if (data.responsable === 'pablo') { pabloPagoEfectivoGeneral += data.monto; }
                } else if (data.tipo === 'individual') {
                    totalIndividual += data.monto;
                    
                    // Separamos los gastos individuales para el nuevo cálculo
                    if (data.responsable === 'pablo') {
                        totalIndividualPablo += data.monto;
                    } else if (data.responsable === 'yanet') {
                        totalIndividualYanet += data.monto;
                    }

                    if (data.metodo_pago === 'tarjeta-credito') {
                        proyeccionTarjeta += data.monto;
                        if (data.responsable === 'pablo') { pabloIndividualEnTarjeta += data.monto; }
                    }
                }

                // NUEVO: CÁLCULO POR CATEGORÍAS (Alimentación y Fijos)
                if (data.categoria) {
                    // Normalizamos quitando acentos y mayúsculas
                    const catNormalizada = data.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const catsAlimentacion = ['supermercado', 'carniceria', 'verduleria'];
                    const catsFijos = ['alquiler', 'expensas', 'gas', 'epe', 'wifi', 'agua', 'tgi'];

                    if (catsAlimentacion.includes(catNormalizada)) {
                        gastoAlimentacion += data.monto;
                    } else if (catsFijos.includes(catNormalizada)) {
                        gastoFijos += data.monto;
                    }
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
                                inventarioAcumuladoAnt[key] = {
                                    nombre: item.producto.toString().trim(),
                                    cantidad: 0,
                                    unidad: unidadNorm
                                };
                            }
                            inventarioAcumuladoAnt[key].cantidad += parseFloat(item.cantidad);
                        }
                    });
                }

                if (data.tipo === 'general') {
                    totalGeneralAnt += data.monto;
                    if (data.metodo_pago !== 'tarjeta-credito' && data.responsable === 'pablo') { 
                        pabloPagoEfectivoGeneralAnt += data.monto; 
                    }
                } else if (data.tipo === 'individual') {
                    if (data.metodo_pago === 'tarjeta-credito' && data.responsable === 'pablo') { 
                        pabloIndividualEnTarjetaAnt += data.monto; 
                    }
                }
            }
        });

        // --- CALCULO DE DEUDAS Y TOTALES --- //
        let deudaGeneralPablo = (totalGeneral / 2) - pabloPagoEfectivoGeneral; 
        let deudaTotalPablo = deudaGeneralPablo + pabloIndividualEnTarjeta;
        let deudaTotalPabloAnt = ((totalGeneralAnt / 2) - pabloPagoEfectivoGeneralAnt) + pabloIndividualEnTarjetaAnt;

        // NUEVO: Gastos Reales por Persona (Mitad de Generales + Individuales Propios)
        let gastoTotalPablo = (totalGeneral / 2) + totalIndividualPablo;
        let gastoTotalYanet = (totalGeneral / 2) + totalIndividualYanet;

        const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // --- PINTAR DATOS EN PANTALLA --- //
        valTotal.textContent = formatoARS(totalGeneral + totalIndividual);
        if(valTotalPablo) valTotalPablo.textContent = formatoARS(gastoTotalPablo);
        if(valTotalYanet) valTotalYanet.textContent = formatoARS(gastoTotalYanet);
        if(valAlimentacion) valAlimentacion.textContent = formatoARS(gastoAlimentacion);
        if(valFijos) valFijos.textContent = formatoARS(gastoFijos);
        valTarjeta.textContent = formatoARS(proyeccionTarjeta);

        if (deudaTotalPablo > 0) {
            txtDeuda.textContent = "Pablo transfiere a Yanet:";
            valDeuda.textContent = formatoARS(deudaTotalPablo);
            desgloseDeuda.innerHTML = `
                <li>Por mitad de generales pendientes: <span>${formatoARS(deudaGeneralPablo)}</span></li>
                <li>Por consumos en su tarjeta: <span>${formatoARS(pabloIndividualEnTarjeta)}</span></li>
            `;
        } else if (deudaTotalPablo < 0) {
            txtDeuda.textContent = "Yanet transfiere a Pablo:";
            valDeuda.textContent = formatoARS(Math.abs(deudaTotalPablo));
            desgloseDeuda.innerHTML = `<li>Ajuste a favor de Pablo por generales.</li>`;
        } else {
            txtDeuda.textContent = "¡Cuentas al día!";
            valDeuda.textContent = "$ 0";
            desgloseDeuda.innerHTML = `<li>Nadie debe nada este mes.</li>`;
        }

        if (Math.abs(deudaTotalPabloAnt) > 1) {
            contenedorDeudaAnt.style.display = 'block';
            if (deudaTotalPabloAnt > 0) {
                txtDeudaAnt.textContent = "Pablo le debía a Yanet:";
                valDeudaAnt.textContent = formatoARS(deudaTotalPabloAnt);
            } else {
                txtDeudaAnt.textContent = "Yanet le debía a Pablo:";
                valDeudaAnt.textContent = formatoARS(Math.abs(deudaTotalPabloAnt));
                valDeudaAnt.style.color = "#1b5e20"; 
            }
        }

        // --- PINTAR INVENTARIOS --- //
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
                    li.innerHTML = `
                        <span>${item.nombre}</span>
                        <span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                            ${item.cantidad} ${item.unidad}
                        </span>
                    `;
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