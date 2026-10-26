import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export class PerfilPublicoService {
    static async sincronizar(db, uid, nombre, avatarUrl) {
        if (!uid) throw new Error('El usuario es obligatorio.');

        const nombreLimpio = String(nombre || '').trim();
        if (!nombreLimpio) throw new Error('El nombre público es obligatorio.');
        if (nombreLimpio.length > 80) {
            throw new Error('El nombre público no puede superar los 80 caracteres.');
        }

        const avatarLimpio = avatarUrl == null ? '' : String(avatarUrl).trim();
        if (avatarLimpio.length > 500) {
            throw new Error('La URL del avatar no puede superar los 500 caracteres.');
        }

        await setDoc(doc(db, 'perfiles_publicos', uid), {
            nombre: nombreLimpio,
            avatar_url: avatarLimpio,
            actualizado_en: serverTimestamp()
        }, { merge: true });
    }

    static async obtener(db, uid) {
        if (!uid) return null;

        const snapshot = await getDoc(doc(db, 'perfiles_publicos', uid));
        return snapshot.exists()
            ? { id: snapshot.id, ...snapshot.data() }
            : null;
    }
}
