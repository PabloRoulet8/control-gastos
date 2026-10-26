import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { DraftService } from "./services/DraftService.js";
import { InventarioService } from "./services/InventarioService.js";
import { CategoryService } from "./services/CategoryService.js";
import { CargaContextService } from "./services/CargaContextService.js";
import { GastoSaveService } from "./services/GastoSaveService.js";
import { IAService } from "./services/IAService.js";
import { VoiceService } from "./services/VoiceService.js";
import { CargaStore } from "./store/CargaStore.js";
import { InventarioUI } from "./ui/InventarioUI.js";
import { FormUI } from "./ui/FormUI.js";

const API_IA_URL = 'https://control-gastos-backend-o6nv.onrender.com/api/procesar-gasto';
const API_IA_PING_URL = new URL('/', API_IA_URL).href;

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const contextService = new CargaContextService({ repository: api });
    const saveService = new GastoSaveService({ repository: api });
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
    const selectMetodoPago = document.getElementById('metodo-pago');
    const tituloHeader = document.getElementById('titulo-header');
    const subtituloHeader = document.querySelector('.container h2');
    const grupoResponsable = document.getElementById('responsable-group');
    const grupoReferencia = document.getElementById('referencia-group');
    const inputMontoGlobal = document.getElementById('monto');
    const inputReferencia = document.getElementById('referencia');
    const listaUI = document.getElementById('lista-inventario');
    const seccionStockUI = document.getElementById('seccion-inventario');
    const formGasto = document.getElementById('expense-form');
    const contenedorOpcionCuotas = document.getElementById('contenedor-opcion-cuotas');
    const checkEsCuotas = document.getElementById('check-es-cuotas');
    const divCuotasConfig = document.getElementById('div-cuotas-config');
    const inputCantidadCuotas = document.getElementById('input-cantidad-cuotas');
    const checkPostCierre = document.getElementById('check-post-cierre');
    const btnDictar = document.getElementById('btn-dictar-gasto');
    const btnDictarTexto = btnDictar?.querySelector('.btn-dictar-texto');
    const dictadoTranscripcion = document.getElementById('dictado-transcripcion');
    const dictarHint = document.querySelector('.dictar-hint');
    const inputInvProducto = document.getElementById('inv-prod');
    const inputInvCantidad = document.getElementById('inv-cant');
    const inputInvPrecio = document.getElementById('inv-precio');
    const inputInvUnidad = document.getElementById('inv-unid');

    const contextoInicial = store.getState();
    NavigationBuilder.buildConfigButton(contextoInicial.ambitoActual, contextoInicial.hogarId);
    NavigationBuilder.buildNav(contextoInicial.ambitoActual, contextoInicial.hogarId, 'carga');

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
                metodoPago: selectMetodoPago?.value || 'efectivo'
            }
        );
        if (!guardado) {
            toast.mostrar('No se pudo guardar el borrador automático.', 'error');
        }
    };

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

    const solicitarPermisoMicrofonoInicial = async () => {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.warn('Permiso de micrófono denegado o ignorado:', error?.name || error);
        }
    };

    const inicializarPagina = async (userId) => {
        store.setContexto({ currentUserIdGlobal: userId });
        const { ambitoActual, hogarId, hogarNombre } = store.getState();

        fetch(API_IA_PING_URL, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store'
        }).catch(() => {});

        if (ambitoActual === 'personal') {
            FormUI.actualizarVisibilidadElemento(grupoResponsable, false);
        }

        try {
            const contexto = await contextService.cargar({
                userId,
                ambitoActual,
                hogarId,
                hogarNombre
            });

            if (Array.isArray(contexto.categorias)) {
                store.setCategorias(contexto.categorias);
            }

            FormUI.aplicarContextoCarga({
                tituloHeader,
                subtituloHeader,
                grupoResponsable
            }, contexto);

            if (contexto.hogar) {
                const responsables = await contextService.cargarResponsables(
                    contexto.miembros,
                    userId
                );

                FormUI.renderizarResponsables(selectResponsable, responsables);
            }

            DraftService.limpiarBorradorLegacy();
            const guardado = DraftService.cargarBorrador(
                store.getState().currentUserIdGlobal,
                ambitoActual,
                hogarId
            );

            if (guardado) {
                FormUI.aplicarBorrador(guardado, {
                    selectCategoria,
                    selectMetodoPago,
                    inputMonto: inputMontoGlobal
                });

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

        if (changed.includes('listaCategorias')) {
            const { listaCategorias } = store.getState();

            FormUI.renderizarCategorias(
                selectCategoria,
                CategoryService.prepararCategorias(listaCategorias)
            );
        }
    });

    let isProcessing = false;
    let abortControllerIA = null;
    let idProcesamientoIA = 0;

    const cancelarProcesamientoIA = () => {
        idProcesamientoIA += 1;
        if (abortControllerIA) {
            abortControllerIA.abort();
            abortControllerIA = null;
        }
    };

    const actualizarTranscripcionUI = (snapshot = null) => {
        const estado = snapshot || voiceService.getSnapshot();
        FormUI.actualizarTranscripcion(dictadoTranscripcion, estado);
    };

    const resetEstado = () => {
        isProcessing = false;
        voiceService.reset();
        actualizarTranscripcionUI();
        FormUI.actualizarEstadoMicrofono(btnDictar, btnDictarTexto, 'idle', dictarHint);
    };

    const aplicarDatosIA = (datos) => {
        const { listaCategorias, arrayInventario } = store.getState();
        const resultado = FormUI.aplicarDatosIA({
            datos,
            selectCategoria,
            categoriasDisponibles: CategoryService.prepararCategorias(listaCategorias),
            selectMetodoPago,
            inputMonto: inputMontoGlobal,
            inputReferencia,
            checkEsCuotas,
            inputCantidadCuotas,
            totalInventario: InventarioService.calcularTotal(arrayInventario),
            agregarProducto: item => agregarProductoInventario(item)
        });

        resultado.avisos.forEach(aviso => {
            toast.mostrar(aviso.mensaje, aviso.tipo || 'info', aviso.duracion || 4000);
        });

        if (resultado.agregoInventario) {
            InventarioUI.actualizarVisibilidadSeccion(seccionStockUI, true);
            guardarBorradorStock();
        }

        if (resultado.completados.length > 0) {
            toast.mostrar(`✅ Listo: ${resultado.completados.join(', ')}. Revisá y guardá.`, 'success');
        }
    };

    const procesarConIA = async (texto) => {
        const idProcesamiento = ++idProcesamientoIA;

        if (abortControllerIA) {
            abortControllerIA.abort();
            abortControllerIA = null;
        }

        console.log('[IA] Texto consolidado enviado:', JSON.stringify(texto));
        toast.mostrar(`🎤 Enviado: "${texto}" — procesando...`, 'info', 4000);

        const categoriasDisponibles = CategoryService
            .prepararCategorias(store.getState().listaCategorias)
            .map(cat => cat.valor);

        const controller = new AbortController();
        abortControllerIA = controller;
        const inicioFetch = performance.now();

        try {
            const datos = await IAService.procesarTexto({
                texto,
                categoriasDisponibles,
                signal: controller.signal,
                auth,
                apiUrl: API_IA_URL,
                timeoutMs: 45000
            });

            if (idProcesamiento !== idProcesamientoIA) return;

            aplicarDatosIA(datos);
        } catch (error) {
            if (idProcesamiento !== idProcesamientoIA) return;

            console.error('Error al procesar el gasto con IA:', error);
            toast.mostrar(`❌ ${IAService.obtenerMensajeError(error)}`, 'error', 6000);
        } finally {
            console.log(`[IA] Fetch completado en ${Math.round(performance.now() - inicioFetch)} ms`);

            if (abortControllerIA === controller) {
                abortControllerIA = null;
            }

            if (idProcesamiento === idProcesamientoIA) {
                resetEstado();
            }
        }
    };

    const consolidarYProcesar = () => {
        if (voiceService.yaConsolidado) return;

        voiceService.marcarConsolidado();
        const texto = voiceService.obtenerTextoConsolidado();
        actualizarTranscripcionUI();

        if (!texto) {
            toast.mostrar('No escuché nada. Probá de nuevo.', 'error');
            resetEstado();
            return;
        }

        isProcessing = true;
        FormUI.actualizarEstadoMicrofono(btnDictar, btnDictarTexto, 'processing', dictarHint);
        procesarConIA(texto);
    };

    const iniciarDictado = () => {
        if (!voiceService.isSupported()) {
            toast.mostrar('Tu navegador no soporta reconocimiento de voz. Probá con Chrome o Edge.', 'error', 6000);
            return;
        }

        if (voiceService.isRecording || isProcessing) return;

        cancelarProcesamientoIA();
        isProcessing = false;

        if (!voiceService.iniciar()) {
            toast.mostrar('No se pudo iniciar el reconocimiento de voz en este dispositivo.', 'error', 5000);
        }
    };

    const finalizarDictado = () => {
        if (!voiceService.isRecording || isProcessing) return;

        isProcessing = true;
        voiceService.detener();
    };

    const voiceService = new VoiceService({
        lang: 'es-AR',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        reinicioDemoraMs: 300,
        onStateChange: (estado) => {
            FormUI.actualizarEstadoMicrofono(
                btnDictar,
                btnDictarTexto,
                estado,
                dictarHint
            );
        },
        onInterim: (snapshot) => {
            actualizarTranscripcionUI(snapshot);
        },
        onFinal: (snapshot) => {
            actualizarTranscripcionUI(snapshot);
        },
        onReadyToConsolidate: () => {
            consolidarYProcesar();
        },
        onError: (codigo) => {
            console.warn('Error de reconocimiento de voz:', codigo);
        },
        onFatalError: (codigo) => {
            const mensajes = {
                'not-allowed': 'Permiso de micrófono denegado. Habilitalo en el navegador.',
                'service-not-allowed': 'El navegador bloqueó el servicio de voz.',
                'audio-capture': 'No se encontró un micrófono disponible.',
                'start-failed': 'No se pudo iniciar el dictado por voz.'
            };
            toast.mostrar(mensajes[codigo] || 'Error con el reconocimiento de voz.', 'error', 5000);
            cancelarProcesamientoIA();
            resetEstado();
        }
    });

    const limpiarTodo = () => {
        const { currentUserIdGlobal, ambitoActual, hogarId } = store.getState();

        cancelarProcesamientoIA();
        isProcessing = false;
        voiceService.abortar();
        actualizarTranscripcionUI();
        FormUI.actualizarEstadoMicrofono(btnDictar, btnDictarTexto, 'idle', dictarHint);

        DraftService.limpiarBorrador(currentUserIdGlobal, ambitoActual, hogarId);
        DraftService.limpiarBorradorLegacy();
        FormUI.limpiarFormularioGasto({
            formGasto,
            inputMonto: inputMontoGlobal,
            inputReferencia,
            grupoReferencia,
            seccionStockUI,
            checkEsCuotas,
            divCuotasConfig,
            inputCantidadCuotas,
            checkPostCierre
        });

        store.setInventario([]);
        toast.mostrar('Inventario y formulario limpiados.', 'info');
    };

    const modalLimpiarUI = FormUI.configurarModalLimpiar({
        modal: document.getElementById('modal-limpiar'),
        btnAbrir: document.getElementById('btn-limpiar-todo'),
        btnCancelar: document.getElementById('btn-cancelar-limpiar'),
        btnConfirmar: document.getElementById('btn-confirmar-limpiar'),
        onConfirmar: () => {
            limpiarTodo();
            modalLimpiarUI.cerrar();
        }
    });

    FormUI.configurarEventosCategoria({
        selectCategoria,
        seccionStockUI,
        grupoReferencia
    });

    FormUI.configurarEventosPago({
        selectMetodoPago,
        contenedorOpcionCuotas,
        checkEsCuotas,
        divCuotasConfig,
        inputCantidadCuotas,
        checkPostCierre
    });

    InventarioUI.configurarAltaRapida({
        btnAgregar: document.getElementById('btn-add-inv'),
        inputProducto: inputInvProducto,
        inputCantidad: inputInvCantidad,
        inputPrecio: inputInvPrecio,
        inputUnidad: inputInvUnidad,
        onAgregar: item => {
            agregarProductoInventario(item);
            guardarBorradorStock();
        },
        onError: mensaje => toast.mostrar(mensaje)
    });

    FormUI.configurarPushToTalk(btnDictar, {
        onPresionar: () => {
            if (isProcessing) return;
            iniciarDictado();
        },
        onSoltar: () => {
            finalizarDictado();
        },
        estaGrabando: () => voiceService.isRecording
    });

    if (window.lucide) window.lucide.createIcons();

    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!navigator.onLine) {
                toast.mostrar(
                    'Sin conexión: el gasto se guardará localmente y se sincronizará automáticamente al recuperar internet.',
                    'warning',
                    5000
                );
            }

            const btn = e.target.querySelector('.btn-primary');
            const textoOriginal = btn?.textContent || 'Guardar Gasto';
            FormUI.toggleBotonSubmit(btn, true, textoOriginal);

            try {
                const datosFormulario = FormUI.leerDatosGasto({
                    selectCategoria,
                    selectMetodoPago,
                    inputMonto: inputMontoGlobal,
                    inputReferencia,
                    grupoReferencia,
                    checkEsCuotas,
                    inputCantidadCuotas,
                    checkPostCierre
                });

                const {
                    currentUserIdGlobal,
                    ambitoActual,
                    hogarId,
                    arrayInventario
                } = store.getState();

                if (ambitoActual === 'hogar') {
                    datosFormulario.responsable = selectResponsable?.value || '';
                }

                const resultado = await saveService.guardar({
                    datosFormulario,
                    contexto: { ambitoActual, hogarId },
                    userId: currentUserIdGlobal,
                    inventario: arrayInventario
                });

                if (!resultado.guardado) {
                    toast.mostrar(resultado.errores[0]);
                    return;
                }

                toast.mostrar("✅ ¡Gasto guardado!");
                DraftService.limpiarBorrador(currentUserIdGlobal, ambitoActual, hogarId);
                DraftService.limpiarBorradorLegacy();
                FormUI.limpiarFormularioGasto({
                    formGasto,
                    inputMonto: inputMontoGlobal,
                    inputReferencia,
                    grupoReferencia,
                    seccionStockUI,
                    checkEsCuotas,
                    divCuotasConfig,
                    inputCantidadCuotas,
                    checkPostCierre
                });

                store.setInventario([]);
            } catch (err) {
                console.error(err);
                toast.mostrar("❌ Error al guardar");
            } finally {
                FormUI.toggleBotonSubmit(btn, false, textoOriginal);
            }
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) inicializarPagina(user.uid);
    });
});
