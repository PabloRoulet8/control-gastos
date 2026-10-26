import { db, auth } from "../firebase-config.js"; 
import { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class GastoRepository {
    constructor() {
        this.coleccionGastos = collection(db, "gastos");
        this.coleccionHogares = collection(db, "hogares");
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

    async obtenerGastos(contexto) {
        const usuarioActual = auth.currentUser;
        if (!usuarioActual) return [];

        const tipoConsulta = typeof contexto === 'object' ? contexto.tipo : (contexto === 'personal' ? 'personal' : 'hogar');
        const idConsulta = typeof contexto === 'object' ? contexto.id : contexto;

        const rutaColeccion = tipoConsulta === 'personal'
            ? collection(db, 'usuarios', usuarioActual.uid, 'gastos')
            : collection(db, 'hogares', idConsulta, 'gastos');

        const snapshot = await getDocs(rutaColeccion);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            administradores: [usuarioActual.uid],
            fecha_creacion: serverTimestamp(),
            codigo_invitacion: codigoGenerado
        };

        console.log('[DEBUG] 3.1 Creando documento en /hogares...');
        const docRef = await addDoc(this.coleccionHogares, nuevoHogar);
        console.log('[DEBUG] 3.2 Documento /hogares creado. ID:', docRef.id);

        try {
            console.log('[DEBUG] 3.3 Guardando configuración inicial en /config...');
            await this.guardarConfiguracionHogar(docRef.id, { fondo_comun: 0 });
            console.log('[DEBUG] 3.4 Configuración inicial guardada');
        } catch (error) {
            console.warn("[DEBUG] No se pudo guardar la configuración inicial del hogar:", error);
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