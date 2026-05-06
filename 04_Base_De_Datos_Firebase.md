### ARCHIVO js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKqmEWdxbUZKDPdUIghdrtgGkGdEudFr8",
    authDomain: "control-gastos-cf09c.firebaseapp.com",
    projectId: "control-gastos-cf09c",
    storageBucket: "control-gastos-cf09c.firebasestorage.app",
    messagingSenderId: "350200153131",
    appId: "1:350200153131:web:e11a4b4fc5e5ba0310966e"
};

// 1. Inicializamos la App
const app = initializeApp(firebaseConfig);

// 2. Inicializamos Autenticación
const auth = getAuth(app); 

// 3. Inicializamos Base de Datos (con la nueva sintaxis para caché offline)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

// Exportamos auth y db para que el resto de la app los use
export { db, auth };

### ARCHIVO js/api/GastoRepository.js

import { db, auth } from "../firebase-config.js"; 
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class GastoRepository {
    constructor() {
        this.coleccionGastos = collection(db, "gastos");
        this.coleccionHogares = collection(db, "hogares");
    }

    async guardarGasto(nuevoGasto, contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        let gastoFirmado = {
            ...nuevoGasto,
            usuario_id: usuarioActual.uid,       
            creador_email: usuarioActual.email,  
            timestamp: serverTimestamp(), 
        };

        if (contexto.tipo === 'personal') {
            gastoFirmado.ambito = 'personal'; 
        } else if (contexto.tipo === 'hogar') {
            gastoFirmado.ambito = 'hogar';
            gastoFirmado.hogar_id = contexto.id;
        }

        return await addDoc(this.coleccionGastos, gastoFirmado);
    }

    async obtenerGastos(contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) return [];

        let q = this.coleccionGastos;
        
        const tipoConsulta = typeof contexto === 'object' ? contexto.tipo : (contexto === 'personal' ? 'personal' : 'hogar');
        const idConsulta = typeof contexto === 'object' ? contexto.id : contexto;

        if (tipoConsulta === 'personal') {
            q = query(q, where("ambito", "==", "personal"), where("usuario_id", "==", usuarioActual.uid));
        } else {
            q = query(q, where("ambito", "==", "hogar"), where("hogar_id", "==", idConsulta));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async eliminarGasto(idGasto, contexto = null) {
        return await deleteDoc(doc(db, "gastos", idGasto));
    }

    async registrarPagoDeuda(contexto, pagadorId, acreedorId, monto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        const pagoFirmado = {
            tipo: 'pagoDeuda', // Etiqueta clave para diferenciarlo de un gasto de súper
            pagador_id: pagadorId,
            receptor_id: acreedorId,
            monto: parseFloat(monto),
            fecha: new Date().toISOString().split('T')[0],
            timestamp: serverTimestamp(),
            usuario_id: usuarioActual.uid,       
            ambito: 'hogar',
            hogar_id: contexto.id
        };

        return await addDoc(this.coleccionGastos, pagoFirmado);
    }

    // 🔥 FIX CRÍTICO: Ahora busca en las colecciones correctas de la nueva arquitectura
    async obtenerCategorias(contextoId, tipo) {
        if (tipo === 'personal') {
            const docSnap = await getDoc(doc(db, "usuarios", contextoId));
            return docSnap.exists() ? docSnap.data().categorias_personales : null;
        } else if (tipo === 'hogar') {
            const docSnap = await getDoc(doc(db, "hogares", contextoId));
            return docSnap.exists() ? docSnap.data().categorias_compartidas : null;
        }
        return null;
    }
    
    async obtenerConfiguracionHogar(hogarId) {
        const docSnap = await getDoc(doc(db, "config", `hogar_config_${hogarId}`));
        return docSnap.exists() ? docSnap.data() : null;
    }

    async guardarConfiguracionHogar(hogarId, dataConfig) {
        await setDoc(doc(db, "config", `hogar_config_${hogarId}`), dataConfig, { merge: true });
    }

    async obtenerMisHogares() {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) return [];
        const q = query(this.coleccionHogares, where("miembros", "array-contains", usuarioActual.uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async crearHogar(nombreHogar) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        const codigoGenerado = Math.random().toString(36).substring(2, 8).toUpperCase();

        const nuevoHogar = {
            nombre: nombreHogar,
            creador_id: usuarioActual.uid,
            miembros: [usuarioActual.uid], 
            fecha_creacion: serverTimestamp(),
            codigo_invitacion: codigoGenerado
        };

        const docRef = await addDoc(this.coleccionHogares, nuevoHogar);

        // Guardamos configuración inicial
        await this.guardarConfiguracionHogar(docRef.id, { fondo_comun: 0 });
        
        return { id: docRef.id, nombre: nombreHogar };
    }

    async unirseAHogar(codigoStr) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        const codigoLimpio = codigoStr.trim().toUpperCase();

        const q = query(this.coleccionHogares, where("codigo_invitacion", "==", codigoLimpio));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error("Código inválido. Revisá bien lo que escribiste.");
        }

        const hogarDoc = snapshot.docs[0];
        const hogarData = hogarDoc.data();

        if (hogarData.miembros.includes(usuarioActual.uid)) {
            throw new Error("Ya sos miembro de este hogar.");
        }

        const nuevosMiembros = [...hogarData.miembros, usuarioActual.uid];
        await updateDoc(doc(db, "hogares", hogarDoc.id), { miembros: nuevosMiembros });

        return hogarData.nombre;
    }

    async obtenerEstadoDeudas(contextoId) {
        const docSnap = await getDoc(doc(db, "config", `estado_deudas_${contextoId}`));
        return docSnap.exists() ? docSnap.data() : {};
    }

    async guardarEstadoDeuda(contextoId, mes, estaSaldado) {
        await setDoc(doc(db, "config", `estado_deudas_${contextoId}`), { [mes]: estaSaldado }, { merge: true });
    }

    // ==========================================
    // HERRAMIENTA DE RESCATE DE DATOS VIEJOS
    // ==========================================
    async migrarDatosViejos(hogarIdDestino) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        const snapshot = await getDocs(this.coleccionGastos);
        let promesas = [];
        let contador = 0;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.ambito) {
                const ref = doc(db, "gastos", docSnap.id);
                promesas.push(updateDoc(ref, {
                    ambito: 'hogar',
                    hogar_id: hogarIdDestino,
                    usuario_id: usuarioActual.uid
                }));
                contador++;
            }
        });

        await Promise.all(promesas);
        return contador;
    }
}