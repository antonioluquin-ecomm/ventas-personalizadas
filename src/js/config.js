/* ============================================================
   VENTAS PERSONALIZADAS — config.js
   Configuración global, constantes, estado de la app
   ============================================================ */

'use strict';

/* ─── VERSIÓN ─────────────────────────────────────────────── */

const VERSION = {
  number: '0.1.0',
  date:   '2026-07-15',
  notes:  'Primer avance del frontend — login, shell, Gestiones, Ventas, Seguimiento',
};

const CHANGELOG = [
  { v: '0.1.0', date: '2026-07-15', desc: 'Primer avance del frontend: login, shell (sidebar/topbar), módulos Gestiones/Ventas/Seguimiento conectados al backend.' },
];

/* ─── VOCABULARIOS CONTROLADOS (espejo de apps-script/Schema.gs) ─── */

const CANAL_INGRESO   = ['Bot', 'Recontacto Cancelados'];
const ESTADOS_GESTION = ['Pendiente', 'Contactado', 'Concretado', 'Descartado'];
const ESTADOS_VENTA   = ['Pago pendiente', 'Pago aprobado', 'Cancelada'];
const ORIGENES_VENTA  = ['Referido', 'Atención', 'Bot', 'Planilla'];
const TIPO_FACTURA    = ['B', 'A'];
const MEDIOS_PAGO     = ['Payway', 'MercadoPago', 'GOcuotas', 'Transferencia por Mercado Pago', 'Transferencia por Banco y retenciones', 'Giftcards'];
const PAYWAY_TIPO     = ['Débito', 'Crédito'];
const TARJETA_ENTIDAD = ['Visa', 'Mastercard'];

/* ─── ESTADO GLOBAL ───────────────────────────────────────── */

const STATE = {
  gestiones: null,      // null = no cargado aún
  ventas: null,         // null = no cargado aún
  resumen: null,        // null = no cargado aún

  gestionesFilters: {
    estado_gestion: '',
    canal_ingreso: '',
  },

  // Resultado de la última búsqueda de pedidos por documento (buscarPedidosCliente)
  busquedaPedidos: null, // { documento, total_pedidos, pedidos } | null

  editingGestionId: null,
  editingVentaId: null,
};

/* ─── MÓDULOS RBAC ─────────────────────────────────────────────
 * Fuente de verdad del frontend (sincronizar con MODULOS_RBAC en
 * apps-script/Schema.gs). */
const MODULOS = ['gestiones', 'ventas', 'seguimiento'];
const MODULO_LABELS = {
  gestiones:   'Gestiones',
  ventas:      'Ventas',
  seguimiento: 'Seguimiento',
};

/* ─── CONFIG (localStorage) ───────────────────────────────── */

// Completar con la URL real del Web App cuando se haga el primer deploy
// (ver docs/gas-setup.md). Sin esta URL, la app arranca en modo demo.
const APPS_SCRIPT_URL = '';

const CFG = {
  get apiUrl()  { return localStorage.getItem('vp_api_url') || APPS_SCRIPT_URL; },
  set apiUrl(v) { if (v) { localStorage.setItem('vp_api_url', v); } else { localStorage.removeItem('vp_api_url'); } },

  isMock() {
    if (localStorage.getItem('vp_demo') === '1') return true;
    if (/[?&]demo=1\b/.test(location.search)) return true;
    return !this.apiUrl;
  },
};

/* ─── THEME GLOBAL ─────────────────────────────────────────────── */

const THEME_STORAGE_KEY = 'vp_theme';

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  _updateThemeToggles(next);
}

function _updateThemeToggles(theme) {
  const t = theme || getCurrentTheme();
  const isLight = t === 'light';
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    var icon = btn.querySelector('.th-icon');
    var text = btn.querySelector('.th-text');
    if (icon) icon.textContent = isLight ? '☀️' : '🌙';
    if (text) text.textContent = isLight ? 'Claro' : 'Oscuro';
    btn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    btn.setAttribute('title', isLight ? 'Modo claro' : 'Modo oscuro');
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}

function toggleTheme() {
  setTheme(getCurrentTheme() === 'light' ? 'dark' : 'light');
}

/* ─── VERSION BADGE ────────────────────────────────────────── */

function initVersionBadge() {
  const span    = document.getElementById('sidebarVersion');
  const btn     = document.getElementById('sidebarVersionBtn');
  const popover = document.getElementById('versionPopover');
  if (!span) return;
  span.textContent = `v${VERSION.number}`;
  if (!btn || !popover || !CHANGELOG.length) return;
  popover.innerHTML =
    '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--sidebar-line)">Historial de cambios</div>'
    + CHANGELOG.map(c =>
      `<div style="margin-bottom:8px;">`
      + `<span style="font-weight:600;font-size:13px;">v${c.v}</span>`
      + `<span style="color:var(--muted);font-size:11px;margin-left:6px;">${c.date}</span>`
      + `<div style="font-size:12px;margin-top:2px;line-height:1.4;">${c.desc}</div>`
      + `</div>`
    ).join('');
  btn.style.cursor = 'pointer';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { popover.style.display = 'none'; });
}

/* ─── HELPERS DE FORMATO ───────────────────────────────────── */

function formatARS(value) {
  return '$' + Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function normalizeDocumentoInput(value) {
  return String(value || '').replace(/\D/g, '');
}
