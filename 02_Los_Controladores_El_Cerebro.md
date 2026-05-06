### ARCHIVO js/controller_carga.js

import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { AppUtils } from "./utils/AppUtils.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const toast = new ToastManager();

    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = NavigationBuilder.normalizeAmbito(urlParams.get('ambito'));
    
    const hogarId = urlParams.get('id');
    const hogarNombre = urlParams.get('nombre');

    let arrayInventario = [];
    let listaCategorias = [];
    let currentUserIdGlobal = null;

    const selectCategoria = document.getElementById('categoria');
    const selectResponsable = document.getElementById('responsable');
    const tituloHeader = document.getElementById('titulo-header');
    const subtituloHeader = document.querySelector('.container h2');
    const grupoResponsable = document.getElementById('responsable-group');
    const inputMontoGlobal = document.getElementById('monto');
    const listaUI = document.getElementById('lista-inventario');
    const formGasto = document.getElementById('expense-form');
    
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');

    NavigationBuilder.buildConfigButton(ambitoActual, hogarId);
    NavigationBuilder.buildNav(ambitoActual, hogarId, 'carga');

    // 1. GESTIÓN DE BORRADOR Y NAVEGACIÓN
    const guardarBorradorStock = () => {
        localStorage.setItem('borrador_stock', JSON.stringify(arrayInventario));
    };

    const actualizarListaInventarioUI = () => {
        if(!listaUI) return;
        listaUI.innerHTML = '';
        let totalAcumulado = 0;
        arrayInventario.forEach((item, index) => {
            totalAcumulado += item.precio;
            const li = document.createElement('li');
            li.className = 'flex-between p-10 border-bottom-gray';
            li.innerHTML = `
                <span><strong>${item.producto}</strong> (${item.cantidad} ${item.unidad})</span>
                <div class="flex-center">
                    <strong style="margin-right:10px">$${item.precio.toLocaleString('es-AR')}</strong>
                    <button type="button" class="btn-icon-danger btn-delete-item" data-index="${index}"><i data-lucide="x"></i></button>
                </div>
            `;
            listaUI.appendChild(li);
        });

        listaUI.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.currentTarget.dataset.index;
                arrayInventario.splice(idx, 1);
                guardarBorradorStock();
                actualizarListaInventarioUI();
            };
        });

        if (arrayInventario.length > 0) {
            inputMontoGlobal.value = totalAcumulado.toFixed(2); 
            inputMontoGlobal.readOnly = true;
        } else {
            inputMontoGlobal.readOnly = false;
        }
    };

    // 2. INICIALIZACIÓN DE DATOS
    const inicializarPagina = async (userId) => {
        currentUserIdGlobal = userId;
        
        // Ocultar/Mostrar Responsable según el ámbito
        if (ambitoActual === 'personal') {
            if (grupoResponsable) grupoResponsable.style.display = 'none';
        }
        
        try {
            const userSnap = await getDoc(doc(db, "usuarios", userId));
            const userData = userSnap.exists() ? userSnap.data() : {};
            
            // Forzamos a que SIEMPRE lea tus categorías de Firebase primero
            let categoriasPropias = userData.categorias_personales || [];
            
            if (ambitoActual === 'personal') {
                listaCategorias = [...categoriasPropias];
                
                // Solo ponemos las de por defecto si REALMENTE está vacío en Firebase
                if (listaCategorias.length === 0) {
                    listaCategorias = [
                        { nombre: 'Supermercado', lleva_stock: false, es_fijo: false },
                        { nombre: 'Transporte', lleva_stock: false, es_fijo: false },
                        { nombre: 'Servicios', lleva_stock: false, es_fijo: true },
                        { nombre: 'Ocio', lleva_stock: false, es_fijo: false }
                    ];
                }
                if (tituloHeader) tituloHeader.textContent = "Gastos Personales";
                if (subtituloHeader) subtituloHeader.textContent = "¿Qué gasto vas a anotar?"; 
                llenarSelectCategorias(); // Llenamos de inmediato
            }

            if (ambitoActual === 'hogar' && hogarId) {
                const hogarSnap = await getDoc(doc(db, "hogares", hogarId));
                if (hogarSnap.exists()) {
                    const hogarData = hogarSnap.data();
                    
                    // Acá cargamos EXCLUSIVAMENTE las categorías compartidas del hogar
                    listaCategorias = hogarData.categorias_compartidas || [];
                    
                    const nombreHogar = hogarNombre || hogarData.nombre;
                    if (tituloHeader) tituloHeader.textContent = nombreHogar;
                    if (subtituloHeader) subtituloHeader.textContent = "¿Qué gasto de la casa vas a anotar?";
                    if (grupoResponsable) grupoResponsable.style.display = 'block';
                    
                    if (selectResponsable) {
                        selectResponsable.innerHTML = '';
                        for (const uid of hogarData.miembros || []) {
                            const uSnap = await getDoc(doc(db, "usuarios", uid));
                            let nombreMostrar = "Usuario";
                            if (uSnap.exists() && uSnap.data().nombre) {
                                nombreMostrar = uSnap.data().nombre;
                            }

                            const opt = document.createElement('option');
                            opt.value = uid; 
                            opt.textContent = nombreMostrar;
                            if (uid === userId) opt.selected = true;
                            selectResponsable.appendChild(opt);
                        }
                    }
                }
                llenarSelectCategorias(); // Llenamos con las del hogar
            }
            
            const guardado = localStorage.getItem('borrador_stock');
            if (guardado) {
                arrayInventario = JSON.parse(guardado);
                actualizarListaInventarioUI();
            }
        } catch (error) {
            console.error("Error cargando perfil:", error);
        }
    };

    const llenarSelectCategorias = () => {
        if (!selectCategoria) return;
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        listaCategorias.sort((a, b) => {
            const nameA = (typeof a === 'string' ? a : a.nombre).toLowerCase();
            const nameB = (typeof b === 'string' ? b : b.nombre).toLowerCase();
            return nameA.localeCompare(nameB);
        }).forEach(cat => {
            const c = typeof cat === 'string' ? { nombre: cat, lleva_stock: false, es_fijo: false } : cat;
            if (c.activa !== false) {
                const option = document.createElement('option');
                option.value = c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                option.textContent = c.nombre;
                option.dataset.llevaStock = c.lleva_stock;
                option.dataset.esFijo = c.es_fijo; 
                selectCategoria.appendChild(option);
            }
        });
    };

    // 3. EVENTOS DE INTERACCIÓN
    
    const selectMetodoPago = document.getElementById('metodo-pago');
    const contenedorOpcionCuotas = document.getElementById('contenedor-opcion-cuotas');
    const checkEsCuotas = document.getElementById('check-es-cuotas');
    const divCuotasConfig = document.getElementById('div-cuotas-config');
    const inputCantidadCuotas = document.getElementById('input-cantidad-cuotas');
    const checkPostCierre = document.getElementById('check-post-cierre');

    // Escuchar cuando cambian a Tarjeta de Crédito
    if (selectMetodoPago) {
        selectMetodoPago.addEventListener('change', () => {
            const esTarjeta = selectMetodoPago.value === 'tarjeta-credito';
            
            if (contenedorOpcionCuotas) {
                contenedorOpcionCuotas.style.display = esTarjeta ? 'block' : 'none';
            }
            
            // Si eligen Efectivo, reseteamos las cuotas y ocultamos todo
            if (!esTarjeta) {
                if (checkEsCuotas) checkEsCuotas.checked = false;
                if (divCuotasConfig) divCuotasConfig.style.display = 'none';
                if (inputCantidadCuotas) inputCantidadCuotas.value = '';
                if (checkPostCierre) checkPostCierre.checked = false;
            }
        });
    }

    // Toggle para mostrar/ocultar los inputs de cuotas
    if (checkEsCuotas && divCuotasConfig) {
        checkEsCuotas.addEventListener('change', () => {
            divCuotasConfig.style.display = checkEsCuotas.checked ? 'block' : 'none';
            // Si apagan el switch, vaciamos los campos
            if (!checkEsCuotas.checked) {
                if (inputCantidadCuotas) inputCantidadCuotas.value = '';
                if (checkPostCierre) checkPostCierre.checked = false;
            }
        });
    }

    selectCategoria?.addEventListener('change', () => {
        const option = selectCategoria.options[selectCategoria.selectedIndex];
        
        const llevaStock = option.dataset.llevaStock === "true";
        const esFijo = option.dataset.esFijo === "true";

        const seccionStock = document.getElementById('seccion-inventario');
        if (seccionStock) seccionStock.style.display = llevaStock ? 'block' : 'none';

        if (grupoReferencia) {
            const esVariable = !esFijo && !llevaStock;
            grupoReferencia.style.display = esVariable ? 'block' : 'none';
        }
    });

    document.getElementById('btn-add-inv')?.addEventListener('click', () => {
        const prod = document.getElementById('inv-prod').value;
        const cant = parseFloat(document.getElementById('inv-cant').value);
        const precio = parseFloat(document.getElementById('inv-precio').value);
        const unid = document.getElementById('inv-unid').value;

        if (!prod || isNaN(cant) || isNaN(precio)) {
            return toast.mostrar("Faltan datos del producto.");
        }
        
        const nombreLimpio = prod.charAt(0).toUpperCase() + prod.slice(1);
        
        arrayInventario.push({ 
            producto: nombreLimpio, 
            cantidad: cant, unidad: unid, precio: precio 
        });
        
        document.getElementById('inv-prod').value = ''; 
        document.getElementById('inv-cant').value = ''; 
        document.getElementById('inv-precio').value = '';
        
        actualizarListaInventarioUI();
        guardarBorradorStock();
    });

    if(formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('.btn-primary');
            btn.disabled = true;
            btn.textContent = "Guardando...";
            
            try {
                const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text;
                const metodoPago = document.getElementById('metodo-pago').value;
                const esCuotas = document.getElementById('check-es-cuotas')?.checked || false;
                const cantidadCuotas = parseInt(document.getElementById('input-cantidad-cuotas')?.value || '1');
                
                let textoReferencia = "";
                if (grupoReferencia && grupoReferencia.style.display === 'block' && inputReferencia) {
                    textoReferencia = inputReferencia.value.trim();
                }
                
                // Si NO es pago en cuotas, guardar normalmente
                if (!esCuotas || metodoPago !== 'tarjeta-credito') {
                    const monto = parseFloat(inputMontoGlobal.value);
                    if (isNaN(monto) || monto <= 0) {
                        toast.mostrar("Ingresá un monto válido mayor a 0.");
                        btn.disabled = false;
                        btn.textContent = "Guardar Gasto";
                        return;
                    }
                    
                    const nuevoGasto = {
                        fecha: AppUtils.getFechaLocal(),
                        monto: monto,
                        categoria: catElegida,
                        detalle_inventario: arrayInventario,
                        responsable: (ambitoActual === 'hogar') ? selectResponsable.value : currentUserIdGlobal,
                        metodo_pago: metodoPago,
                        tipo: (ambitoActual === 'hogar') ? 'general' : 'individual',
                        referencia: AppUtils.escapeHTML(textoReferencia)
                    };
                    
                    const contexto = (ambitoActual === 'hogar') ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
                    await api.guardarGasto(nuevoGasto, contexto);
                } else {
                    // LÓGICA DE PAGO EN CUOTAS
                    const montoTotal = parseFloat(inputMontoGlobal.value);
                    if (isNaN(montoTotal) || montoTotal <= 0) {
                        toast.mostrar("Ingresá un monto válido mayor a 0.");
                        btn.disabled = false;
                        btn.textContent = "Guardar Gasto";
                        return;
                    }
                    const montoCuota = montoTotal / cantidadCuotas;
                    const compraId = 'cuotas_' + Date.now();
                    
                    // Obtener fecha base usando AppUtils
                    const [y, m, d] = AppUtils.getFechaLocal().split('-').map(Number);
                    let fechaBase = new Date(y, m - 1, d);  
                    
                    // Si está marcado "post-cierre", sumar 1 mes
                    const postCierre = document.getElementById('check-post-cierre')?.checked || false;
                    if (postCierre) {
                        fechaBase.setMonth(fechaBase.getMonth() + 1);
                    }
                    
                    // Arrays para Promises
                    const promesasGasto = [];
                    
                    for (let i = 1; i <= cantidadCuotas; i++) {
                        // Clonar fecha base y sumar (i-1) meses
                        let fechaCuota = new Date(fechaBase);
                        fechaCuota.setMonth(fechaBase.getMonth() + (i - 1));
                        
                        // Formatear fecha a YYYY-MM-DD
                        const yearCuota = fechaCuota.getFullYear();
                        const monthCuota = String(fechaCuota.getMonth() + 1).padStart(2, '0');
                        const dayCuota = String(fechaCuota.getDate()).padStart(2, '0');
                        const fechaCuotaStr = `${yearCuota}-${monthCuota}-${dayCuota}`;
                        
                        const gastoCuota = {
                            fecha: fechaCuotaStr,
                            monto: montoCuota,
                            categoria: catElegida,
                            detalle_inventario: [],
                            responsable: (ambitoActual === 'hogar') ? selectResponsable.value : currentUserIdGlobal,
                            metodo_pago: metodoPago,
                            tipo: (ambitoActual === 'hogar') ? 'general' : 'individual',
                            referencia: `${AppUtils.escapeHTML(textoReferencia)} (Cuota ${i} de ${cantidadCuotas}) - Total: $${montoTotal.toLocaleString('es-AR')}`,
                            es_cuota: true,
                            compra_id: compraId
                        };
                        
                        const contexto = (ambitoActual === 'hogar') ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
                        promesasGasto.push(api.guardarGasto(gastoCuota, contexto));
                    }
                    
                    await Promise.all(promesasGasto);
                }
                
                toast.mostrar("✅ ¡Gasto guardado!");
                localStorage.removeItem('borrador_stock');
                arrayInventario = [];
                formGasto.reset();
                
                // Resetear controles de cuotas
                const checkEsCuotas = document.getElementById('check-es-cuotas');
                const divCuotasConfig = document.getElementById('div-cuotas-config');
                if (checkEsCuotas) checkEsCuotas.checked = false;
                if (divCuotasConfig) divCuotasConfig.style.display = 'none';
                
                if (inputReferencia) inputReferencia.value = '';
                if (grupoReferencia) grupoReferencia.style.display = 'none';
                
                actualizarListaInventarioUI();
                
            } catch (err) {
                console.error(err);
                toast.mostrar("❌ Error al guardar");
            } finally {
                btn.disabled = false;
                btn.textContent = "Guardar Gasto";
            }
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) inicializarPagina(user.uid);
    });
});

### ARCHIVO js/controller_resumen.js

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

    // --- LÓGICA DE INGRESOS (BOTÓN Y MODAL) ---
    const btnIngresos = document.getElementById('btn-header-ingresos');
    const modalIngreso = document.getElementById('modal-ingreso');
    const inputConceptoIngreso = document.getElementById('input-concepto-ingreso');
    const inputMontoIngreso = document.getElementById('input-monto-ingreso');
    const btnCerrarModalIngreso = document.getElementById('btn-cerrar-modal-ingreso');
    const btnGuardarIngreso = document.getElementById('btn-guardar-ingreso');

    // Función auxiliar para cerrar el modal con animación
    const cerrarModalIngresoFn = () => {
        const content = modalIngreso.querySelector('.modal-content');
        if (content) content.classList.remove('active'); // Le sacamos la clase para que baje
        setTimeout(() => {
            modalIngreso.style.display = 'none';
            inputConceptoIngreso.value = '';
            inputMontoIngreso.value = '';
        }, 300); // Esperamos 300ms a que termine la animación antes de apagar el display
    };

    if (btnIngresos) {
        btnIngresos.addEventListener('click', (e) => {
            e.preventDefault();
            modalIngreso.style.display = 'flex';
            // Un micro-delay para que el navegador procese el flex antes de animar
            setTimeout(() => {
                const content = modalIngreso.querySelector('.modal-content');
                if (content) content.classList.add('active'); // ¡Acá está la magia!
            }, 10);
        });
    }

    // Cerrar tocando el botón Cancelar
    if (btnCerrarModalIngreso) {
        btnCerrarModalIngreso.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarModalIngresoFn();
        });
    }

    // Cerrar tocando lo oscuro de afuera (Mejora de UX)
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
                monto: parseFloat(monto),
                categoria: "Ingreso",
                referencia: concepto,
                tipo: 'ingreso',
                responsable: auth.currentUser?.uid || ""
            };

            try {
                await api.guardarGasto(nuevoIngreso, { tipo: 'personal' });
                toast.mostrar('¡Ingreso guardado exitosamente! 💸');
                cerrarModalIngresoFn(); // Usamos la nueva función con animación
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
    // ------------------------------------------

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
        const mesActualNum = new Date().getMonth() + 1; 

        // PATÓVICA PARA KPIS: Afuera Ingresos y Deudas
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
                const monto = Number(g.monto) || 0;
                if (monto > 0) sumasPorMes[mesKey] = (sumasPorMes[mesKey] || 0) + monto;
            }
        });
        
        const totalesMensuales = Object.values(sumasPorMes).filter(m => m > 0);
        if (totalesMensuales.length === 0) return { minimo: 0, promedio: 0, maximo: 0 };
        
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
            let totalIngresosMesGlobal = 0; 

            const btnIngresosTexto = document.getElementById('btn-header-ingresos');
            if (btnIngresosTexto) {
                if (ambitoActual === 'unificado') btnIngresosTexto.style.display = 'block';
                else btnIngresosTexto.style.display = 'none';
            }

            if (ambitoActual === 'personal') {
                if (tituloHeader) tituloHeader.textContent = "Mis Gastos Personales";
                const todos = await api.obtenerGastos({ tipo: 'personal' }) || [];                
                
                todosLosGastos = todos.filter(g => g.tipo !== 'ingreso');
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                const gastosMesAnt = todosLosGastos.filter(g => g.fecha?.startsWith(mesAnterior)); // STOCK DATA
                
                renderer.renderizarPersonal(resumenService.calcularPersonal(gastosMes, categoriasPersonales), userData.fondos || [], gastosMes, kpisTotales, 0);
                renderer.mostrarComunes(gastosMes, categoriasPersonales, true, gastosMesAnt); // PASAMOS EL STOCK ANT

            } else if (ambitoActual === 'hogar' && hogarId) {
                const snapHogar = await getDoc(doc(db, "hogares", hogarId));
                const dataHogar = snapHogar.exists() ? snapHogar.data() : {};
                if (tituloHeader) tituloHeader.textContent = dataHogar.nombre;
                
                const cacheUsuariosHogar = {};
                for (const uid of dataHogar.miembros || []) {
                    if (!cacheUsuariosHogar[uid]) {
                        const u = await getDoc(doc(db, "usuarios", uid));
                        if (u.exists()) cacheUsuariosHogar[uid] = u.data().nombre;
                    }
                    mapaNombres[uid] = cacheUsuariosHogar[uid];
                }
                
                todosLosGastos = (await api.obtenerGastos(hogarId) || []).filter(g => g.tipo === 'general' || !g.tipo || g.tipo === 'pagoDeuda');                
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                const gastosMes = todosLosGastos.filter(g => g.fecha?.startsWith(mesActual));
                const gastosMesAnt = todosLosGastos.filter(g => g.fecha?.startsWith(mesAnterior)); // STOCK DATA
                
                renderer.renderizarHogar(resumenService.calcularHogar(gastosMes, mapaNombres), dataHogar.nombre, kpisTotales, dataHogar.presupuestos_compartidos || [], gastosMes, userId, dataHogar.categorias_compartidas || []);
                renderer.mostrarComunes(gastosMes, dataHogar.categorias_compartidas || [], true, gastosMesAnt); // PASAMOS EL STOCK ANT

            } else if (ambitoActual === 'unificado') {
                if (tituloHeader) tituloHeader.textContent = "Resumen Unificado";
                const todosP = await api.obtenerGastos('personal') || [];
                
                const gastosPersonalesReales = todosP.filter(g => g.tipo !== 'ingreso');
                const ingresosPersonales = todosP.filter(g => g.tipo === 'ingreso');
                totalIngresosMesGlobal = ingresosPersonales.filter(g => g.fecha?.startsWith(mesActual)).reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

                const q = query(collection(db, "hogares"), where("miembros", "array-contains", userId));
                const hogaresSnap = await getDocs(q);
                
                let miParteHogarTotal = 0, todosHogaresParaGraficos = [], gastosHogarMesListas = [];
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

                todosLosGastos = [...gastosPersonalesReales, ...todosHogaresParaGraficos];
                kpisTotales = calcularKPIsAnuales(todosLosGastos, anioActual);
                
                renderer.renderizarUnificado({ 
                    totalBolsillo: resumenService.calcularPersonal(gastosPersonalesReales.filter(g => g.fecha?.startsWith(mesActual)), []).total + miParteHogarTotal,
                    desglosePersonal: resumenService.calcularPersonal(gastosPersonalesReales.filter(g => g.fecha?.startsWith(mesActual)), []).total,
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

### ARCHIVO js/controller_perfil.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";
import { PerfilRenderer } from "./ui/PerfilRenderer.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    let currentUserUid = null;
    let userData = {};

    const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    const displayNombre = document.getElementById('display-nombre-perfil');
    const inputNombre = document.getElementById('input-nombre');
    const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
    const btnToggleEditNombre = document.getElementById('btn-toggle-edit-nombre');
    const boxEditNombre = document.getElementById('box-edit-nombre');

    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const inputNuevoPago = document.getElementById('input-nuevo-pago');
    const btnAddPago = document.getElementById('btn-add-pago');
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');

    const renderer = new PerfilRenderer(async () => await guardarDatosGenerales());

    const setupToggle = (btnId, boxId) => {
        const btn = document.getElementById(btnId);
        const box = document.getElementById(boxId);
        if(btn && box) {
            btn.addEventListener('click', () => {
                const isHidden = box.style.display === 'none';
                box.style.display = isHidden ? 'block' : 'none';
                if (isHidden) btn.classList.add('is-active');
                else btn.classList.remove('is-active');
            });
        }
    };

    setupToggle('btn-toggle-cat', 'form-cat-box');
    setupToggle('btn-toggle-pago', 'form-pago-box');
    setupToggle('btn-toggle-fondo', 'form-fondo-box');

    // Lógica del lápiz para el nombre
    const viewModeNombre = document.getElementById('view-mode-nombre');
    const editModeNombre = document.getElementById('edit-mode-nombre');
    const btnCancelarEdit = document.getElementById('btn-cancelar-edit');

    if (btnToggleEditNombre) {
        btnToggleEditNombre.addEventListener('click', () => {
            viewModeNombre.style.display = 'none';
            editModeNombre.style.display = 'flex';
            inputNombre.focus(); // Autoselecciona el input para escribir directo
        });
    }

if (btnCancelarEdit) {
        btnCancelarEdit.addEventListener('click', () => {
            editModeNombre.style.display = 'none';
            viewModeNombre.style.display = 'flex';
            inputNombre.value = displayNombre.textContent;
        });
    }

    NavigationBuilder.buildNav('personal', null);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            await cargarDatosUsuario();
        } else {
            window.location.href = 'login.html'; 
        }
    });

    async function cargarDatosUsuario() {
        try {
            const docSnap = await getDoc(doc(db, "usuarios", currentUserUid));
            userData = docSnap.exists() ? docSnap.data() : { nombre: "", categorias_personales: [], metodos_pago: ["Efectivo / Transferencia"], fondos: [] };

            userData.categorias_personales = (userData.categorias_personales || []).map(c => typeof c === 'string' ? { nombre: c, es_fijo: false, lleva_stock: false } : c);

            if (displayNombre) displayNombre.textContent = userData.nombre || "Usuario";
            if (inputNombre) inputNombre.value = userData.nombre || "";

            renderer.renderizarCategorias(userData);
            renderer.renderizarPagos(userData);
            renderer.renderizarFondos(userData);
        } catch (error) { toast.mostrar("Error al cargar datos."); }
    }

    if (btnGuardarPerfil) {
        btnGuardarPerfil.addEventListener('click', async () => {
            const nombre = capitalizar(inputNombre.value.trim()); 
            if (!nombre) return toast.mostrar("Ingresá un nombre.");
            
            btnGuardarPerfil.textContent = "Guardando...";
            try {
                await updateDoc(doc(db, "usuarios", currentUserUid), { nombre });
                toast.mostrar("¡Nombre actualizado!");
                displayNombre.textContent = nombre;
                editModeNombre.style.display = 'none';
                viewModeNombre.style.display = 'flex';
            } catch (error) { toast.mostrar("Error al guardar."); } 
            finally { btnGuardarPerfil.textContent = "Guardar"; }
        });
    }

    if (btnAddCat) {
        btnAddCat.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevaCat.value.trim());
            if (!nombre) return;
            
            // BLINDAJE 1: Nos aseguramos de que el array exista antes de buscar nada
            if (!userData.categorias_personales) {
                userData.categorias_personales = [];
            }
            
            // BLINDAJE 2: Buscamos de forma segura, incluso si la categoría guardada es un texto simple en vez de un objeto
            const existe = userData.categorias_personales.find(c => {
                const nombreCat = typeof c === 'string' ? c : c.nombre;
                return nombreCat && nombreCat.toLowerCase() === nombre.toLowerCase();
            });
            
            if (existe) return toast.mostrar("Esa categoría ya existe");
            
            // BLINDAJE 3: Forzamos el guardado de la nueva categoría como un objeto
            userData.categorias_personales.push({ nombre: nombre, es_fijo: false, lleva_stock: false });
            inputNuevaCat.value = '';
            
            try {
                // Guardamos, notificamos y re-dibujamos
                await guardarDatosGenerales();
                renderer.renderizarCategorias(userData);
                toast.mostrar("¡Categoría agregada!"); // Le damos feedback visual a Yane
            } catch (error) {
                console.error("Error al guardar la categoría:", error);
                toast.mostrar("Error al guardar en la nube.");
            }
        });
    }

    if (btnAddPago) {
        btnAddPago.addEventListener('click', async () => {
            const nombre = capitalizar(inputNuevoPago.value.trim());
            if (!nombre) return;
            
            if (!userData.metodos_pago) userData.metodos_pago = [];
            if (userData.metodos_pago.find(p => p.toLowerCase() === nombre.toLowerCase())) return toast.mostrar("Ese método ya existe");
            
            userData.metodos_pago.push(nombre);
            inputNuevoPago.value = '';
            
            await guardarDatosGenerales();
            renderer.renderizarPagos(userData);
        });
    }

     if(btnCrearFondo) {
         btnCrearFondo.addEventListener('click', async () => {
             const nombre = capitalizar(inputNombreFondo.value.trim());
             const monto = parseFloat(inputMontoFondo.value);
             let seleccionadas = [];

             const checksGrid = document.querySelectorAll('input[name="cat-vinculo-check"]:checked');
             const checksCustom = document.querySelectorAll('input[name="cat-vinculo-custom"]:checked');

             if (checksGrid.length > 0) seleccionadas = Array.from(checksGrid).map(c => c.value);
             else if (checksCustom.length > 0) seleccionadas = Array.from(checksCustom).map(c => c.value);

             if (!nombre || isNaN(monto) || seleccionadas.length === 0) {
                 return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
             }

             if(!userData.fondos) userData.fondos = [];
             userData.fondos.push({ id: Date.now().toString(), nombre, monto, categorias: seleccionadas });

             inputNombreFondo.value = '';
             inputMontoFondo.value = '';
             document.querySelectorAll('input[name="cat-vinculo-check"], input[name="cat-vinculo-custom"]').forEach(chk => chk.checked = false);
             const textSpan = document.getElementById('dropdown-text');
             if(textSpan) textSpan.textContent = "Seleccionar categorías...";

             await guardarDatosGenerales();
             renderer.renderizarFondos(userData);
toast.mostrar("¡Presupuesto creado!");
          });
      }

    async function guardarDatosGenerales() {
         try {
             // 1. EL BLINDAJE: Nos aseguramos de que NINGÚN dato viaje como "undefined".
             // Si no existen, le mandamos un array vacío a Firebase para que no se cuelgue.
             const datosLimpios = {
                 categorias_personales: userData.categorias_personales || [],
                 metodos_pago: userData.metodos_pago || ["Efectivo / Transferencia"],
                 fondos: userData.fondos || []
             };

             // 2. Guardamos en Firebase usando los datos limpios
             await updateDoc(doc(db, "usuarios", currentUserUid), datosLimpios);
             
             // Si llega hasta acá, Firebase lo aceptó perfecto.
             console.log("Guardado exitoso en Firebase");
             
         } catch(error) {
             console.error(error);
             
             // 3. LA SONDA DE DIAGNÓSTICO: Este cartelito feo va a saltar en el medio 
             // de la pantalla del iPhone de Yane gritándonos cuál es el problema real.
             alert("⚠️ ERROR DE FIREBASE: " + error.message);
             
             toast.mostrar("Hubo un error al guardar.");
         }
    }
});

