import { GastoRepository } from "./api/GastoRepository.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";
import { auth } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const repositorio = new GastoRepository();
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager();
    
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

    const listaGastosUI = document.getElementById('lista-gastos');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroResponsable = document.getElementById('filtro-responsable');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroMes = document.getElementById('filtro-mes');
    const tituloHeader = document.querySelector('header h1');

    // LÓGICA DEL BOTÓN DE RESCATE
    const btnRescatar = document.getElementById('btn-rescatar');
    if (btnRescatar) {
        btnRescatar.addEventListener('click', async () => {
            if (ambitoActual !== 'hogar' || !hogarId) {
                alert("⚠️ Por favor, volvé al Inicio y entrá al Historial desde la tarjeta de tu 'Hogar' (no desde gastos personales) para rescatar los datos.");
                return;
            }
            
            if (confirm("¿Querés actualizar todos tus gastos viejos para que aparezcan en este Hogar?")) {
                btnRescatar.textContent = "Recuperando datos... aguardá...";
                btnRescatar.disabled = true;
                try {
                    const cantidad = await repositorio.migrarDatosViejos(hogarId);
                    alert(`¡Misión cumplida! Se rescataron ${cantidad} gastos viejos. La página se va a recargar.`);
                    window.location.reload();
                } catch (error) {
                    alert("Error al rescatar: " + error.message);
                    btnRescatar.textContent = "🛠️ Recuperar Datos Viejos";
                    btnRescatar.disabled = false;
                }
            }
        });
    }

    if (tituloHeader) {
        tituloHeader.textContent = ambitoActual === 'hogar' ? `Historial: ${hogarNombre}` : 'Mi Historial';
    }

    let todosLosGastos = [];

    const cargarFiltroCategorias = async (userId) => {
        const contextoId = ambitoActual === 'hogar' ? hogarId : userId;
        const categoriasList = await repositorio.obtenerCategorias(contextoId, ambitoActual);

        if (categoriasList) {
            const catsUnicas = [...categoriasList].sort();
            catsUnicas.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat; 
                option.textContent = cat;
                filtroCategoria.appendChild(option);
            });
        }
    };

    const renderizarHistorial = () => {
        listaGastosUI.innerHTML = '';
        
        let gastosFiltrados = todosLosGastos.filter(gasto => {
            const cumpleTipo = filtroTipo.value === 'todos' || gasto.tipo === filtroTipo.value;
            const cumpleResp = filtroResponsable.value === 'todos' || gasto.responsable === filtroResponsable.value;
            const cumpleMes = !filtroMes.value || gasto.fecha.startsWith(filtroMes.value);
            const cumpleCat = filtroCategoria.value === 'todas' || gasto.categoria === filtroCategoria.value;
            return cumpleTipo && cumpleResp && cumpleMes && cumpleCat;
        });

        if (gastosFiltrados.length === 0) {
            listaGastosUI.innerHTML = '<p style="text-align:center; padding:20px;">No se encontraron movimientos.</p>';
            return;
        }

        gastosFiltrados.forEach((gasto) => {
            const item = document.createElement('div');
            const esMio = gasto.responsable === auth.currentUser?.displayName;
            let claseTipo = gasto.tipo === 'individual' ? (esMio ? 'individual-pablo' : 'individual-yanet') : 'general';
            if(ambitoActual === 'personal') claseTipo = 'individual-pablo';

            item.className = `gasto-item ${claseTipo}`;
            item.innerHTML = `
                <div class="gasto-info">
                    <strong>${gasto.categoria}</strong> 
                    <span class="fecha">${gasto.fecha} — ${gasto.responsable.toUpperCase()}</span>
                </div>
                <div class="gasto-acciones">
                    <span class="monto">$ ${gasto.monto.toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar">🗑️</button>
                </div>
            `;
            listaGastosUI.appendChild(item);
        });

        document.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', async (e) => {
                const idGasto = e.currentTarget.getAttribute('data-id');
                if (await confirmacion.preguntar("Eliminar Gasto", "¿Estás seguro de borrar este registro?")) {
                    try {
                        await repositorio.eliminarGasto(idGasto);
                        toast.mostrar("Gasto eliminado");
                        cargarDatosIniciales();
                    } catch (error) { toast.mostrar("Error al borrar"); }
                }
            });
        });
    };

    const cargarDatosIniciales = async () => {
        listaGastosUI.innerHTML = '<p style="text-align:center; padding:20px;">Cargando movimientos...</p>';
        try {
            const contextoConsulta = ambitoActual === 'hogar' ? hogarId : 'personal';
            todosLosGastos = await repositorio.obtenerGastos(contextoConsulta, { ordenPor: "timestamp", ordenDireccion: "desc" });
            renderizarHistorial();
        } catch (error) {
            console.error(error);
            listaGastosUI.innerHTML = '<p style="text-align:center; color:#d32f2f;">Error. Asegurate de haber creado el Índice en Firebase.</p>';
        }
    };

    filtroTipo.addEventListener('change', renderizarHistorial);
    filtroResponsable.addEventListener('change', renderizarHistorial);
    filtroCategoria.addEventListener('change', renderizarHistorial);
    filtroMes.addEventListener('change', renderizarHistorial);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (ambitoActual === 'personal') {
                if(filtroResponsable) filtroResponsable.style.display = 'none';
                if(filtroTipo) filtroTipo.style.display = 'none';
            }
            await cargarFiltroCategorias(user.uid);
            await cargarDatosIniciales();
        }
    });
});