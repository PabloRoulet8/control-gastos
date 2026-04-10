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
    const valGenerales = document.querySelectorAll('.split-item .valor')[0];
    const valIndividuales = document.querySelectorAll('.split-item .valor')[1];
    const valTarjeta = document.querySelector('.monto-tarjeta .valor');
    const valDeuda = document.querySelector('.valor-deuda');
    const txtDeuda = document.querySelector('.deuda-principal p');
    const desgloseDeuda = document.querySelector('.desglose-deuda');
    const listaInventarioUI = document.getElementById('lista-inventario-mensual');

    // Elementos del mes anterior
    const contenedorDeudaAnt = document.getElementById('contenedor-deuda-anterior');
    const txtDeudaAnt = document.getElementById('txt-deuda-anterior');
    const valDeudaAnt = document.getElementById('val-deuda-anterior');

    // Variables Mes Actual
    let totalGeneral = 0, totalIndividual = 0, proyeccionTarjeta = 0;
    let pabloPagoEfectivoGeneral = 0, pabloIndividualEnTarjeta = 0;
    let inventarioAcumulado = {};

    // Variables Mes Anterior
    let totalGeneralAnt = 0;
    let pabloPagoEfectivoGeneralAnt = 0, pabloIndividualEnTarjetaAnt = 0;

    // Calcular strings de fechas (ej: "2026-04" y "2026-03")
    const fechaHoy = new Date();
    const mesActual = fechaHoy.toISOString().slice(0, 7); 
    
    fechaHoy.setMonth(fechaHoy.getMonth() - 1); // Restamos un mes
    const mesAnterior = fechaHoy.toISOString().slice(0, 7);

    try {
        const querySnapshot = await getDocs(collection(db, "gastos"));
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // LÓGICA MES ACTUAL
            if (data.fecha.startsWith(mesActual)) {
                
                // INVENTARIO: Lo calculamos para TODOS los gastos de este mes
                if (data.detalle_inventario && Array.isArray(data.detalle_inventario)) {
                    data.detalle_inventario.forEach(item => {
                        // Verificamos que el item tenga nombre y cantidad para no romper el código
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

                // CÁLCULOS DE DINERO
                if (data.tipo === 'general') {
                    totalGeneral += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') { proyeccionTarjeta += data.monto; }
                    else if (data.responsable === 'pablo') { pabloPagoEfectivoGeneral += data.monto; }
                } else if (data.tipo === 'individual') {
                    totalIndividual += data.monto;
                    if (data.metodo_pago === 'tarjeta-credito') {
                        proyeccionTarjeta += data.monto;
                        if (data.responsable === 'pablo') { pabloIndividualEnTarjeta += data.monto; }
                    }
                }
            } 
            // LÓGICA MES ANTERIOR
            else if (data.fecha.startsWith(mesAnterior)) {
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

        // CÁLCULO MES ACTUAL
        let deudaGeneralPablo = (totalGeneral / 2) - pabloPagoEfectivoGeneral; 
        let deudaTotalPablo = deudaGeneralPablo + pabloIndividualEnTarjeta;

        // CÁLCULO MES ANTERIOR
        let deudaTotalPabloAnt = ((totalGeneralAnt / 2) - pabloPagoEfectivoGeneralAnt) + pabloIndividualEnTarjetaAnt;

        const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // Pintar datos del mes actual
        valTotal.textContent = formatoARS(totalGeneral + totalIndividual);
        valGenerales.textContent = formatoARS(totalGeneral);
        valIndividuales.textContent = formatoARS(totalIndividual);
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

        // MOSTRAR DEUDA ANTERIOR (Solo si es mayor a cero, redondeando centavos)
        if (Math.abs(deudaTotalPabloAnt) > 1) {
            contenedorDeudaAnt.style.display = 'block';
            if (deudaTotalPabloAnt > 0) {
                txtDeudaAnt.textContent = "Pablo le debía a Yanet:";
                valDeudaAnt.textContent = formatoARS(deudaTotalPabloAnt);
            } else {
                txtDeudaAnt.textContent = "Yanet le debía a Pablo:";
                valDeudaAnt.textContent = formatoARS(Math.abs(deudaTotalPabloAnt));
                valDeudaAnt.style.color = "#1b5e20"; // Verde si era a favor tuyo
            }
        }

        // PINTAR EL INVENTARIO EN LA PANTALLA
        listaInventarioUI.innerHTML = '';
        const itemsInventario = Object.values(inventarioAcumulado);

        if (itemsInventario.length === 0) {
            listaInventarioUI.innerHTML = '<li style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">No hay productos registrados este mes.</li>';
        } else {
            // Ordenar alfabéticamente
            itemsInventario.sort((a, b) => a.nombre.localeCompare(b.nombre));

            itemsInventario.forEach(item => {
                const li = document.createElement('li');
                li.style.cssText = "display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 0.95rem; text-transform: capitalize;";
                li.innerHTML = `
                    <span>${item.nombre}</span>
                    <span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                        ${item.cantidad} ${item.unidad}
                    </span>
                `;
                listaInventarioUI.appendChild(li);
            });
        }

    } catch (error) {
        console.error("Error: ", error);
        valDeuda.textContent = "Error";
    }
});