/* ============================================================
   VENTAS PERSONALIZADAS — api.js
   Comunicación con Apps Script + rama mock (CFG.isMock()).

   Regla del proyecto (CLAUDE.md): nunca fetch() directo — todo pasa por
   apiPost(). Todo endpoint nuevo necesita su rama mock acá.
   ============================================================ */

/* ─── FETCH HELPER ────────────────────────────────────────── */

async function apiPost(body) {
  const sesToken = (typeof SESSION !== 'undefined') ? SESSION.token : '';
  const res = await fetch(CFG.apiUrl, {
    method: 'POST',
    body: JSON.stringify(Object.assign(
      sesToken ? { session_token: sesToken } : {},
      body
    )),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json;
}

/* ─── MOCK: datos locales ─────────────────────────────────── */

let _mockGestiones = null;
let _mockVentas = null;
let _mockPagos = null;
let _mockPedidos = null;

async function _loadMockData() {
  if (_mockGestiones) return;
  const [g, v, pv, p] = await Promise.all([
    fetch('src/data/gestiones.json').then(r => r.json()),
    fetch('src/data/ventas.json').then(r => r.json()),
    fetch('src/data/pagos_venta.json').then(r => r.json()),
    fetch('src/data/pedidos_mock.json').then(r => r.json()),
  ]);
  _mockGestiones = g;
  _mockVentas = v;
  _mockPagos = pv;
  _mockPedidos = p;
}

function _mockNextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}

/* ─── GESTIONES ───────────────────────────────────────────── */

async function apiListGestiones(filters) {
  filters = filters || {};
  if (CFG.isMock()) {
    await _loadMockData();
    let rows = _mockGestiones.slice();
    if (filters.estado_gestion) rows = rows.filter(r => r.estado_gestion === filters.estado_gestion);
    if (filters.canal_ingreso)  rows = rows.filter(r => r.canal_ingreso === filters.canal_ingreso);
    return { ok: true, data: rows };
  }
  return apiPost(Object.assign({ action: 'listGestiones' }, filters));
}

async function apiGetGestionById(id) {
  if (CFG.isMock()) {
    await _loadMockData();
    const data = _mockGestiones.find(r => r.id === Number(id));
    const venta = _mockVentas.find(v => v.id_gestion === Number(id)) || null;
    return { ok: true, data, venta };
  }
  return apiPost({ action: 'getGestionById', id: Number(id) });
}

async function apiCreateGestion(data) {
  if (CFG.isMock()) {
    await _loadMockData();
    const id = _mockNextId(_mockGestiones);
    const now = new Date().toISOString();
    _mockGestiones.push(Object.assign({
      id, estado_gestion: 'Pendiente', fecha_contacto: '', agente_contacto: '',
      fecha_creacion: now, fecha_modificacion: now, creado_por: 'demo@local', modificado_por: 'demo@local',
    }, data));
    return { ok: true, id };
  }
  return apiPost({ action: 'createGestion', data });
}

async function apiRegistrarContacto(id, data) {
  if (CFG.isMock()) {
    await _loadMockData();
    const row = _mockGestiones.find(r => r.id === Number(id));
    if (row) {
      Object.assign(row, data);
      if (data.estado_gestion === 'Contactado') {
        row.fecha_contacto = new Date().toISOString();
        row.agente_contacto = 'demo@local';
      }
      row.fecha_modificacion = new Date().toISOString();
    }
    return { ok: true };
  }
  return apiPost({ action: 'registrarContacto', id: Number(id), data });
}

/* ─── PROXY DE PEDIDOS (vtex-control-center) ─────────────── */

async function apiBuscarPedidosCliente(documento) {
  documento = normalizeDocumentoInput(documento);
  if (CFG.isMock()) {
    await _loadMockData();
    const pedidos = _mockPedidos.filter(p => p._documento === documento);
    return { ok: true, data: { documento, total_pedidos: pedidos.length, pedidos: pedidos.map(({ _documento, ...rest }) => rest) } };
  }
  return apiPost({ action: 'buscarPedidosCliente', documento });
}

/* ─── VENTAS ──────────────────────────────────────────────── */

async function apiListVentas(filters) {
  filters = filters || {};
  if (CFG.isMock()) {
    await _loadMockData();
    let rows = _mockVentas.slice();
    if (filters.estado_venta) rows = rows.filter(r => r.estado_venta === filters.estado_venta);
    return { ok: true, data: rows };
  }
  // No hay acción listVentas en el backend todavía — placeholder para cuando se agregue.
  return { ok: true, data: [] };
}

async function apiCrearVenta(data) {
  if (CFG.isMock()) {
    await _loadMockData();
    const id = _mockNextId(_mockVentas);
    const now = new Date().toISOString();
    _mockVentas.push(Object.assign({
      id, estado_venta: 'Pago pendiente', fecha_aprobacion_pago: '',
      fecha_creacion: now, fecha_modificacion: now, creado_por: 'demo@local', modificado_por: 'demo@local',
    }, data));
    return { ok: true, id };
  }
  return apiPost({ action: 'crearVenta', data });
}

async function apiAgregarPagoVenta(data) {
  if (CFG.isMock()) {
    await _loadMockData();
    const id = _mockNextId(_mockPagos);
    _mockPagos.push(Object.assign({ id, fecha_creacion: new Date().toISOString(), creado_por: 'demo@local' }, data));
    return { ok: true, id };
  }
  return apiPost({ action: 'agregarPagoVenta', data });
}

async function apiListPagosVenta(idVenta) {
  if (CFG.isMock()) {
    await _loadMockData();
    return _mockPagos.filter(p => p.id_venta === Number(idVenta));
  }
  // Sin acción dedicada en el backend todavía — se deriva del detalle de getGestionById
  // o se agrega una acción listPagosVenta cuando haga falta mostrarlos en detalle.
  return [];
}

async function apiSubirComprobante(data) {
  if (CFG.isMock()) return { ok: true, id: 1 };
  return apiPost({ action: 'subirComprobante', data });
}

async function apiAprobarPagoVenta(id) {
  if (CFG.isMock()) {
    await _loadMockData();
    const row = _mockVentas.find(r => r.id === Number(id));
    if (row) { row.estado_venta = 'Pago aprobado'; row.fecha_aprobacion_pago = new Date().toISOString(); }
    return { ok: true, warning: 'Modo demo: no se llamó a VTEX (esto tampoco ocurre en producción — ver CLAUDE.md).' };
  }
  return apiPost({ action: 'aprobarPagoVenta', id: Number(id) });
}

/* ─── RESUMEN ─────────────────────────────────────────────── */

async function apiGetResumen() {
  if (CFG.isMock()) {
    await _loadMockData();
    const total = _mockGestiones.length;
    const porEstado = {};
    _mockGestiones.forEach(g => { porEstado[g.estado_gestion] = (porEstado[g.estado_gestion] || 0) + 1; });
    const contactados = (porEstado['Contactado'] || 0) + (porEstado['Concretado'] || 0) + (porEstado['Descartado'] || 0);
    const concretados = porEstado['Concretado'] || 0;
    const porEstadoVenta = {};
    _mockVentas.forEach(v => { porEstadoVenta[v.estado_venta] = (porEstadoVenta[v.estado_venta] || 0) + 1; });
    return {
      ok: true,
      data: {
        gestiones: {
          total,
          por_estado: porEstado,
          tasa_contacto_pct: total ? Math.round((contactados / total) * 1000) / 10 : 0,
          tasa_conversion_pct: total ? Math.round((concretados / total) * 1000) / 10 : 0,
        },
        ventas: { total: _mockVentas.length, por_estado: porEstadoVenta },
      },
    };
  }
  return apiPost({ action: 'getResumen' });
}
