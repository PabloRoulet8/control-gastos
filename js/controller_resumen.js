import { GastoRepository } from "./api/GastoRepository.js";
import { ResumenService } from "./services/ResumenService.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Instanciamos nuestras capas
    const api = new GastoRepository();
    const calculador = new ResumenService();

    // Selectores del DOM
    const valTotal = document.querySelector('.monto-total .valor');
    const valTotalMostri = document.querySelector('.pablo-total');
    const valTotalMostrina = document.querySelector('.yanet-total');
    const valAlimentacion = document.querySelector('.valor-alimentacion');
    const valFijos = document.querySelector('.valor-fijos');
    const valFondo = document.querySelector('.valor-fondo');
    const valTarjeta = document.querySelector('.monto-tarjeta .valor');
    const valDeuda = document.querySelector('.valor-deuda');
    const txtDeuda = document.querySelector('.deuda-principal p');
    const desgloseDeuda = document.querySelector('.desglose-deuda');
    
    // Selectores Acordeones y Mes Anterior
    const listaStockUI = document.getElementById('lista-stock-categorizada');
    const listaMostriUI = document.getElementById('lista-gastos-mostri');
    const listaMostrinaUI = document.getElementById('lista-gastos-mostrina');
    const contenedorDeudaAnt = document.getElementById('contenedor-deuda-anterior');
    const txtDeudaAnt = document.getElementById('txt-deuda-anterior');
    const valDeudaAnt = document.getElementById('val-deuda-anterior');

    // Lógica Acordeones UI
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const content = btn.nextElementSibling;
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });
    });

    const formatoARS = (num) => '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    try {
        // 2. Conseguimos las fechas
        const fechaHoy = new Date();
        const mesActual = fechaHoy.toISOString().slice(0, 7); 
        fechaHoy.setMonth(fechaHoy.getMonth() - 1); 
        const mesAnterior = fechaHoy.toISOString().slice(0, 7);
        const primerDiaFiltro = mesAnterior + "-01";

        // 3. Obtenemos datos de la API y los procesamos en el Servicio
        const gastos = await api.obtenerGastos({ desde: primerDiaFiltro });
        const resultados = calculador.calcularResumen(gastos, mesActual, mesAnterior);

        // 4. PINTAMOS EL HTML
        // Totales
        valTotal.textContent = formatoARS(resultados.totales.general);
        if(valTotalMostri) valTotalMostri.textContent = formatoARS(resultados.totales.mostri);
        if(valTotalMostrina) valTotalMostrina.textContent = formatoARS(resultados.totales.mostrina);
        if(valAlimentacion) valAlimentacion.textContent = formatoARS(resultados.totales.alimentacion);
        if(valFijos) valFijos.textContent = formatoARS(resultados.totales.fijos);
        valTarjeta.textContent = formatoARS(resultados.totales.tarjeta);

        // Fondo Comestibles
        if (valFondo) {
            valFondo.textContent = formatoARS(resultados.totales.fondoRestante);
            const contenedorFondo = document.querySelector('.monto-fondo');
            const labelFondo = document.querySelector('.monto-fondo .label');
            if (resultados.totales.fondoRestante < 0) {
                valFondo.style.color = "#c62828";
                labelFondo.textContent = "Fondo Comestibles (¡Se pasaron!)";
                labelFondo.style.color = "#d32f2f";
                contenedorFondo.style.backgroundColor = "#ffebee";
                contenedorFondo.style.border = "1px solid #ffcdd2";
            } else {
                valFondo.style.color = "#01579b";
                labelFondo.textContent = "Fondo Comestibles (Quedan de $300.000)";
                labelFondo.style.color = "#0277bd";
                contenedorFondo.style.backgroundColor = "#e3f2fd";
                contenedorFondo.style.border = "1px solid #bbdefb";
            }
        }

        // Deuda Actual
        if (resultados.deuda.actual > 0) {
            txtDeuda.textContent = "Mostri transfiere a Mostrina:";
            valDeuda.textContent = formatoARS(resultados.deuda.actual);
            desgloseDeuda.innerHTML = `
                <li>Por mitad de generales pendientes: <span>${formatoARS(resultados.deuda.desgloseGeneral)}</span></li>
                <li>Por consumos en su tarjeta: <span>${formatoARS(resultados.deuda.desgloseTarjeta)}</span></li>
            `;
        } else if (resultados.deuda.actual < 0) {
            txtDeuda.textContent = "Mostrina transfiere a Mostri:";
            valDeuda.textContent = formatoARS(Math.abs(resultados.deuda.actual));
            desgloseDeuda.innerHTML = `<li>Ajuste a favor de Mostri por generales.</li>`;
        } else {
            txtDeuda.textContent = "¡Cuentas al día!";
            valDeuda.textContent = "$ 0";
            desgloseDeuda.innerHTML = `<li>Nadie debe nada este mes.</li>`;
        }

        // Deuda Anterior
        if (Math.abs(resultados.deuda.anterior) > 1) {
            contenedorDeudaAnt.style.display = 'block';
            if (resultados.deuda.anterior > 0) {
                txtDeudaAnt.textContent = "Mostri le debía a Mostrina:";
                valDeudaAnt.textContent = formatoARS(resultados.deuda.anterior);
            } else {
                txtDeudaAnt.textContent = "Mostrina le debía a Mostri:";
                valDeudaAnt.textContent = formatoARS(Math.abs(resultados.deuda.anterior));
                valDeudaAnt.style.color = "#1b5e20"; 
            }
        }

        // Listas Individuales Ordenadas
        const renderResumenIndividual = (datos, uiElement) => {
            if (!uiElement) return;
            uiElement.innerHTML = '';
            let items = Object.entries(datos);
            items.sort((a, b) => a[0].localeCompare(b[0]));

            const idxColectivo = items.findIndex(i => i[0].toLowerCase().includes("colectivo"));
            if (idxColectivo > -1) {
                const [itemColectivo] = items.splice(idxColectivo, 1);
                items.unshift(itemColectivo);
            }

            if (items.length === 0) {
                uiElement.innerHTML = '<li style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">Sin gastos registrados.</li>';
            } else {
                items.forEach(([cat, total]) => {
                    uiElement.innerHTML += `<li><span>${cat}</span> <strong>${formatoARS(total)}</strong></li>`;
                });
            }
        };

        renderResumenIndividual(resultados.individuales.mostri, listaMostriUI);
        renderResumenIndividual(resultados.individuales.mostrina, listaMostrinaUI);

        // Stock Categorizado
        if (listaStockUI) {
            listaStockUI.innerHTML = '';
            if (Object.keys(resultados.inventario).length === 0) {
                listaStockUI.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">No hay productos registrados en comestibles.</p>';
            } else {
                for (const [categoria, productos] of Object.entries(resultados.inventario)) {
                    const catTitle = document.createElement('h4');
                    catTitle.style.cssText = "color: #2e7d32; border-bottom: 1px solid #a5d6a7; padding-bottom: 5px; margin-top: 15px; margin-bottom: 10px;";
                    catTitle.textContent = categoria;
                    listaStockUI.appendChild(catTitle);

                    const ul = document.createElement('ul');
                    ul.className = "lista-minimal";
                    
                    const items = Object.values(productos).sort((a, b) => a.nombre.localeCompare(b.nombre));
                    items.forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>${item.nombre}</span> <span style="font-weight: bold; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">${item.cantidad} ${item.unidad}</span>`;
                        ul.appendChild(li);
                    });
                    listaStockUI.appendChild(ul);
                }
            }
        }

    } catch (error) {
        console.error("Error al cargar datos: ", error);
        valDeuda.textContent = "Error al cargar";
    }
});