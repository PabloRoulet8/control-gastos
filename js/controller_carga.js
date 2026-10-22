import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";
import { AppUtils } from "./utils/AppUtils.js";

// Backend de IA (procesamiento del gasto dictado)
const API_IA_URL = 'https://control-gastos-backend-o6nv.onrender.com/api/procesar-gasto';

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

    // Lista estándar de rubros. El value se normaliza en llenarSelectCategorias()
    // (minúsculas y sin tildes): "Carnicería" -> "carniceria".
    const CATEGORIAS_ESTANDAR = [
        'Supermercado', 'Carnicería', 'Fiambrería', 'Verdulería', 'Panadería',
        'Farmacia', 'Hogar', 'Transporte', 'Salidas', 'Delivery', 'Otros'
    ];

    const categoriasEstandar = () => CATEGORIAS_ESTANDAR.map(nombre => ({
        nombre,
        lleva_stock: false,
        es_fijo: false
    }));

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
            const precio = Number(item.precio) || 0;
            totalAcumulado += precio;

            const li = document.createElement('li');
            li.className = 'flex-between p-10 border-bottom-gray';
            li.innerHTML = `
                <span><strong>${item.producto}</strong> (${item.cantidad} ${item.unidad})</span>
                <div class="flex-center inv-item-acciones">
                    <strong>$${precio.toLocaleString('es-AR')}</strong>
                    <button
                        type="button"
                        class="btn-icon-danger btn-delete-item"
                        data-index="${index}"
                        title="Eliminar producto"
                        aria-label="Eliminar producto del inventario">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            listaUI.appendChild(li);
        });

        listaUI.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.onclick = (e) => {
                const idx = Number(e.currentTarget.dataset.index);
                if (!Number.isInteger(idx) || idx < 0 || idx >= arrayInventario.length) return;

                arrayInventario.splice(idx, 1);

                // Redibuja la lista y dispara 'change' sobre #lista-inventario
                actualizarListaInventarioUI();
                guardarBorradorStock();
            };
        });

        // Al reescribir el innerHTML se pierden los SVG de lucide: hay que
        // volver a renderizarlos para que el botón de eliminar sea visible.
        window.lucide?.createIcons();

        if (arrayInventario.length > 0) {
            // Si los ítems no traen precio (ej. los inyecta la IA), no pisamos
            // el monto que ya cargó el usuario o la IA.
            if (totalAcumulado > 0) {
                inputMontoGlobal.value = totalAcumulado.toFixed(2);
            }
            inputMontoGlobal.readOnly = true;
        } else {
            inputMontoGlobal.readOnly = false;
        }

        // Avisamos que el estado del inventario/monto cambió para que la app
        // pueda reaccionar (recalcular totales, etc.).
        if (inputMontoGlobal) {
            inputMontoGlobal.dispatchEvent(new Event('input', { bubbles: true }));
            inputMontoGlobal.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (listaUI) {
            listaUI.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    // Normaliza la unidad que devuelve la IA a las opciones del select de inventario
    const normalizarUnidadInventario = (unidad) => {
        const u = String(unidad || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return 'kg';
        if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return 'litro';
        if (['pack', 'paquete', 'paquetes'].includes(u)) return 'pack';
        return 'unid';
    };

    // Lógica única para agregar un producto al inventario (manual o por IA)
    const agregarProductoInventario = ({ producto, cantidad, unidad, precio = 0 }) => {
        const nombre = String(producto || '').trim();
        const cant = parseFloat(cantidad);
        const precioNum = parseFloat(precio);

        if (!nombre || !Number.isFinite(cant) || cant <= 0) return false;

        const nombreLimpio = nombre.charAt(0).toUpperCase() + nombre.slice(1);

        arrayInventario.push({
            producto: nombreLimpio,
            cantidad: cant,
            unidad: normalizarUnidadInventario(unidad),
            precio: Number.isFinite(precioNum) ? precioNum : 0
        });

        return true;
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
                    listaCategorias = categoriasEstandar();
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
                    if (listaCategorias.length === 0) {
                        listaCategorias = categoriasEstandar();
                    }
                    
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

        agregarProductoInventario({ producto: prod, cantidad: cant, unidad: unid, precio });

        document.getElementById('inv-prod').value = '';
        document.getElementById('inv-cant').value = '';
        document.getElementById('inv-precio').value = '';

        actualizarListaInventarioUI();
        guardarBorradorStock();
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
    let isRecording = false;        // el micrófono está activo
    let isProcessing = false;       // hay un fetch a la IA en curso (o finalizando)
    let yaConsolidado = false;      // evita consolidar/enviar dos veces el mismo dictado
    let stopSolicitado = false;     // el usuario tocó "finalizar"
    let reiniciosSilencio = 0;      // cortes automáticos consecutivos sin voz

    let reconocimiento = null;
    let temporizadorReinicio = null;
    let transcripcionFinal = '';    // resultados ya consolidados por el motor
    let transcripcionInterina = ''; // lo que el motor está interpretando ahora

    // Normaliza texto para comparar (minúsculas y sin acentos)
    const normalizar = (texto) => (texto || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Busca la categoría del select que mejor corresponde a lo que devolvió la IA
    const buscarCategoriaIA = (nombreIA) => {
        if (!selectCategoria || !nombreIA) return null;

        const objetivo = normalizar(nombreIA);
        if (!objetivo) return null;

        const opciones = Array.from(selectCategoria.options).filter(o => o.value);
        if (opciones.length === 0) return null;

        // 1) Coincidencia exacta contra el value o el texto visible
        let opcion = opciones.find(o =>
            normalizar(o.value) === objetivo || normalizar(o.textContent) === objetivo
        );
        if (opcion) return opcion;

        // 2) Una opción está contenida en la respuesta de la IA (o al revés)
        opcion = opciones.find(o => {
            const valor = normalizar(o.value);
            const texto = normalizar(o.textContent);
            return objetivo.includes(valor) || objetivo.includes(texto) ||
                   valor.includes(objetivo) || texto.includes(objetivo);
        });
        if (opcion) return opcion;

        // 3) Coincidencia por palabras compartidas ("gasto de supermercado" -> "Supermercado")
        const palabras = objetivo.split(/[\s,._-]+/).filter(p => p.length > 3);
        if (palabras.length > 0) {
            opcion = opciones.find(o => {
                const tokens = new Set(normalizar(`${o.value} ${o.textContent}`).split(/[\s,._-]+/));
                return palabras.some(p => tokens.has(p));
            });
            if (opcion) return opcion;
        }

        return null;
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
            if (arrayInventario.length > 0) {
                toast.mostrar('Hay productos cargados: el monto se calcula solo.', 'info');
            } else {
                inputMontoGlobal.value = monto;
                inputMontoGlobal.readOnly = false;
                completados.push('monto');
            }
        }

        // Categoría
        const opcionCategoria = buscarCategoriaIA(datos.categoria);
        if (opcionCategoria) {
            selectCategoria.value = opcionCategoria.value;
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
                // La sección suele estar oculta si la categoría no lleva stock:
                // la mostramos para que los artículos inyectados se vean.
                const seccionStock = document.getElementById('seccion-inventario');
                if (seccionStock) seccionStock.style.display = 'block';

                // Redibuja las filas, recalcula el total y dispara 'input'/'change'
                actualizarListaInventarioUI();
                guardarBorradorStock();

                completados.push(`${agregados} producto(s)`);
            }
        }

        if (completados.length > 0) {
            toast.mostrar(`✅ Listo: ${completados.join(', ')}. Revisá y guardá.`, 'success');
        }
    };

    // Muestra la transcripción en vivo (consolidado + lo que se está interpretando)
    const actualizarTranscripcionUI = () => {
        if (!dictadoTranscripcion) return;

        const texto = `${transcripcionFinal} ${transcripcionInterina}`.replace(/\s+/g, ' ').trim();
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
        isRecording = false;
        isProcessing = false;
        yaConsolidado = false;
        stopSolicitado = false;
        reiniciosSilencio = 0;
        transcripcionFinal = '';
        transcripcionInterina = '';

        if (temporizadorReinicio) {
            clearTimeout(temporizadorReinicio);
            temporizadorReinicio = null;
        }

        actualizarTranscripcionUI();
        pintarBotonDictar('idle');
    };

    // Envía el texto transcrito al backend de IA y completa el formulario
    const procesarConIA = async (texto) => {
        toast.mostrar('Procesando con IA...', 'info');

        // Mandamos las categorías reales del select para que la IA elija una y no invente nombres
        const categoriasDisponibles = selectCategoria
            ? Array.from(selectCategoria.options).filter(o => o.value).map(o => o.value)
            : [];

        // Medimos desde que sale el request hasta que el JSON está resuelto.
        // (No incluye el pintado del formulario posterior.)
        let fetchMedido = false;
        const terminarTiempoFetch = () => {
            if (fetchMedido) return;
            fetchMedido = true;
            console.timeEnd('Tiempo Fetch');
        };

        console.time('Tiempo Fetch');

        try {
            const respuesta = await fetch(API_IA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, categorias: categoriasDisponibles })
            });

            if (!respuesta.ok) {
                const detalle = await respuesta.json().catch(() => null);
                throw new Error(detalle?.error || `El servidor de IA respondió ${respuesta.status}`);
            }

            const datos = await respuesta.json();
            terminarTiempoFetch();
            aplicarDatosIA(datos);

        } catch (error) {
            terminarTiempoFetch();
            console.error('Error al procesar el gasto con IA:', error);
            const mensaje = error?.name === 'TypeError'
                ? 'No se pudo conectar con el servidor de IA. ¿Está corriendo en localhost:3000?'
                : (error?.message || 'No se pudo procesar el gasto con IA.');
            toast.mostrar(`❌ ${mensaje}`, 'error', 6000);
        } finally {
            resetEstado();
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
        reconocimiento.continuous = true;       // soporta pausas sin cortar el dictado
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
            let interino = '';
            let huboFinal = false;

            for (let i = evento.resultIndex; i < evento.results.length; i++) {
                const resultado = evento.results[i];
                const texto = resultado[0]?.transcript || '';

                if (resultado.isFinal) {
                    transcripcionFinal += `${texto} `;
                    reiniciosSilencio = 0; // volvió a hablar: resetea los cortes por silencio
                    huboFinal = true;
                } else {
                    interino += `${texto} `;
                }
            }

            transcripcionInterina = interino.trim();
            actualizarTranscripcionUI();

            // Bypass de onend: si el usuario ya soltó y este bloque quedó final
            // (sin interino pendiente), disparamos el fetch de inmediato.
            if (stopSolicitado && huboFinal && !transcripcionInterina) {
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
            // Si el texto ya se envió desde onresult, onend NO vuelve a enviar:
            // solo apaga el micrófono y limpia el estado de grabación. El fetch
            // en curso hace el reset final cuando termina.
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

            // Fallback: el usuario soltó y el motor terminó sin entregar un
            // bloque final (ej. no hubo audio reconocible).
            if (stopSolicitado) {
                consolidarYProcesar();
                return;
            }

            if (!isRecording) return;

            // El navegador cortó solo (pausa larga o red): reconectamos sin perder lo dicho
            if (reiniciosSilencio < MAX_REINICIOS_SILENCIO) {
                reiniciosSilencio++;
                console.debug(`Reconocimiento cortado solo (${reiniciosSilencio}/${MAX_REINICIOS_SILENCIO}). Reintentando...`);

                temporizadorReinicio = setTimeout(() => {
                    if (!isRecording || stopSolicitado) return;

                    // Lo parcial que quedó colgado pasa a final antes de reconectar
                    if (transcripcionInterina) {
                        transcripcionFinal += `${transcripcionInterina} `;
                        transcripcionInterina = '';
                        actualizarTranscripcionUI();
                    }

                    try { reconocimiento.start(); } catch (e) { /* ya está iniciado */ }
                }, REINICIO_DEMORA_MS);
                return;
            }

            // Demasiados cortes seguidos: finalizamos con lo que haya
            // (ya estamos en onend, no hace falta volver a llamar a stop())
            stopSolicitado = true;
            isRecording = false;
            isProcessing = true;
            pintarBotonDictar('processing');
            consolidarYProcesar();
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

        transcripcionFinal = '';
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

        const texto = `${transcripcionFinal} ${transcripcionInterina}`.replace(/\s+/g, ' ').trim();

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
        if (e.type.startsWith('touch')) {
            ultimoTouch = Date.now();
            e.preventDefault();
        } else if (e.type.startsWith('mouse') && esMouseSintetico()) {
            return;
        }

        finalizarDictado();
    };

    btnDictar?.addEventListener('mousedown', alPresionar);
    btnDictar?.addEventListener('touchstart', alPresionar, { passive: false });

    btnDictar?.addEventListener('mouseup', alSoltar);
    btnDictar?.addEventListener('mouseleave', alSoltar);
    btnDictar?.addEventListener('touchend', alSoltar, { passive: false });
    btnDictar?.addEventListener('touchcancel', alSoltar, { passive: false });

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