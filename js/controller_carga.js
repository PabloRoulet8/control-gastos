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
        
        const userSnap = await getDoc(doc(db, "usuarios", userId));
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (ambitoActual === 'personal') {
                listaCategorias = userData.categorias_personales || [];
                if (!listaCategorias || listaCategorias.length === 0) {
                    listaCategorias = [
                        { nombre: 'Supermercado', lleva_stock: false, es_fijo: false },
                        { nombre: 'Transporte', lleva_stock: false, es_fijo: false },
                        { nombre: 'Servicios', lleva_stock: false, es_fijo: true },
                        { nombre: 'Ocio', lleva_stock: false, es_fijo: false }
                    ];
                }
                if (tituloHeader) tituloHeader.textContent = "Gastos Personales";
                if (subtituloHeader) subtituloHeader.textContent = "¿Qué gasto vas a anotar?"; 
            }
        }
        
        // Categories are loaded, now fill the select
        llenarSelectCategorias();

        if (ambitoActual === 'hogar' && hogarId) {
            const hogarSnap = await getDoc(doc(db, "hogares", hogarId));
            if (hogarSnap.exists()) {
                const hogarData = hogarSnap.data();
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
            llenarSelectCategorias();
        }
        
        const guardado = localStorage.getItem('borrador_stock');
        if (guardado) {
            arrayInventario = JSON.parse(guardado);
            actualizarListaInventarioUI();
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