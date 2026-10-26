import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ResumenRenderer } from "./ui/ResumenRenderer.js";
import { ChartManager } from "./ui/ChartManager.js";
import { ToastManager } from "./ui/ToastManager.js";
import { PerfilPublicoService } from "./services/PerfilPublicoService.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
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

    // --- LÓGICA DE INGRESOS (BOTÓN Y MODAL) ---
    const btnIngresos = document.getElementById('btn-header-ingresos');
    const modalIngreso = document.getElementById('modal-ingreso');
    const inputConceptoIngreso = document.getElementById('input-concepto-ingreso');
    const inputMontoIngreso = document.getElementById('input-monto-ingreso');
    const btnCerrarModalIngreso = document.getElementById('btn-cerrar-modal-ingreso');
    const btnGuardarIngreso = document.getElementById('btn-guardar-ingreso');

    const cerrarModalIngresoFn = () => {
        const content = modalIngreso.querySelector('.modal-content');
        if (content) content.classList.remove('active'); 
        setTimeout(() => {
            modalIngreso.style.display = 'none';
            inputConceptoIngreso.value = '';
            inputMontoIngreso.value = '';
        }, 300); 
    };

    if (btnIngresos) {
        btnIngresos.addEventListener('click', (e) => {
            e.preventDefault();
            modalIngreso.style.display = 'flex';
            setTimeout(() => {
                const content = modalIngreso.querySelector('.modal-content');
                if (content) content.classList.add('active'); 
            }, 10);
        });
    }

    if (btnCerrarModalIngreso) {
        btnCerrarModalIngreso.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarModalIngresoFn();
        });
    }

    if (modalIngreso) {
        modalIngreso.addEventListener('click', (e) => {
            if (e.target === modalIngreso) {
                cerrarModalIngresoFn();
            }
        });
    }

    if (btnGuardarIngreso) {
        btnGuardarIngreso.addEventListener('click', async () => {
            const concepto = AppUtils.escapeHTML(inputConceptoIngreso.value.trim());
            const monto = inputMontoIngreso.value.trim();
            const toast = new ToastManager();

            if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
                toast.mostrar('El monto debe ser un número mayor a 0');
                return;
            }

            btnGuardarIngreso.disabled = true;
            btnGuardarIngreso.textContent = 'Guardando...';

            const nuevoIngreso = {
                fecha: AppUtils.getFechaLocal(),
                monto: AppUtils.redondearMonto(parseFloat(monto)),
                categoria: "Ingreso",
                referencia: concepto,
                tipo: 'ingreso',
                responsable: auth.currentUser?.uid || ""
            };

            try {
                await api.guardarGasto(nuevoIngreso, { tipo: 'personal' });
                toast.mostrar('¡Ingreso guardado exitosamente! 💸');
                cerrarModalIngresoFn(); 
                await procesarPantalla(auth.currentUser.uid);
            } catch (error) {
                toast.mostrar('Error al guardar el ingreso');
                console.error(error);
            } finally {
                btnGuardarIngreso.disabled = false;
                btnGuardarIngreso.textContent = 'Guardar';
            }
        });
    }

    document.getElementById('btn-stock')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const content = btn.nextElementSibling;
        if(content) content.style.display = content.style.display === "block" ? "none" : "block";
    });

    const obtenerRangoResumen = (hoy = new Date()) => {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 35, 1);
        return {
            fechaInicio: AppUtils.getFechaLocal(inicio),
            fechaFin: '9999-12-31',
            orden: 'asc'
        };
    };

    const calcularKPIsAnuales = (gastos, year) => {
        const prefix = year.toString();
        const mesActualNum = new Date().getMonth() + 1; 

        const gastosAnio = gastos.filter(g => {
            const isIngreso = g.tipo === 'ingreso' || g.categoria === 'Ingreso';
            const isPagoDeuda = g.tipo === 'pagoDeuda' || g.categoria === 'Pago de Deuda';
            return g.fecha && g.fecha.startsWith(prefix) && !isIngreso && !isPagoDeuda;
        });
        
        const sumasPorMes = {};
        gastosAnio.forEach(g => {
            const mesGastoNum = parseInt(g.fecha.substring(5, 7), 10);
            if (mesGastoNum <= mesActualNum) {
                const mesKey = g.fecha.substring(0, 7); 
                const montoCentavos = AppUtils.aCentavos(g.monto);
                if (montoCentavos > 0) sumasPorMes[mesKey] = (sumasPorMes[mesKey] || 0) + montoCentavos;
            }
        });
        
        const totalesMensuales = Object.values(sumasPorMes).filter(m => m > 0);
        if (totalesMensuales.length === 0) return { minimo: 0, promedio: 0, maximo: 0 };
        
        const minimo = Math.min(...totalesMensuales);
        const maximo = Math.max(...totalesMensuales);
        const sumaTotal = totalesMensuales.reduce((a,b) => a + b, 0);
        const promedio = Math.round(sumaTotal / totalesMensuales.length);
        
        return {
            minimo: AppUtils.aPesos(minimo),
            promedio: AppUtils.aPesos(promedio),
            maximo: AppUtils.aPesos(maximo)
        };
    };

    const calcularMontosTarjetas = (todosLosGastos, gastosMes, mesActual) => {
        const gastosTarjetaMes = gastosMes.filter(g => {
            if (!g.metodo_pago) return false;
            const metodo = g.metodo_pago.toLowerCase();
            return metodo.includes('tarjeta') || metodo.includes('credito');
        });
        const montoTarjetasMes = AppUtils.sumarMontos(gastosTarjetaMes.map(g => g.monto));

        const [year, month] = mesActual.split('-').map(Number);
        const inicioMesActual = new Date(year, month - 1, 1).toISOString().split('T')[0];

        const gastosTarjetaTotal = todosLosGastos.filter(g => {
            if (!g.metodo_pago || !g.fecha) return false;
            const metodo = g.metodo_pago.toLowerCase();
            const esTarjeta = metodo.includes('tarjeta') || metodo.includes('credito');
            const fechaMayorOIgual = g.fecha >= inicioMesActual;
            return esTarjeta && fechaMayorOIgual;
        });
        const montoTarjetasTotal = AppUtils.sumarMontos(gastosTarjetaTotal.map(g => g.monto));

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
            const rangoResumen = obtenerRangoResumen(hoy);
            
            const userData = await api.obtenerUsuario(userId) || {};
            
            const categoriasPersonales = (userData.categorias_personales || [])
                .map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c)
                .filter(c => c && c.nombre);

            let todosLosGastos = [];
            let kpisTotales = null;
            let mapaNombres = {};
            let totalIngresosMesGlobal = 0; 

            const btnIngresosTexto = document.getElementById('btn-header-ingresos');
            if (btnIngresosTexto) {
                if (ambitoActual === 'unificado') btnIngresosTexto.style.display = 'block';
                else btnIngresosTexto.style.display = 'none';
            }

            if (ambitoActual === 'personal') {
                if (tituloHeader) tituloHeader.textContent = "Mis Gastos Personales";
                const todos = await api.obtenerGastosPorRango({ tipo: 'personal' }, rangoResumen) || [];
                
                todosLosGastos = todos.filter(g => g.tipo !== 'ingreso');
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                const gastosMesAnt = todosLosGastos.filter(g => g.fecha?.startsWith(mesAnterior)); 
                
                renderer.renderizarPersonal(resumenService.calcularPersonal(gastosMes, categoriasPersonales), userData.fondos || [], gastosMes, kpisTotales, 0);
                renderer.mostrarComunes(gastosMes, categoriasPersonales, true, gastosMesAnt); 

            } else if (ambitoActual === 'hogar' && hogarId) {
                const dataHogar = await api.obtenerHogar(hogarId) || {};
                if (tituloHeader) tituloHeader.textContent = dataHogar.nombre;
                
                const cacheUsuariosHogar = {};
                for (const uid of dataHogar.miembros || []) {
                    if (!cacheUsuariosHogar[uid]) {
                        const perfil = await PerfilPublicoService.obtener(uid);
                        cacheUsuariosHogar[uid] = perfil?.nombre || "Usuario";
                    }
                    mapaNombres[uid] = cacheUsuariosHogar[uid];
                }
                
                todosLosGastos = (await api.obtenerGastosPorRango(hogarId, rangoResumen) || []).filter(g => g.tipo === 'general' || !g.tipo || g.tipo === 'pagoDeuda');
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                const gastosMesAnt = todosLosGastos.filter(g => g.fecha?.startsWith(mesAnterior)); 
                
                // LE PASAMOS LOS PRESUPUESTOS AL SERVICIO
                renderer.renderizarHogar(resumenService.calcularHogar(gastosMes, mapaNombres, dataHogar.presupuestos_compartidos || []), dataHogar.nombre, kpisTotales, dataHogar.presupuestos_compartidos || [], gastosMes, userId, dataHogar.categorias_compartidas || []);
                renderer.mostrarComunes(gastosMes, dataHogar.categorias_compartidas || [], true, gastosMesAnt); 

            } else if (ambitoActual === 'unificado') {
                if (tituloHeader) tituloHeader.textContent = "Resumen Unificado";
                const todosP = await api.obtenerGastosPorRango('personal', rangoResumen) || [];
                
                const gastosPersonalesReales = todosP.filter(g => g.tipo !== 'ingreso');
                const ingresosPersonales = todosP.filter(g => g.tipo === 'ingreso');
                totalIngresosMesGlobal = AppUtils.sumarMontos(
                    ingresosPersonales.filter(g => g.fecha?.startsWith(mesActual)).map(g => g.monto)
                );

                const hogares = await api.obtenerMisHogares(userId);
                
                let miParteHogarTotal = 0, todosHogaresParaGraficos = [], gastosHogarMesListas = [];
                const cacheUsuarios = {};
                
                for (const hData of hogares) {
                    const nHogar = {};
                    for (const uid of hData.miembros || []) {
                        if (!cacheUsuarios[uid]) {
                            const perfil = await PerfilPublicoService.obtener(uid);
                            cacheUsuarios[uid] = perfil?.nombre || "Usuario";
                        }
                        nHogar[uid] = cacheUsuarios[uid];
                    }
                    const gH = await api.obtenerGastosPorRango(hData.id, rangoResumen) || [];
                    const gH_Generales = gH.filter(g => g.tipo === 'general' || !g.tipo);
                    
                    // LE PASAMOS LOS PRESUPUESTOS AL SERVICIO EN UNIFICADO TAMBIÉN
                    const hogarInfo = resumenService.calcularHogar(gH_Generales.filter(g => g.fecha?.startsWith(mesActual)), nHogar, hData.presupuestos_compartidos || []);
                    const cuota = hogarInfo.cuotasMiembro[userId] ?? hogarInfo.cuotaPorPersona;
                    miParteHogarTotal = AppUtils.sumarMontos(miParteHogarTotal, cuota);
                    
                    const cantidadMiembros = hData.miembros?.length || 1;
                    todosHogaresParaGraficos.push(...gH_Generales.map(g => {
                        const montoCentavos = Math.round(AppUtils.aCentavos(g.monto) / cantidadMiembros);
                        return { ...g, monto: AppUtils.aPesos(montoCentavos) };
                    }));
                    gastosHogarMesListas.push(...gH.filter(g => g.fecha?.startsWith(mesActual)));
                }

                const gastosPersonalesMes = gastosPersonalesReales.filter(g => g.fecha?.startsWith(mesActual));
                const personalMes = resumenService.calcularPersonal(gastosPersonalesMes, []).total;

                todosLosGastos = [...gastosPersonalesReales, ...todosHogaresParaGraficos];
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                renderer.renderizarUnificado({ 
                    totalBolsillo: AppUtils.sumarMontos(personalMes, miParteHogarTotal),
                    desglosePersonal: personalMes,
                    desgloseHogar: miParteHogarTotal
                }, kpisTotales, totalIngresosMesGlobal); 
                
                renderer.mostrarComunes([...gastosPersonalesReales.filter(g => g.fecha?.startsWith(mesActual)), ...gastosHogarMesListas], [], false, []);

                if (btnIngresosTexto && totalIngresosMesGlobal > 0) {
                    btnIngresosTexto.innerHTML = 'Sumar<br>Ingresos';
                    btnIngresosTexto.style.lineHeight = '1.1';
                    btnIngresosTexto.style.marginTop = '4px';
                } else if (btnIngresosTexto) {
                    btnIngresosTexto.textContent = 'Ingresos';
                    btnIngresosTexto.style.marginTop = '0';
                }
            }

            chartManager.inicializar(todosLosGastos, mesActual, mesAnterior);

            const gastosMesGlobal = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
            const montosTarjetas = calcularMontosTarjetas(todosLosGastos, gastosMesGlobal, mesActual);
            const elMes = document.getElementById('monto-tarjetas-mes');
            const elTotal = document.getElementById('monto-tarjetas-total');
            if (elMes) elMes.innerHTML = `<strong>${AppUtils.formatearARS(montosTarjetas.montoTarjetasMes)}</strong>`;
            if (elTotal) elTotal.innerHTML = `<strong>${AppUtils.formatearARS(montosTarjetas.montoTarjetasTotal)}</strong>`;
            
        } catch (error) {
            console.error(error); 
            if(contenedorDinamico) contenedorDinamico.innerHTML = `<p class="text-center p-20" style="color:#ef4444;">Error cargando datos.</p>`;
        }
    }

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