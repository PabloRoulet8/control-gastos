import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const toast = new ToastManager();

    const urlParams = new URLSearchParams(window.location.search);
    let ambitoActual = urlParams.get('ambito') || 'individual'; 
    if (ambitoActual === 'personal') ambitoActual = 'individual';
    
    const hogarId = urlParams.get('id');
    const hogarNombre = urlParams.get('nombre');

    let arrayInventario = [];
    let listaCategorias = [];
    let currentUserIdGlobal = null;

    const selectCategoria = document.getElementById('categoria');
    const selectResponsable = document.getElementById('responsable');
    const tituloHeader = document.getElementById('titulo-header');
    // === INYECTAR TUERCA DE CONFIGURACIÓN EN EL HEADER ===
    const headerSpacer = document.querySelector('.header-spacer');
    if (headerSpacer && ambitoActual !== 'unificado') {
        // ¿A dónde tiene que ir la tuerca?
        const linkConfig = ambitoActual === 'hogar' ? `config_hogar.html?v=9.5&id=${hogarId}` : `perfil.html?v=9.5`;
        
        // Reemplazamos el espacio vacío por el botón de la tuerca
        headerSpacer.outerHTML = `
            <a href="${linkConfig}" class="btn-icon-white" title="Configuración" style="text-decoration: none; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                ⚙️
            </a>
        `;
    }
    const subtituloHeader = document.querySelector('.container h2');
    const grupoResponsable = document.getElementById('responsable-group');
    const inputMontoGlobal = document.getElementById('monto');
    const listaUI = document.getElementById('lista-inventario');
    const formGasto = document.getElementById('expense-form');
    
    const grupoReferencia = document.getElementById('referencia-group');
    const inputReferencia = document.getElementById('referencia');

    // === NAVEGACIÓN INFERIOR (EL FIX CLAVE) ===
    const navContextual = document.getElementById('nav-contextual');
    if (navContextual) {
        const urlAmbito = ambitoActual === 'individual' ? 'personal' : ambitoActual;
        const suffix = hogarId ? `&id=${hogarId}` : '';
        
        navContextual.innerHTML = `
            <a href="carga.html?v=9.5&ambito=${urlAmbito}${suffix}" class="nav-item active">
                <span class="icon">➕</span><span class="label">Cargar</span>
            </a>
            <a href="historial.html?v=9.5&ambito=${urlAmbito}${suffix}" class="nav-item">
                <span class="icon">📜</span><span class="label">Historial</span>
            </a>
            <a href="resumen.html?v=9.5&ambito=${urlAmbito}${suffix}" class="nav-item">
                <span class="icon">📊</span><span class="label">Resumen</span>
            </a>`;
    }

    // 1. GESTIÓN DE BORRADOR Y NAVEGACIÓN
    const guardarBorradorStock = () => {
        localStorage.setItem('borrador_stock', JSON.stringify(arrayInventario));
    };

    const actualizarListaInventarioUI = () => {
        if(!listaUI) return;
        listaUI.innerHTML = '';
        let totalAcumulado = 0;
        arrayInventario.forEach((item, index) => {
            totalAcumulado += item.precio;
            const li = document.createElement('li');
            li.className = 'flex-between p-10 border-bottom-gray';
            li.innerHTML = `
                <span><strong>${item.producto}</strong> (${item.cantidad} ${item.unidad})</span>
                <div class="flex-center">
                    <strong style="margin-right:10px">$${item.precio.toLocaleString('es-AR')}</strong>
                    <button type="button" class="btn-delete-item" data-index="${index}" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem;">✕</button>
                </div>
            `;
            listaUI.appendChild(li);
        });

        listaUI.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.currentTarget.dataset.index;
                arrayInventario.splice(idx, 1);
                guardarBorradorStock();
                actualizarListaInventarioUI();
            };
        });

        if (arrayInventario.length > 0) {
            inputMontoGlobal.value = totalAcumulado.toFixed(2); 
            inputMontoGlobal.readOnly = true;
        } else {
            inputMontoGlobal.readOnly = false;
        }
    };

    // 2. INICIALIZACIÓN DE DATOS
    const inicializarPagina = async (userId) => {
        currentUserIdGlobal = userId;
        const userSnap = await getDoc(doc(db, "usuarios", userId));
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (ambitoActual === 'individual') {
                listaCategorias = userData.categorias_personales || [];
                if (tituloHeader) tituloHeader.textContent = "Gastos Personales";
                if (subtituloHeader) subtituloHeader.textContent = "¿Qué gasto vas a anotar hoy?"; 
                if (grupoResponsable) grupoResponsable.style.display = 'none';
            }
        }

        if (ambitoActual === 'hogar' && hogarId) {
            const hogarSnap = await getDoc(doc(db, "hogares", hogarId));
            if (hogarSnap.exists()) {
                const hogarData = hogarSnap.data();
                listaCategorias = hogarData.categorias_compartidas || [];
                if (tituloHeader) tituloHeader.textContent = `Hogar: ${hogarNombre || hogarData.nombre}`;
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
        }
        llenarSelectCategorias();
        const guardado = localStorage.getItem('borrador_stock');
        if (guardado) {
            arrayInventario = JSON.parse(guardado);
            actualizarListaInventarioUI();
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
        
        const nombreLimpio = prod.charAt(0).toUpperCase() + prod.slice(1);
        
        arrayInventario.push({ 
            producto: nombreLimpio, 
            cantidad: cant, unidad: unid, precio: precio 
        });
        
        document.getElementById('inv-prod').value = ''; 
        document.getElementById('inv-cant').value = ''; 
        document.getElementById('inv-precio').value = '';
        
        actualizarListaInventarioUI();
        guardarBorradorStock();
    });

    if(formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('.btn-primary');
            btn.disabled = true;
            btn.textContent = "Guardando...";

            try {
                const catElegida = selectCategoria.options[selectCategoria.selectedIndex].text;
                
                let textoReferencia = "";
                if (grupoReferencia && grupoReferencia.style.display === 'block' && inputReferencia) {
                    textoReferencia = inputReferencia.value.trim();
                }

                const nuevoGasto = {
                    fecha: new Date().toISOString().split('T')[0],
                    monto: parseFloat(inputMontoGlobal.value),
                    categoria: catElegida,
                    detalle_inventario: arrayInventario,
                    responsable: (ambitoActual === 'hogar') ? selectResponsable.value : currentUserIdGlobal,
                    metodo_pago: document.getElementById('metodo-pago').value,
                    tipo: (ambitoActual === 'hogar') ? 'general' : 'individual',
                    referencia: textoReferencia
                };

                const contexto = (ambitoActual === 'hogar') ? { tipo: 'hogar', id: hogarId } : { tipo: 'personal' };
                await api.guardarGasto(nuevoGasto, contexto);
                
                toast.mostrar("✅ ¡Gasto guardado!");
                localStorage.removeItem('borrador_stock');
                arrayInventario = [];
                formGasto.reset();
                
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