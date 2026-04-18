import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";
import { ToastManager } from "./ui/ToastManager.js";
import { auth } from "./firebase-config.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const api = new GastoRepository();
    const calculador = new ResumenService();
    const toast = new ToastManager();

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

    const txtDeudor = document.getElementById('txt-deudor');
    const valDeuda = document.getElementById('val-deuda');
    const switchSaldado = document.getElementById('switch-saldado');
    const labelSwitch = document.getElementById('label-switch-saldado');
    const valDeudaAnteriorDetalle = document.getElementById('val-deuda-mes-anterior');
    let selectorGrafico = document.getElementById('selector-grafico');
    const listaChecklist = document.getElementById('lista-checklist');
    const valTotalCasa = document.getElementById('val-total-casa');
    const valFondo = document.querySelector('.valor-fondo');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');
    const tituloHeader = document.querySelector('header h1');

    if (tituloHeader) {
        tituloHeader.textContent = ambitoActual === 'hogar' ? `Resumen: ${hogarNombre}` : 'Mi Resumen Personal';
    }

    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.nextElementSibling;
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
    });

    const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    let miGrafico = null;
    let datosGraficoActuales = {}; 

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Identificamos quién es el usuario logueado para mostrar sus datos personales
                const nombreUsuario = user.displayName ? user.displayName.toLowerCase() : '';
                const esMostri = (nombreUsuario === 'mostri' || nombreUsuario === 'pablo');
                const miClavePersonal = esMostri ? 'mostri' : 'mostrina';

                const contextoConsulta = ambitoActual === 'hogar' ? hogarId : 'personal';
                const contextoId = ambitoActual === 'hogar' ? hogarId : user.uid;

                const fechaHoy = new Date();
                const mesActual = fechaHoy.toISOString().slice(0, 7); 
                const fechaAnterior = new Date();
                fechaAnterior.setMonth(fechaAnterior.getMonth() - 1);
                const mesAnterior = fechaAnterior.toISOString().slice(0, 7);

                if (ambitoActual === 'hogar') {
                    const configHogar = await api.obtenerConfiguracionHogar(hogarId);
                    if (configHogar && configHogar.fondo_comun) {
                        calculador.fondoInicial = parseFloat(configHogar.fondo_comun);
                    }
                }

                const gastos = await api.obtenerGastos(contextoConsulta);
                const estadoDeudas = await api.obtenerEstadoDeudas(contextoId);
                const res = calculador.calcularResumen(gastos, mesActual, mesAnterior, estadoDeudas);

                if (ambitoActual === 'personal') {
                    // ==========================================
                    // MUNDO PERSONAL
                    // ==========================================
                    if(txtDeudor) txtDeudor.textContent = "Total Gastado este mes:";
                    
                    const miTotalPersonal = res.totales[miClavePersonal]; 
                    if(valDeuda) {
                        valDeuda.textContent = formatoARS(miTotalPersonal);
                        valDeuda.style.color = "#2e7d32"; 
                    }

                    if(switchSaldado) switchSaldado.closest('.card').style.display = 'none'; 
                    if(valTotalCasa) valTotalCasa.closest('.card').style.display = 'none'; 
                    if(listaChecklist) listaChecklist.closest('.card').style.display = 'none'; 
                    if(listaStockUI) listaStockUI.closest('.card').style.display = 'none'; 

                    const renderList = (datos, ui) => {
                        if(!ui) return;
                        ui.innerHTML = Object.keys(datos).length ? '' : '<li>Sin gastos</li>';
                        Object.entries(datos).sort().forEach(([cat, val]) => {
                            ui.innerHTML += `<li><span>${cat}</span> <strong>${formatoARS(val)}</strong></li>`;
                        });
                    };
                    
                    // Mostramos SOLO mi propia lista
                    renderList(res.individuales[miClavePersonal], listaMostriUI);
                    if(listaMostriUI) {
                        const tituloAcordeon = listaMostriUI.closest('.accordion-item').querySelector('.accordion-header span');
                        if (tituloAcordeon) tituloAcordeon.textContent = "Mis Gastos Detallados";
                    }
                    if(listaMostrinaUI && listaMostrinaUI.closest('.accordion-item')) listaMostrinaUI.closest('.accordion-item').style.display = 'none'; 

                } else {
                    // ==========================================
                    // MUNDO HOGAR
                    // ==========================================
                    if(valTotalCasa) {
                        // SUMA EXCLUSIVA DE GASTOS DE LA CASA (Fijos + Comestibles)
                        valTotalCasa.textContent = formatoARS(res.totales.fijos + res.totales.alimentacion);
                        const tituloCasa = valTotalCasa.previousElementSibling;
                        if(tituloCasa) tituloCasa.textContent = "Total Gastos del Hogar";
                    }

                    // PRIVACIDAD: Ocultar los totales personales (cajitas verdes)
                    if (valTotalMostri && valTotalMostri.parentElement) valTotalMostri.parentElement.style.display = 'none';
                    if (valTotalMostrina && valTotalMostrina.parentElement) valTotalMostrina.parentElement.style.display = 'none';

                    // PRIVACIDAD: Ocultar los acordeones de listas personales en el Hogar
                    if (listaMostriUI && listaMostriUI.closest('.accordion-item')) listaMostriUI.closest('.accordion-item').style.display = 'none';
                    if (listaMostrinaUI && listaMostrinaUI.closest('.accordion-item')) listaMostrinaUI.closest('.accordion-item').style.display = 'none';

                    if(labelSwitch) labelSwitch.textContent = `¿Mes de ${mesAnterior} saldado?`;
                    if(switchSaldado) switchSaldado.checked = res.estadoMesAnterior;
                    
                    if (valDeudaAnteriorDetalle) {
                        valDeudaAnteriorDetalle.textContent = res.estadoMesAnterior ? formatoARS(0) : formatoARS(Math.abs(res.deudaMesAnterior));
                        valDeudaAnteriorDetalle.style.color = res.estadoMesAnterior ? "#2e7d32" : "#d32f2f";
                    }

                    if (Math.abs(res.deudaAcumulada) < 1) {
                        if(txtDeudor) txtDeudor.textContent = "¡Cuentas al día! 🎉";
                        if(valDeuda) { valDeuda.textContent = "$ 0"; valDeuda.style.color = "#2e7d32"; }
                    } else {
                        if(txtDeudor) txtDeudor.textContent = res.deudaAcumulada > 0 ? "Mostri debe a Mostrina:" : "Mostrina debe a Mostri:";
                        if(valDeuda) { valDeuda.textContent = formatoARS(Math.abs(res.deudaAcumulada)); valDeuda.style.color = "#d32f2f"; }
                    }

                    if(switchSaldado) switchSaldado.addEventListener('change', async (e) => {
                        try {
                            await api.guardarEstadoDeuda(contextoId, mesAnterior, e.target.checked);
                            toast.mostrar(e.target.checked ? `Cuentas de ${mesAnterior} cerradas ✅` : "Cuentas reabiertas ❌");
                            setTimeout(() => location.reload(), 1200);
                        } catch (error) { toast.mostrar("Error al guardar"); e.target.checked = !e.target.checked; }
                    });

                    if (valFondo) valFondo.textContent = formatoARS(res.totales.fondoRestante);
                    if (valAlimentacion) valAlimentacion.textContent = formatoARS(res.totales.alimentacion);
                    if (valFijos) valFijos.textContent = formatoARS(res.totales.fijos);

                    if(listaChecklist) {
                        const emojis = { alquiler: '🏠', expensas: '🏢', epe: '⚡', agua: '💧', tgi: '📝', gas: '🔥', wifi: '🌐' };
                        listaChecklist.innerHTML = '';
                        for (const [servicio, estaPagado] of Object.entries(res.checklist)) {
                            const status = estaPagado ? '<span style="color:#2e7d32; font-weight:bold;">✅ Pagado</span>' : '<span style="color:#d32f2f;">❌ Pendiente</span>';
                            listaChecklist.innerHTML += `<li><span>${emojis[servicio] || '📌'} <span style="text-transform: capitalize;">${servicio}</span></span> ${status}</li>`;
                        }
                    }

                    if(listaStockUI) {
                        listaStockUI.innerHTML = '';
                        for (const [cat, prods] of Object.entries(res.inventario)) {
                            listaStockUI.innerHTML += `<h4 style="color:#2e7d32; margin-top:10px; text-transform: capitalize;">${cat}</h4>`;
                            const ul = document.createElement('ul');
                            ul.className = 'lista-minimal';
                            Object.values(prods).forEach(p => {
                                ul.innerHTML += `<li><span>${p.nombre}</span> <strong>${p.cantidad} ${p.unidad}</strong></li>`;
                            });
                            listaStockUI.appendChild(ul);
                        }
                    }
                }

                datosGraficoActuales = res.graficos;
                const dibujarGrafico = (tipo) => {
                    const datosMap = datosGraficoActuales[tipo];
                    const canvas = document.getElementById('graficoTorta');
                    if(!canvas) return;
                    const ctx = canvas.getContext('2d');
                    if (miGrafico) miGrafico.destroy();
                    if(!datosMap) return;
                    
                    const etiquetas = Object.keys(datosMap);
                    miGrafico = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: etiquetas,
                            datasets: [
                                { label: 'Mes Anterior', data: etiquetas.map(c => datosMap[c].anterior), backgroundColor: '#bdc3c7', borderRadius: 5 },
                                { label: 'Mes Actual', data: etiquetas.map(c => datosMap[c].actual), backgroundColor: '#2e7d32', borderRadius: 5 }
                            ]
                        },
                        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top' } } }
                    });
                };
                
                if (ambitoActual === 'personal') {
                    dibujarGrafico(miClavePersonal); // Dibuja el gráfico con las categorías personales del usuario
                    if(selectorGrafico) selectorGrafico.style.display = 'none'; 
                } else {
                    dibujarGrafico('general'); // Por defecto dibuja el total de la casa
                    if(selectorGrafico) {
                        selectorGrafico.style.display = 'block';
                        selectorGrafico.innerHTML = `
                            <option value="general">🏠 Todos los Gastos</option>
                            <option value="comestibles">🛒 Solo Comestibles</option>
                            <option value="servicios">⚡ Solo Servicios (Fijos)</option>
                        `;
                        // Clonamos el elemento para borrar los "event listeners" viejos y evitar errores
                        const nuevoSelector = selectorGrafico.cloneNode(true);
                        selectorGrafico.parentNode.replaceChild(nuevoSelector, selectorGrafico);
                        selectorGrafico = nuevoSelector; // Actualizamos la referencia
                        selectorGrafico.addEventListener('change', (e) => dibujarGrafico(e.target.value));
                    }
                }

            } catch (error) { 
                console.error("Error al cargar resumen:", error); 
                if(valTotalCasa) valTotalCasa.textContent = "Error";
            }
        }
    });
});