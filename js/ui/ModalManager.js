export class ModalManager {
    constructor(modalId, inputId, confirmId, cancelId) {
        this.modal = document.getElementById(modalId);
        this.input = document.getElementById(inputId);
        this.btnConfirm = document.getElementById(confirmId);
        this.btnCancel = document.getElementById(cancelId);
    }

    solicitarEntrada() {
        return new Promise((resolve) => {
            this.modal.style.display = 'flex';
            this.input.value = '';
            this.input.focus();

            const cleanup = () => {
                this.modal.style.display = 'none';
                this.btnConfirm.removeEventListener('click', onConfirm);
                this.btnCancel.removeEventListener('click', onCancel);
            };

            const onConfirm = () => {
                cleanup();
                resolve(this.input.value.trim());
            };

            const onCancel = () => {
                cleanup();
                resolve(null);
            };

            this.btnConfirm.addEventListener('click', onConfirm);
            this.btnCancel.addEventListener('click', onCancel);
        });
    }
}