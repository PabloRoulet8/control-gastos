import { db, auth } from "../firebase-config.js"; 
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, writeBatch, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class GastoRepository {
    constructor() {
        this.coleccionHogares = collection(db, "hogares");
    }

    async obtenerUsuario(uid) {
        if (!uid) return null;

        const snapshot = await getDoc(doc(db, "usuarios", uid));
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    }

    async actualizarUsuario(uid, datos) {
        if (!uid) throw new Error("El usuario es obligatorio.");

        await setDoc(doc(db, "usuarios", uid), datos, { merge: true });
        return { id: uid, ...datos };
    }

    async guardarGasto(nuevoGasto, contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        if (!contexto || !['personal', 'hogar'].includes(contexto.tipo)) {
            throw new Error("Contexto de guardado inválido.");
        }

        if (contexto.tipo === 'hogar' && !contexto.id) {
            throw new Error("El contexto de hogar requiere un ID.");
        }

        let gastoFirmado = {
            ...nuevoGasto,
            usuario_id: usuarioActual.uid,       
            creador_email: usuarioActual.email,  
            timestamp: serverTimestamp(), 
        };

        if (contexto.tipo === 'personal') {
            gastoFirmado.ambito = 'personal'; 
        } else {
            gastoFirmado.ambito = 'hogar';
            gastoFirmado.hogar_id = contexto.id;
        }

        const rutaColeccion = contexto.tipo === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', contexto.id, 'gastos');

        return await addDoc(rutaColeccion, gastoFirmado);
    }

    async guardarGastosEnLote(arrayGastos, contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        if (!Array.isArray(arrayGastos) || arrayGastos.length === 0) {
            return [];
        }

        if (arrayGastos.length > 500) {
            throw new Error("El lote supera el límite de 500 operaciones de Firestore.");
        }

        if (!contexto || !['personal', 'hogar'].includes(contexto.tipo)) {
            throw new Error("Contexto de guardado inválido.");
        }

        if (contexto.tipo === 'hogar' && !contexto.id) {
            throw new Error("El contexto de hogar requiere un ID.");
        }

        const rutaColeccion = contexto.tipo === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', contexto.id, 'gastos');

        const batch = writeBatch(db);
        const referencias = [];

        for (const gasto of arrayGastos) {
            const gastoFirmado = {
                ...gasto,
                usuario_id: usuarioActual.uid,
                creador_email: usuarioActual.email,
                timestamp: serverTimestamp()
            };

            if (contexto.tipo === 'personal') {
                gastoFirmado.ambito = 'personal';
            } else {
                gastoFirmado.ambito = 'hogar';
                gastoFirmado.hogar_id = contexto.id;
            }

            const referencia = doc(rutaColeccion);
            batch.set(referencia, gastoFirmado);
            referencias.push(referencia);
        }

        await batch.commit();
        return referencias;
    }

    async obtenerGastos(contexto, opciones = {}) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) return [];

        const tipoConsulta = typeof contexto === 'object' ? contexto.tipo : (contexto === 'personal' ? 'personal' : 'hogar');
        const idConsulta = typeof contexto === 'object' ? contexto.id : contexto;

        const rutaColeccion = tipoConsulta === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', idConsulta, 'gastos');

        const { fechaInicio = null, fechaFin = null, limite = null, orden = 'desc' } = opciones || {};
        const sentidoOrden = orden === 'asc' ? 'asc' : 'desc';
        const limiteNumerico = Number(limite);
        const tieneLimite = Number.isFinite(limiteNumerico) && limiteNumerico > 0;
        const restricciones = [];

        if (fechaInicio) restricciones.push(where('fecha', '>=', fechaInicio));
        if (fechaFin) restricciones.push(where('fecha', '<=', fechaFin));
        if (fechaInicio || fechaFin || tieneLimite) restricciones.push(orderBy('fecha', sentidoOrden));
        if (tieneLimite) restricciones.push(limit(limiteNumerico));

        const consulta = restricciones.length > 0 ? query(rutaColeccion, ...restricciones) : rutaColeccion;

        try {
            const snapshot = await getDocs(consulta);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            if (!fechaInicio && !fechaFin) throw error;

            console.warn("No se pudo aplicar la consulta por rango. Se reintenta con filtrado local.", error);
            const snapshot = await getDocs(rutaColeccion);
            let gastos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            gastos = this.filtrarGastosPorRango(gastos, fechaInicio, fechaFin);
            gastos = this.ordenarGastosPorFecha(gastos, sentidoOrden);
            return tieneLimite ? gastos.slice(0, limiteNumerico) : gastos;
        }
    }

    async obtenerGastosPorRango(contexto, rango = {}) {
        return this.obtenerGastos(contexto, rango);
    }

    async obtenerGastosPorCompra(compraId, contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual || !compraId) return [];

        const tipoConsulta = typeof contexto === 'object' ? contexto.tipo : (contexto === 'personal' ? 'personal' : 'hogar');
        const idConsulta = typeof contexto === 'object' ? contexto.id : contexto;

        const rutaColeccion = tipoConsulta === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', idConsulta, 'gastos');

        const consulta = query(rutaColeccion, where('compra_id', '==', compraId));
        const snapshot = await getDocs(consulta);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    normalizarFechaGasto(fecha) {
        if (!fecha) return '';
        if (typeof fecha === 'string') return fecha.slice(0, 10);
        if (typeof fecha.toDate === 'function') return fecha.toDate().toISOString().slice(0, 10);
        if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) return fecha.toISOString().slice(0, 10);
        return '';
    }

    filtrarGastosPorRango(gastos, fechaInicio = null, fechaFin = null) {
        return gastos.filter(gasto => {
            const fecha = this.normalizarFechaGasto(gasto.fecha);
            if (!fecha) return false;
            if (fechaInicio && fecha < fechaInicio) return false;
            if (fechaFin && fecha > fechaFin) return false;
            return true;
        });
    }

    ordenarGastosPorFecha(gastos, orden = 'desc') {
        const factor = orden === 'asc' ? 1 : -1;
        return gastos.sort((a, b) => {
            const fechaA = this.normalizarFechaGasto(a.fecha);
            const fechaB = this.normalizarFechaGasto(b.fecha);
            return fechaA.localeCompare(fechaB) * factor;
        });
    }

    async eliminarGasto(idGasto, contexto = null) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        if (!contexto || !['personal', 'hogar'].includes(contexto.tipo)) {
            throw new Error("Contexto inválido para eliminar el gasto.");
        }

        if (contexto.tipo === 'hogar' && !contexto.id) {
            throw new Error("El contexto de hogar requiere un ID.");
        }

        const rutaColeccion = contexto.tipo === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', contexto.id, 'gastos');

        return await deleteDoc(doc(rutaColeccion, idGasto));
    }

    async registrarPagoDeuda(contexto, pagadorId, acreedorId, monto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        if (!contexto || !contexto.id) {
            throw new Error("El contexto de hogar requiere un ID.");
        }

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

        const rutaColeccion = collection(db, 'hogares', contexto.id, 'gastos');

        return await addDoc(rutaColeccion, pagoFirmado);
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

    async obtenerMisHogares(uid = auth.currentUser?.uid) {
        if (!uid) return [];
        const q = query(this.coleccionHogares, where("miembros", "array-contains", uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async obtenerHogar(hogarId) {
        if (!hogarId) return null;

        const snapshot = await getDoc(doc(db, "hogares", hogarId));
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    }

    async actualizarHogar(hogarId, datos) {
        if (!hogarId) throw new Error("El hogar es obligatorio.");

        await updateDoc(doc(db, "hogares", hogarId), datos);
    }

    async eliminarHogar(hogarId) {
        if (!hogarId) throw new Error("El hogar es obligatorio.");

        await deleteDoc(doc(db, "hogares", hogarId));
    }

    async actualizarAdministrador(hogarId, uid, esAdmin) {
        if (!hogarId || !uid) throw new Error("El hogar y el usuario son obligatorios.");

        await updateDoc(doc(db, "hogares", hogarId), {
            administradores: esAdmin ? arrayUnion(uid) : arrayRemove(uid)
        });
    }

    async expulsarMiembro(hogarId, uid) {
        if (!hogarId || !uid) throw new Error("El hogar y el usuario son obligatorios.");

        await updateDoc(doc(db, "hogares", hogarId), {
            miembros: arrayRemove(uid),
            administradores: arrayRemove(uid)
        });
    }

    async crearHogar(nombreHogar) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) throw new Error("Acceso denegado.");

        const codigoGenerado = Math.random().toString(36).substring(2, 8).toUpperCase();

        const nuevoHogar = {
            nombre: nombreHogar,
            creador_id: usuarioActual.uid,
            miembros: [usuarioActual.uid],
            administradores: [usuarioActual.uid],
            fecha_creacion: serverTimestamp(),
            codigo_invitacion: codigoGenerado
        };

        const docRef = await addDoc(this.coleccionHogares, nuevoHogar);

        try {
            await this.guardarConfiguracionHogar(docRef.id, { fondo_comun: 0 });
        } catch (error) {
            console.warn("No se pudo guardar la configuración inicial del hogar:", error);
        }
        
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
}