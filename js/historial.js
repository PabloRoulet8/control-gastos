import { db } from "./firebase-config.js";
import { collection, getDocs, doc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const listaGastos = document.getElementById('lista-gastos');

    const cargarHistorial = async () => {
        listaGastos.innerHTML = '<p style="text-align:center; padding:20px;">Cargando movimientos...</p>';
        
        try {
            const q = query(collection(db, "gastos"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            
            listaGastos.innerHTML = ''; 

            if (querySnapshot.empty) {
                listaGastos.innerHTML = '<p style="text-align:center; padding:20px;">No hay gastos registrados aún.</p>';
                return;
            }

            querySnapshot.forEach((documento) => {
                const data = documento.data();
                const id = documento.id;
                
                const item = document.createElement('div');
                // Utilizamos los colores correctos para la interfaz
                const esMostri = (data.responsable === 'pablo' || data.responsable === 'mostri');
                let claseTipo = data.tipo === 'individual' ? (esMostri ? 'individual-pablo' : 'individual-yanet') : 'general';
                item.className = `gasto-item ${claseTipo}`;
                
                item.innerHTML = `
                    <div class="gasto-info">
                        <strong>${data.categoria}</strong> 
                        <span class="fecha">${data.fecha} — ${data.responsable.toUpperCase()}</span>
                    </div>
                    <div class="gasto-acciones">
                        <span class="monto">$ ${data.monto.toLocaleString('es-AR')}</span>
                        <button class="btn-eliminar" data-id="${id}" title="Eliminar">🗑️</button>
                    </div>
                `;
                listaGastos.appendChild(item);
            });

            document.querySelectorAll('.btn-eliminar').forEach(boton => {
                boton.addEventListener('click', async (e) => {
                    const idGasto = e.currentTarget.getAttribute('data-id');
                    const confirmar = confirm("¿Querés eliminar este registro?");
                    
                    if (confirmar) {
                        try {
                            await deleteDoc(doc(db, "gastos", idGasto));
                            cargarHistorial(); 
                        } catch (error) {
                            alert("Error al borrar: " + error.message);
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error:", error);
            listaGastos.innerHTML = '<p>Error al conectar. Revisá tu conexión.</p>';
        }
    };

    cargarHistorial();
});