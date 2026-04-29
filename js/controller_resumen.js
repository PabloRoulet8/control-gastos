import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ResumenRenderer } from "./ui/ResumenRenderer.js";
import { ChartManager } from "./ui/ChartManager.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { AppUtils } from "./utils/AppUtils.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const resumenService = new ResumenService();
    const renderer = new ResumenRenderer();
    const chartManager = new ChartManager(resumenService);
    
    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = NavigationBuilder.normalizeAmbito(urlParams.get('ambito'));

    const hogarId = urlParams.get('id');

    const tituloHeader = document.getElementById('titulo-header');
    NavigationBuilder.buildConfigButton(ambitoActual, hogarId);
    
    const contenedorDinamico = document.getElementById('contenedor-resumen-dinamico');

    NavigationBuilder.buildNav(ambitoActual, hogarId, 'resumen');

    document.getElementById('btn-stock')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if(content) content.style.display = content.style.display === "block" ? "none" : "block";
    });

    // =============================================
    // LÓGICA DE KPIs (MÍNIMO, PROMEDIO, MÁXIMO ANUAL)
    // =============================================
    const calcularKPIsAnuales = (gastos, year) => {
        const prefix = year.toString();
        
        // Obtenemos el número del mes actual (ej: 4 para Abril)
        const mesActualNum = new Date().getMonth() + 1; 

        // Filtramos solo los gastos del año actual
        const gastosAnio = gastos.filter(g => g.fecha && g.fecha.startsWith(prefix));
        
        // Armamos las "bolsitas" por mes, IGNORANDO los meses futuros
        const sumasPorMes = {};
        gastosAnio.forEach(g => {
            // Extraemos el mes del gasto (ej: de "2026-05-29" saca "05" y lo convierte a 5)
            const mesGastoNum = parseInt(g.fecha.substring(5, 7), 10);
            
            // REGLA CLAVE: Si el gasto es de un mes futuro (ej: cuotas de tarjeta), NO cuenta para la estadística
            if (mesGastoNum <= mesActualNum) {
                const mesKey = g.fecha.substring(0, 7); // Formato: YYYY-MM
                const monto = Number(g.monto) || 0;
                if (monto > 0) {
                    sumasPorMes[mesKey] = (sumasPorMes[mesKey] || 0) + monto;
                }
            }
        });
        
        const totalesMensuales = Object.values(sumasPorMes).filter(m => m > 0);
        
        if (totalesMensuales.length === 0) {
            return { minimo: 0, promedio: 0, maximo: 0 };
        }
        
        const minimo = Math.min(...totalesMensuales);
        const maximo = Math.max(...totalesMensuales);
        const sumaTotal = totalesMensuales.reduce((a,b) => a + b, 0);
        const promedio = sumaTotal / totalesMensuales.length;
        
        return { minimo, promedio, maximo };
    };

    // =============================================
    // LÓGICA DE TARJETAS DE CRÉDITO
    // =============================================
    const calcularMontosTarjetas = (todosLosGastos, gastosMes, mesActual) => {
        // A) montoTarjetasMes: Gastos del mes actual con método tarjeta/crédito
        const gastosTarjetaMes = gastosMes.filter(g => {
            if (!g.metodo_pago) return false;
            const metodo = g.metodo_pago.toLowerCase();
            return metodo.includes('tarjeta') || metodo.includes('credito');
        });
        const montoTarjetasMes = gastosTarjetaMes.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

        // B) montoTarjetasTotal: TODOS los gastos de tarjeta desde el inicio del mes actual (deuda proyectada)
        const [year, month] = mesActual.split('-').map(Number);
        const inicioMesActual = new Date(year, month - 1, 1).toISOString().split('T')[0];

        const gastosTarjetaTotal = todosLosGastos.filter(g => {
            if (!g.metodo_pago || !g.fecha) return false;
            const metodo = g.metodo_pago.toLowerCase();
            const esTarjeta = metodo.includes('tarjeta') || metodo.includes('credito');
            const fechaMayorOIgual = g.fecha >= inicioMesActual;
            return esTarjeta && fechaMayorOIgual;
        });
        const montoTarjetasTotal = gastosTarjetaTotal.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

        return { montoTarjetasMes, montoTarjetasTotal };
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) await procesarPantalla(user.uid);
    });

    async function procesarPantalla(userId) {
        try {
            const hoy = new Date();
            const anioActual = hoy.getFullYear();
            const mesActual = `${anioActual}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
            const mesAnterior = new Date(anioActual, hoy.getMonth() - 1, 1).toISOString().substring(0, 7);
            
            const snapUser = await getDoc(doc(db, "usuarios", userId));
            const userData = snapUser.exists() ? snapUser.data() : {};
            
            const categoriasPersonales = (userData.categorias_personales || [])
                .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                .filter(c => c && c.nombre);

            let todosLosGastos = [];
            let kpisTotales = null;
            let mapaNombres = {};

            if (ambitoActual === 'personal') {
                if (tituloHeader) tituloHeader.textContent = "Mis Gastos Personales";
                todosLosGastos = await api.obtenerGastos({ tipo: 'personal' }) || [];                
                
                // Calculamos KPIs con la nueva regla anual
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                
                renderer.renderizarPersonal(resumenService.calcularPersonal(gastosMes, categoriasPersonales), userData.fondos || [], gastosMes, kpisTotales);
                renderer.mostrarComunes(gastosMes, categoriasPersonales, true);

            } else if (ambitoActual === 'hogar' && hogarId) {
                const snapHogar = await getDoc(doc(db, "hogares", hogarId));
                const dataHogar = snapHogar.exists() ? snapHogar.data() : {};
                const hogarNombre = dataHogar.nombre;
                if (tituloHeader) tituloHeader.textContent = hogarNombre;
                
                // Caché para miembros del hogar individual
                const cacheUsuariosHogar = {};
                for (const uid of dataHogar.miembros || []) {
                    if (!cacheUsuariosHogar[uid]) {
                        const u = await getDoc(doc(db, "usuarios", uid));
                        if (u.exists()) cacheUsuariosHogar[uid] = u.data().nombre;
                    }
                    mapaNombres[uid] = cacheUsuariosHogar[uid];
                }
                
                todosLosGastos = (await api.obtenerGastos(hogarId) || []).filter(g => g.tipo === 'general' || !g.tipo || g.tipo === 'pagoDeuda');                
                
                // Calculamos KPIs con la nueva regla anual
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                
                renderer.renderizarHogar(resumenService.calcularHogar(gastosMes, mapaNombres), dataHogar.nombre, kpisTotales, dataHogar.presupuestos_compartidos || [], gastosMes, userId, dataHogar.categorias_compartidas || []);
                renderer.mostrarComunes(gastosMes, dataHogar.categorias_compartidas || [], true);

            } else if (ambitoActual === 'unificado') {
                if (tituloHeader) tituloHeader.textContent = "Resumen Unificado";
                const todosP = await api.obtenerGastos('personal') || [];
                const q = query(collection(db, "hogares"), where("miembros", "array-contains", userId));
                const hogaresSnap = await getDocs(q);
                
                let miParteHogarTotal = 0, todosHogaresParaGraficos = [], gastosHogarMesListas = [];

                // Caché local para evitar lecturas repetitivas de usuarios
                const cacheUsuarios = {};
                
                for (const hDoc of hogaresSnap.docs) {
                    const hData = hDoc.data();
                    const nHogar = {};
                    for (const uid of hData.miembros || []) {
                        if (!cacheUsuarios[uid]) {
                            const u = await getDoc(doc(db, "usuarios", uid));
                            if (u.exists()) cacheUsuarios[uid] = u.data().nombre;
                        }
                        nHogar[uid] = cacheUsuarios[uid];
                    }
                    const gH = await api.obtenerGastos(hDoc.id) || [];
                    const gH_Generales = gH.filter(g => g.tipo === 'general' || !g.tipo);
                    const cuota = resumenService.calcularHogar(gH_Generales.filter(g => g.fecha?.startsWith(mesActual)), nHogar).cuotaPorPersona;
                    miParteHogarTotal += cuota;
                    
                    todosHogaresParaGraficos.push(...gH_Generales.map(g => ({ ...g, monto: Number(g.monto) / (hData.miembros?.length || 1) })));
                    gastosHogarMesListas.push(...gH.filter(g => g.fecha?.startsWith(mesActual)));
                }

                todosLosGastos = [...todosP, ...todosHogaresParaGraficos];
                
                // Calculamos KPIs con la nueva regla anual
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                renderer.renderizarUnificado({ 
                    totalBolsillo: resumenService.calcularPersonal(todosP.filter(g => g.fecha?.startsWith(mesActual)), []).total + miParteHogarTotal,
                    desglosePersonal: resumenService.calcularPersonal(todosP.filter(g => g.fecha?.startsWith(mesActual)), []).total,
                    desgloseHogar: miParteHogarTotal
                }, kpisTotales);
                renderer.mostrarComunes([...todosP.filter(g => g.fecha?.startsWith(mesActual)), ...gastosHogarMesListas], [], false);
            }

            chartManager.inicializar(todosLosGastos, mesActual, mesAnterior);

            // CORRECCIÓN "VARIABLE FANTASMA": Creamos gastosMesGlobal fuera del if para usarlo en las tarjetas
            const gastosMesGlobal = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));

            // Inyectar valores de Tarjetas de Crédito
            const montosTarjetas = calcularMontosTarjetas(todosLosGastos, gastosMesGlobal, mesActual);
            const elMes = document.getElementById('monto-tarjetas-mes');
            const elTotal = document.getElementById('monto-tarjetas-total');
            if (elMes) elMes.innerHTML = `<strong>$ ${montosTarjetas.montoTarjetasMes.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>`;
            if (elTotal) elTotal.innerHTML = `<strong>$ ${montosTarjetas.montoTarjetasTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>`;
            
        } catch (error) {
            console.error(error); 
            if(contenedorDinamico) contenedorDinamico.innerHTML = `<p class="text-center p-20" style="color:#ef4444;">Error cargando datos.</p>`;
        }
    }

    // ===============================================
    // LÓGICA DE PAGOS DE DEUDA EN EL HOGAR (ESCUDO DE CRISTAL)
    // ===============================================
    const toastGlobal = new ToastManager(); 
    const modalPago = document.getElementById('modal-pago-deuda');
    const btnConfirmar = document.getElementById('btn-confirmar-pago');
    const btnCerrar = document.getElementById('btn-cerrar-modal-pago');
    let clickAbiertoTiempo = 0;
    let modalEstaAbierto = false;

    contenedorDinamico.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-abrir-modal-pago');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            
            const deId = btn.dataset.deId;
            const paraId = btn.dataset.paraId;
            const nombre = btn.dataset.deNombre;
            
            document.getElementById('hidden-deudor-id').value = deId;
            document.getElementById('hidden-acreedor-id').value = paraId;
            document.getElementById('input-monto-pago').value = '';
            document.getElementById('texto-info-pago').textContent = `¿Cuánto transfirió ${nombre}?`;
            
            clickAbiertoTiempo = Date.now();
            modalEstaAbierto = true;
            
            const montoDeuda = btn.dataset.monto;
            document.getElementById('hidden-monto-deuda').value = montoDeuda;
            
            const montoFormateado = Number(montoDeuda).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('texto-info-pago').textContent = `¿Cuánto transfirió ${nombre}? (Total: $${montoFormateado})`;
            
            setTimeout(() => {
                if (modalPago && modalEstaAbierto) {
                    modalPago.style.display = 'flex';
                    const modalContent = modalPago.querySelector('.modal-content');
                    if (modalContent) modalContent.classList.add('active');
                    
                    modalPago.onclick = (e) => {
                        if (!e.target.closest('.modal-content')) {
                            e.stopPropagation();
                            return false;
                        }
                    };
                }
                
                if (btnConfirmar && modalEstaAbierto) {
                    btnConfirmar.disabled = true;
                    btnConfirmar.style.opacity = '0.5';
                    setTimeout(() => {
                        if (btnConfirmar && modalEstaAbierto) {
                            btnConfirmar.disabled = false;
                            btnConfirmar.style.opacity = '1';
                        }
                    }, 800);
                }
            }, 200);
        }
    });

    if (btnCerrar) {
        btnCerrar.onclick = (e) => {
            e.preventDefault();
            modalEstaAbierto = false;
            if (modalPago) {
                const modalContent = modalPago.querySelector('.modal-content');
                if (modalContent) modalContent.classList.remove('active');
                modalPago.style.display = 'none';
            }
        };
    }

    const btnMaxMonto = document.getElementById('btn-max-monto');
    if (btnMaxMonto) {
        btnMaxMonto.onclick = (e) => {
            e.preventDefault();
            const montoDeuda = document.getElementById('hidden-monto-deuda').value;
            const inputMonto = document.getElementById('input-monto-pago');
            if (montoDeuda && inputMonto) {
                const montoFormateado = Number(montoDeuda).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                inputMonto.value = montoDeuda;
                inputMonto.placeholder = montoFormateado;
            }
        };
    }

    if (btnConfirmar) {
        btnConfirmar.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!modalEstaAbierto) return;
            if (Date.now() - clickAbiertoTiempo < 800) return;

            const deId = document.getElementById('hidden-deudor-id').value;
            const paraId = document.getElementById('hidden-acreedor-id').value;
            const monto = parseFloat(document.getElementById('input-monto-pago').value);

            if (!monto || monto <= 0) return toastGlobal.mostrar("Ingresá un monto válido.");

            modalEstaAbierto = false;
            btnConfirmar.disabled = true;
            btnConfirmar.textContent = "Guardando...";

            try {
                await api.registrarPagoDeuda({ tipo: 'hogar', id: hogarId }, deId, paraId, monto);
                toastGlobal.mostrar("¡Pago registrado! 💸 Las cuentas se ajustaron.");
                if (modalPago) {
                    const modalContent = modalPago.querySelector('.modal-content');
                    if (modalContent) modalContent.classList.remove('active');
                    modalPago.style.display = 'none';
                }
                
                await procesarPantalla(auth.currentUser.uid);
            } catch (err) {
                console.error(err);
                toastGlobal.mostrar("Error al registrar el pago.");
            } finally {
                btnConfirmar.disabled = false;
                btnConfirmar.textContent = "Confirmar Pago";
            }
        };
    }
});