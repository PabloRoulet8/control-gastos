import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ModalManager } from "./ui/ModalManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const modalCategoria = new ModalManager('custom-prompt', 'custom-prompt-input', 'custom-prompt-confirm', 'custom-prompt-cancel');

    const urlParams = new URLSearchParams(window.location.search);
    const ambitoActual = urlParams.get('ambito') || 'personal'; 
    const hogarId = urlParams.get('id');
    const hogarNombre = urlParams.get('nombre');

    document.querySelectorAll('.bottom-nav a').forEach(link => {
        const baseHref = link.getAttribute('href').split('?')[0];
        if (baseHref !== 'index.html') {
            link.href = `${baseHref}?ambito=${ambitoActual}${hogarId ? `&id=${hogarId}` : ''}${hogarNombre ? `&nombre=${encodeURIComponent(hogarNombre)}` : ''}`;
        }
    });

    let listaCategorias = [];
    let arrayInventario = [];
    let nombreUsuarioGlobal = "Usuario"; 
    let fondosPersonales = []; 

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

    const inicializarDatosPerfilYCategorias = async (userId) => {
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const userRef = doc(db, "usuarios", userId);
        const docSnap = await getDoc(userRef);

        let metodosPago = ['Efectivo / Transferencia', 'Tarjeta de Crédito'];

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.nombre) nombreUsuarioGlobal = data.nombre;
            if (data.metodos_pago && data.metodos_pago.length > 0) metodosPago = data.metodos_pago;

            if (ambitoActual === 'personal') {
                listaCategorias = data.categorias_personales || [];
                fondosPersonales = data.fondos || []; 
            }
        }

        const saludoUI = document.getElementById('saludo-usuario');
        if (saludoUI) saludoUI.textContent = `Hola, ${nombreUsuarioGlobal}`;

        selectMetodoPago.innerHTML = '';
        metodosPago.forEach(m => {
            const option = document.createElement('option');
            option.value = m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
            option.textContent = m;
            selectMetodoPago.appendChild(option);
        });

        if (ambitoActual === 'hogar') {
            const catNube = await api.obtenerCategorias(contextoId, ambitoActual);
            if (catNube) {
                listaCategorias = catNube;
            }
        }

        actualizarSelectUI();
    };

    const actualizarSelectUI = () => {
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        
        listaCategorias.sort((a, b) => {
            const nA = typeof a === 'string' ? a : a.nombre;
            const nB = typeof b === 'string' ? b : b.nombre;
            return nA.localeCompare(nB);
        }).forEach(cat => {
            const c = typeof cat === 'string' ? { nombre: cat, lleva_stock: false, es_fijo: false } : cat;
            
            const option = document.createElement('option');
            option.value = c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
            option.textContent = c.nombre;
            // Guardamos el interruptor oculto
            option.dataset.llevaStock = c.lleva_stock; 
            selectCategoria.appendChild(option);
        });

        if (ambitoActual === 'hogar') {
            const optAdd = document.createElement('option');
            optAdd.value = "nueva-categoria";
            optAdd.textContent = "➕ AGREGAR NUEVA...";
            optAdd.style.fontWeight = "bold";
            optAdd.style.color = "#2e7d32";
            selectCategoria.appendChild(optAdd);
        }

        manejarCamposDinamicos();
    };

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

        const optionElegida = selectCategoria.options[selectCategoria.selectedIndex];
        // Revisamos el interruptor directamente de la base de datos
        const llevaStock = optionElegida.dataset.llevaStock === "true";

        if (seccionInventario) {
            seccionInventario.style.display = llevaStock ? 'block' : 'none';
        }
        
        if (grupoFondo) {
            if (ambitoActual === 'hogar' && llevaStock) {
                grupoFondo.style.display = 'block';
            } else {
                grupoFondo.style.display = 'none';
                if(checkPagadoFondo) checkPagadoFondo.checked = false; 
            }
        }

        if (grupoReferencia) {
            const catNormalizada = optionElegida.value;
            if (ambitoActual === 'personal' || ['otros', 'campo'].includes(catNormalizada)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                if(inputReferencia) inputReferencia.value = ''; 
            }
        }
    };

    if (selectResponsable) selectResponsable.addEventListener('change', actualizarSelectUI);

    if (selectMetodoPago) selectMetodoPago.addEventListener('change', (e) => {
        const textoElegido = selectMetodoPago.options[selectMetodoPago.selectedIndex].text.toLowerCase();
        if (textoElegido.includes('tarjeta') || textoElegido.includes('crédito') || textoElegido.includes('credito')) {
            if(panelTarjeta) panelTarjeta.style.display = 'block';
            if(ambitoActual === 'hogar' && selectTitularTarjeta) selectTitularTarjeta.value = selectResponsable.value; 
        } else {
            if(panelTarjeta) panelTarjeta.style.display = 'none';
        }
    });

    if (selectCategoria) selectCategoria.addEventListener('change', async (e) => {
        if (e.target.value === "nueva-categoria" && ambitoActual === 'hogar') {
            const nuevaCat = await modalCategoria.solicitarEntrada(); 
            if (nuevaCat && nuevaCat !== "") {
                const nuevoObjCat = { nombre: nuevaCat, es_fijo: false, lleva_stock: false };
                listaCategorias.push(nuevoObjCat);
                await api.guardarCategorias(hogarId, ambitoActual, listaCategorias); 
                toast.mostrar("Categoría agregada con éxito");
                actualizarSelectUI();
                Array.from(selectCategoria.options).forEach((opt, idx) => {
                    if(opt.text === nuevaCat) selectCategoria.selectedIndex = idx;
                });
            } else { e.target.selectedIndex = 0; }
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
            arrayInventario.forEach((item) => {
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
            const textoElegido = selectMetodoPago.options[selectMetodoPago.selectedIndex].text.toLowerCase();
            const esTarjeta = textoElegido.includes('tarjeta') || textoElegido.includes('crédito') || textoElegido.includes('credito');
            
            const cuotas = esTarjeta ? parseInt(inputCuotas.value) : 1;
            const montoPorCuota = montoTotal / cuotas;
            const refOriginal = inputReferencia ? inputReferencia.value.trim() : "";
            const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text;
            
            const responsableFinal = ambitoActual === 'personal' ? nombreUsuarioGlobal : selectResponsable.value;
            const tipoFinal = ambitoActual === 'personal' ? 'individual' : 'general';

            let idFondoVinculado = null;
            let usaFondo = false;

            if (ambitoActual === 'personal') {
                const fondoEncontrado = fondosPersonales.find(f => f.categorias.includes(catElegida));
                if (fondoEncontrado) {
                    idFondoVinculado = fondoEncontrado.id;
                    usaFondo = true;
                }
            } else {
                usaFondo = (grupoFondo && grupoFondo.style.display === 'block') ? checkPagadoFondo.checked : false;
            }

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
                        metodo_pago: textoElegido,
                        titular_tarjeta: esTarjeta ? selectTitularTarjeta.value : null,
                        detalle_inventario: arrayInventario,
                        referencia: referenciaFinal,
                        pagado_con_fondo: usaFondo,
                        id_fondo_vinculado: idFondoVinculado
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

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            actualizarVistaTipoGasto();
            await inicializarDatosPerfilYCategorias(user.uid);
        }
    });
});