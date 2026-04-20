import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const api = new GastoRepository();
    const toast = new ToastManager();
    const urlParams = new URLSearchParams(window.location.search);
    
    let hogarId = urlParams.get('id');
    const esModoCreacion = (hogarId === 'nuevo');

    // --- VARIABLES DE DATOS ---
    let categoriasBorrador = [];
    let presupuestosBorrador = [];

    // --- SELECTORES ---
    const tituloPantalla = document.getElementById('titulo-hogar');
    const inputNombreHogar = document.getElementById('input-nombre-hogar');
    const btnAccionFinal = document.getElementById('btn-final');
    const seccionNombre = document.getElementById('seccion-nombre-hogar');

    // Selectores Categorías
    const inputNuevaCat = document.getElementById('input-nueva-cat');
    const btnAddCat = document.getElementById('btn-add-cat');
    const listaCategoriasUI = document.getElementById('lista-categorias-hogar');

    // Selectores Presupuestos
    const inputNombreFondo = document.getElementById('input-nombre-fondo');
    const inputMontoFondo = document.getElementById('input-monto-fondo');
    const checkCategoriasUI = document.getElementById('check-categorias-vinculadas');
    const btnCrearFondo = document.getElementById('btn-crear-fondo');
    const listaFondosUI = document.getElementById('lista-fondos-hogar');

    // --- 1. CONFIGURACIÓN VISUAL SEGÚN EL MODO ---
    if (esModoCreacion) {
        tituloPantalla.textContent = "Crear Nuevo Hogar";
        document.getElementById('btn-guardar-nombre').style.display = 'none';
        
        btnAccionFinal.textContent = "Crear Hogar y Generar Link";
        btnAccionFinal.className = "btn-primary w-100 mb-20"; 
        btnAccionFinal.style.backgroundColor = "#2e7d32"; 

        listaCategoriasUI.innerHTML = '<li class="text-center text-muted">Aún no hay categorías</li>';
        checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1;">Agregá categorías primero</span>';

    } else {
        // MODO EDICIÓN: Ocultar nombre y transformar pantalla
        if (seccionNombre) seccionNombre.style.display = 'none';
        document.querySelector('.header h1').textContent = "Categorías y Fondos";
        
        btnAccionFinal.textContent = "Guardar Cambios";
        btnAccionFinal.className = "btn-primary w-100 mb-20"; 
        btnAccionFinal.style.backgroundColor = "#2e7d32"; 
    }

    // --- 2. CARGA DE DATOS EXISTENTES (Solo Edición) ---
    onAuthStateChanged(auth, async (user) => {
        if (user && !esModoCreacion) {
            const snap = await getDoc(doc(db, "hogares", hogarId));
            if (snap.exists()) {
                const data = snap.data();
                
                // Cargamos las categorías asegurándonos que tengan el campo "activa"
                categoriasBorrador = (data.categorias_compartidas || []).map(c => ({
                    ...c, 
                    activa: c.activa !== false // Si no existe el campo, por defecto es true
                }));
                presupuestosBorrador = data.presupuestos_compartidos || [];

                renderizarCategorias();
                actualizarChecksPresupuestos();
                renderizarPresupuestos();
            }
        }
    });

    // ==========================================
    // LÓGICA DE CATEGORÍAS (Borrador + Opción C)
    // ==========================================
    btnAddCat.addEventListener('click', () => {
        const nombre = inputNuevaCat.value.trim();
        if (!nombre) return;
        
        // Buscamos si ya existe (incluso si está archivada)
        const catExistente = categoriasBorrador.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        
        if (catExistente) {
            if (catExistente.activa === false) {
                // Si estaba eliminada, la "revivimos"
                catExistente.activa = true;
                toast.mostrar("Categoría restaurada.");
            } else {
                return toast.mostrar("Esa categoría ya existe");
            }
        } else {
            // Creamos una nueva
            categoriasBorrador.push({ nombre, es_fijo: false, lleva_stock: false, activa: true });
        }

        inputNuevaCat.value = '';
        renderizarCategorias();
        actualizarChecksPresupuestos();
    });

    function renderizarCategorias() {
        listaCategoriasUI.innerHTML = '';
        
        // Filtramos solo las que están activas
        const categoriasVisibles = categoriasBorrador.filter(c => c.activa !== false);

        if (categoriasVisibles.length === 0) {
            listaCategoriasUI.innerHTML = '<li class="text-center text-muted">Aún no hay categorías</li>';
            return;
        }

        categoriasVisibles.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'flex-between mb-10';
            li.style.padding = "10px";
            li.style.background = "#f9f9f9";
            li.style.borderRadius = "8px";
            
            li.innerHTML = `
                <span class="text-bold-dark flex-2">${cat.nombre}</span>
                <div class="flex-1 text-center">
                    <button class="btn-toggle-cat" data-nombre="${cat.nombre}" data-prop="es_fijo" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">
                        ${cat.es_fijo ? '✅' : '⬜'}
                    </button>
                </div>
                <div class="flex-1 text-center">
                    <button class="btn-toggle-cat" data-nombre="${cat.nombre}" data-prop="lleva_stock" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">
                        ${cat.lleva_stock ? '✅' : '⬜'}
                    </button>
                </div>
                <button class="btn-icon-white btn-delete-cat" data-nombre="${cat.nombre}" style="color: #d32f2f; font-size: 1.2rem; width: 40px;">🗑️</button>
            `;
            listaCategoriasUI.appendChild(li);
        });

        listaCategoriasUI.querySelectorAll('.btn-toggle-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nombre = btn.dataset.nombre;
                const prop = btn.dataset.prop;
                const catIndex = categoriasBorrador.findIndex(c => c.nombre === nombre);
                if (catIndex > -1) {
                    categoriasBorrador[catIndex][prop] = !categoriasBorrador[catIndex][prop];
                    renderizarCategorias(); 
                }
            });
        });

        listaCategoriasUI.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // OPCIÓN C: En vez de borrar, la ocultamos
                const catAEliminar = categoriasBorrador.find(c => c.nombre === btn.dataset.nombre);
                if(catAEliminar) {
                    catAEliminar.activa = false;
                    renderizarCategorias();
                    actualizarChecksPresupuestos(); 
                }
            });
        });
    }

    // ==========================================
    // LÓGICA DE PRESUPUESTOS
    // ==========================================
    function actualizarChecksPresupuestos() {
        checkCategoriasUI.innerHTML = '';
        const categoriasVisibles = categoriasBorrador.filter(c => c.activa !== false);

        if (categoriasVisibles.length === 0) {
            checkCategoriasUI.innerHTML = '<span class="text-muted text-center span-full" style="grid-column: 1/-1;">Agregá categorías primero</span>';
            return;
        }

        categoriasVisibles.forEach(cat => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '5px';
            label.style.fontSize = '0.9rem';
            label.innerHTML = `<input type="checkbox" name="cat-vinculo" value="${cat.nombre}" class="checkbox-lg"> ${cat.nombre}`;
            checkCategoriasUI.appendChild(label);
        });
    }

    btnCrearFondo.addEventListener('click', () => {
        const nombre = inputNombreFondo.value.trim();
        const monto = parseFloat(inputMontoFondo.value);
        const seleccionadas = Array.from(document.querySelectorAll('input[name="cat-vinculo"]:checked')).map(c => c.value);

        if (!nombre || isNaN(monto) || seleccionadas.length === 0) {
            return toast.mostrar("Completá nombre, monto y elegí al menos una categoría.");
        }

        presupuestosBorrador.push({
            id: Date.now().toString(),
            nombre,
            monto,
            categorias: seleccionadas
        });

        inputNombreFondo.value = '';
        inputMontoFondo.value = '';
        renderizarPresupuestos();
    });

    function renderizarPresupuestos() {
        listaFondosUI.innerHTML = '';
        if (presupuestosBorrador.length === 0) {
            listaFondosUI.innerHTML = '<li class="text-center text-muted">Aún no hay presupuestos.</li>';
            return;
        }

        presupuestosBorrador.forEach(f => {
            const li = document.createElement('li');
            li.className = 'card mb-15'; 
            li.style.borderLeft = '5px solid #e65100';
            li.style.padding = '15px';
            li.innerHTML = `
                <div class="flex-between">
                    <div>
                        <strong style="font-size: 1.1rem; color: #e65100;">${f.nombre}</strong><br>
                        <span class="text-sm-gray" style="display: block; margin-top: 5px;">Aplica en: ${f.categorias.join(', ')}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-weight: bold; font-size: 1.2rem; color: #333;">$ ${f.monto.toLocaleString()}</span>
                        <button class="btn-delete-fondo" data-id="${f.id}" style="background: none; border: none; color: #d32f2f; cursor: pointer; padding: 5px; margin-top: 5px; font-weight: bold;">Eliminar</button>
                    </div>
                </div>
            `;
            listaFondosUI.appendChild(li);
        });

        listaFondosUI.querySelectorAll('.btn-delete-fondo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                presupuestosBorrador = presupuestosBorrador.filter(p => p.id !== e.target.dataset.id);
                renderizarPresupuestos();
            });
        });
    }

    // ==========================================
    // ACCIÓN DEL BOTÓN FINAL (CREAR O GUARDAR CAMBIOS)
    // ==========================================
    if (btnAccionFinal) {
        btnAccionFinal.addEventListener('click', async () => {
            btnAccionFinal.disabled = true;
            
            try {
                if (esModoCreacion) {
                    // MODO CREACIÓN (Lo que ya funcionaba)
                    const nombreHogar = inputNombreHogar.value.trim();
                    if (!nombreHogar) {
                        toast.mostrar("⚠️ Por favor, ingresá el nombre del hogar");
                        inputNombreHogar.focus();
                        btnAccionFinal.disabled = false;
                        return;
                    }

                    btnAccionFinal.textContent = "Guardando configuración...";
                    const nuevoHogar = await api.crearHogar(nombreHogar);
                    const nuevoId = nuevoHogar.id;

                    await setDoc(doc(db, "hogares", nuevoId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador,
                        administradores: [auth.currentUser.uid] 
                    }, { merge: true });

                    const snapHogar = await getDoc(doc(db, "hogares", nuevoId));
                    const codigoGenerado = snapHogar.data().codigo_invitacion;
                    
                    const urlBase = window.location.origin + window.location.pathname.replace('admin_hogar.html', 'index.html');
                    const linkFinal = `${urlBase}?join=${codigoGenerado}`;

                    document.getElementById('modal-link-invitacion').style.display = 'flex'; 
                    document.getElementById('input-link-generado').value = linkFinal;

                    document.getElementById('btn-copiar-link-modal').onclick = () => {
                        navigator.clipboard.writeText(linkFinal);
                        toast.mostrar("¡Link copiado al portapapeles! 🔗");
                    };

                    document.getElementById('btn-cerrar-modal-link').onclick = () => {
                        window.location.href = 'index.html'; 
                    };

                } else {
                    // MODO EDICIÓN: Simplemente actualiza el documento y vuelve al Panel
                    btnAccionFinal.textContent = "Guardando Cambios...";
                    
                    await updateDoc(doc(db, "hogares", hogarId), {
                        categorias_compartidas: categoriasBorrador,
                        presupuestos_compartidos: presupuestosBorrador
                    });
                    
                    toast.mostrar("¡Configuración actualizada! ✅");
                    setTimeout(() => window.location.href = `config_hogar.html?id=${hogarId}`, 1000);
                }

            } catch (error) {
                console.error("Error completo en acción final:", error);
                toast.mostrar("Error al guardar la configuración");
                btnAccionFinal.disabled = false;
                btnAccionFinal.textContent = esModoCreacion ? "Crear Hogar y Generar Link" : "Guardar Cambios";
            }
        });
    }
});