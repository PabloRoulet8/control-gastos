import { FormService } from "../services/FormService.js";

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
}
