import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const urlParams = new URLSearchParams(window.location.search);
    const hogarId = urlParams.get('id');

    let hogarData = null;

    onAuthStateChanged(auth, async (user) => {
        // Si no hay usuario o no hay ID de hogar, lo devolvemos al inicio
        if (!user || !hogarId) {
            window.location.href = 'index.html';
            return;
        }

        const snapHogar = await getDoc(doc(db, "hogares", hogarId));
        if (snapHogar.exists()) {
            hogarData = snapHogar.data();
            
            // VERIFICACIÓN DE SEGURIDAD: ¿Es Administrador?
            const esAdmin = hogarData.administradores && hogarData.administradores.includes(user.uid);
            
            if (!esAdmin) {
                toast.mostrar("⚠️ Acceso denegado. Solo administradores pueden ver esto.");
                setTimeout(() => window.location.href = 'index.html', 1500);
                return;
            }

            // Si es admin, cargamos los datos
            document.getElementById('edit-nombre-hogar').value = hogarData.nombre;
            renderizarMiembros(hogarData.miembros, hogarData.administradores, user.uid);
        } else {
            toast.mostrar("El hogar no existe.");
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
    });

    // 1. ACTUALIZAR NOMBRE
    document.getElementById('btn-actualizar-nombre').addEventListener('click', async () => {
        const nuevoNombre = document.getElementById('edit-nombre-hogar').value.trim();
        if(!nuevoNombre) return toast.mostrar("El nombre no puede estar vacío");
        
        await updateDoc(doc(db, "hogares", hogarId), { nombre: nuevoNombre });
        toast.mostrar("¡Nombre actualizado con éxito!");
    });

    // 2. COPIAR LINK DE INVITACIÓN
    document.getElementById('btn-compartir-invitacion').addEventListener('click', () => {
         const codigo = hogarData.codigo_invitacion;
         // Armamos el link dinámicamente según dónde esté alojada la app
         const urlBase = window.location.origin + window.location.pathname.replace('config_hogar.html', 'index.html');
         navigator.clipboard.writeText(`${urlBase}?join=${codigo}`);
         toast.mostrar("¡Link copiado al portapapeles! 🔗");
    });

    // 3. ELIMINAR HOGAR DEFINITIVAMENTE 
    const modalDelete = document.getElementById('modal-confirm-delete');
    
    // Al tocar el botón rojo grande, abrimos la ventanita
    document.getElementById('btn-eliminar-hogar').addEventListener('click', () => {
        modalDelete.style.display = 'flex';
    });

    // Si toca cancelar, simplemente ocultamos la ventanita
    document.getElementById('btn-cancelar-delete').addEventListener('click', () => {
        modalDelete.style.display = 'none';
    });

    // Si confirma, disparamos la eliminación real
    document.getElementById('btn-confirmar-delete').addEventListener('click', async () => {
        const btnConfirmar = document.getElementById('btn-confirmar-delete');
        btnConfirmar.textContent = "Eliminando...";
        btnConfirmar.disabled = true;

        try {
            await deleteDoc(doc(db, "hogares", hogarId));
            modalDelete.style.display = 'none';
            toast.mostrar("Hogar eliminado correctamente. 🗑️");
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (error) {
            console.error("Error al eliminar hogar:", error);
            toast.mostrar("Error al intentar eliminar.");
            btnConfirmar.textContent = "Sí, Eliminar";
            btnConfirmar.disabled = false;
        }
    });

    // --- RENDERIZADO DE MIEMBROS Y PERMISOS ---
    async function renderizarMiembros(uids, admins, miUid) {
        const lista = document.getElementById('lista-gestion-miembros');
        lista.innerHTML = '';

        for (const uid of uids) {
            // Buscamos el nombre de cada persona en la colección de usuarios
            const snapUser = await getDoc(doc(db, "usuarios", uid));
            const userData = snapUser.exists() ? snapUser.data() : { nombre: "Usuario Desconocido" };
            
            const esEsteUserAdmin = admins.includes(uid);

            const li = document.createElement('li');
            li.className = 'flex-between mb-10';
            li.style.border = "1px solid #ddd";
            li.style.borderRadius = "8px";
            li.style.background = "#fff";
            li.style.padding = "10px 15px";

            li.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: #333; font-size: 1.1rem;">
                        ${userData.nombre} ${esEsteUserAdmin ? '⭐' : ''}
                    </strong>
                    <small style="color: #888;">${uid === miUid ? '(Vos)' : ''}</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${uid !== miUid ? `
                        <button class="btn-toggle-admin btn-secondary" data-uid="${uid}" data-isadmin="${esEsteUserAdmin}" style="padding: 6px 12px; font-size: 0.85rem; margin: 0;">
                            ${esEsteUserAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                        </button>
                        <button class="btn-delete-member" data-uid="${uid}" style="background: none; border: none; color: #d32f2f; font-size: 1.4rem; cursor: pointer; padding: 0 5px;" title="Expulsar">🗑️</button>
                    ` : ''}
                </div>
            `;
            lista.appendChild(li);
        }
        
        asignarEventosMiembros();
    }

    function asignarEventosMiembros() {
        // Evento para dar o quitar permisos de Administrador
        document.querySelectorAll('.btn-toggle-admin').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetUid = e.target.dataset.uid;
                const isCurrentlyAdmin = e.target.dataset.isadmin === "true";
                const docRef = doc(db, "hogares", hogarId);
                
                if (isCurrentlyAdmin) {
                    await updateDoc(docRef, { administradores: arrayRemove(targetUid) });
                    toast.mostrar("Permisos de admin removidos.");
                } else {
                    await updateDoc(docRef, { administradores: arrayUnion(targetUid) });
                    toast.mostrar("¡Nuevo administrador asignado! ⭐");
                }
                
                setTimeout(() => window.location.reload(), 1000);
            });
        });

        // Evento para expulsar a un miembro
        document.querySelectorAll('.btn-delete-member').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("¿Seguro que querés expulsar a esta persona del hogar? Sus gastos previos quedarán registrados con su nombre.")) {
                    const targetUid = e.currentTarget.dataset.uid;
                    const docRef = doc(db, "hogares", hogarId);
                    
                    // Lo sacamos de la lista de miembros y de admins (por si acaso)
                    await updateDoc(docRef, { 
                        miembros: arrayRemove(targetUid),
                        administradores: arrayRemove(targetUid)
                    });
                    
                    toast.mostrar("Miembro expulsado del hogar 🥾");
                    setTimeout(() => window.location.reload(), 1000);
                }
            });
        });
    }
});