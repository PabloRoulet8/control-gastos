import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKqmEWdxbUZKDPdUIghdrtgGkGdEudFr8",
    authDomain: "control-gastos-cf09c.firebaseapp.com",
    projectId: "control-gastos-cf09c",
    storageBucket: "control-gastos-cf09c.firebasestorage.app",
    messagingSenderId: "350200153131",
    appId: "1:350200153131:web:e11a4b4fc5e5ba0310966e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // 1. CATEGORÍAS
    const categorias = {
        general: ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'],
        pablo: ['Cuota Handball', 'Campo', 'Otros'],
        yanet: ['Monotributo', 'Crédito Mercado Pago', 'Otros']
    };

    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');
    
    const actualizarCategorias = () => {
        let listaActiva = tipoGeneral.checked ? categorias.general : categorias[selectResponsable.value];
        document.querySelector('#responsable-group label').textContent = tipoGeneral.checked ? '¿Quién lo pagó?' : 'Responsable del gasto';
        
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        listaActiva.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase().replace(/ /g, '-');
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });
    };

    tipoGeneral.addEventListener('change', actualizarCategorias);
    tipoIndividual.addEventListener('change', actualizarCategorias);
    selectResponsable.addEventListener('change', actualizarCategorias);
    actualizarCategorias();

    // 2. OCR (TESSERACT)
    const inputFoto = document.getElementById('ticket-foto');
    const ocrStatus = document.getElementById('ocr-status');
    const textareaTexto = document.getElementById('ticket-texto');
    const botonGuardar = document.querySelector('.btn-primary');

    inputFoto.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        ocrStatus.style.display = 'block';
        textareaTexto.style.display = 'none';
        botonGuardar.disabled = true;

        try {
            const result = await Tesseract.recognize(file, 'spa');
            textareaTexto.value = result.data.text;
            textareaTexto.style.display = 'block';
            ocrStatus.innerHTML = '✅ ¡Ticket leído! Usalo de guía abajo.';
            textareaTexto.style.height = 'auto'; 
            textareaTexto.style.height = textareaTexto.scrollHeight + 'px';
        } catch (error) {
            ocrStatus.innerHTML = '❌ Error al leer. Podés cargar manual.';
            ocrStatus.style.color = 'red';
        } finally {
            botonGuardar.disabled = false;
        }
    });

    // 3. LÓGICA DE INVENTARIO Y AUTO-CÁLCULO
    let arrayInventario = [];
    const inputMontoGlobal = document.getElementById('monto');
    const listaUI = document.getElementById('lista-inventario');
    const btnAddInv = document.getElementById('btn-add-inv');

    const actualizarVistaInventario = () => {
        listaUI.innerHTML = '';
        let totalAcumulado = 0;

        arrayInventario.forEach((item, index) => {
            totalAcumulado += item.precio;
            const li = document.createElement('li');
            li.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #fff; border: 1px solid #ddd; margin-bottom: 5px; border-radius: 5px; font-size: 0.9rem;";
            li.innerHTML = `
                <span><strong>${item.producto}</strong> (${item.cantidad} ${item.unidad})</span>
                <div>
                    <span style="font-weight: bold; margin-right: 10px;">$${item.precio.toLocaleString('es-AR')}</span>
                    <button type="button" data-index="${index}" class="btn-borrar-item" style="background:none; border:none; color:red; cursor:pointer;">❌</button>
                </div>
            `;
            listaUI.appendChild(li);
        });

        // Eventos para borrar ítems de la lista
        document.querySelectorAll('.btn-borrar-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                arrayInventario.splice(idx, 1);
                actualizarVistaInventario();
            });
        });

        // Si hay ítems, bloqueamos el Monto Global y le ponemos la suma total
        if (arrayInventario.length > 0) {
            inputMontoGlobal.value = totalAcumulado;
            inputMontoGlobal.readOnly = true;
            inputMontoGlobal.style.backgroundColor = '#f0f0f0';
        } else {
            inputMontoGlobal.value = '';
            inputMontoGlobal.readOnly = false;
            inputMontoGlobal.style.backgroundColor = 'transparent';
        }
    };

    btnAddInv.addEventListener('click', () => {
        const prod = document.getElementById('inv-prod').value;
        const cant = parseFloat(document.getElementById('inv-cant').value);
        const unid = document.getElementById('inv-unid').value;
        const precio = parseFloat(document.getElementById('inv-precio').value);

        if (!prod || !cant || !precio) {
            alert("Completá Producto, Cantidad y Precio para agregarlo a la lista.");
            return;
        }

        arrayInventario.push({ producto: prod, cantidad: cant, unidad: unid, precio: precio });
        
        // Limpiamos los mini-inputs
        document.getElementById('inv-prod').value = '';
        document.getElementById('inv-cant').value = '';
        document.getElementById('inv-precio').value = '';
        
        actualizarVistaInventario();
    });

    // 4. GUARDAR EN FIREBASE
    const formGasto = document.getElementById('expense-form');
    formGasto.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        botonGuardar.textContent = "Guardando..."; 
        botonGuardar.disabled = true;

        const nuevoGasto = {
            fecha: new Date().toISOString().split('T')[0],
            timestamp: new Date(),
            tipo: tipoGeneral.checked ? 'general' : 'individual',
            responsable: selectResponsable.value,
            categoria: selectCategoria.options[selectCategoria.selectedIndex].text,
            monto: parseFloat(inputMontoGlobal.value),
            metodo_pago: document.getElementById('metodo-pago').value,
            // Agregamos el array completo a la base de datos
            detalle_inventario: arrayInventario 
        };

        try {
            await addDoc(collection(db, "gastos"), nuevoGasto);
            alert('¡Gasto guardado exitosamente! ☁️');
            
            // Reseteamos toda la pantalla
            formGasto.reset();
            arrayInventario = [];
            actualizarVistaInventario();
            actualizarCategorias();
            textareaTexto.style.display = 'none';
            ocrStatus.style.display = 'none';
        } catch (error) {
            console.error("Error al guardar: ", error);
            alert('Hubo un error al guardar. Intentá de nuevo.');
        } finally {
            botonGuardar.textContent = "Guardar Gasto Definitivo";
            botonGuardar.disabled = false;
        }
    });
});

// FORZAR INSTALACIÓN PWA
let eventoInstalacion;
const btnInstalar = document.getElementById('btn-instalar');

window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome dice que la app ES instalable. Atrapamos el evento.
    e.preventDefault();
    eventoInstalacion = e;
    
    // Mostramos nuestro propio botón
    btnInstalar.style.display = 'block';
});

btnInstalar.addEventListener('click', async () => {
    if (eventoInstalacion) {
        eventoInstalacion.prompt(); // Mostramos el cartel de Chrome
        const { outcome } = await eventoInstalacion.userChoice;
        if (outcome === 'accepted') {
            console.log('App instalada con éxito');
            btnInstalar.style.display = 'none';
        }
        eventoInstalacion = null;
    }
});