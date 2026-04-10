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
    // 1. CATEGORÍAS Y CAMPOS DINÁMICOS
    const categorias = {
        general: ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'],
        pablo: ['Cuota Handball', 'Campo', 'Otros'],
        yanet: ['Monotributo', 'Crédito Mercado Pago', 'Otros']
    };

    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');
    
    // Capturamos las secciones que se ocultan/muestran
    const seccionInventario = document.getElementById('seccion-inventario');
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');
    
    // Función maestra para mostrar/ocultar campos según categoría
    const manejarCamposDinamicos = () => {
        // Si no hay categoría, ocultamos todo
        if (selectCategoria.selectedIndex <= 0) {
            if(seccionInventario) seccionInventario.style.display = 'none';
            if(grupoReferencia) grupoReferencia.style.display = 'none';
            return;
        }

        const categoriaElegida = selectCategoria.options[selectCategoria.selectedIndex].text.toLowerCase();
        const catNormalizada = categoriaElegida.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // A. Lógica para el Inventario
        const categoriasConInventario = ['supermercado', 'verduleria', 'carniceria'];
        if (seccionInventario) {
            seccionInventario.style.display = categoriasConInventario.includes(catNormalizada) ? 'block' : 'none';
        }

        // B. Lógica para la Referencia (Otros y Campo)
        const categoriasConReferencia = ['otros', 'campo'];
        if (grupoReferencia) {
            if (categoriasConReferencia.includes(catNormalizada)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                inputReferencia.value = ''; // Limpiamos lo que se haya escrito si cambian de opinión
            }
        }
    };

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
        
        manejarCamposDinamicos();
    };

    tipoGeneral.addEventListener('change', actualizarCategorias);
    tipoIndividual.addEventListener('change', actualizarCategorias);
    selectResponsable.addEventListener('change', actualizarCategorias);
    selectCategoria.addEventListener('change', manejarCamposDinamicos); 
    
    actualizarCategorias();

    // 2. OCR (Oculto)
    const inputFoto = document.getElementById('ticket-foto');
    const ocrStatus = document.getElementById('ocr-status');
    const textareaTexto = document.getElementById('ticket-texto');
    const botonGuardar = document.querySelector('.btn-primary');

    if(inputFoto) {
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
    }

    // 3. LÓGICA DE INVENTARIO
    let arrayInventario = [];
    const inputMontoGlobal = document.getElementById('monto');
    const listaUI = document.getElementById('lista-inventario');
    const btnAddInv = document.getElementById('btn-add-inv');

    const actualizarVistaInventario = () => {
        if (!listaUI) return;
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

    if(btnAddInv) {
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
            
            document.getElementById('inv-prod').value = '';
            document.getElementById('inv-cant').value = '';
            document.getElementById('inv-precio').value = '';
            
            actualizarVistaInventario();
        });
    }

    // 4. GUARDAR EN FIREBASE
    const formGasto = document.getElementById('expense-form');
    if(formGasto) {
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
                detalle_inventario: arrayInventario,
                // NUEVO: Agregamos la referencia a la base de datos
                referencia: inputReferencia ? inputReferencia.value.trim() : ""
            };

            try {
                await addDoc(collection(db, "gastos"), nuevoGasto);
                alert('¡Gasto guardado exitosamente! ☁️');
                
                formGasto.reset();
                arrayInventario = [];
                actualizarVistaInventario();
                actualizarCategorias();
                if(textareaTexto) textareaTexto.style.display = 'none';
                if(ocrStatus) ocrStatus.style.display = 'none';
                if(seccionInventario) seccionInventario.style.display = 'none';
                // Volvemos a ocultar la referencia
                if(grupoReferencia) grupoReferencia.style.display = 'none';
                
            } catch (error) {
                console.error("Error al guardar: ", error);
                alert('Hubo un error al guardar. Intentá de nuevo.');
            } finally {
                botonGuardar.textContent = "Guardar Gasto Definitivo";
                botonGuardar.disabled = false;
            }
        });
    }
});

// PWA Instalación
let eventoInstalacion;
const btnInstalar = document.getElementById('btn-instalar');
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    if(btnInstalar) btnInstalar.style.display = 'block';
});
if(btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
        if (eventoInstalacion) {
            eventoInstalacion.prompt();
            const { outcome } = await eventoInstalacion.userChoice;
            if (outcome === 'accepted') {
                btnInstalar.style.display = 'none';
            }
            eventoInstalacion = null;
        }
    });
}