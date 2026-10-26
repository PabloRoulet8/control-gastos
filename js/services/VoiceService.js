export class VoiceService {
    constructor({
        lang = 'es-AR',
        continuous = false,
        interimResults = true,
        maxAlternatives = 1,
        reinicioDemoraMs = 300,
        SpeechRecognitionClass = null,
        onStateChange = () => {},
        onInterim = () => {},
        onFinal = () => {},
        onReadyToConsolidate = () => {},
        onError = () => {},
        onFatalError = () => {}
    } = {}) {
        this.SpeechRecognitionClass = SpeechRecognitionClass
            || (typeof window !== 'undefined'
                ? (window.SpeechRecognition || window.webkitSpeechRecognition)
                : null);

        this.lang = lang;
        this.continuous = continuous;
        this.interimResults = interimResults;
        this.maxAlternatives = maxAlternatives;
        this.reinicioDemoraMs = reinicioDemoraMs;

        this.reconocimiento = null;
        this.temporizadorReinicio = null;

        this.isRecording = false;
        this.stopSolicitado = false;
        this.yaConsolidado = false;

        this.fragmentosConfirmados = [];
        this.transcripcionInterina = '';

        this.onStateChange = typeof onStateChange === 'function' ? onStateChange : () => {};
        this.onInterim = typeof onInterim === 'function' ? onInterim : () => {};
        this.onFinal = typeof onFinal === 'function' ? onFinal : () => {};
        this.onReadyToConsolidate = typeof onReadyToConsolidate === 'function' ? onReadyToConsolidate : () => {};
        this.onError = typeof onError === 'function' ? onError : () => {};
        this.onFatalError = typeof onFatalError === 'function' ? onFatalError : () => {};
    }

    isSupported() {
        return Boolean(this.SpeechRecognitionClass);
    }

    configurar() {
        if (!this.isSupported()) return false;

        try {
            this.reconocimiento = new this.SpeechRecognitionClass();
        } catch (error) {
            console.error('No se pudo crear el reconocedor de voz:', error);
            return false;
        }

        this.reconocimiento.lang = this.lang;
        this.reconocimiento.continuous = this.continuous;
        this.reconocimiento.interimResults = this.interimResults;
        this.reconocimiento.maxAlternatives = this.maxAlternatives;

        this.reconocimiento.onstart = () => {
            if (this.stopSolicitado) return;
            this.isRecording = true;
            this.onStateChange('recording');
        };

        this.reconocimiento.onresult = (evento) => {
            this.transcripcionInterina = '';

            for (let i = evento.resultIndex; i < evento.results.length; i++) {
                const resultado = evento.results[i];
                const texto = (resultado[0]?.transcript || '').trim();
                if (!texto) continue;

                if (resultado.isFinal) {
                    const ultimo = this.fragmentosConfirmados[this.fragmentosConfirmados.length - 1];
                    if (ultimo && ultimo === texto) {
                        continue;
                    }
                    this.fragmentosConfirmados.push(texto);
                    this.onFinal(this.getSnapshot());
                } else {
                    this.transcripcionInterina = texto;
                    this.onInterim(this.getSnapshot());
                }
            }

            if (this.stopSolicitado && !this.transcripcionInterina) {
                this.onReadyToConsolidate(this.getSnapshot());
            }
        };

        this.reconocimiento.onerror = (evento) => {
            const codigo = evento.error;
            console.warn('Error de reconocimiento de voz:', codigo);

            if (this.stopSolicitado) return;

            const fatales = ['not-allowed', 'service-not-allowed', 'audio-capture'];
            if (fatales.includes(codigo)) {
                this.onFatalError(codigo);
                this.limpiarTemporizador();
                return;
            }

            this.onError(codigo);
        };

        this.reconocimiento.onend = () => {
            if (this.yaConsolidado) {
                this.isRecording = false;
                this.limpiarTemporizador();
                return;
            }

            if (this.stopSolicitado) {
                if (this.transcripcionInterina) {
                    const ultimo = this.fragmentosConfirmados[this.fragmentosConfirmados.length - 1];
                    if (!(ultimo && ultimo === this.transcripcionInterina)) {
                        this.fragmentosConfirmados.push(this.transcripcionInterina);
                    }
                    this.transcripcionInterina = '';
                    this.onFinal(this.getSnapshot());
                }
                this.onReadyToConsolidate(this.getSnapshot());
                return;
            }

            if (!this.isRecording) return;

            if (this.transcripcionInterina) {
                const ultimo = this.fragmentosConfirmados[this.fragmentosConfirmados.length - 1];
                if (!(ultimo && ultimo === this.transcripcionInterina)) {
                    this.fragmentosConfirmados.push(this.transcripcionInterina);
                }
                this.transcripcionInterina = '';
                this.onFinal(this.getSnapshot());
            }

            this.limpiarTemporizador();
            this.temporizadorReinicio = setTimeout(() => {
                if (!this.isRecording || this.stopSolicitado || this.yaConsolidado) return;
                try {
                    this.reconocimiento?.start();
                } catch (e) {}
            }, this.reinicioDemoraMs);
        };

        return true;
    }

    limpiarTemporizador() {
        if (this.temporizadorReinicio) {
            clearTimeout(this.temporizadorReinicio);
            this.temporizadorReinicio = null;
        }
    }

    reset() {
        this.isRecording = false;
        this.stopSolicitado = false;
        this.yaConsolidado = false;
        this.fragmentosConfirmados = [];
        this.transcripcionInterina = '';
        this.limpiarTemporizador();
        this.onStateChange('idle');
        this.onInterim(this.getSnapshot());
    }

    iniciar() {
        if (!this.isSupported()) return false;
        if (this.isRecording) return false;

        this.reset();
        if (!this.reconocimiento && !this.configurar()) return false;

        try {
            this.isRecording = true;
            this.stopSolicitado = false;
            this.yaConsolidado = false;
            this.reconocimiento.start();
            this.onStateChange('recording');
            return true;
        } catch (error) {
            if (error.name === 'InvalidStateError') {
                console.warn('El reconocimiento ya estaba activo.');
                return true;
            }
            console.error('Error al iniciar the dictado por voz:', error);
            this.onFatalError('start-failed');
            this.reset();
            return false;
        }
    }

    detener() {
        if (!this.isRecording || this.stopSolicitado) return false;
        this.isRecording = false;
        this.stopSolicitado = true;
        this.onStateChange('processing');
        try {
            this.reconocimiento?.stop();
            return true;
        } catch (error) {
            this.onReadyToConsolidate(this.getSnapshot());
            return false;
        }
    }

    abortar() {
        this.limpiarTemporizador();
        if (this.reconocimiento) {
            try {
                this.reconocimiento.abort();
            } catch (error) {
                console.warn('No se pudo abortar the reconocimiento:', error);
            }
        }
        this.reset();
    }

    getSnapshot() {
        return {
            fragmentosConfirmados: [...this.fragmentosConfirmados],
            transcripcionInterina: this.transcripcionInterina
        };
    }

    marcarConsolidado() {
        this.yaConsolidado = true;
        this.isRecording = false;
        this.stopSolicitado = false;
        this.limpiarTemporizador();
    }

    obtenerTextoConsolidado() {
        if (this.transcripcionInterina) {
            const ultimo = this.fragmentosConfirmados[this.fragmentosConfirmados.length - 1];
            if (!(ultimo && ultimo === this.transcripcionInterina)) {
                this.fragmentosConfirmados.push(this.transcripcionInterina);
            }
            this.transcripcionInterina = '';
        }
        return this.fragmentosConfirmados.join(' ').replace(/\s+/g, ' ').trim();
    }
}
