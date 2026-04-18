import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ModalManager } from "./ui/ModalManager.js";
import { auth } from "./firebase-config.js"; 
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const modalCategoria = new ModalManager('custom-prompt', 'custom-prompt-input', 'custom-prompt-confirm', 'custom-prompt-cancel');

    // 1. LEER LA URL PARA SABER EL CONTEXTO
    const urlParams = new URLSearchParams(window.location.search);
    const ambitoActual = urlParams.get('ambito') || 'personal'; 
    const hogarId = urlParams.get('id');
    const hogarNombre = urlParams.get('nombre');

    // MANTENER EL CONTEXTO EN LA BARRA INFERIOR
    document.querySelectorAll('.bottom-nav a').forEach(link => {
        const baseHref = link.getAttribute('href').split('?')[0];
        if (baseHref !== 'index.html') {
            link.href = `${baseHref}?ambito=${ambitoActual}${hogarId ? `&id=${hogarId}` : ''}${hogarNombre ? `&nombre=${encodeURIComponent(hogarNombre)}` : ''}`;
        }
    });

    let listaCategorias = [];
    let arrayInventario = [];

    // Selectores
    const tituloHeader = document.getElementById('titulo-header');
    const selectorTipoGasto = document.getElementById('selector-tipo-gasto');
    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');
    const inputReferencia = document.getElementById('referencia');
    const inputMontoGlobal = document.getElementById('monto');
    const formGasto = document.getElementById('expense-form');
    const selectMetodoPago = document.getElementById('metodo-pago');
    const panelTarjeta = document.getElementById('opciones-tarjeta');
    const selectTitularTarjeta = document.getElementById('titular-tarjeta');
    const inputCuotas = document.getElementById('cantidad-cuotas');
    const selectImpacto = document.getElementById('impacto-cuota');
    
    const grupoResponsable = document.getElementById('responsable-group');
    const grupoFondo = document.getElementById('fondo-group');
    const checkPagadoFondo = document.getElementById('pagado-fondo');

    if (tituloHeader) {
        tituloHeader.textContent = ambitoActual === 'hogar' ? `Hogar: ${hogarNombre}` : 'Gastos Personales';
    }

    // ==========================================
    // LÓGICA DE CATEGORÍAS
    // ==========================================
    const inicializarCategorias = async (userId) => {
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const catNube = await api.obtenerCategorias(contextoId, ambitoActual);

        if (catNube) {
            listaCategorias = catNube;
        } else {
            if (ambitoActual === 'hogar') {
                listaCategorias = ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'];
            } else {
                listaCategorias = ['Ropa', 'Educación', 'Salidas', 'Suscripciones', 'Deportes', 'Otros'];
            }
            await api.guardarCategorias(contextoId, ambitoActual, listaCategorias);
        }
        actualizarSelectUI();
    };

    const actualizarSelectUI = () => {
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        
        listaCategorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });

        const optAdd = document.createElement('option');
        optAdd.value = "nueva-categoria";
        optAdd.textContent = "➕ AGREGAR NUEVA...";
        optAdd.style.fontWeight = "bold";
        optAdd.style.color = "#2e7d32";
        selectCategoria.appendChild(optAdd);

        manejarCamposDinamicos();
    };

    // ==========================================
    // ADAPTACIÓN DE LA INTERFAZ SEGÚN EL CONTEXTO
    // ==========================================
    const actualizarVistaTipoGasto = () => {
        if (selectorTipoGasto) selectorTipoGasto.style.display = 'none';

        if (ambitoActual === 'personal') {
            if (grupoResponsable) grupoResponsable.style.display = 'none';
            if (grupoFondo) grupoFondo.style.display = 'none';
            if (tipoIndividual) tipoIndividual.checked = true;
        } else {
            if (grupoResponsable) grupoResponsable.style.display = 'block';
            if (tipoGeneral) tipoGeneral.checked = true;
        }
        actualizarSelectUI();
    };

    const manejarCamposDinamicos = () => {
        const seccionInventario = document.getElementById('seccion-inventario');
        const grupoReferencia = document.getElementById('referencia-group');

        if (selectCategoria.selectedIndex <= 0) {
            if(seccionInventario) seccionInventario.style.display = 'none';
            if(grupoReferencia) grupoReferencia.style.display = 'none';
            if(grupoFondo) grupoFondo.style.display = 'none';
            return;
        }

        const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text.toLowerCase();
        const catNormalizada = catElegida.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (seccionInventario) {
            seccionInventario.style.display = ['supermercado', 'verduleria', 'carniceria'].includes(catNormalizada) ? 'block' : 'none';
        }
        
        if (grupoFondo) {
            if (ambitoActual === 'hogar' && ['supermercado', 'carniceria', 'verduleria'].includes(catNormalizada)) {
                grupoFondo.style.display = 'block';
            } else {
                grupoFondo.style.display = 'none';
                if(checkPagadoFondo) checkPagadoFondo.checked = false; 
            }
        }

        if (grupoReferencia) {
            if (ambitoActual === 'personal' || ['otros', 'campo'].includes(catNormalizada)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                if(inputReferencia) inputReferencia.value = ''; 
            }
        }
    };

    // ==========================================
    // EVENTOS Y GUARDADO
    // ==========================================
    if (selectResponsable) selectResponsable.addEventListener('change', actualizarSelectUI);

    if (selectMetodoPago) selectMetodoPago.addEventListener('change', (e) => {
        if (e.target.value === 'tarjeta-credito') {
            if(panelTarjeta) panelTarjeta.style.display = 'block';
            if(ambitoActual === 'hogar' && selectTitularTarjeta) selectTitularTarjeta.value = selectResponsable.value; 
        } else {
            if(panelTarjeta) panelTarjeta.style.display = 'none';
        }
    });

    if (selectCategoria) selectCategoria.addEventListener('change', async (e) => {
        if (e.target.value === "nueva-categoria") {
            const nuevaCat = await modalCategoria.solicitarEntrada(); 
            if (nuevaCat && nuevaCat !== "") {
                const contextoId = ambitoActual === 'hogar' ? hogarId : auth.currentUser.uid;
                listaCategorias.push(nuevaCat);
                await api.guardarCategorias(contextoId, ambitoActual, listaCategorias); 
                
                toast.mostrar("Categoría agregada con éxito");
                actualizarSelectUI();
                
                Array.from(selectCategoria.options).forEach((opt, idx) => {
                    if(opt.text === nuevaCat) selectCategoria.selectedIndex = idx;
                });
            } else { 
                e.target.selectedIndex = 0; 
            }
        }
        manejarCamposDinamicos();
    });

    const btnAddInv = document.getElementById('btn-add-inv');
    if(btnAddInv) {
        btnAddInv.addEventListener('click', () => {
            const prod = document.getElementById('inv-prod').value;
            const cant = parseFloat(document.getElementById('inv-cant').value);
            const unid = document.getElementById('inv-unid').value;
            const precio = parseFloat(document.getElementById('inv-precio').value);
            if (!prod || !cant || !precio) return toast.mostrar("Completá Producto, Cantidad y Precio.");
            
            arrayInventario.push({ producto: prod, cantidad: cant, unidad: unid, precio: precio });
            document.getElementById('inv-prod').value = '';
            document.getElementById('inv-cant').value = '';
            document.getElementById('inv-precio').value = '';
            
            const listaUI = document.getElementById('lista-inventario');
            listaUI.innerHTML = '';
            let totalAcumulado = 0;
            arrayInventario.forEach((item, index) => {
                totalAcumulado += item.precio;
                listaUI.innerHTML += `<li style="display: flex; justify-content: space-between; padding: 8px; background: #fff; border: 1px solid #ddd; margin-bottom: 5px; border-radius: 5px;"><span><strong>${item.producto}</strong> (${item.cantidad} ${item.unidad})</span><div><strong>$${item.precio}</strong></div></li>`;
            });
            inputMontoGlobal.value = totalAcumulado;
            inputMontoGlobal.readOnly = true;
        });
    }

    if(formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const botonGuardar = document.querySelector('.btn-primary');
            botonGuardar.textContent = "Guardando..."; 
            botonGuardar.disabled = true;

            const montoTotal = parseFloat(inputMontoGlobal.value);
            const esTarjeta = selectMetodoPago.value === 'tarjeta-credito';
            const cuotas = esTarjeta ? parseInt(inputCuotas.value) : 1;
            const montoPorCuota = montoTotal / cuotas;
            const refOriginal = inputReferencia ? inputReferencia.value.trim() : "";
            const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text;
            
            const responsableFinal = ambitoActual === 'personal' ? (auth.currentUser.displayName || "Usuario") : selectResponsable.value;
            const tipoFinal = ambitoActual === 'personal' ? 'individual' : 'general';
            
            const usaFondo = (grupoFondo && grupoFondo.style.display === 'block') ? checkPagadoFondo.checked : false;

            try {
                let promesasGuardado = [];
                for (let i = 1; i <= cuotas; i++) {
                    let fechaCuota = new Date();
                    let mesesASumar = (i - 1);
                    if (esTarjeta && selectImpacto.value === 'proximo-mes') mesesASumar += 1;
                    fechaCuota.setMonth(fechaCuota.getMonth() + mesesASumar);
                    
                    let referenciaFinal = refOriginal;
                    if (cuotas > 1) referenciaFinal = refOriginal ? `${refOriginal} (Cuota ${i}/${cuotas})` : `(Cuota ${i}/${cuotas})`;

                    const nuevoGasto = {
                        fecha: fechaCuota.toISOString().split('T')[0],
                        tipo: tipoFinal,
                        responsable: responsableFinal, 
                        categoria: catElegida,
                        monto: montoPorCuota,
                        metodo_pago: selectMetodoPago.value,
                        titular_tarjeta: esTarjeta ? selectTitularTarjeta.value : null,
                        detalle_inventario: arrayInventario,
                        referencia: referenciaFinal,
                        pagado_con_fondo: usaFondo
                    };

                    const contextoEnvio = ambitoActual === 'hogar' ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
                    promesasGuardado.push(api.guardarGasto(nuevoGasto, contextoEnvio));
                }
                
                await Promise.all(promesasGuardado);
                toast.mostrar(cuotas > 1 ? `¡${cuotas} cuotas guardadas! ☁️` : '¡Gasto guardado! ☁️');
                
                setTimeout(() => window.location.href = 'index.html', 1500); 
                
            } catch (error) { 
                toast.mostrar('Error al guardar. Revisá tu conexión.'); 
            } finally { 
                botonGuardar.textContent = "Guardar"; botonGuardar.disabled = false; 
            }
        });
    }

    // ==========================================
    // ARRANQUE DE SESIÓN
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const saludoUI = document.getElementById('saludo-usuario');
            if (!user.displayName) {
                const modalPerfil = document.getElementById('perfil-prompt');
                const inputPerfil = document.getElementById('perfil-prompt-input');
                const btnPerfil = document.getElementById('perfil-prompt-confirm');
                if(modalPerfil) modalPerfil.style.display = 'flex';
                if(saludoUI) saludoUI.textContent = "¡Bienvenido!";
                
                if(btnPerfil) btnPerfil.addEventListener('click', async () => {
                    const nombre = inputPerfil.value.trim();
                    if (nombre) {
                        btnPerfil.textContent = "Guardando...";
                        await updateProfile(user, { displayName: nombre });
                        toast.mostrar(`¡Hola, ${nombre}! 👋`);
                        modalPerfil.style.display = 'none';
                        if(saludoUI) saludoUI.textContent = `Hola, ${nombre}`;
                    }
                });
            } else {
                if(saludoUI) saludoUI.textContent = `Hola, ${user.displayName}`;
            }

            await inicializarCategorias(user.uid);
            actualizarVistaTipoGasto();
        }
    });
});