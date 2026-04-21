import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager(); 
    const urlParams = new URLSearchParams(window.location.search);
    const hogarId = urlParams.get('id');

    let hogarData = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user || !hogarId) {
            window.location.href = 'index.html';
            return;
        }

        const snapHogar = await getDoc(doc(db, "hogares", hogarId));
        if (snapHogar.exists()) {
            hogarData = snapHogar.data();
            
            const esAdmin = hogarData.administradores && hogarData.administradores.includes(user.uid);
            
            if (!esAdmin) {
                toast.mostrar("⚠️ Acceso denegado. Solo administradores.");
                setTimeout(() => window.location.href = 'index.html', 1500);
                return;
            }

            // 1. Inyectamos el nombre y preparamos el link de categorías
            document.getElementById('display-nombre-hogar').textContent = hogarData.nombre;
            document.getElementById('edit-nombre-hogar').value = hogarData.nombre;
            
            // Buscamos el link del menú que va a admin_hogar y le pegamos el ID
            const linkCategorias = document.querySelector('a[href*="admin_hogar.html"]');
            if(linkCategorias) linkCategorias.href = `admin_hogar.html?id=${hogarId}`;

            renderizarMiembros(hogarData.miembros, hogarData.administradores, user.uid);
        } else {
            toast.mostrar("El hogar no existe.");
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
    });

    // 2. LÓGICA DE EDICIÓN DE NOMBRE (Con el lápiz ✏️)
    const btnToggleEdit = document.getElementById('btn-edit-name-toggle');
    const boxEditName = document.getElementById('edit-name-box');
    const displayNombre = document.getElementById('display-nombre-hogar');

    if(btnToggleEdit) {
        btnToggleEdit.addEventListener('click', () => {
            boxEditName.style.display = boxEditName.style.display === 'none' ? 'flex' : 'none';
        });
    }

    document.getElementById('btn-actualizar-nombre').addEventListener('click', async () => {
        const nuevoNombre = document.getElementById('edit-nombre-hogar').value.trim();
        if(!nuevoNombre) return toast.mostrar("El nombre no puede estar vacío");
        
        await updateDoc(doc(db, "hogares", hogarId), { nombre: nuevoNombre });
        displayNombre.textContent = nuevoNombre;
        boxEditName.style.display = 'none'; // Ocultamos el form tras guardar
        toast.mostrar("¡Nombre actualizado!");
    });

    // 3. COPIAR LINK DE INVITACIÓN (Aplica para el botón + y para el menú navegable)
    const copiarLinkInvitacion = () => {
        if(!hogarData) return;
        const codigo = hogarData.codigo_invitacion;
        const urlBase = window.location.origin + window.location.pathname.replace('config_hogar.html', 'index.html');
        navigator.clipboard.writeText(`${urlBase}?join=${codigo}`);
        toast.mostrar("¡Link copiado al portapapeles! 🔗");
    };

    document.getElementById('btn-compartir-invitacion').addEventListener('click', copiarLinkInvitacion);

    // 4. ELIMINAR HOGAR
    const modalDelete = document.getElementById('modal-confirm-delete');
    
    document.getElementById('btn-eliminar-hogar').addEventListener('click', () => {
        modalDelete.style.display = 'flex';
    });

    document.getElementById('btn-cancelar-delete').addEventListener('click', () => {
        modalDelete.style.display = 'none';
    });

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
            toast.mostrar("Error al intentar eliminar.");
            btnConfirmar.textContent = "Sí, Eliminar";
            btnConfirmar.disabled = false;
        }
    });

    // 5. RENDERIZAR MIEMBROS (Con avatar circular)
    async function renderizarMiembros(uids, admins, miUid) {
        const lista = document.getElementById('lista-gestion-miembros');
        lista.innerHTML = '';

        for (const uid of uids) {
            const snapUser = await getDoc(doc(db, "usuarios", uid));
            const userData = snapUser.exists() ? snapUser.data() : { nombre: "Usuario" };
            
            const esEsteUserAdmin = admins.includes(uid);
            const inicial = userData.nombre.charAt(0).toUpperCase(); // Sacamos la primera letra

            const li = document.createElement('li');
            li.className = 'flex-between mb-10';
            li.style.border = "1px solid var(--border-color)";
            li.style.borderRadius = "8px";
            li.style.background = "var(--bg-card)";
            li.style.padding = "10px 15px";

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="avatar-circle">${inicial}</div>
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: var(--text-main); font-size: 1.05rem;">
                            ${userData.nombre} ${esEsteUserAdmin ? '⭐' : ''}
                        </strong>
                        <small style="color: var(--text-muted);">${uid === miUid ? '(Vos)' : ''}</small>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${uid !== miUid ? `
                        <button class="btn-toggle-admin btn-secondary" data-uid="${uid}" data-isadmin="${esEsteUserAdmin}" style="padding: 6px 10px; font-size: 0.8rem; margin: 0;">
                            ${esEsteUserAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                        </button>
                        <button class="btn-delete-member" data-uid="${uid}" style="background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer; padding: 0 5px;" title="Expulsar">🗑️</button>
                    ` : ''}
                </div>
            `;
            lista.appendChild(li);
        }
        
        asignarEventosMiembros();
    }

    function asignarEventosMiembros() {
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

        document.querySelectorAll('.btn-delete-member').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const estaSeguro = await confirmacion.preguntar("Expulsar Miembro", "¿Seguro que querés expulsar a esta persona del hogar? Sus gastos previos quedarán intactos.");
                
                if(estaSeguro) {
                    const targetUid = e.currentTarget.dataset.uid;
                    const docRef = doc(db, "hogares", hogarId);
                    
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