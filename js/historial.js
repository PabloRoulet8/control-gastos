import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', async () => {
    const listaGastos = document.getElementById('lista-gastos');

    const cargarHistorial = async () => {
        listaGastos.innerHTML = '<p style="text-align:center; padding:20px;">Cargando movimientos...</p>';
        
        try {
            // Traemos los gastos ordenados por el más reciente arriba
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
                // Clase dinámica según el tipo de gasto
                let claseTipo = data.tipo === 'individual' ? `individual-${data.responsable}` : 'general';
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

            // Lógica para el botón de eliminar
            document.querySelectorAll('.btn-eliminar').forEach(boton => {
                boton.addEventListener('click', async (e) => {
                    const idGasto = e.currentTarget.getAttribute('data-id');
                    const confirmar = confirm("¿Querés eliminar este registro?");
                    
                    if (confirmar) {
                        try {
                            await deleteDoc(doc(db, "gastos", idGasto));
                            cargarHistorial(); // Refrescamos la lista automáticamente
                        } catch (error) {
                            alert("Error al borrar: " + error.message);
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error:", error);
            listaGastos.innerHTML = '<p>Error al conectar con la base de datos.</p>';
        }
    };

    cargarHistorial();
});