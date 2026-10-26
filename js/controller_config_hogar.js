import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { HogarService } from "./services/HogarService.js";
import { ToastManager } from "./ui/ToastManager.js";
import { ConfirmManager } from "./ui/ConfirmManager.js";
import { NavigationBuilder } from "./utils/NavigationBuilder.js";

document.addEventListener('DOMContentLoaded', () => {
    const toast = new ToastManager();
    const confirmacion = new ConfirmManager(); 
    const urlParams = new URLSearchParams(window.location.search);
    const hogarId = urlParams.get('id');

    NavigationBuilder.buildNav('hogar', hogarId);

    // Botón Categorías y Fondos
    document.getElementById('btn-gestionar-categorias').href = 'admin_hogar.html?id=' + hogarId;

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

    // 3. GENERAR Y COMPARTIR LINK DE INVITACIÓN
    const btnCompartirInvitacion = document.getElementById('btn-compartir-invitacion');
    const inputLinkInvitacion = document.getElementById('link-invitacion-generado');

    const generarLinkInvitacion = async () => {
        if (!hogarData || !auth.currentUser) return;

        btnCompartirInvitacion.disabled = true;

        try {
            const { codigo } = await HogarService.generarInvitacion(db, hogarId, auth.currentUser.uid);
            const url = new URL('index.html', window.location.href);
            url.searchParams.set('hogarId', hogarId);
            url.searchParams.set('join', codigo);
            const link = url.toString();

            if (inputLinkInvitacion) {
                inputLinkInvitacion.value = link;
                inputLinkInvitacion.parentElement.style.display = 'block';
                inputLinkInvitacion.select();
            }

            try {
                await navigator.clipboard.writeText(link);
                toast.mostrar("¡Link de invitación copiado! 🔗");
            } catch (error) {
                toast.mostrar("Link generado. Copialo manualmente.");
            }
        } catch (error) {
            toast.mostrar(error.message || "No se pudo generar la invitación.");
        } finally {
            btnCompartirInvitacion.disabled = false;
        }
    };

    btnCompartirInvitacion.addEventListener('click', generarLinkInvitacion);

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
        lista.replaceChildren();

        for (const uid of uids) {
            const snapUser = await getDoc(doc(db, "perfiles_publicos", uid));
            const perfil = snapUser.exists() ? snapUser.data() : {};
            const nombreMostrar = perfil.nombre || "Usuario";
            
            const esEsteUserAdmin = admins.includes(uid);
            const inicial = nombreMostrar.charAt(0).toUpperCase();

            const li = document.createElement('li');
            li.className = 'flex-between mb-10';
            li.style.border = "1px solid var(--border-color)";
            li.style.borderRadius = "8px";
            li.style.background = "var(--bg-card)";
            li.style.padding = "10px 15px";

            const contenedorInfo = document.createElement('div');
            Object.assign(contenedorInfo.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            });

            const avatar = document.createElement('div');
            avatar.className = 'avatar-circle';
            avatar.textContent = inicial;

            const contenedorTexto = document.createElement('div');
            Object.assign(contenedorTexto.style, {
                display: 'flex',
                flexDirection: 'column'
            });

            const nombreElemento = document.createElement('strong');
            Object.assign(nombreElemento.style, {
                color: 'var(--text-main)',
                fontSize: '1.05rem'
            });
            nombreElemento.textContent = esEsteUserAdmin ? `${nombreMostrar} ⭐` : nombreMostrar;

            const etiquetaVos = document.createElement('small');
            Object.assign(etiquetaVos.style, {
                color: 'var(--text-muted)'
            });
            etiquetaVos.textContent = uid === miUid ? '(Vos)' : '';

            contenedorTexto.append(nombreElemento, etiquetaVos);
            contenedorInfo.append(avatar, contenedorTexto);

            const contenedorAcciones = document.createElement('div');
            Object.assign(contenedorAcciones.style, {
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
            });

            if (uid !== miUid) {
                const btnToggleAdmin = document.createElement('button');
                btnToggleAdmin.className = 'btn-toggle-admin btn-secondary';
                btnToggleAdmin.dataset.uid = uid;
                btnToggleAdmin.dataset.isadmin = String(esEsteUserAdmin);
                Object.assign(btnToggleAdmin.style, {
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    margin: '0'
                });
                btnToggleAdmin.textContent = esEsteUserAdmin ? 'Quitar Admin' : 'Hacer Admin';

                const btnEliminar = document.createElement('button');
                btnEliminar.className = 'btn-icon-danger btn-delete-member';
                btnEliminar.dataset.uid = uid;
                btnEliminar.title = 'Expulsar';

                const iconoEliminar = document.createElement('i');
                iconoEliminar.setAttribute('data-lucide', 'trash-2');
                btnEliminar.appendChild(iconoEliminar);

                contenedorAcciones.append(btnToggleAdmin, btnEliminar);
            }

            li.append(contenedorInfo, contenedorAcciones);
            lista.appendChild(li);
        }
        
        asignarEventosMiembros();
        
        if (window.lucide) window.lucide.createIcons();
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