// Inicializa los iconos declarativos de Lucide al final del body.
// Se carga como script externo para no necesitar 'unsafe-inline' en la CSP.
if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
}
