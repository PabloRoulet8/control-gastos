export class ConfirmManager {
    constructor(modalId = 'custom-confirm', titleId = 'confirm-title', messageId = 'confirm-message', btnOkId = 'confirm-ok', btnCancelId = 'confirm-cancel') {
        this.modal = document.getElementById(modalId);
        this.title = document.getElementById(titleId);
        this.message = document.getElementById(messageId);
        this.btnOk = document.getElementById(btnOkId);
        this.btnCancel = document.getElementById(btnCancelId);
    }

    preguntar(titulo, mensaje) {
        return new Promise((resolve) => {
            if (!this.modal) {
                // Respaldo por si nos olvidamos de poner el HTML en alguna página
                resolve(confirm(mensaje));
                return;
            }

            this.title.textContent = titulo;
            this.message.textContent = mensaje;
            this.modal.style.display = 'flex';

            const cleanup = () => {
                this.modal.style.display = 'none';
                this.btnOk.removeEventListener('click', onOk);
                this.btnCancel.removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            this.btnOk.addEventListener('click', onOk);
            this.btnCancel.addEventListener('click', onCancel);
        });
    }
}