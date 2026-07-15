/* ============================================================
   VENTAS PERSONALIZADAS — ventas.js
   Alta de ventas, medios de pago múltiples, aprobación de pago.
   ============================================================ */

async function loadVentas() {
  const body = document.getElementById('ventas-list-body');
  if (body) body.innerHTML = '<div class="loader-wrap"><div class="spinner"></div> Cargando…</div>';
  try {
    const res = await apiListVentas({});
    STATE.ventas = res.data || [];
    renderVentasList();
  } catch (err) {
    if (body) body.innerHTML = '<div class="empty"><div class="empty-title">Error al cargar</div><div class="empty-sub">' + escapeHtml(err.message) + '</div></div>';
  }
}

function renderVentasList() {
  const body = document.getElementById('ventas-list-body');
  if (!body) return;
  const rows = (STATE.ventas || []).slice().sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

  if (!rows.length) {
    body.innerHTML = '<div class="empty"><div class="empty-ico">🧾</div><div class="empty-title">Sin ventas</div><div class="empty-sub">Todavía no hay ventas registradas.</div></div>';
    return;
  }

  body.innerHTML = '<div class="table-wrap">'
    + '<div class="table-head" style="grid-template-columns:70px 1fr 130px 110px 120px 140px">'
    + '<span>ID</span><span>Pedido / Cliente</span><span>Origen</span><span>Estado</span><span>Total</span><span></span>'
    + '</div>'
    + rows.map(renderVentaRow).join('')
    + '</div>';
}

function renderVentaRow(v) {
  const puedeEditar = SESSION.canEdit('ventas');
  return '<div class="table-row" style="grid-template-columns:70px 1fr 130px 110px 120px 140px" onclick="abrirGestionPagos(' + v.id + ')">'
    + '<span class="row-id">#' + v.id + '</span>'
    + '<span><div class="row-title">' + escapeHtml(v.order_id_vtex) + '</div><div class="row-sub">DNI ' + escapeHtml(v.cliente_documento) + '</div></span>'
    + '<span class="row-sub">' + escapeHtml(v.origen) + '</span>'
    + '<span><span class="estado-badge ' + estadoVentaBadgeClass(v.estado_venta) + '">' + escapeHtml(v.estado_venta) + '</span></span>'
    + '<span class="mono">' + formatARS(v.monto_total) + '</span>'
    + '<span class="row-actions">'
    + (puedeEditar && v.estado_venta === 'Pago pendiente' ? '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();abrirGestionPagos(' + v.id + ')">Gestionar pagos</button>' : '')
    + '</span>'
    + '</div>';
}

/* ─── NUEVA VENTA ─────────────────────────────────────────── */

function abrirFormNuevaVenta() {
  document.getElementById('drawer-title').textContent = 'Nueva venta';
  document.getElementById('drawer-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Pedido VTEX<span class="form-req">*</span></label>
        <input class="input" id="nv-order-id" placeholder="1234567890123-01"></div>
      <div class="form-group"><label class="form-label">DNI/CUIT cliente<span class="form-req">*</span></label>
        <input class="input" id="nv-documento" placeholder="30123456"></div>
    </div>
    <div class="form-group"><label class="form-label">Origen<span class="form-req">*</span></label>
      <div class="radio-row">
        ${ORIGENES_VENTA.map(o => `<label class="rb-label"><input type="radio" name="nv-origen" value="${o}"${o === 'Bot' ? ' checked' : ''}> ${o}</label>`).join('')}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nro. de caso</label><input class="input" id="nv-caso"></div>
      <div class="form-group"><label class="form-label">Monto total<span class="form-req">*</span></label><input class="input" id="nv-monto" type="number" step="0.01"></div>
    </div>
    <div class="form-group"><label class="form-label">Tipo de factura</label>
      <div class="radio-row">
        <label class="rb-label"><input type="radio" name="nv-factura" value="B" checked onchange="_toggleFacturaA()"> B</label>
        <label class="rb-label"><input type="radio" name="nv-factura" value="A" onchange="_toggleFacturaA()"> A</label>
      </div>
    </div>
    <div id="nv-factura-a-fields" hidden>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Razón social</label><input class="input" id="nv-razon-social"></div>
        <div class="form-group"><label class="form-label">CUIT</label><input class="input" id="nv-cuit"></div>
      </div>
    </div>
    <div class="form-group"><label class="cb-label"><input type="checkbox" id="nv-retencion"> Agente de retención</label></div>
  `;
  document.getElementById('drawer-footer').innerHTML =
    '<button class="btn btn-ghost" onclick="closeDrawer()">Cancelar</button>'
    + '<button class="btn btn-primary" onclick="guardarNuevaVenta()">Guardar</button>';

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function _toggleFacturaA() {
  const esA = document.querySelector('input[name="nv-factura"]:checked').value === 'A';
  document.getElementById('nv-factura-a-fields').hidden = !esA;
}

async function guardarNuevaVenta() {
  const orderId = document.getElementById('nv-order-id').value.trim();
  const documento = normalizeDocumentoInput(document.getElementById('nv-documento').value);
  const origen = document.querySelector('input[name="nv-origen"]:checked').value;
  const nroCaso = document.getElementById('nv-caso').value.trim();
  const monto = Number(document.getElementById('nv-monto').value || 0);
  const tipoFactura = document.querySelector('input[name="nv-factura"]:checked').value;
  const retencion = document.getElementById('nv-retencion').checked;
  const razonSocial = document.getElementById('nv-razon-social').value.trim();
  const cuit = normalizeDocumentoInput(document.getElementById('nv-cuit').value);

  if (!orderId || !documento || !monto) {
    toast('✕', 'Completá pedido, documento y monto total', 'error');
    return;
  }
  if (tipoFactura === 'A' && (!razonSocial || !cuit)) {
    toast('✕', 'Razón social y CUIT son obligatorios con Factura A', 'error');
    return;
  }

  try {
    await apiCrearVenta({
      order_id_vtex: orderId,
      cliente_documento: documento,
      origen,
      nro_caso: nroCaso,
      tipo_factura: tipoFactura,
      agente_retencion: retencion ? 'SI' : 'NO',
      razon_social: razonSocial,
      cuit,
      monto_total: monto,
    });
    closeDrawer();
    toast('✓', 'Venta creada', 'success');
    STATE.ventas = null;
    if (_currentPage === 'ventas') loadVentas();
  } catch (err) {
    toast('✕', err.message, 'error');
  }
}

/* ─── GESTIONAR PAGOS + APROBAR ───────────────────────────── */

let _pagosVentaActual = [];

async function abrirGestionPagos(idVenta) {
  const venta = (STATE.ventas || []).find(v => v.id === idVenta);
  if (!venta) return;
  STATE.editingVentaId = idVenta;
  _pagosVentaActual = await apiListPagosVenta(idVenta);

  document.getElementById('drawer-title').textContent = 'Venta #' + idVenta + ' — ' + venta.order_id_vtex;
  _renderGestionPagosBody(venta);
  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function _sumaPagosActual() {
  return _pagosVentaActual.reduce((sum, p) => sum + Number(p.monto || 0), 0);
}

function _renderGestionPagosBody(venta) {
  const suma = _sumaPagosActual();
  const diferencia = Math.round((Number(venta.monto_total) - suma) * 100) / 100;
  const puedeEditar = SESSION.canEdit('ventas');

  document.getElementById('drawer-body').innerHTML =
    '<div class="detail-row">'
    + '<div class="detail-block"><div class="detail-label">Total venta</div><div class="detail-val mono">' + formatARS(venta.monto_total) + '</div></div>'
    + '<div class="detail-block"><div class="detail-label">Suma de pagos</div><div class="detail-val mono" style="color:' + (diferencia === 0 ? 'var(--success)' : 'var(--danger)') + '">' + formatARS(suma) + '</div></div>'
    + '</div>'
    + (diferencia !== 0 ? '<div class="alert-err" style="margin-bottom:14px">Faltan ' + formatARS(diferencia) + ' para poder aprobar el pago.</div>' : '')
    + '<div class="form-section-title">Medios de pago</div>'
    + (_pagosVentaActual.length
        ? _pagosVentaActual.map(p => '<div class="card" style="margin-bottom:6px;cursor:default"><div class="flex-between"><span>' + escapeHtml(p.medio_pago) + (p.payway_tipo ? ' · ' + p.payway_tipo + ' ' + p.tarjeta_entidad + ' ****' + p.tarjeta_ultimos4 + (p.cuotas ? ' (' + p.cuotas + ' cuotas)' : '') : '') + '</span><span class="mono">' + formatARS(p.monto) + '</span></div></div>').join('')
        : '<div class="text-sm text-muted mb-8">Sin pagos cargados todavía.</div>')
    + (puedeEditar && venta.estado_venta === 'Pago pendiente' ? `
      <div class="form-section" style="margin-top:12px">
        <div class="form-section-title">Agregar medio de pago</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Medio</label>
            <select class="select w-full" id="pv-medio" onchange="_togglePaywayFields()">
              ${MEDIOS_PAGO.map(m => '<option value="' + m + '">' + m + '</option>').join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Monto</label><input class="input" id="pv-monto" type="number" step="0.01"></div>
        </div>
        <div class="form-group"><label class="form-label">Nro. de transacción</label><input class="input" id="pv-transaccion"></div>
        <div id="pv-payway-fields" hidden>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Débito / Crédito</label>
              <select class="select w-full" id="pv-payway-tipo" onchange="_toggleCuotas()">
                ${PAYWAY_TIPO.map(t => '<option value="' + t + '">' + t + '</option>').join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">Entidad</label>
              <select class="select w-full" id="pv-tarjeta-entidad">
                ${TARJETA_ENTIDAD.map(t => '<option value="' + t + '">' + t + '</option>').join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Últimos 4 dígitos</label><input class="input" id="pv-ultimos4" maxlength="4"></div>
            <div class="form-group" id="pv-cuotas-group" hidden><label class="form-label">Cuotas</label><input class="input" id="pv-cuotas" type="number" min="1"></div>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="agregarPago()">+ Agregar pago</button>
      </div>
    ` : '');

  const footer = document.getElementById('drawer-footer');
  footer.innerHTML = '<button class="btn btn-ghost" onclick="closeDrawer()">Cerrar</button>';
  if (puedeEditar && venta.estado_venta === 'Pago pendiente') {
    footer.innerHTML += '<button class="btn btn-primary" ' + (diferencia !== 0 ? 'disabled' : '') + ' onclick="aprobarPago(' + venta.id + ')">Aprobar pago</button>';
  }
}

function _togglePaywayFields() {
  const esPayway = document.getElementById('pv-medio').value === 'Payway';
  document.getElementById('pv-payway-fields').hidden = !esPayway;
}

function _toggleCuotas() {
  const esCredito = document.getElementById('pv-payway-tipo').value === 'Crédito';
  document.getElementById('pv-cuotas-group').hidden = !esCredito;
}

async function agregarPago() {
  const idVenta = STATE.editingVentaId;
  const medio = document.getElementById('pv-medio').value;
  const monto = Number(document.getElementById('pv-monto').value || 0);
  const transaccion = document.getElementById('pv-transaccion').value.trim();

  if (!monto) { toast('✕', 'Ingresá un monto', 'error'); return; }

  const data = { id_venta: idVenta, medio_pago: medio, monto, nro_transaccion: transaccion };
  if (medio === 'Payway') {
    data.payway_tipo = document.getElementById('pv-payway-tipo').value;
    data.tarjeta_entidad = document.getElementById('pv-tarjeta-entidad').value;
    data.tarjeta_ultimos4 = document.getElementById('pv-ultimos4').value.trim();
    if (data.payway_tipo === 'Crédito') data.cuotas = Number(document.getElementById('pv-cuotas').value || 1);
  }

  try {
    await apiAgregarPagoVenta(data);
    toast('✓', 'Pago agregado', 'success');
    const venta = (STATE.ventas || []).find(v => v.id === idVenta);
    _pagosVentaActual = await apiListPagosVenta(idVenta);
    _renderGestionPagosBody(venta);
  } catch (err) {
    toast('✕', err.message, 'error');
  }
}

async function aprobarPago(idVenta) {
  try {
    const res = await apiAprobarPagoVenta(idVenta);
    toast('✓', 'Pago aprobado', 'success');
    if (res.warning) toast('⚠', res.warning, 'warning');
    closeDrawer();
    STATE.ventas = null;
    if (_currentPage === 'ventas') loadVentas();
  } catch (err) {
    toast('✕', err.message, 'error');
  }
}
