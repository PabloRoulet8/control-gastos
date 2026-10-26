import { CategoryService } from "../services/CategoryService.js";
import { FormService } from "../services/FormService.js";
import { AppUtils } from "../utils/AppUtils.js";

const TEXTOS_MICROFONO = {
    idle: 'Mantén presionado para dictar',
    recording: 'Escuchando... (Suelta para procesar)',
    processing: 'Procesando...'
};

const TEXTO_BOTON_GUARDANDO = 'Guardando...';

export class FormUI {
    static renderizarCategorias(selectCategoria, categorias) {
        if (!selectCategoria) return;

        const lista = Array.isArray(categorias) ? categorias : [];
        selectCategoria.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Seleccioná una categoría';
        selectCategoria.appendChild(placeholder);

        lista.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.valor;
            option.textContent = categoria.nombre;
            option.dataset.llevaStock = categoria.lleva_stock;
            option.dataset.esFijo = categoria.es_fijo;
            selectCategoria.appendChild(option);
        });
    }

    static actualizarEstadoMicrofono(btnDictar, btnTexto, estado, dictarHint = null) {
        if (!btnDictar) return;

        const estadoActual = TEXTOS_MICROFONO[estado] ? estado : 'idle';

        btnDictar.classList.toggle('is-listening', estadoActual === 'recording');
        btnDictar.disabled = estadoActual === 'processing';

        if (btnTexto) {
            btnTexto.textContent = TEXTOS_MICROFONO[estadoActual];
        }

        if (dictarHint) {
            dictarHint.hidden = estadoActual !== 'idle';
        }
    }

    static toggleBotonSubmit(btnSubmit, cargando, textoOriginal = 'Guardar Gasto') {
        if (!btnSubmit) return;

        btnSubmit.disabled = Boolean(cargando);
        btnSubmit.textContent = cargando ? TEXTO_BOTON_GUARDANDO : textoOriginal;
    }

    static actualizarVisibilidadElemento(elemento, visible) {
        if (!elemento) return;
        elemento.style.display = visible ? 'block' : 'none';
    }

    static aplicarContextoCarga({
        tituloHeader,
        subtituloHeader,
        grupoResponsable
    } = {}, contexto = {}) {
        if (contexto.titulo && tituloHeader) {
            tituloHeader.textContent = contexto.titulo;
        }

        if (contexto.subtitulo && subtituloHeader) {
            subtituloHeader.textContent = contexto.subtitulo;
        }

        if (typeof contexto.mostrarResponsable === 'boolean') {
            FormUI.actualizarVisibilidadElemento(
                grupoResponsable,
                contexto.mostrarResponsable
            );
        }
    }

    static renderizarResponsables(selectResponsable, responsables = []) {
        if (!selectResponsable) return;

        const lista = Array.isArray(responsables) ? responsables : [];
        selectResponsable.innerHTML = '';

        lista.forEach(responsable => {
            const option = document.createElement('option');
            option.value = responsable.uid;
            option.textContent = responsable.nombre;
            option.selected = Boolean(responsable.seleccionado);
            selectResponsable.appendChild(option);
        });
    }

    static configurarEventosPago({
        selectMetodoPago,
        contenedorOpcionCuotas,
        checkEsCuotas,
        divCuotasConfig,
        inputCantidadCuotas,
        checkPostCierre
    } = {}) {
        const resetear = () => FormUI.resetearCuotas({
            checkEsCuotas,
            divCuotasConfig,
            inputCantidadCuotas,
            checkPostCierre
        });

        if (selectMetodoPago) {
            selectMetodoPago.addEventListener('change', () => {
                const esTarjeta = FormService.admiteCuotas(selectMetodoPago.value);

                FormUI.actualizarVisibilidadElemento(contenedorOpcionCuotas, esTarjeta);

                if (!esTarjeta) resetear();
            });
        }

        if (checkEsCuotas && divCuotasConfig) {
            checkEsCuotas.addEventListener('change', () => {
                FormUI.actualizarVisibilidadElemento(
                    divCuotasConfig,
                    checkEsCuotas.checked
                );

                if (!checkEsCuotas.checked) resetear();
            });
        }
    }

    static resetearCuotas({
        checkEsCuotas,
        divCuotasConfig,
        inputCantidadCuotas,
        checkPostCierre
    } = {}) {
        if (checkEsCuotas) checkEsCuotas.checked = false;
        FormUI.actualizarVisibilidadElemento(divCuotasConfig, false);
        if (inputCantidadCuotas) inputCantidadCuotas.value = '';
        if (checkPostCierre) checkPostCierre.checked = false;
    }

    static aplicarBorrador(guardado, {
        selectCategoria,
        selectMetodoPago,
        inputMonto
    } = {}) {
        if (!guardado) return false;

        if (guardado.categoria && selectCategoria) {
            selectCategoria.value = guardado.categoria;
            selectCategoria.dispatchEvent(new Event('change'));
        }

        if (guardado.metodoPago && selectMetodoPago) {
            selectMetodoPago.value = guardado.metodoPago;
            selectMetodoPago.dispatchEvent(new Event('change'));
        }

        if (guardado.monto && inputMonto) {
            inputMonto.value = guardado.monto;
        }

        return true;
    }

    static configurarEventosCategoria({
        selectCategoria,
        seccionStockUI,
        grupoReferencia
    } = {}) {
        if (!selectCategoria) return;

        selectCategoria.addEventListener('change', () => {
            const option = selectCategoria.options[selectCategoria.selectedIndex];
            if (!option) return;

            const llevaStock = option.dataset.llevaStock === 'true';
            const esFijo = option.dataset.esFijo === 'true';

            FormUI.actualizarVisibilidadElemento(seccionStockUI, llevaStock);
            FormUI.actualizarVisibilidadElemento(
                grupoReferencia,
                FormService.esCategoriaVariable({ esFijo, llevaStock })
            );
        });
    }

    static configurarPushToTalk(btnDictar, {
        onPresionar = () => {},
        onSoltar = () => {},
        estaGrabando = () => false
    } = {}) {
        if (!btnDictar) return null;

        let ultimoTouch = 0;
        const esMouseSintetico = () => Date.now() - ultimoTouch < 700;

        const presionar = (e) => {
            e.preventDefault();

            if (e.type === 'touchstart') {
                ultimoTouch = Date.now();
            } else if (e.type === 'mousedown' && esMouseSintetico()) {
                return;
            }

            onPresionar(e);
        };

        const soltar = (e) => {
            if (!estaGrabando()) return;

            if (e.type.startsWith('touch')) {
                ultimoTouch = Date.now();
                e.preventDefault?.();
            } else if (e.type.startsWith('mouse') && esMouseSintetico()) {
                return;
            }

            onSoltar(e);
        };

        btnDictar.addEventListener('mousedown', presionar);
        btnDictar.addEventListener('touchstart', presionar, { passive: false });

        document.addEventListener('mouseup', soltar);
        document.addEventListener('touchend', soltar, { passive: false });
        document.addEventListener('touchcancel', soltar, { passive: false });

        btnDictar.addEventListener('contextmenu', (e) => e.preventDefault());

        btnDictar.addEventListener('keydown', (e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return;
            e.preventDefault();
            if (e.repeat) return;
            presionar(e);
        });

        btnDictar.addEventListener('keyup', (e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return;
            e.preventDefault();
            soltar(e);
        });

        return { esMouseSintetico };
    }

    static limpiarEcoVisual(texto) {
        if (!texto) return '';

        return texto.replace(
            /\b([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})\s+\1\b/gi,
            '$1'
        ).trim();
    }

    static actualizarTranscripcion(elemento, {
        fragmentosConfirmados = [],
        transcripcionInterina = ''
    } = {}) {
        if (!elemento) return;

        const base = fragmentosConfirmados.join(' ');
        const textoCrudo = base
            ? (transcripcionInterina ? `${base} ${transcripcionInterina}` : base)
            : (transcripcionInterina || '');
        const texto = FormUI.limpiarEcoVisual(textoCrudo.trim());

        elemento.textContent = texto;
        elemento.hidden = texto === '';
    }

    static aplicarMetodoPagoIA(selectMetodoPago, metodoIA) {
        if (!selectMetodoPago || !metodoIA) return false;

        const normalizar = (texto) => CategoryService.normalizarTexto(texto);
        const objetivo = normalizar(metodoIA);
        const opciones = Array.from(selectMetodoPago.options);

        let opcion = opciones.find(o => normalizar(o.value) === objetivo);

        if (!opcion && objetivo.includes('debito')) {
            opcion = opciones.find(o => normalizar(o.value).includes('efectivo')) || opciones[0];
        }

        if (!opcion && (objetivo.includes('tarjeta') || objetivo.includes('credito'))) {
            opcion = opciones.find(o => normalizar(o.value).includes('tarjeta'));
        }

        if (!opcion) {
            opcion = opciones.find(o => {
                const valor = normalizar(o.value);
                return objetivo.includes(valor) || valor.includes(objetivo);
            });
        }

        if (!opcion) return false;

        selectMetodoPago.value = opcion.value;
        selectMetodoPago.dispatchEvent(new Event('change'));
        return true;
    }

    static aplicarDatosIA({
        datos,
        selectCategoria,
        categoriasDisponibles = [],
        selectMetodoPago,
        inputMonto,
        inputReferencia,
        checkEsCuotas,
        inputCantidadCuotas,
        totalInventario = 0,
        agregarProducto = null
    } = {}) {
        if (!datos || typeof datos !== 'object') {
            return {
                valido: false,
                completados: [],
                avisos: [{ mensaje: 'La IA no devolvió datos utilizables.', tipo: 'error' }],
                agregoInventario: false
            };
        }

        const completados = [];
        const avisos = [];
        let agregoInventario = false;

        const monto = typeof datos.monto === 'number' ? datos.monto : parseFloat(datos.monto);
        if (!isNaN(monto) && monto > 0 && inputMonto) {
            if (totalInventario > 0) {
                avisos.push({
                    mensaje: 'Hay productos con precio: el monto se calcula solo.',
                    tipo: 'info'
                });
            } else {
                const montoAnterior = parseFloat(inputMonto.value) || 0;
                inputMonto.value = AppUtils.sumarMontos(montoAnterior, monto).toFixed(2);
                inputMonto.readOnly = false;
                completados.push('monto');
            }
        }

        const categoriaIA = CategoryService.buscarCategoria(
            datos.categoria,
            categoriasDisponibles
        );
        if (categoriaIA && selectCategoria) {
            selectCategoria.value = categoriaIA.valor;
            selectCategoria.dispatchEvent(new Event('change'));
            completados.push('categoría');
        } else if (datos.categoria) {
            avisos.push({
                mensaje: `No encontré la categoría "${datos.categoria}". Elegila a mano.`,
                tipo: 'error',
                duracion: 5000
            });
        }

        if (FormUI.aplicarMetodoPagoIA(selectMetodoPago, datos.metodo_pago)) {
            completados.push('método de pago');
        }

        if (datos.referencia && inputReferencia) {
            inputReferencia.value = String(datos.referencia).trim();
            completados.push('referencia');
        }

        const cuotas = parseInt(datos.cuotas, 10);
        const esTarjetaCredito = selectMetodoPago?.value === FormService.METODO_PAGO_TARJETA_CREDITO;
        if (esTarjetaCredito && Number.isInteger(cuotas) && cuotas > 1 && inputCantidadCuotas) {
            const cuotasValidas = Math.min(cuotas, FormService.MAX_CUOTAS);
            if (checkEsCuotas) {
                checkEsCuotas.checked = true;
                checkEsCuotas.dispatchEvent(new Event('change'));
            }
            inputCantidadCuotas.value = cuotasValidas;
            completados.push(`${cuotasValidas} cuotas`);
        }

        if (Array.isArray(datos.detalle_inventario) && datos.detalle_inventario.length > 0) {
            let agregados = 0;

            datos.detalle_inventario.forEach(item => {
                if (!item || typeof agregarProducto !== 'function') return;

                const ok = agregarProducto({
                    producto: item.producto,
                    cantidad: item.cantidad,
                    unidad: item.unidad,
                    precio: item.precio
                });

                if (ok) agregados++;
            });

            if (agregados > 0) {
                agregoInventario = true;
                completados.push(`${agregados} producto(s)`);
            }
        }

        return { valido: true, completados, avisos, agregoInventario };
    }

    static leerDatosGasto({
        selectCategoria,
        selectMetodoPago,
        inputMonto,
        inputReferencia,
        grupoReferencia,
        checkEsCuotas,
        inputCantidadCuotas,
        checkPostCierre
    } = {}) {
        const categoria = selectCategoria?.value
            ? selectCategoria.options[selectCategoria.selectedIndex]?.text || ''
            : '';
        const categoriaValor = selectCategoria?.value || '';
        const metodoPago = selectMetodoPago?.value || '';
        const esCuotas = checkEsCuotas?.checked || false;
        const cantidadCuotas = inputCantidadCuotas?.value || '';
        const postCierre = checkPostCierre?.checked || false;

        let referencia = '';
        if (grupoReferencia && grupoReferencia.style.display === 'block' && inputReferencia) {
            referencia = inputReferencia.value.trim();
        }

        return {
            monto: inputMonto?.value || '',
            categoria,
            categoriaValor,
            metodoPago,
            esCuotas,
            cantidadCuotas,
            postCierre,
            referencia
        };
    }

    static limpiarFormularioGasto({
        formGasto,
        inputMonto,
        inputReferencia,
        grupoReferencia,
        seccionStockUI,
        checkEsCuotas,
        divCuotasConfig,
        inputCantidadCuotas,
        checkPostCierre
    } = {}) {
        if (formGasto) formGasto.reset();
        if (inputMonto) {
            inputMonto.value = '';
            inputMonto.readOnly = false;
        }
        if (inputReferencia) inputReferencia.value = '';
        FormUI.actualizarVisibilidadElemento(grupoReferencia, false);
        FormUI.actualizarVisibilidadElemento(seccionStockUI, false);
        FormUI.resetearCuotas({
            checkEsCuotas,
            divCuotasConfig,
            inputCantidadCuotas,
            checkPostCierre
        });
    }

    static configurarModalLimpiar({
        modal,
        btnAbrir,
        btnCancelar,
        btnConfirmar,
        onConfirmar = () => {}
    } = {}) {
        if (!modal) {
            return { abrir: () => {}, cerrar: () => {} };
        }

        let focoPrevio = null;

        const cerrar = () => {
            modal.style.display = 'none';
            if (focoPrevio && typeof focoPrevio.focus === 'function') {
                focoPrevio.focus();
            }
            focoPrevio = null;
        };

        const abrir = () => {
            focoPrevio = document.activeElement;
            modal.style.display = 'flex';
            btnCancelar?.focus();
        };

        btnAbrir?.addEventListener('click', abrir);
        btnCancelar?.addEventListener('click', cerrar);

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cerrar();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusables = modal.querySelectorAll(
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

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrar();
        });

        btnConfirmar?.addEventListener('click', () => {
            onConfirmar();
        });

        return { abrir, cerrar };
    }
}
