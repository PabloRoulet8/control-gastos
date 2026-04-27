export class NavigationBuilder {
    static buildNav(ambitoActual, hogarId = null, paginaActual = null) {
        const navContextual = document.getElementById('nav-contextual');
        if (!navContextual) return;

        const suffix = hogarId ? `&id=${hogarId}` : '';
        
        if (ambitoActual === 'unificado') {
            const isActive = paginaActual === 'resumen';
            navContextual.innerHTML = `
                <a href="resumen.html?v=9.5&ambito=unificado" class="nav-item ${isActive ? 'active' : ''}">
                    <span class="icon"><i data-lucide="trending-up"></i></span>
                    <span class="label">Unificado</span>
                </a>`;
        } else {
            const urlAmbito = ambitoActual === 'individual' ? 'personal' : ambitoActual;
            
            const pages = ['carga', 'historial', 'resumen'];
            const labels = ['Cargar', 'Historial', 'Resumen'];
            const icons = ['plus', 'file-text', 'bar-chart-2'];
            
            let html = '';
            pages.forEach((page, idx) => {
                const isActive = paginaActual === page;
                html += `
                <a href="${page}.html?v=9.5&ambito=${urlAmbito}${suffix}" class="nav-item ${isActive ? 'active' : ''}">
                    <span class="icon"><i data-lucide="${icons[idx]}"></i></span>
                    <span class="label">${labels[idx]}</span>
                </a>`;
            });
            
            navContextual.innerHTML = html;
        }
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    static buildConfigButton(ambitoActual, hogarId = null) {
        const headerSpacer = document.querySelector('.header-spacer');
        if (!headerSpacer || ambitoActual === 'unificado') return;

        const linkConfig = ambitoActual === 'hogar' || ambitoActual === 'individual' 
            ? (ambitoActual === 'hogar' ? `config_hogar.html?v=9.5&id=${hogarId}` : `perfil.html?v=9.5`)
            : `perfil.html?v=9.5`;

        headerSpacer.outerHTML = `
            <a href="${linkConfig}" class="btn-icon-white" title="Configuración" style="text-decoration: none; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="settings"></i>
            </a>`;
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    static normalizeAmbito(urlAmbito) {
        if (urlAmbito === 'personal' || urlAmbito === 'individual') {
            return 'personal';
        }
        return urlAmbito || 'personal';
    }
}