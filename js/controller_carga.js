import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ModalManager } from "./ui/ModalManager.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Instanciamos nuestras capas de Datos y UI
    const api = new GastoRepository();
    const toast = new ToastManager();
    const modalCategoria = new ModalManager('custom-prompt', 'custom-prompt-input', 'custom-prompt-confirm', 'custom-prompt-cancel');

    // 2. Estado de la aplicación
    let categorias = {};
    let arrayInventario = [];

    // Selectores principales
    const tipoGeneral = document.getElementById('tipo-general');
    const tipoIndividual = document.getElementById('tipo-individual');
    const selectResponsable = document.getElementById('responsable');
    const selectCategoria = document.getElementById('categoria');
    const inputReferencia = document.getElementById('referencia');
    const inputMontoGlobal = document.getElementById('monto');
    const formGasto = document.getElementById('expense-form');

    // ==========================================
    // LÓGICA DE CATEGORÍAS
    // ==========================================
    const inicializarCategorias = async () => {
        const catNube = await api.obtenerCategorias();
        if (catNube) {
            categorias = catNube;
        } else {
            // Categorías por defecto si la base de datos está vacía
            categorias = {
                general: ['Alquiler', 'Expensas', 'Gas', 'EPE', 'WiFi', 'Agua', 'TGI', 'Supermercado', 'Carnicería', 'Verdulería', 'Salidas', 'Otros'],
                mostri: ['Cuota Handball', 'Campo', 'Tarjeta de colectivo', 'Teléfono', 'Otros'],
                mostrina: ['Monotributo', 'Crédito Mercado Pago', 'Tarjeta de colectivo', 'Teléfono', 'Otros']
            };
            await api.inicializarCategorias(categorias);
        }
        actualizarSelectUI();
    };

    const actualizarSelectUI = () => {
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

    const manejarCamposDinamicos = () => {
        const seccionInventario = document.getElementById('seccion-inventario');
        const grupoReferencia = document.getElementById('referencia-group');

        if (selectCategoria.selectedIndex <= 0) {
            if(seccionInventario) seccionInventario.style.display = 'none';
            if(grupoReferencia) grupoReferencia.style.display = 'none';
            return;
        }

        const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text.toLowerCase();
        const catNormalizada = catElegida.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (seccionInventario) {
            seccionInventario.style.display = ['supermercado', 'verduleria', 'carniceria'].includes(catNormalizada) ? 'block' : 'none';
        }
        
        if (grupoReferencia) {
            if (!tipoGeneral.checked || ['otros', 'campo'].includes(catNormalizada)) {
                grupoReferencia.style.display = 'block';
            } else {
                grupoReferencia.style.display = 'none';
                if(inputReferencia) inputReferencia.value = ''; 
            }
        }
    };

    // Eventos de categorías
    tipoGeneral.addEventListener('change', actualizarSelectUI);
    tipoIndividual.addEventListener('change', actualizarSelectUI);
    selectResponsable.addEventListener('change', actualizarSelectUI);
    
    selectCategoria.addEventListener('change', async (e) => {
        if (e.target.value === "nueva-categoria") {
            const nuevaCat = await modalCategoria.solicitarEntrada(); 
            
            if (nuevaCat && nuevaCat !== "") {
                const resp = selectResponsable.value;
                categorias[resp].push(nuevaCat);
                
                await api.actualizarCategorias(categorias); // Delegamos a la API
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

    // ==========================================
    // LÓGICA DE INVENTARIO
    // ==========================================
    const actualizarVistaInventario = () => {
        const listaUI = document.getElementById('lista-inventario');
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
                arrayInventario.splice(e.target.getAttribute('data-index'), 1);
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

    const btnAddInv = document.getElementById('btn-add-inv');
    if(btnAddInv) {
        btnAddInv.addEventListener('click', () => {
            const prod = document.getElementById('inv-prod').value;
            const cant = parseFloat(document.getElementById('inv-cant').value);
            const unid = document.getElementById('inv-unid').value;
            const precio = parseFloat(document.getElementById('inv-precio').value);

            if (!prod || !cant || !precio) {
                toast.mostrar("Completá Producto, Cantidad y Precio.");
                return;
            }

            arrayInventario.push({ producto: prod, cantidad: cant, unidad: unid, precio: precio });
            document.getElementById('inv-prod').value = '';
            document.getElementById('inv-cant').value = '';
            document.getElementById('inv-precio').value = '';
            actualizarVistaInventario();
        });
    }

    // ==========================================
    // GUARDAR GASTO
    // ==========================================
    if(formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const botonGuardar = document.querySelector('.btn-primary');
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
                await api.guardarGasto(nuevoGasto); // Delegamos a la API
                toast.mostrar('¡Gasto guardado exitosamente! ☁️');
                
                formGasto.reset();
                arrayInventario = [];
                actualizarVistaInventario();
                actualizarSelectUI();
                
            } catch (error) {
                console.error("Error al guardar: ", error);
                toast.mostrar('Error al guardar. Se subirá al recuperar conexión.');
            } finally {
                botonGuardar.textContent = "Guardar";
                botonGuardar.disabled = false;
            }
        });
    }

    // Inicializamos la app
    await inicializarCategorias();
});