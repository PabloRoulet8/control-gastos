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
    // 1. CATEGORÍAS (Actualizado a las nuevas keys mostri y mostrina)
    const categorias = {
        general: ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'],
        mostri: ['Cuota Handball', 'Campo', 'Otros'],
        mostrina: ['Monotributo', 'Crédito Mercado Pago', 'Otros']
    };

    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');
    
    const seccionInventario = document.getElementById('seccion-inventario');
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');
    
    // Función maestra reparada
    const manejarCamposDinamicos = () => {
        if (selectCategoria.selectedIndex <= 0) {
            if(seccionInventario) seccionInventario.style.display = 'none';
            if(grupoReferencia) grupoReferencia.style.display = 'none';
            return;
        }

        // Usamos el 'value' directamente (ej: "otros", "campo", "supermercado")
        const catValue = selectCategoria.value; 

        // Inventario
        const categoriasConInventario = ['supermercado', 'verduleria', 'carniceria'];
        if (seccionInventario) {
            seccionInventario.style.display = categoriasConInventario.includes(catValue) ? 'block' : 'none';
        }

        // Referencia
        const categoriasConReferencia = ['otros', 'campo'];
        if (grupoReferencia) {
            if (categoriasConReferencia.includes(catValue)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                inputReferencia.value = ''; 
            }
        }
    };

    const actualizarCategorias = () => {
        let listaActiva = tipoGeneral.checked ? categorias.general : categorias[selectResponsable.value];
        document.querySelector('#responsable-group label').textContent = tipoGeneral.checked ? '¿Quién lo pagó?' : 'Responsable del gasto';
        
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        listaActiva.forEach(cat => {
            const option = document.createElement('option');
            // Quitamos acentos y pasamos a minusculas para el value (ej: Carnicería -> carniceria)
            option.value = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
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
                ocrStatus.innerHTML = '✅ ¡Ticket leído!';
                textareaTexto.style.height = 'auto'; 
                textareaTexto.style.height = textareaTexto.scrollHeight + 'px';
            } catch (error) {
                ocrStatus.innerHTML = '❌ Error al leer.';
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
                alert("Completá Producto, Cantidad y Precio.");
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
                if(grupoReferencia) grupoReferencia.style.display = 'none';
                
            } catch (error) {
                console.error("Error:", error);
                alert('Error al guardar.');
            } finally {
                botonGuardar.textContent = "Guardar Gasto Definitivo";
                botonGuardar.disabled = false;
            }
        });
    }
});