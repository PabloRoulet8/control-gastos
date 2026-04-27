export class HistorialRenderer {
      constructor() {
          this.listaGastosUI = document.getElementById('contenedor-gastos');
          this.filtroResponsable = document.getElementById('filtro-responsable');
          this.filtroCategoria = document.getElementById('filtro-categoria');
          this.modalFiltros = document.getElementById('modal-filtros');
          this.btnAbrirFiltros = document.getElementById('btn-abrir-filtros');
          this.btnCerrarFiltros = document.getElementById('btn-cerrar-filtros');
          this.btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
          this.btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
          
          this.initModalEvents();
          
          // Event Delegation para eliminación de gastos
          if (this.listaGastosUI) {
              this.listaGastosUI.addEventListener('click', (e) => {
                  const btn = e.target.closest('.btn-icon-danger');
                  if (btn) {
                      e.preventDefault();
                      e.stopPropagation();
                      const id = btn.getAttribute('data-id');
                      if (id && this.onDeleteCallback) {
                          this.onDeleteCallback(id);
                      }
                  }
              });
          }
      }
  
      initModalEvents() {
          if (this.btnAbrirFiltros && this.modalFiltros) {
              this.btnAbrirFiltros.addEventListener('click', () => {
                  this.modalFiltros.classList.add('active');
                  this.modalFiltros.querySelector('.modal-content').classList.add('active');
                  if (window.lucide) window.lucide.createIcons();
              });
          }
          
          if (this.btnCerrarFiltros && this.modalFiltros) {
              this.btnCerrarFiltros.addEventListener('click', () => {
                  this.cerrarModal();
              });
          }
          
          if (this.modalFiltros) {
              this.modalFiltros.addEventListener('click', (e) => {
                  if (e.target === this.modalFiltros) {
                      this.cerrarModal();
                  }
              });
          }
      }
  
      abrirModal() {
          if (this.modalFiltros) {
              this.modalFiltros.classList.add('active');
              this.modalFiltros.querySelector('.modal-content').classList.add('active');
              if (window.lucide) window.lucide.createIcons();
          }
      }
      
      cerrarModal() {
          if (this.modalFiltros) {
              this.modalFiltros.classList.remove('active');
              const content = this.modalFiltros.querySelector('.modal-content');
              if (content) content.classList.remove('active');
          }
      }
      
getMapeoTipo(gasto) {
          // Regla de seguridad: Si es un pago de deuda, color verde
          if (gasto.tipo === 'pagoDeuda') {
              return { color: 'var(--primary-color)' };
          }
  
          // Leemos la categoría para determinar el color del monto
          const categoria = (gasto.categoria || '').toLowerCase();
          
          const mapeo = {
              'servicios': { color: '#dc2626' },      // Rojo oscuro (cuentas)
              'alquiler': { color: '#dc2626' },
              'expensas': { color: '#dc2626' },
              'luz': { color: '#dc2626' },
              'agua': { color: '#dc2626' },
              'gas': { color: '#dc2626' },
              'internet': { color: '#dc2626' },
              'stock': { color: '#d97706' },         // Naranja oscuro (compras)
              'supermercado': { color: '#d97706' },
              'verduleria': { color: '#d97706' },
              'carniceria': { color: '#d97706' },
              'limpieza': { color: '#d97706' },
              'variable': { color: '#2563eb' },       // Azul oscuro (otros)
          };
  
          // Buscar coincidencia parcial
          for (const [key, value] of Object.entries(mapeo)) {
              if (categoria.includes(key)) {
                  return value;
              }
          }
  
          // Default: texto principal
          return { color: 'var(--text-main)' };
      }
  
      renderLista(gastosFiltrados, currentUser, ambitoActual, mapaNombres, onDeleteClick) {
          if (!this.listaGastosUI) return;
          this.listaGastosUI.innerHTML = '';
          this.onDeleteCallback = onDeleteClick;
  
          if (gastosFiltrados.length === 0) {
              this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20" style="color: var(--text-muted);">No hay movimientos con estos filtros.</p>';
              return;
          }
  
          // AGRUPAR POR FECHA
          const hoy = new Date();
          hoy.setHours(0,0,0,0);
          const haceUnaSemana = new Date(hoy); haceUnaSemana.setDate(hoy.getDate() - 7);
  
          const grupos = { 'Hoy': [], 'Ayer': [], 'Esta semana': [], 'Anterior': [] };
          
          gastosFiltrados.forEach(gasto => {
              if (!gasto.fecha) {
                  grupos['Anterior'].push(gasto);
                  return;
              }
              const fechaGasto = new Date(gasto.fecha + 'T00:00:00');
              if (fechaGasto.getTime() === hoy.getTime()) {
                  grupos['Hoy'].push(gasto);
              } else if (fechaGasto.getTime() === new Date(hoy.getTime() - 86400000).getTime()) {
                  grupos['Ayer'].push(gasto);
              } else if (fechaGasto >= haceUnaSemana) {
                  grupos['Esta semana'].push(gasto);
              } else {
                  grupos['Anterior'].push(gasto);
              }
          });
  
          // Renderizar cada grupo
          Object.entries(grupos).forEach(([nombreGrupo, gastos]) => {
              if (gastos.length === 0) return;
              
              const header = document.createElement('div');
              header.className = 'date-group-header';
              header.textContent = nombreGrupo;
              this.listaGastosUI.appendChild(header);
  
              gastos.forEach((gasto) => {
              const item = document.createElement('div');
              item.className = 'gasto-item';
              
              const parts = gasto.fecha ? gasto.fecha.split('-') : ['','',''];
              const fechaCorta = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : gasto.fecha;
              
              const esPago = gasto.tipo === 'pagoDeuda';
              const idDelResponsable = esPago ? gasto.pagador_id : gasto.responsable;
              const nombreResponsable = mapaNombres[idDelResponsable] || idDelResponsable || 'Usuario';
  
              // Color del monto según categoría
              const infoTipo = this.getMapeoTipo(gasto);
              const colorMonto = infoTipo.color;
  
const etiquetaCategoria = esPago ? 'Pago de Deuda' : (gasto.categoria || 'Sin categoría');
              const metodoPago = gasto.metodo_pago ? ` • ${gasto.metodo_pago}` : '';

              item.innerHTML = `
                  <div class="gasto-info">
                      <strong>${etiquetaCategoria}</strong> 
                      <span class="fecha">${fechaCorta}${metodoPago}</span>
                  </div>
                  <div class="gasto-acciones">
                      <span class="monto" style="color: ${colorMonto};">$ ${Number(gasto.monto).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      <button class="btn-icon-danger" data-id="${gasto.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                  </div>
              `;
              this.listaGastosUI.appendChild(item);
          });
  
});
   
// Inicializar iconos Lucide
          if (window.lucide) {
              window.lucide.createIcons();
          }
      }
   
      renderizarFiltrosResponsables(mapaNombres) {
          const select = document.getElementById('filtro-responsable');
          if (!select) return;
          
          const valorActual = select.value;
          select.innerHTML = '<option value="todos">Todos</option>';
          
          if (mapaNombres) {
              Object.entries(mapaNombres).forEach(([uid, nombre]) => {
                  const opt = document.createElement('option');
                  opt.value = uid;
                  opt.textContent = nombre;
                  select.appendChild(opt);
              });
          }
          
          if (valorActual && valorActual !== 'todos') {
              select.value = valorActual;
          }
      }
      
      renderizarFiltrosCategorias(categorias) {
          const select = document.getElementById('filtro-categoria');
          if (!select) return;
          
          const valorActual = select.value;
          select.innerHTML = '<option value="todas">Todas</option>';
          
          if (categorias && categorias.length > 0) {
              categorias.forEach(cat => {
                  const opt = document.createElement('option');
                  opt.value = cat;
                  opt.textContent = cat;
                  select.appendChild(opt);
              });
          }
          
          if (valorActual && valorActual !== 'todas') {
              select.value = valorActual;
          }
      }
      
      mostrarCargando() {
          if (this.listaGastosUI) {
              this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Cargando gastos...</p>';
          }
      }
      
      mostrarError() {
          if (this.listaGastosUI) {
              this.listaGastosUI.innerHTML = '<p class="text-center text-muted p-20">Error al cargar gastos.</p>';
          }
      }
  }