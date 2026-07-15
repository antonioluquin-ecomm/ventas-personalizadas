/* ============================================================
   VENTAS PERSONALIZADAS — gestiones.js
   Búsqueda de cliente por DNI/documento, historial de pedidos,
   registro y seguimiento de gestiones de contacto.
   ============================================================ */

async function loadGestiones() {
  const body = document.getElementById('gestiones-list-body');
  if (body) body.innerHTML = '<div class="loader-wrap"><div class="spinner"></div> Cargando…</div>';
  try {
    const res = await apiListGestiones({});
    STATE.gestiones = res.data || [];
    renderGestionesList();
  } catch (err) {
    if (body) body.innerHTML = '<div class="empty"><div class="empty-title">Error al cargar</div><div class="empty-sub">' + escapeHtml(err.message) + '</div></div>';
  }
}

function renderGestionesList() {
  const body = document.getElementById('gestiones-list-body');
  if (!body) return;
  const f = STATE.gestionesFilters;
  let rows = (STATE.gestiones || []).slice();
  if (f.estado_gestion) rows = rows.filter(r => r.estado_gestion === f.estado_gestion);
  if (f.canal_ingreso)  rows = rows.filter(r => r.canal_ingreso === f.canal_ingreso);
  rows.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

  if (!rows.length) {
    body.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div class="empty-title">Sin gestiones</div><div class="empty-sub">Todavía no hay gestiones registradas con estos filtros.</div></div>';
    return;
  }

  body.innerHTML = '<div class="table-wrap">'
    + '<div class="table-head" style="grid-template-columns:70px 1fr 140px 110px 130px 90px">'
    + '<span>ID</span><span>Cliente</span><span>Canal</span><span>Estado</span><span>Contactado</span><span></span>'
    + '</div>'
    + rows.map(renderGestionRow).join('')
    + '</div>';
}

function renderGestionRow(g) {
  const puedeEditar = SESSION.canEdit('gestiones');
  const puedeContactar = puedeEditar && g.estado_gestion === 'Pendiente';
  return '<div class="table-row" style="grid-template-columns:70px 1fr 140px 110px 130px 90px" onclick="openGestionDetail(' + g.id + ')">'
    + '<span class="row-id">#' + g.id + '</span>'
    + '<span><div class="row-title">' + escapeHtml(g.cliente_nombre || g.cliente_documento) + '</div><div class="row-sub">DNI ' + escapeHtml(g.cliente_documento) + '</div></span>'
    + '<span class="row-sub">' + escapeHtml(g.canal_ingreso) + '</span>'
    + '<span><span class="estado-badge ' + estadoGestionBadgeClass(g.estado_gestion) + '">' + escapeHtml(g.estado_gestion) + '</span></span>'
    + '<span class="row-sub">' + (g.fecha_contacto ? formatFecha(g.fecha_contacto) : '—') + '</span>'
    + '<span class="row-actions">'
    + (puedeContactar ? '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();marcarContactado(' + g.id + ')">Contactado</button>' : '')
    + '</span>'
    + '</div>';
}

function updateGestionesFilters() {
  STATE.gestionesFilters.estado_gestion = document.getElementById('gest-filter-estado').value;
  STATE.gestionesFilters.canal_ingreso  = document.getElementById('gest-filter-canal').value;
  renderGestionesList();
}

async function marcarContactado(id) {
  try {
    await apiRegistrarContacto(id, { estado_gestion: 'Contactado' });
    toast('✓', 'Gestión #' + id + ' marcada como contactada', 'success');
    await loadGestiones();
  } catch (err) {
    toast('✕', err.message, 'error');
  }
}

function openGestionDetail(id) {
  // Detalle simple vía toast por ahora — un drawer de detalle queda para
  // la siguiente pasada del frontend (ver docs/roadmap.md).
  const g = (STATE.gestiones || []).find(r => r.id === id);
  if (!g) return;
  toast('📋', 'Gestión #' + g.id + ' — ' + (g.notas || 'sin notas'), '');
}

/* ─── BÚSQUEDA DE CLIENTE POR DNI ─────────────────────────── */

async function buscarCliente() {
  const input = document.getElementById('busqueda-documento');
  const documento = normalizeDocumentoInput(input.value);
  const resultBox = document.getElementById('busqueda-resultado');
  if (!documento) {
    toast('✕', 'Ingresá un DNI/CUIT válido', 'error');
    return;
  }

  resultBox.innerHTML = '<div class="loader-wrap"><div class="spinner"></div> Buscando pedidos…</div>';
  try {
    const res = await apiBuscarPedidosCliente(documento);
    STATE.busquedaPedidos = res.data;
    renderBusquedaResultado();
  } catch (err) {
    resultBox.innerHTML = '<div class="empty"><div class="empty-title">Error al buscar</div><div class="empty-sub">' + escapeHtml(err.message) + '</div></div>';
  }
}

function renderBusquedaResultado() {
  const resultBox = document.getElementById('busqueda-resultado');
  const data = STATE.busquedaPedidos;
  if (!data) { resultBox.innerHTML = ''; return; }

  if (!data.total_pedidos) {
    resultBox.innerHTML = '<div class="empty"><div class="empty-ico">🔍</div><div class="empty-title">Sin pedidos</div>'
      + '<div class="empty-sub">No se encontraron pedidos para el documento ' + escapeHtml(data.documento) + '.</div></div>';
    return;
  }

  const first = data.pedidos[0];
  resultBox.innerHTML = '<div class="form-section">'
    + '<div class="form-section-title">' + data.total_pedidos + ' pedido(s) encontrado(s) — ' + escapeHtml(first.client_name || '') + ' · ' + escapeHtml(first.client_phone || 'sin teléfono') + '</div>'
    + data.pedidos.map(renderPedidoCard).join('')
    + '<div style="margin-top:10px">'
    + '<button class="btn btn-primary admin-only" onclick="abrirFormRegistrarGestion()">+ Registrar gestión con este cliente</button>'
    + '</div>'
    + '</div>';
}

function renderPedidoCard(p) {
  const items = (p.items || []).map(i => escapeHtml(i.name) + ' ×' + i.quantity).join(', ');
  return '<div class="card" style="margin-bottom:8px;cursor:default">'
    + '<div class="flex-between">'
    + '<div><div class="row-title">Pedido ' + escapeHtml(p.sequence || p.order_id) + ' · ' + escapeHtml(p.store_id) + '</div>'
    + '<div class="row-sub">' + formatFecha(p.creation_date) + ' · ' + escapeHtml(p.payment_names || '') + '</div></div>'
    + '<div><span class="estado-badge ' + (p.status === 'canceled' ? 'e-cancelada' : p.status === 'invoiced' ? 'e-concretado' : 'e-pendiente') + '">' + escapeHtml(p.status_description) + '</span></div>'
    + '</div>'
    + '<div class="text-sm mt-8">' + items + '</div>'
    + '<div class="text-sm fw-600 mt-4">' + formatARS(p.value) + '</div>'
    + '</div>';
}

/* ─── REGISTRAR GESTIÓN (desde una búsqueda) ──────────────── */

function abrirFormRegistrarGestion() {
  const data = STATE.busquedaPedidos;
  if (!data || !data.total_pedidos) return;
  const first = data.pedidos[0];
  const canceladoReciente = data.pedidos.find(p => p.status === 'canceled');

  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('drawer');
  document.getElementById('drawer-title').textContent = 'Registrar gestión';
  document.getElementById('drawer-body').innerHTML =
    '<div class="form-group"><label class="form-label">Canal de ingreso</label>'
    + '<select class="select w-full" id="ng-canal">'
    + CANAL_INGRESO.map(c => '<option value="' + c + '"' + (c === 'Recontacto Cancelados' ? ' selected' : '') + '>' + c + '</option>').join('')
    + '</select></div>'
    + '<div class="form-group"><label class="form-label">Pedido de referencia</label>'
    + '<select class="select w-full" id="ng-pedido"><option value="">— Ninguno (consulta directa) —</option>'
    + data.pedidos.map(p => '<option value="' + p.order_id + '"' + (canceladoReciente && p.order_id === canceladoReciente.order_id ? ' selected' : '') + '>' + p.sequence + ' (' + p.status_description + ')</option>').join('')
    + '</select></div>'
    + '<div class="form-group"><label class="form-label">Notas</label><textarea class="input" id="ng-notas" rows="3"></textarea></div>';
  document.getElementById('drawer-footer').innerHTML =
    '<button class="btn btn-ghost" onclick="closeDrawer()">Cancelar</button>'
    + '<button class="btn btn-primary" onclick="guardarNuevaGestion()">Guardar</button>';

  overlay.classList.add('open');
  drawer.classList.add('open');
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

async function guardarNuevaGestion() {
  const data = STATE.busquedaPedidos;
  const first = data.pedidos[0];
  const canal = document.getElementById('ng-canal').value;
  const pedidoRef = document.getElementById('ng-pedido').value;
  const notas = document.getElementById('ng-notas').value;

  try {
    await apiCreateGestion({
      canal_ingreso: canal,
      cliente_documento: data.documento,
      cliente_nombre: first.client_name || '',
      cliente_telefono: first.client_phone || '',
      pedido_referencia: pedidoRef,
      cantidad_pedidos_cliente: data.total_pedidos,
      notas,
    });
    closeDrawer();
    toast('✓', 'Gestión registrada', 'success');
    STATE.gestiones = null; // forzar recarga
    if (_currentPage === 'gestiones') loadGestiones();
  } catch (err) {
    toast('✕', err.message, 'error');
  }
}
