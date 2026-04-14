import { db } from "./firebase-config.js";
import { collection, addDoc, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const showToast = (message) => {
    const toast = document.getElementById('toast-container');
    if(toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    } else {
        alert(message);
    }
};

// NUEVA FUNCIÓN: Cartel personalizado
const solicitarNuevaCategoria = () => {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt');
        const input = document.getElementById('custom-prompt-input');
        const btnConfirm = document.getElementById('custom-prompt-confirm');
        const btnCancel = document.getElementById('custom-prompt-cancel');

        modal.style.display = 'flex';
        input.value = '';
        input.focus();

        const cleanup = () => {
            modal.style.display = 'none';
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            cleanup();
            resolve(input.value.trim());
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
        };

        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    let categorias = {
        general: ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'],
        mostri: ['Cuota Handball', 'Campo', 'Tarjeta de colectivo', 'Teléfono', 'Otros'],
        mostrina: ['Monotributo', 'Crédito Mercado Pago', 'Tarjeta de colectivo', 'Teléfono', 'Otros']
    };

    const docRef = doc(db, "config", "categorias");

    const cargarCategoriasDesdeNube = async () => {
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                categorias = docSnap.data();
            } else {
                await setDoc(docRef, categorias);
            }
        } catch (e) { console.error("Error cargando categorías:", e); }
    };

    const actualizarSelectUI = () => {
        const tipoGeneral = document.getElementById('tipo-general');
        const selectResponsable = document.getElementById('responsable');
        const selectCategoria = document.getElementById('categoria');
        
        let listaActiva = tipoGeneral.checked ? categorias.general : categorias[selectResponsable.value];
        
        selectCategoria.innerHTML = '<option value="" disabled selected>Seleccioná una categoría</option>';
        listaActiva.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });

        if (!tipoGeneral.checked) {
            const optAdd = document.createElement('option');
            optAdd.value = "nueva-categoria";
            optAdd.textContent = "➕ AGREGAR NUEVA...";
            optAdd.style.fontWeight = "bold";
            optAdd.style.color = "#2e7d32";
            selectCategoria.appendChild(optAdd);
        }
        
        manejarCamposDinamicos();
    };

    const seccionInventario = document.getElementById('seccion-inventario');
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');

    const manejarCamposDinamicos = () => {
        const selectCategoria = document.getElementById('categoria');
        if (selectCategoria.selectedIndex <= 0) {
            if(seccionInventario) seccionInventario.style.display = 'none';
            if(grupoReferencia) grupoReferencia.style.display = 'none';
            return;
        }

        const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text.toLowerCase();
        const catNormalizada = catElegida.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const categoriasConInventario = ['supermercado', 'verduleria', 'carniceria'];
        if (seccionInventario) {
            seccionInventario.style.display = categoriasConInventario.includes(catNormalizada) ? 'block' : 'none';
        }

        const tipoGeneral = document.getElementById('tipo-general').checked;
        const categoriasGralConRef = ['otros', 'campo'];
        
        if (grupoReferencia) {
            if (!tipoGeneral || categoriasGralConRef.includes(catNormalizada)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                inputReferencia.value = ''; 
            }
        }
    };

    await cargarCategoriasDesdeNube();
    actualizarSelectUI();

    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');

    tipoGeneral.addEventListener('change', actualizarSelectUI);
    tipoIndividual.addEventListener('change', actualizarSelectUI);
    selectResponsable.addEventListener('change', actualizarSelectUI);

    // LÓGICA DE CATEGORÍA NUEVA ACTUALIZADA
    selectCategoria.addEventListener('change', async (e) => {
        if (e.target.value === "nueva-categoria") {
            const nuevaCat = await solicitarNuevaCategoria(); // Llamamos al cartel lindo
            
            if (nuevaCat && nuevaCat !== "") {
                const resp = selectResponsable.value;
                categorias[resp].push(nuevaCat);
                
                await updateDoc(docRef, categorias);
                showToast("Categoría agregada con éxito");
                actualizarSelectUI();
                
                Array.from(selectCategoria.options).forEach((opt, idx) => {
                    if(opt.text === nuevaCat) selectCategoria.selectedIndex = idx;
                });
                manejarCamposDinamicos();
            } else {
                e.target.selectedIndex = 0;
                manejarCamposDinamicos();
            }
        } else {
            manejarCamposDinamicos();
        }
    });

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

        document.querySelectorAll('.btn-borrar-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                arrayInventario.splice(idx, 1);
                actualizarVistaInventario();
            });
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
                showToast("Completá Producto, Cantidad y Precio.");
                return;
            }

            arrayInventario.push({ producto: prod, cantidad: cant, unidad: unid, precio: precio });
            document.getElementById('inv-prod').value = '';
            document.getElementById('inv-cant').value = '';
            document.getElementById('inv-precio').value = '';
            actualizarVistaInventario();
        });
    }

    const formGasto = document.getElementById('expense-form');
    const botonGuardar = document.querySelector('.btn-primary');
    
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
                showToast('¡Gasto guardado exitosamente! ☁️');
                
                formGasto.reset();
                arrayInventario = [];
                actualizarVistaInventario();
                actualizarSelectUI();
                if(seccionInventario) seccionInventario.style.display = 'none';
                if(grupoReferencia) grupoReferencia.style.display = 'none';
                
            } catch (error) {
                console.error("Error al guardar: ", error);
                showToast('Error al guardar. Se subirá al recuperar conexión.');
            } finally {
                botonGuardar.textContent = "Guardar";
                botonGuardar.disabled = false;
            }
        });
    }
});