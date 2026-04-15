import { db } from "../firebase-config.js";
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
        return await addDoc(this.coleccionGastos, nuevoGasto);
    }

    async obtenerGastos(filtros = null) {
        let q = this.coleccionGastos;
        
        // Si le pasamos filtros, arma la consulta automáticamente
        if (filtros && filtros.desde) {
            q = query(q, where("fecha", ">=", filtros.desde));
        } else if (filtros && filtros.ordenPor) {
            q = query(q, orderBy(filtros.ordenPor, filtros.ordenDireccion || "desc"));
        }
        
        const snapshot = await getDocs(q);
        // Devuelve un array limpio con los datos y el ID, sin objetos raros de Firebase
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async eliminarGasto(idGasto) {
        return await deleteDoc(doc(db, "gastos", idGasto));
    }

    // ==========================================
    // MÉTODOS PARA CATEGORÍAS
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

    // ==========================================
    // MÉTODOS PARA ESTADO DE DEUDAS
    // ==========================================
    async obtenerEstadoDeudas() {
        const docSnap = await getDoc(doc(db, "config", "estado_deudas"));
        return docSnap.exists() ? docSnap.data() : {};
    }

    async guardarEstadoDeuda(mes, estaSaldado) {
        await setDoc(doc(db, "config", "estado_deudas"), { [mes]: estaSaldado }, { merge: true });
    }
}