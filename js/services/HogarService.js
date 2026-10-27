import { db } from "../firebase-config.js";
import {
    arrayUnion,
    doc,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class HogarService {
    static DURACION_INVITACION_MS = 48 * 60 * 60 * 1000;

    static generarCodigoInvitacion() {
        const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = new Uint8Array(16);

        if (!globalThis.crypto?.getRandomValues) {
            throw new Error('No hay un generador de números seguros disponible.');
        }

        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => alfabeto[byte % alfabeto.length]).join('');
    }

    static async generarInvitacion(hogarId, adminUid) {
        if (!hogarId) throw new Error('El hogar es obligatorio.');
        if (!adminUid) throw new Error('El administrador es obligatorio.');

        const codigo = this.generarCodigoInvitacion();
        const expiraEn = Timestamp.fromDate(new Date(Date.now() + this.DURACION_INVITACION_MS));
        const invitacionRef = doc(db, 'hogares', hogarId, 'invitaciones', codigo);

        await setDoc(invitacionRef, {
            codigo,
            hogar_id: hogarId,
            creada_por: adminUid,
            creada_en: serverTimestamp(),
            expira_en: expiraEn,
            invitado_uid: null,
            estado: 'pendiente'
        });

        return { codigo, hogarId, expiraEn };
    }

    static async revocarInvitacion(hogarId, codigo, adminUid) {
        if (!hogarId) throw new Error('El hogar es obligatorio.');
        if (!adminUid) throw new Error('El administrador es obligatorio.');

        const codigoNormalizado = String(codigo || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{8,64}$/.test(codigoNormalizado)) {
            throw new Error('El código de invitación no es válido.');
        }

        const invitacionRef = doc(db, 'hogares', hogarId, 'invitaciones', codigoNormalizado);
        await updateDoc(invitacionRef, {
            estado: 'revocada',
            revocada_por: adminUid,
            revocada_en: serverTimestamp()
        });

        return { hogarId, codigo: codigoNormalizado, estado: 'revocada' };
    }

    static async consumirInvitacion(hogarId, codigo, usuarioUid) {
        if (!hogarId) throw new Error('El hogar es obligatorio.');
        if (!usuarioUid) throw new Error('El usuario es obligatorio.');

        const codigoNormalizado = String(codigo || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{8,64}$/.test(codigoNormalizado)) {
            throw new Error('El código de invitación no es válido.');
        }

        const invitacionRef = doc(db, 'hogares', hogarId, 'invitaciones', codigoNormalizado);
        const hogarRef = doc(db, 'hogares', hogarId);

        return runTransaction(db, async (transaction) => {
            const invitacionSnap = await transaction.get(invitacionRef);

            if (!invitacionSnap.exists()) {
                throw new Error('La invitación no existe o fue eliminada.');
            }

            const invitacion = invitacionSnap.data();

            if (invitacion.hogar_id !== hogarId) {
                throw new Error('La invitación no pertenece a este hogar.');
            }

            if (invitacion.codigo && invitacion.codigo !== codigoNormalizado) {
                throw new Error('El código de invitación no coincide.');
            }

            if (invitacion.estado === 'revocada') {
                throw new Error('La invitación fue revocada.');
            }

            if (invitacion.estado === 'usada') {
                throw new Error('La invitación ya fue utilizada.');
            }

            if (invitacion.estado !== 'pendiente') {
                throw new Error('La invitación no está disponible.');
            }

            const expiraMs = typeof invitacion.expira_en?.toMillis === 'function'
                ? invitacion.expira_en.toMillis()
                : new Date(invitacion.expira_en).getTime();

            if (!Number.isFinite(expiraMs) || expiraMs <= Date.now()) {
                throw new Error('La invitación expiró.');
            }

            if (invitacion.invitado_uid && invitacion.invitado_uid !== usuarioUid) {
                throw new Error('Esta invitación está reservada para otro usuario.');
            }

            transaction.update(invitacionRef, {
                estado: 'usada',
                usada_por: usuarioUid,
                usada_en: serverTimestamp()
            });

            transaction.update(hogarRef, {
                miembros: arrayUnion(usuarioUid),
                codigos_usados: arrayUnion(codigoNormalizado),
                ultima_invitacion: {
                    codigo: codigoNormalizado,
                    uid: usuarioUid
                }
            });

            return { hogarId, codigo: codigoNormalizado };
        });
    }
}