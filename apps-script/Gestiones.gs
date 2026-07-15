// ============================================================
// VENTAS PERSONALIZADAS — Gestiones.gs
// CRUD de la hoja GESTIONES + resolución de la venta asociada.
// ============================================================

var GESTIONES_SHEET = 'GESTIONES';

/**
 * Lista gestiones con filtros opcionales.
 * params: { estado_gestion?, canal_ingreso?, agente_contacto? }
 */
function listGestiones(params) {
  params = params || {};
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GESTIONES_SHEET);
  if (!sheet) return { ok: true, data: [] };

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1)
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) { return rowToObj(r, headers); });

  if (params.estado_gestion)  rows = rows.filter(function(r) { return r.estado_gestion === params.estado_gestion; });
  if (params.canal_ingreso)   rows = rows.filter(function(r) { return r.canal_ingreso === params.canal_ingreso; });
  if (params.agente_contacto) rows = rows.filter(function(r) { return r.agente_contacto === params.agente_contacto; });

  return { ok: true, data: rows };
}

/**
 * Gestión por ID. Adjunta la venta asociada si existe — se resuelve
 * buscando en VENTAS la fila con id_gestion = GESTIONES.id (no se guarda
 * la relación en ambos lados, ver docs/ventas_personalizadas_db_structure.md).
 */
function getGestionById(id) {
  var gestion = findRowById(GESTIONES_SHEET, Number(id));
  if (!gestion) return { ok: false, error: 'Gestión no encontrada', code: 404 };

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var ventaSheet = ss.getSheetByName('VENTAS');
  var venta = null;
  if (ventaSheet) {
    var data    = ventaSheet.getDataRange().getValues();
    var headers = data[0];
    var idxIdGestion = headers.indexOf('id_gestion');
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][idxIdGestion]) === Number(id)) {
        venta = rowToObj(data[i], headers);
        break;
      }
    }
  }

  return { ok: true, data: gestion, venta: venta };
}

/**
 * Crea una gestión nueva. data: {
 *   canal_ingreso, cliente_documento, cliente_nombre?, cliente_telefono?,
 *   pedido_referencia?, cantidad_pedidos_cliente?, notas?
 * }
 * estado_gestion arranca siempre en "Pendiente".
 */
function createGestion(body) {
  var data = body.data || {};
  var canalIngreso = String(data.canal_ingreso || '').trim();
  var documento    = normalizeDocumento(data.cliente_documento);

  validateEnum(canalIngreso, 'canal_ingreso', CANAL_INGRESO);
  requireParam(documento, 'cliente_documento');

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GESTIONES_SHEET);
  if (!sheet) return { ok: false, error: 'Tabla de gestiones no disponible', code: 500 };

  var nextId = getNextId(sheet);
  var now    = new Date().toISOString();
  var email  = String(body._sesEmail || '');

  sheet.appendRow([
    nextId,
    canalIngreso,
    documento,
    String(data.cliente_nombre || ''),
    String(data.cliente_telefono || ''),
    String(data.pedido_referencia || ''),
    Number(data.cantidad_pedidos_cliente || 0),
    'Pendiente',
    '',
    '',
    String(data.notas || ''),
    now,
    now,
    email,
    email,
  ]);

  writeAuditLog('CREATE', 'GESTIONES', nextId);
  writeLog('createGestion', 'GESTIONES', nextId, 'OK', 'Gestión creada: ' + canalIngreso);
  return { ok: true, id: nextId };
}

/**
 * Marca una gestión como contactada (o cualquier estado válido).
 * body: { id, data: { estado_gestion, notas? } }
 * Si estado_gestion pasa a "Contactado", registra fecha_contacto y
 * agente_contacto automáticamente (no se reciben del cliente — se derivan
 * de la sesión y del momento del cambio).
 */
function registrarContacto(body) {
  var id   = Number(body.id);
  var data = body.data || {};
  var nuevoEstado = String(data.estado_gestion || '').trim();
  validateEnum(nuevoEstado, 'estado_gestion', ESTADOS_GESTION);

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GESTIONES_SHEET);
  if (!sheet) return { ok: false, error: 'Tabla de gestiones no disponible', code: 500 };

  var rowNum = findRowNumber(sheet, id);
  if (!rowNum) return { ok: false, error: 'Gestión no encontrada', code: 404 };

  var headers = sheet.getDataRange().getValues()[0];
  var email   = String(body._sesEmail || '');
  var now     = new Date().toISOString();

  var idxEstado = headers.indexOf('estado_gestion');
  var valorAnterior = sheet.getRange(rowNum, idxEstado + 1).getValue();
  sheet.getRange(rowNum, idxEstado + 1).setValue(nuevoEstado);

  if (nuevoEstado === 'Contactado') {
    sheet.getRange(rowNum, headers.indexOf('fecha_contacto') + 1).setValue(now);
    sheet.getRange(rowNum, headers.indexOf('agente_contacto') + 1).setValue(email);
  }
  if (data.notas !== undefined) {
    sheet.getRange(rowNum, headers.indexOf('notas') + 1).setValue(String(data.notas));
  }
  sheet.getRange(rowNum, headers.indexOf('fecha_modificacion') + 1).setValue(now);
  sheet.getRange(rowNum, headers.indexOf('modificado_por') + 1).setValue(email);

  writeAuditLogDetail('UPDATE', 'GESTIONES', id, 'Cambio de estado', 'estado_gestion', valorAnterior, nuevoEstado);
  writeLog('registrarContacto', 'GESTIONES', id, 'OK', 'Estado: ' + valorAnterior + ' → ' + nuevoEstado);
  return { ok: true };
}
