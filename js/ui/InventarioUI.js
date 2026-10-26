export class InventarioUI {
    static renderizarLista(arrayInventario, contenedorLista, inputMonto, seccionStock, onDeleteCallback) {
        if (!contenedorLista) return;

        const inventario = Array.isArray(arrayInventario) ? arrayInventario : [];
        const manejarBorrado = typeof onDeleteCallback === 'function'
            ? onDeleteCallback
            : () => {};

        contenedorLista.innerHTML = '';

        inventario.forEach((item, index) => {
            const producto = item || {};
            const precio = Number(producto.precio) || 0;

            const li = document.createElement('li');
            li.className = 'flex-between p-10 border-bottom-gray';

            const descripcion = document.createElement('span');
            const nombre = document.createElement('strong');
            nombre.textContent = String(producto.producto ?? '');
            descripcion.appendChild(nombre);
            descripcion.appendChild(document.createTextNode(
                ` (${Number(producto.cantidad) || 0} ${String(producto.unidad ?? '')})`
            ));

            const acciones = document.createElement('div');
            acciones.className = 'flex-center inv-item-acciones';

            if (precio > 0) {
                const precioEl = document.createElement('strong');
                precioEl.textContent = `$${precio.toLocaleString('es-AR')}`;
                acciones.appendChild(precioEl);
            }

            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'btn-icon-danger btn-delete-item';
            boton.dataset.index = String(index);
            boton.title = 'Eliminar producto';
            boton.setAttribute('aria-label', 'Eliminar producto del inventario');
            boton.innerHTML = '<i data-lucide="trash-2"></i>';

            acciones.appendChild(boton);
            li.appendChild(descripcion);
            li.appendChild(acciones);
            contenedorLista.appendChild(li);
        });

        contenedorLista.querySelectorAll('.btn-delete-item').forEach(boton => {
            boton.onclick = () => {
                const indice = Number(boton.dataset.index);
                if (!Number.isInteger(indice)) return;
                manejarBorrado(indice);
            };
        });

        window.lucide?.createIcons();

        const totalInventario = inventario.reduce(
            (acumulado, item) => acumulado + (Number(item?.precio) || 0),
            0
        );

        if (inputMonto) {
            if (totalInventario > 0) {
                inputMonto.value = totalInventario.toFixed(2);
                inputMonto.readOnly = true;
            } else {
                inputMonto.readOnly = false;
            }

            inputMonto.dispatchEvent(new Event('input', { bubbles: true }));
            inputMonto.dispatchEvent(new Event('change', { bubbles: true }));
        }

        contenedorLista.dispatchEvent(new Event('change', { bubbles: true }));

        if (seccionStock && inventario.length > 0) {
            InventarioUI.actualizarVisibilidadSeccion(seccionStock, true);
        }
    }

    static actualizarVisibilidadSeccion(seccionStock, visible) {
        if (!seccionStock) return;
        seccionStock.style.display = visible ? 'block' : 'none';
    }
}
