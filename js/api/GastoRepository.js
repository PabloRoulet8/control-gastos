import { db, auth } from "../firebase-config.js"; 
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class GastoRepository {
    constructor() {
        this.coleccionGastos = collection(db, "gastos");
        this.docCategorias = doc(db, "config", "categorias");
    }

    // ==========================================
    // MÉTODOS PARA GASTOS
    // ==========================================
    async guardarGasto(nuevoGasto) {
        // 1. Verificamos que haya un usuario logueado
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) {
            throw new Error("Acceso denegado: No hay usuario autenticado.");
        }

        // 2. Le estampamos la firma digital secreta al gasto
        const gastoFirmado = {
            ...nuevoGasto,
            usuario_id: usuarioActual.uid,       
            creador_email: usuarioActual.email,  
            hogar_id: "hogar_default_1"          
        };

        return await addDoc(this.coleccionGastos, gastoFirmado);
    }

    async obtenerGastos(filtros = null) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) return [];

        let q = this.coleccionGastos;
        
        // Si le pasamos filtros, arma la consulta automáticamente
        if (filtros && filtros.desde) {
            q = query(q, where("fecha", ">=", filtros.desde));
        } else if (filtros && filtros.ordenPor) {
            q = query(q, orderBy(filtros.ordenPor, filtros.ordenDireccion || "desc"));
        }
        
        const snapshot = await getDocs(q);
        
       // FILTRO DE SEGURIDAD EN EL CLIENTE
        const gastosFiltrados = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(gasto => {
                // Aceptamos el hogar nuevo o los que no tienen hogar (viejos)
                const esDeMiHogar = gasto.hogar_id === "hogar_default_1" || !gasto.hogar_id; 
                const esGastoGeneral = gasto.tipo === 'general';
                // Aceptamos los míos o los viejos que no tienen ID
                const esMiGastoIndividual = gasto.tipo === 'individual' && (gasto.usuario_id === usuarioActual.uid || !gasto.usuario_id);
                
                return esDeMiHogar && (esGastoGeneral || esMiGastoIndividual);
            });
            
        // ¡LA LÍNEA MÁGICA QUE FALTABA!
        return gastosFiltrados; 
    }

    async eliminarGasto(idGasto) {
        return await deleteDoc(doc(db, "gastos", idGasto));
    }

    // ==========================================
    // MÉTODOS PARA CATEGORÍAS Y DEUDAS (Sin cambios)
    // ==========================================
    async obtenerCategorias() {
        const docSnap = await getDoc(this.docCategorias);
        return docSnap.exists() ? docSnap.data() : null;
    }

    async inicializarCategorias(categoriasDefault) {
        await setDoc(this.docCategorias, categoriasDefault);
    }

    async actualizarCategorias(nuevasCategorias) {
        await updateDoc(this.docCategorias, nuevasCategorias);
    }

    async obtenerEstadoDeudas() {
        const docSnap = await getDoc(doc(db, "config", "estado_deudas"));
        return docSnap.exists() ? docSnap.data() : {};
    }

    async guardarEstadoDeuda(mes, estaSaldado) {
        await setDoc(doc(db, "config", "estado_deudas"), { [mes]: estaSaldado }, { merge: true });
    }
}