/* ============================================================
   VENTAS PERSONALIZADAS — ui.js
   Navegación entre páginas SPA, toast, helpers de UI genéricos.
   ============================================================ */

const PAGE_TITLES = {
  inicio: 'Inicio',
  gestiones: 'Gestiones',
  ventas: 'Ventas',
  seguimiento: 'Seguimiento',
  config: 'Configuración',
};

let _currentPage = 'inicio';

function showPage(page) {
  if (!PAGE_TITLES.hasOwnProperty(page)) return;
  if (page !== 'inicio' && page !== 'config' && !SESSION.canView(page)) return;

  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-page]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const crumb = document.getElementById('topbar-crumb');
  if (crumb) crumb.textContent = PAGE_TITLES[page] || page;

  _currentPage = page;
  restrictWriteIfAgent(page);
  closeSidebarMobile();

  // Carga lazy por módulo — solo la primera vez que se navega ahí.
  if (page === 'gestiones' && STATE.gestiones === null) loadGestiones();
  if (page === 'ventas' && STATE.ventas === null) loadVentas();
  if (page === 'seguimiento') loadResumen();
  if (page === 'inicio') loadResumen();
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

/* ─── TOAST ───────────────────────────────────────────────── */

let _toastTimer = null;
function toast(icon, msg, type) {
  const el   = document.getElementById('toast');
  const ic   = document.getElementById('toast-icon');
  const text = document.getElementById('toast-msg');
  if (!el) return;
  ic.textContent = icon || '✓';
  text.textContent = msg || '';
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.remove('show'); }, 3200);
}

/* ─── BADGES DE ESTADO ────────────────────────────────────── */

function estadoGestionBadgeClass(estado) {
  const map = { 'Pendiente': 'e-pendiente', 'Contactado': 'e-contactado', 'Concretado': 'e-concretado', 'Descartado': 'e-descartado' };
  return map[estado] || '';
}

function estadoVentaBadgeClass(estado) {
  const map = { 'Pago pendiente': 'e-pago-pendiente', 'Pago aprobado': 'e-pago-aprobado', 'Cancelada': 'e-cancelada' };
  return map[estado] || '';
}
