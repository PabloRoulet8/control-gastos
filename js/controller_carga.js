import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { AppUtils } from "./utils/AppUtils.js";
import { DraftService } from "./services/DraftService.js";
import { InventarioService } from "./services/InventarioService.js";
import { CategoryService } from "./services/CategoryService.js";
import { FormService } from "./services/FormService.js";
import { IAService } from "./services/IAService.js";
import { VoiceService } from "./services/VoiceService.js";
import { CargaStore } from "./store/CargaStore.js";
import { InventarioUI } from "./ui/InventarioUI.js";

// Backend de IA (procesamiento del gasto dictado)
const API_IA_URL = 'https://control-gastos-backend-o6nv.onrender.com/api/procesar-gasto';
const API_IA_PING_URL = new URL('/', API_IA_URL).href;

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const toast = new ToastManager();

    const store = CargaStore.getInstance();
    const urlParams = new URLSearchParams(window.location.search);

    store.setContexto({
        ambitoActual: NavigationBuilder.normalizeAmbito(urlParams.get('ambito')),
        hogarId: urlParams.get('id'),
        hogarNombre: urlParams.get('nombre')
    });

    const selectCategoria = document.getElementById('categoria');
    const selectResponsable = document.getElementById('responsable');
    const tituloHeader = document.getElementById('titulo-header');
    const subtituloHeader = document.querySelector('.container h2');
    const grupoResponsable = document.getElementById('responsable-group');
    const inputMontoGlobal = document.getElementById('monto');
    const listaUI = document.getElementById('lista-inventario');
    const seccionStockUI = document.getElementById('seccion-inventario');
    const formGasto = document.getElementById('expense-form');
    
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');

    const contextoInicial = store.getState();
    NavigationBuilder.buildConfigButton(contextoInicial.ambitoActual, contextoInicial.hogarId);
    NavigationBuilder.buildNav(contextoInicial.ambitoActual, contextoInicial.hogarId, 'carga');

    // 1. GESTIÓN DE BORRADOR Y NAVEGACIÓN
    const guardarBorradorStock = () => {
        const { currentUserIdGlobal, ambitoActual, hogarId, arrayInventario } = store.getState();
        const guardado = DraftService.guardarBorrador(
            currentUserIdGlobal,
            ambitoActual,
            hogarId,
            {
                items: arrayInventario,
                monto: inputMontoGlobal?.value || '',
                categoria: selectCategoria?.value || '',
                metodoPago: document.getElementById('metodo-pago')?.value || 'efectivo'
            }
        );
        if (!guardado) {
            toast.mostrar('No se pudo guardar el borrador automático.', 'error');
        }
    };

    // Lógica única para agregar un producto al inventario (manual o por IA)
    const agregarProductoInventario = ({ producto, cantidad, unidad, precio = 0 }) => {
        const { arrayInventario: inventarioActual } = store.getState();
        const inventarioAntes = Array.isArray(inventarioActual) ? inventarioActual.length : 0;
        const inventarioNuevo = InventarioService.agregarItem(inventarioActual, {
            producto,
            cantidad,
            unidad,
            precio
        });
        const inventarioDespues = Array.isArray(inventarioNuevo) ? inventarioNuevo.length : 0;

        store.setInventario(inventarioNuevo);

        return inventarioDespues >= inventarioAntes && inventarioNuevo.length > 0;
    };

    // Solicita permiso de micrófono al ingresar para evitar el prompt en el primer toque
    const solicitarPermisoMicrofonoInicial = async () => {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Liberamos el micrófono inmediatamente para no mantenerlo activo
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.warn('Permiso de micrófono denegado o ignorado:', error?.name || error);
        }
    };

    // 2. INICIALIZACIÓN DE DATOS
    const inicializarPagina = async (userId) => {
        store.setContexto({ currentUserIdGlobal: userId });
        const { ambitoActual, hogarId, hogarNombre } = store.getState();

        // Despierta el backend gratuito sin bloquear ni esperar respuesta.
        fetch(API_IA_PING_URL, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store'
        }).catch(() => {});

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
                store.setCategorias(CategoryService.obtenerCategoriasParaAmbito('personal', {
                    personales: categoriasPropias
                }));

                if (tituloHeader) tituloHeader.textContent = "Gastos Personales";
                if (subtituloHeader) subtituloHeader.textContent = "¿Qué gasto vas a anotar?"; 
            }

            if (ambitoActual === 'hogar' && hogarId) {
                const hogarSnap = await getDoc(doc(db, "hogares", hogarId));
                if (hogarSnap.exists()) {
                    const hogarData = hogarSnap.data();
                    
                    // Acá cargamos EXCLUSIVAMENTE las categorías compartidas del hogar
                    store.setCategorias(CategoryService.obtenerCategoriasParaAmbito('hogar', {
                        hogar: hogarData.categorias_compartidas || []
                    }));
                    
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
            }
            
            DraftService.limpiarBorradorLegacy();
            const { currentUserIdGlobal } = store.getState();
            const guardado = DraftService.cargarBorrador(currentUserIdGlobal, ambitoActual, hogarId);
            if (guardado) {
                if (guardado.categoria && selectCategoria) {
                    selectCategoria.value = guardado.categoria;
                    selectCategoria.dispatchEvent(new Event('change'));
                }
                if (guardado.metodoPago) {
                    const selectMetodoPago = document.getElementById('metodo-pago');
                    if (selectMetodoPago) {
                        selectMetodoPago.value = guardado.metodoPago;
                        selectMetodoPago.dispatchEvent(new Event('change'));
                    }
                }
                if (guardado.monto && inputMontoGlobal) inputMontoGlobal.value = guardado.monto;
                const itemsGuardados = guardado.items || [];
                store.setInventario(itemsGuardados);
                InventarioUI.actualizarVisibilidadSeccion(
                    seccionStockUI,
                    itemsGuardados.length > 0
                );
            }

            await solicitarPermisoMicrofonoInicial();
        } catch (error) {
            console.error("Error cargando perfil:", error);
        }
    };

    const llenarSelectCategorias = () => {
        if (!selectCategoria) return;
        const { listaCategorias } = store.getState();

        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';

        CategoryService.prepararCategorias(listaCategorias).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.valor;
            option.textContent = cat.nombre;
            option.dataset.llevaStock = cat.lleva_stock;
            option.dataset.esFijo = cat.es_fijo;
            selectCategoria.appendChild(option);
        });
    };

    store.subscribe(({ changed }) => {
        if (changed.includes('arrayInventario')) {
            const { arrayInventario } = store.getState();

            InventarioUI.renderizarLista(
                arrayInventario,
                listaUI,
                inputMontoGlobal,
                seccionStockUI,
                (index) => {
                    const { arrayInventario: inventarioActual } = store.getState();
                    store.setInventario(
                        InventarioService.eliminarItem(inventarioActual, index)
                    );
                    guardarBorradorStock();
                }
            );
        }

        if (changed.includes('listaCategorias')) llenarSelectCategorias();
    });

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
            const esTarjeta = FormService.admiteCuotas(selectMetodoPago.value);

            if (contenedorOpcionCuotas) {
                contenedorOpcionCuotas.style.display = esTarjeta ? 'block' : 'none';
            }

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
        if (!option) return;

        const llevaStock = option.dataset.llevaStock === "true";
        const esFijo = option.dataset.esFijo === "true";

        InventarioUI.actualizarVisibilidadSeccion(seccionStockUI, llevaStock);

        if (grupoReferencia) {
            grupoReferencia.style.display = FormService.esCategoriaVariable({ esFijo, llevaStock })
                ? 'block'
                : 'none';
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

        agregarProductoInventario({ producto: prod, cantidad: cant, unidad: unid, precio });

        document.getElementById('inv-prod').value = '';
        document.getElementById('inv-cant').value = '';
        document.getElementById('inv-precio').value = '';

        guardarBorradorStock();
    });

    const modalLimpiar = document.getElementById('modal-limpiar');
    const btnLimpiarTodo = document.getElementById('btn-limpiar-todo');
    const btnCancelarLimpiar = document.getElementById('btn-cancelar-limpiar');
    const btnConfirmarLimpiar = document.getElementById('btn-confirmar-limpiar');
    let focoPrevioLimpiar = null;

    const cerrarModalLimpiar = () => {
        if (!modalLimpiar) return;
        modalLimpiar.style.display = 'none';
        if (focoPrevioLimpiar && typeof focoPrevioLimpiar.focus === 'function') {
            focoPrevioLimpiar.focus();
        }
        focoPrevioLimpiar = null;
    };

    const abrirModalLimpiar = () => {
        if (!modalLimpiar) return;
        focoPrevioLimpiar = document.activeElement;
        modalLimpiar.style.display = 'flex';
        btnCancelarLimpiar?.focus();
    };

    btnLimpiarTodo?.addEventListener('click', abrirModalLimpiar);
    btnCancelarLimpiar?.addEventListener('click', cerrarModalLimpiar);

    modalLimpiar?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cerrarModalLimpiar();
            return;
        }
        if (e.key !== 'Tab') return;

        const focusables = modalLimpiar.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const primero = focusables[0];
        const ultimo = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    });

    modalLimpiar?.addEventListener('click', (e) => {
        if (e.target === modalLimpiar) cerrarModalLimpiar();
    });

    btnConfirmarLimpiar?.addEventListener('click', () => {
        cancelarProcesamientoIA();
        isProcessing = false;
        voiceService.abortar();
        transcripcionInterina = '';
        fragmentosConfirmados = [];
        actualizarTranscripcionUI();
        pintarBotonDictar('idle');

        const { currentUserIdGlobal, ambitoActual, hogarId } = store.getState();
        DraftService.limpiarBorrador(currentUserIdGlobal, ambitoActual, hogarId);
        DraftService.limpiarBorradorLegacy();
        if (formGasto) formGasto.reset();
        if (inputMontoGlobal) {
            inputMontoGlobal.value = '';
            inputMontoGlobal.readOnly = false;
        }
        if (inputReferencia) inputReferencia.value = '';
        if (grupoReferencia) grupoReferencia.style.display = 'none';
        InventarioUI.actualizarVisibilidadSeccion(seccionStockUI, false);
        const checkCuotas = document.getElementById('check-es-cuotas');
        const divCuotasConfig = document.getElementById('div-cuotas-config');
        if (checkCuotas) checkCuotas.checked = false;
        if (divCuotasConfig) divCuotasConfig.style.display = 'none';
        store.setInventario([]);
        cerrarModalLimpiar();
        toast.mostrar('Inventario y formulario limpiados.', 'info');
    });

    // ==========================================
    // 4. DICTADO POR VOZ + PROCESAMIENTO CON IA
    // ==========================================

    const btnDictar = document.getElementById('btn-dictar-gasto');
    const btnDictarTexto = btnDictar?.querySelector('.btn-dictar-texto');
    const dictadoTranscripcion = document.getElementById('dictado-transcripcion');
    const dictarHint = document.querySelector('.dictar-hint');

    // API nativa del navegador (Chrome / Edge)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const MAX_REINICIOS_SILENCIO = 5;
    const REINICIO_DEMORA_MS = 300;

    // Banderas de estado: evitan clics dobles y envíos simultáneos
    let isProcessing = false;       // hay a una petición de IA en curso (or finalizando)
    let abortControllerIA = null;
    let idProcesamientoIA = 0;
    const cancelarProcesamientoIA = () => {
        idProcesamientoIA += 1;
        if (abortControllerIA) {
            abortControllerIA.abort();
            abortControllerIA = null;
        }
    };

    let transcripcionInterina = '';
    let fragmentosConfirmados = [];

    const voiceService = new VoiceService({
        lang: 'es-AR',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        reinicioDemoraMs: 300,
        onStateChange: (estado) => {
            if (estado === 'recording') {
                pintarBotonDictar('recording');
            } else if (estado === 'processing') {
                pintarBotonDictar('processing');
            } else if (estado === 'idle') {
                pintarBotonDictar('idle');
            }
        },
        onInterim: (snapshot) => {
            fragmentosConfirmados = [...snapshot.fragmentosConfirmados];
            transcripcionInterina = snapshot.transcripcionInterina;
            actualizarTranscripcionUI();
        },
        onFinal: (snapshot) => {
            fragmentosConfirmados = [...snapshot.fragmentosConfirmados];
            transcripcionInterina = snapshot.transcripcionInterina;
            actualizarTranscripcionUI();
        },
        onReadyToConsolidate: () => {
            consolidarYProcesar();
        },
        onError: (codigo) => {
            console.warn('Error de reconocimiento de voz:', codigo);
        },
        onFatalError: (codigo) => {
            const mensajes = {
                'not-allowed': 'Permiso de micrófono denegado. Habilitalo en the navegador.',
                'service-not-allowed': 'El navegador bloqueó the servicio de voz.',
                'audio-capture': 'No se encontró a micrófono disponible.',
                'start-failed': 'No se pudo iniciar the dictado por voz.'
            };
            toast.mostrar(mensajes[codigo] || 'Error con the reconocimiento de voz.', 'error', 5000);
            cancelarProcesamientoIA();
            isProcessing = false;
            voiceService.reset();
            actualizarTranscripcionUI();
            pintarBotonDictar('idle');
        }
    });

    // Normaliza texto para comparar (minúsculas y sin acentos)
    const normalizar = (texto) => CategoryService.normalizarTexto(texto);

    // Busca la categoría que mejor corresponde a lo que devolvió la IA
    const buscarCategoriaIA = (nombreIA) => {
        if (!nombreIA) return null;
        const { listaCategorias } = store.getState();
        return CategoryService.buscarCategoria(nombreIA, listaCategorias);
    };

    // Traduce el método de pago de la IA a las opciones reales del select
    const aplicarMetodoPagoIA = (metodoIA) => {
        if (!selectMetodoPago || !metodoIA) return false;

        const objetivo = normalizar(metodoIA);
        const opciones = Array.from(selectMetodoPago.options);

        // 1) Coincidencia exacta
        let opcion = opciones.find(o => normalizar(o.value) === objetivo);

        // 2) Débito: la app no tiene tarjeta de débito y no genera deuda, se trata como efectivo
        if (!opcion && objetivo.includes('debito')) {
            opcion = opciones.find(o => normalizar(o.value).includes('efectivo')) || opciones[0];
        }

        // 3) Tarjeta de crédito
        if (!opcion && (objetivo.includes('tarjeta') || objetivo.includes('credito'))) {
            opcion = opciones.find(o => normalizar(o.value).includes('tarjeta'));
        }

        // 4) Coincidencia parcial
        if (!opcion) {
            opcion = opciones.find(o => {
                const valor = normalizar(o.value);
                return objetivo.includes(valor) || valor.includes(objetivo);
            });
        }

        if (!opcion) return false;

        selectMetodoPago.value = opcion.value;
        // Disparamos el change para que se muestre/oculte el bloque de cuotas
        selectMetodoPago.dispatchEvent(new Event('change'));
        return true;
    };

    // Volca la respuesta de la IA en los campos del formulario
    const aplicarDatosIA = (datos) => {
        if (!datos || typeof datos !== 'object') {
            toast.mostrar('❌ La IA no devolvió datos utilizables.', 'error');
            return;
        }

        const completados = [];

        // Monto
        const monto = typeof datos.monto === 'number' ? datos.monto : parseFloat(datos.monto);
        if (!isNaN(monto) && monto > 0) {
            // Solo hay un total propio si los ítems ya cargados tienen precio.
            // Si todos valen 0 (típico de la IA), se respeta el monto dictado.
            const { arrayInventario } = store.getState();
            const totalPrecios = arrayInventario.reduce(
                (acc, item) => acc + (Number(item.precio) || 0),
                0
            );

            if (totalPrecios > 0) {
                toast.mostrar('Hay productos con precio: el monto se calcula solo.', 'info');
            } else {
                const montoAnterior = parseFloat(inputMontoGlobal.value) || 0;
                inputMontoGlobal.value = (montoAnterior + monto).toFixed(2);
                inputMontoGlobal.readOnly = false;
                completados.push('monto');
            }
        }

        // Categoría
        const categoriaIA = buscarCategoriaIA(datos.categoria);
        if (categoriaIA && selectCategoria) {
            selectCategoria.value = categoriaIA.valor;
            // Disparamos el change para que se actualicen stock / referencia
            selectCategoria.dispatchEvent(new Event('change'));
            completados.push('categoría');
        } else if (datos.categoria) {
            toast.mostrar(`No encontré la categoría "${datos.categoria}". Elegila a mano.`, 'error', 5000);
        }

        // Método de pago
        if (aplicarMetodoPagoIA(datos.metodo_pago)) {
            completados.push('método de pago');
        }

        // Referencia / detalle corto
        if (datos.referencia && inputReferencia) {
            inputReferencia.value = String(datos.referencia).trim();
            completados.push('referencia');
        }

        // Cuotas: solo si la IA detectó tarjeta de crédito y más de una cuota
        const cuotas = parseInt(datos.cuotas, 10);
        const esTarjetaCredito = selectMetodoPago?.value === 'tarjeta-credito';
        if (esTarjetaCredito && Number.isInteger(cuotas) && cuotas > 1 && inputCantidadCuotas) {
            const cuotasValidas = Math.min(cuotas, 36); // respeta el max del input
            if (checkEsCuotas) {
                checkEsCuotas.checked = true;
                checkEsCuotas.dispatchEvent(new Event('change')); // despliega el panel de cuotas
            }
            inputCantidadCuotas.value = cuotasValidas;
            completados.push(`${cuotasValidas} cuotas`);
        }

        // Detalle de inventario dictado: dibujamos cada producto en la lista
        if (Array.isArray(datos.detalle_inventario) && datos.detalle_inventario.length > 0) {
            let agregados = 0;

            datos.detalle_inventario.forEach(item => {
                if (!item) return;

                const ok = agregarProductoInventario({
                    producto: item.producto,
                    cantidad: item.cantidad,
                    unidad: item.unidad,
                    precio: item.precio
                });

                if (ok) agregados++;
            });

            if (agregados > 0) {
                InventarioUI.actualizarVisibilidadSeccion(seccionStockUI, true);
                guardarBorradorStock();

                completados.push(`${agregados} producto(s)`);
            }
        }

        if (completados.length > 0) {
            toast.mostrar(`✅ Listo: ${completados.join(', ')}. Revisá y guardá.`, 'success');
        }
    };

    // Filtro SOLO visual: colapsa repeticiones contiguas exactas (eco de Android).
    // No se usa sobre el texto que se envía a la IA.
    const limpiarEcoVisual = (texto) => {
        if (!texto) return '';
        // Filtro visual seguro: elimina una duplicación exacta de bloques de 1 a 3 palabras
        // Evita el catastrophic backtracking y preserva repeticiones intencionales complejas
        return texto.replace(/\b([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})\s+\1\b/gi, '$1').trim();
    };

    // Muestra la transcripción en vivo (consolidado + lo que se está interpretando)
    const actualizarTranscripcionUI = () => {
        if (!dictadoTranscripcion) return;

        const base = fragmentosConfirmados.join(' ');
        const textoCrudo = base ? (transcripcionInterina ? `${base} ${transcripcionInterina}` : base) : (transcripcionInterina || '');
        const texto = limpiarEcoVisual(textoCrudo.trim());
        dictadoTranscripcion.textContent = texto;
        dictadoTranscripcion.hidden = (texto === '');
    };

    // Feedback visual del botón según el estado: 'idle' | 'recording' | 'processing'
    const pintarBotonDictar = (estado) => {
        if (!btnDictar) return;

        btnDictar.classList.toggle('is-listening', estado === 'recording');
        btnDictar.disabled = (estado === 'processing');

        if (btnDictarTexto) {
            if (estado === 'recording') btnDictarTexto.textContent = 'Escuchando... (Suelta para procesar)';
            else if (estado === 'processing') btnDictarTexto.textContent = 'Procesando...';
            else btnDictarTexto.textContent = 'Mantén presionado para dictar';
        }

        // Mientras dicta o procesa, el ejemplo deja de ser útil
        if (dictarHint) dictarHint.hidden = (estado !== 'idle');
    };

    // Vuelve todo a reposo y limpia la transcripción
    const resetEstado = () => {
        isProcessing = false;
        voiceService.reset();
        fragmentosConfirmados = [];
        transcripcionInterina = '';
        actualizarTranscripcionUI();
        pintarBotonDictar('idle');
    };

    // Envía el texto transcrito al backend de IA y completa el formulario
    const procesarConIA = async (texto) => {
        const idProcesamiento = ++idProcesamientoIA;

        if (abortControllerIA) {
            abortControllerIA.abort();
            abortControllerIA = null;
        }

        // Diagnóstico: permite distinguir error acústico (texto mal transcripto)
        // de una mala extracción del backend.
        console.log('[IA] Texto consolidado enviado:', JSON.stringify(texto));
        toast.mostrar(`🎤 Enviado: "${texto}" — procesando...`, 'info', 4000);

        // Mandamos las categorías reales para que la IA elija una y no invente nombres
        const { listaCategorias } = store.getState();
        const categoriasDisponibles = CategoryService
            .prepararCategorias(listaCategorias)
            .map(cat => cat.valor);

        // Medimos desde que sale el request hasta que el JSON está resuelto.
        // (No incluye el pintado del formulario posterior.)
        let fetchMedido = false;
        const terminarTiempoFetch = () => {
            if (fetchMedido) return;
            fetchMedido = true;
            console.timeEnd('Tiempo Fetch');
        };

        console.time('Tiempo Fetch');

        const controller = new AbortController();
        abortControllerIA = controller;
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
            const datos = await IAService.procesarTexto({
                texto,
                categoriasDisponibles,
                signal: controller.signal,
                auth,
                apiUrl: API_IA_URL
            });

            terminarTiempoFetch();

            if (idProcesamiento !== idProcesamientoIA) return;

            aplicarDatosIA(datos);

        } catch (error) {
            terminarTiempoFetch();

            if (idProcesamiento !== idProcesamientoIA) return;

            console.error('Error al procesar el gasto con IA:', error);

            let mensaje;
            if (error?.name === 'AbortError') {
                mensaje = 'La IA tardó demasiado en responder. Intentá de nuevo.';
            } else if (error instanceof TypeError) {
                mensaje = 'Sin conexión. Revisá tu internet e intentá de nuevo.';
            } else {
                mensaje = error?.message || 'No se pudo procesar el gasto con IA.';
            }

            toast.mostrar(`❌ ${mensaje}`, 'error', 6000);
        } finally {
            clearTimeout(timeoutId);

            if (abortControllerIA === controller) {
                abortControllerIA = null;
            }

            if (idProcesamiento === idProcesamientoIA) {
                resetEstado();
            }
        }
    };

    const configurarReconocimiento = () => {
        try {
            reconocimiento = new SpeechRecognition();
        } catch (error) {
            console.error('No se pudo crear el reconocedor de voz:', error);
            return false;
        }

        reconocimiento.lang = 'es-AR';
        reconocimiento.continuous = false;       // modo burst para evitar eco nativo en Android
        reconocimiento.interimResults = true;   // transcripción parcial en tiempo real
        reconocimiento.maxAlternatives = 1;

        reconocimiento.onstart = () => {
            // Si el usuario ya pidió finalizar (doble clic muy rápido), no reabrimos el micrófono
            if (stopSolicitado) return;

            isRecording = true;
            pintarBotonDictar('recording');
            actualizarTranscripcionUI();
        };

        reconocimiento.onresult = (evento) => {
            reiniciosSilencio = 0;
            transcripcionInterina = '';

            for (let i = evento.resultIndex; i < evento.results.length; i++) {
                const resultado = evento.results[i];
                const texto = (resultado[0]?.transcript || '').trim();
                if (!texto) continue;

                if (resultado.isFinal) {
                    const ultimo = fragmentosConfirmados[fragmentosConfirmados.length - 1];
                    if (ultimo && ultimo === texto) {
                        // evita duplicados inmediatos por eco
                        continue;
                    }
                    fragmentosConfirmados.push(texto);
                } else {
                    transcripcionInterina = texto;
                }
            }

            actualizarTranscripcionUI();

            if (stopSolicitado && !transcripcionInterina) {
                consolidarYProcesar();
            }
        };

        reconocimiento.onerror = (evento) => {
            const codigo = evento.error;
            console.warn('Error de reconocimiento de voz:', codigo);

            // Si el usuario pidió finalizar, onresult (bypass) u onend consolidan lo transcripto
            if (stopSolicitado) return;

            const fatales = ['not-allowed', 'service-not-allowed', 'audio-capture'];
            if (fatales.includes(codigo)) {
                const mensajes = {
                    'not-allowed': 'Permiso de micrófono denegado. Habilitalo en el navegador.',
                    'service-not-allowed': 'El navegador bloqueó el servicio de voz.',
                    'audio-capture': 'No se encontró un micrófono disponible.'
                };
                toast.mostrar(mensajes[codigo], 'error', 5000);
                resetEstado();
            }
            // 'no-speech', 'network' y 'aborted' son recuperables:
            // onend reintenta para no cortar el dictado durante las pausas.
        };

        reconocimiento.onend = () => {
            // Si el texto ya se envió desde onresult, onend NO vuelve a enviar
            if (yaConsolidado) {
                isRecording = false;
                reiniciosSilencio = 0;
                btnDictar?.classList.remove('is-listening');

                if (temporizadorReinicio) {
                    clearTimeout(temporizadorReinicio);
                    temporizadorReinicio = null;
                }
                return;
            }

            // Fallback: el usuario soltó y el motor terminó sin entregar un bloque final
            if (stopSolicitado) {
                // Pasa lo que quede interino a fragmentos confirmados evitando duplicado
                if (transcripcionInterina) {
                    const ultimo = fragmentosConfirmados[fragmentosConfirmados.length - 1];
                    if (!(ultimo && ultimo === transcripcionInterina)) {
                        fragmentosConfirmados.push(transcripcionInterina);
                    }
                    transcripcionInterina = '';
                    actualizarTranscripcionUI();
                }
                consolidarYProcesar();
                return;
            }

            if (!isRecording) return;

            // Modo burst: el motor corta solo tras cada ráfaga; lo reeniciamos
            // manualmente mientras el usuario siga manteniendo presionado.
            if (transcripcionInterina) {
                const ultimo = fragmentosConfirmados[fragmentosConfirmados.length - 1];
                if (!(ultimo && ultimo === transcripcionInterina)) {
                    fragmentosConfirmados.push(transcripcionInterina);
                }
                transcripcionInterina = '';
                actualizarTranscripcionUI();
            }

            temporizadorReinicio = setTimeout(() => {
                if (!isRecording || stopSolicitado) return;
                try { reconocimiento.start(); } catch (e) {}
            }, REINICIO_DEMORA_MS);
        };

        return true;
    };

    // Primer clic: arranca el micrófono
    const iniciarDictado = () => {
        if (!SpeechRecognition) {
            toast.mostrar('Tu navegador no soporta reconocimiento de voz. Probá con Chrome o Edge.', 'error', 6000);
            return;
        }

        if (isRecording || isProcessing) return;

        cancelarProcesamientoIA();
        isProcessing = false;

        if (temporizadorReinicio) {
            clearTimeout(temporizadorReinicio);
            temporizadorReinicio = null;
        }

        fragmentosConfirmados = [];
        transcripcionInterina = '';
        reiniciosSilencio = 0;
        yaConsolidado = false;
        stopSolicitado = false;
        actualizarTranscripcionUI();

        if (!reconocimiento && !configurarReconocimiento()) {
            toast.mostrar('No se pudo iniciar el reconocimiento de voz en este dispositivo.', 'error', 5000);
            return;
        }

        try {
            isRecording = true;
            pintarBotonDictar('recording');
            reconocimiento.start();
        } catch (error) {
            if (error.name === 'InvalidStateError') {
                console.warn('El reconocimiento ya estaba activo.');
            } else {
                console.error('Error al iniciar el dictado por voz:', error);
                toast.mostrar('No se pudo iniciar el dictado por voz.', 'error');
                resetEstado();
            }
        }
    };

    // Al soltar: corta el micrófono y consolida el texto
    const finalizarDictado = () => {
        if (!isRecording || isProcessing) return;

        isRecording = false;
        isProcessing = true; // bloquea el botón aunque falle el stop()
        pintarBotonDictar('processing');

        stopSolicitado = true; // justo antes de stop(): onresult puede disparar el bypass
        try {
            reconocimiento.stop();
        } catch (error) {
            // Nunca llegó a arrancar: consolidamos igual lo que haya
            consolidarYProcesar();
        }
    };

    // Une final + interino y recién ahí dispara el fetch a la IA
    const consolidarYProcesar = () => {
        if (yaConsolidado) return;
        yaConsolidado = true;

        if (temporizadorReinicio) {
            clearTimeout(temporizadorReinicio);
            temporizadorReinicio = null;
        }

        // Flushea interino si quedó
        if (transcripcionInterina) {
            const ultimo = fragmentosConfirmados[fragmentosConfirmados.length - 1];
            if (!(ultimo && ultimo === transcripcionInterina)) {
                fragmentosConfirmados.push(transcripcionInterina);
            }
            transcripcionInterina = '';
        }

        const texto = fragmentosConfirmados.join(' ').replace(/\s+/g, ' ').trim();

        isRecording = false;
        stopSolicitado = false;

        if (!texto) {
            toast.mostrar('No escuché nada. Probá de nuevo.', 'error');
            resetEstado();
            return;
        }

        isProcessing = true;
        pintarBotonDictar('processing');
        procesarConIA(texto);
    };

    // ==========================================
    // PUSH-TO-TALK: mantener presionado graba, soltar procesa
    // ==========================================
    // Algunos móviles disparan eventos de mouse "sintéticos" después del touch.
    // Si no los ignoramos, al soltar se reabriría el micrófono.
    let ultimoTouch = 0;
    const esMouseSintetico = () => Date.now() - ultimoTouch < 700;

    const alPresionar = (e) => {
        e.preventDefault(); // evita selección de texto, zoom y menú contextual

        if (e.type === 'touchstart') {
            ultimoTouch = Date.now();
        } else if (e.type === 'mousedown' && esMouseSintetico()) {
            return;
        }

        if (isProcessing) return; // evita envíos simultáneos
        iniciarDictado();
    };

    const alSoltar = (e) => {
        if (!isRecording) return;

        if (e.type.startsWith('touch')) {
            ultimoTouch = Date.now();
            e.preventDefault?.();
        } else if (e.type.startsWith('mouse') && esMouseSintetico()) {
            return;
        }

        finalizarDictado();
    };

    btnDictar?.addEventListener('mousedown', alPresionar);
    btnDictar?.addEventListener('touchstart', alPresionar, { passive: false });

    document.addEventListener('mouseup', alSoltar);
    document.addEventListener('touchend', alSoltar, { passive: false });
    document.addEventListener('touchcancel', alSoltar, { passive: false });

    // El long-press en móvil puede abrir el menú contextual aunque touchstart
    // tenga preventDefault(); lo bloqueamos explícitamente.
    btnDictar?.addEventListener('contextmenu', (e) => e.preventDefault());

    // Accesibilidad: misma semántica push-to-talk con el teclado
    btnDictar?.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (e.repeat) return;
        alPresionar(e);
    });

    btnDictar?.addEventListener('keyup', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        alSoltar(e);
    });

    if (window.lucide) window.lucide.createIcons();

    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('.btn-primary');
            btn.disabled = true;
            btn.textContent = "Guardando...";

            try {
                const catElegida = selectCategoria?.value
                    ? selectCategoria.options[selectCategoria.selectedIndex]?.text || ''
                    : '';
                const metodoPago = document.getElementById('metodo-pago').value;
                const esCuotas = document.getElementById('check-es-cuotas')?.checked || false;
                const cantidadCuotas = document.getElementById('input-cantidad-cuotas')?.value || '';
                const postCierre = document.getElementById('check-post-cierre')?.checked || false;

                let textoReferencia = "";
                if (grupoReferencia && grupoReferencia.style.display === 'block' && inputReferencia) {
                    textoReferencia = inputReferencia.value.trim();
                }

                const validacion = FormService.validarFormulario({
                    monto: inputMontoGlobal.value,
                    categoria: catElegida,
                    categoriaValor: selectCategoria?.value || '',
                    metodoPago,
                    esCuotas,
                    cantidadCuotas
                });

                if (!validacion.valido) {
                    toast.mostrar(validacion.errores[0]);
                    return;
                }

                const { currentUserIdGlobal, ambitoActual, hogarId, arrayInventario } = store.getState();
                const tipo = FormService.determinarTipo(ambitoActual);
                const responsable = (ambitoActual === 'hogar')
                    ? selectResponsable.value
                    : currentUserIdGlobal;
                const contexto = FormService.construirContexto(ambitoActual, hogarId);
                const fecha = AppUtils.getFechaLocal();
                const usaCuotas = FormService.esPagoEnCuotas({
                    metodoPago,
                    esCuotas,
                    cantidadCuotas
                });

                if (!usaCuotas) {
                    const nuevoGasto = FormService.construirGasto({
                        fecha,
                        monto: validacion.monto,
                        categoria: catElegida,
                        inventario: arrayInventario,
                        responsable,
                        metodoPago,
                        tipo,
                        referencia: textoReferencia
                    });

                    await api.guardarGasto(nuevoGasto, contexto);
                } else {
                    const gastosCuota = FormService.construirGastosEnCuotas({
                        fecha,
                        montoTotal: validacion.monto,
                        categoria: catElegida,
                        responsable,
                        metodoPago,
                        tipo,
                        referencia: textoReferencia,
                        cantidadCuotas,
                        postCierre,
                        compraId: 'cuotas_' + Date.now()
                    });

                    await Promise.all(
                        gastosCuota.map(gasto => api.guardarGasto(gasto, contexto))
                    );
                }

                toast.mostrar("✅ ¡Gasto guardado!");
                DraftService.limpiarBorrador(currentUserIdGlobal, ambitoActual, hogarId);
                DraftService.limpiarBorradorLegacy();
                formGasto.reset();

                const checkEsCuotas = document.getElementById('check-es-cuotas');
                const divCuotasConfig = document.getElementById('div-cuotas-config');
                if (checkEsCuotas) checkEsCuotas.checked = false;
                if (divCuotasConfig) divCuotasConfig.style.display = 'none';

                if (inputReferencia) inputReferencia.value = '';
                if (grupoReferencia) grupoReferencia.style.display = 'none';

                store.setInventario([]);
                InventarioUI.actualizarVisibilidadSeccion(seccionStockUI, false);

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