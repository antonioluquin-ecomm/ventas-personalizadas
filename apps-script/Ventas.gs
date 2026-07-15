// ============================================================
// VENTAS PERSONALIZADAS — Ventas.gs
// CRUD de VENTAS + PAGOS_VENTA (append-only) + COMPROBANTES_VENTA
// + aprobación de pago (validación de montos).
// ============================================================

var VENTAS_SHEET        = 'VENTAS';
var PAGOS_VENTA_SHEET   = 'PAGOS_VENTA';
var COMPROBANTES_SHEET  = 'COMPROBANTES_VENTA';

/**
 * Crea una venta. data: {
 *   id_gestion?, order_id_vtex, cliente_documento, origen, nro_caso?,
 *   tipo_factura, agente_retencion?, razon_social?, cuit?, monto_total
 * }
 * estado_venta arranca en "Pago pendiente" — el agente ya generó el pedido
 * en VTEX vía Master Data antes de llamar a esta función (ver CLAUDE.md).
 */
function crearVenta(body) {
  var data = body.data || {};
  var orderIdVtex = String(data.order_id_vtex || '').trim();
  var documento   = normalizeDocumento(data.cliente_documento);
  var origen      = String(data.origen || '').trim();
  var tipoFactura = String(data.tipo_factura || 'B').trim();
  var montoTotal  = Number(data.monto_total || 0);

  requireParam(orderIdVtex, 'order_id_vtex');
  requireParam(documento, 'cliente_documento');
  validateEnum(origen, 'origen', ORIGENES_VENTA);
  validateEnum(tipoFactura, 'tipo_factura', TIPO_FACTURA);
  if (montoTotal <= 0) throw new Error('monto_total debe ser mayor a 0');

  var razonSocial = String(data.razon_social || '').trim();
  var cuit        = normalizeDocumento(data.cuit);
  if (tipoFactura === 'A') {
    requireParam(razonSocial, 'razon_social (obligatorio con Factura A)');
    requireParam(cuit, 'cuit (obligatorio con Factura A)');
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(VENTAS_SHEET);
  if (!sheet) return { ok: false, error: 'Tabla de ventas no disponible', code: 500 };

  var nextId = getNextId(sheet);
  var now    = new Date().toISOString();
  var email  = String(body._sesEmail || '');

  sheet.appendRow([
    nextId,
    data.id_gestion ? Number(data.id_gestion) : '',
    orderIdVtex,
    documento,
    email,
    'Pago pendiente',
    origen,
    String(data.nro_caso || ''),
    tipoFactura,
    data.agente_retencion === 'SI' ? 'SI' : 'NO',
    tipoFactura === 'A' ? razonSocial : '',
    tipoFactura === 'A' ? cuit : '',
    montoTotal,
    '',
    now,
    now,
    email,
    email,
  ]);

  writeAuditLog('CREATE', 'VENTAS', nextId);
  writeLog('crearVenta', 'VENTAS', nextId, 'OK', 'Venta creada para pedido ' + orderIdVtex);
  return { ok: true, id: nextId };
}

/**
 * Agrega un medio de pago a una venta. Append-only — nunca se actualiza
 * una fila existente (ver docs/ventas_personalizadas_db_structure.md):
 * si el agente se equivoca, se agrega una fila de corrección.
 * data: { id_venta, medio_pago, monto, nro_transaccion?, payway_tipo?,
 *         tarjeta_entidad?, tarjeta_ultimos4?, cuotas? }
 */
function agregarPagoVenta(body) {
  var data      = body.data || {};
  var idVenta   = Number(data.id_venta);
  var medioPago = String(data.medio_pago || '').trim();
  var monto     = Number(data.monto || 0);

  requireParam(idVenta, 'id_venta');
  validateEnum(medioPago, 'medio_pago', MEDIOS_PAGO);
  if (monto <= 0) throw new Error('monto debe ser mayor a 0');

  var venta = findRowById(VENTAS_SHEET, idVenta);
  if (!venta) return { ok: false, error: 'Venta no encontrada', code: 404 };

  var paywayTipo    = '';
  var tarjetaEntidad = '';
  var tarjetaUltimos4 = '';
  var cuotas = '';

  if (medioPago === 'Payway') {
    paywayTipo = String(data.payway_tipo || '').trim();
    validateEnum(paywayTipo, 'payway_tipo', PAYWAY_TIPO);
    tarjetaEntidad = String(data.tarjeta_entidad || '').trim();
    validateEnum(tarjetaEntidad, 'tarjeta_entidad', TARJETA_ENTIDAD);
    tarjetaUltimos4 = String(data.tarjeta_ultimos4 || '').trim();
    if (!/^\d{4}$/.test(tarjetaUltimos4)) throw new Error('tarjeta_ultimos4 debe tener exactamente 4 dígitos');
    if (paywayTipo === 'Crédito') {
      cuotas = Number(data.cuotas || 0);
      if (cuotas < 1) throw new Error('cuotas debe ser al menos 1 para Payway Crédito');
    }
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PAGOS_VENTA_SHEET);
  if (!sheet) return { ok: false, error: 'Tabla de pagos no disponible', code: 500 };

  var nextId = getNextId(sheet);
  var email  = String(body._sesEmail || '');

  sheet.appendRow([
    nextId,
    idVenta,
    medioPago,
    monto,
    String(data.nro_transaccion || ''),
    paywayTipo,
    tarjetaEntidad,
    tarjetaUltimos4,
    cuotas,
    new Date().toISOString(),
    email,
  ]);

  writeAuditLog('CREATE', 'PAGOS_VENTA', nextId);
  writeLog('agregarPagoVenta', 'PAGOS_VENTA', nextId, 'OK', 'Pago ' + medioPago + ' $' + monto + ' para venta ' + idVenta);
  return { ok: true, id: nextId };
}

/** Suma de PAGOS_VENTA para una venta — nunca almacenado, siempre calculado. */
function _sumaPagosVenta(idVenta) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PAGOS_VENTA_SHEET);
  if (!sheet) return 0;
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxIdVenta = headers.indexOf('id_venta');
  var idxMonto   = headers.indexOf('monto');
  var suma = 0;
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idxIdVenta]) === Number(idVenta)) suma += Number(data[i][idxMonto] || 0);
  }
  return suma;
}

/**
 * Registra un comprobante de pago. data: { id_venta, nombre_archivo, url_archivo }
 * El nombre de archivo debe contener el número de pedido (validado acá, no
 * en el Sheet). La subida real del archivo a Drive la hace el frontend antes
 * de llamar a esta función — acá solo se guarda la referencia.
 */
function subirComprobante(body) {
  var data       = body.data || {};
  var idVenta    = Number(data.id_venta);
  var nombreArchivo = String(data.nombre_archivo || '').trim();
  var urlArchivo    = String(data.url_archivo || '').trim();

  requireParam(idVenta, 'id_venta');
  requireParam(nombreArchivo, 'nombre_archivo');
  requireParam(urlArchivo, 'url_archivo');

  var venta = findRowById(VENTAS_SHEET, idVenta);
  if (!venta) return { ok: false, error: 'Venta no encontrada', code: 404 };

  var pedidoDigits  = normalizeDocumento(venta.order_id_vtex);
  var archivoDigits = normalizeDocumento(nombreArchivo);
  if (pedidoDigits && archivoDigits.indexOf(pedidoDigits) === -1) {
    throw new Error('El nombre del archivo debe contener el número de pedido (' + venta.order_id_vtex + ')');
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(COMPROBANTES_SHEET);
  if (!sheet) return { ok: false, error: 'Tabla de comprobantes no disponible', code: 500 };

  var nextId = getNextId(sheet);
  var email  = String(body._sesEmail || '');

  sheet.appendRow([nextId, idVenta, nombreArchivo, urlArchivo, new Date().toISOString(), email]);

  writeAuditLog('CREATE', 'COMPROBANTES_VENTA', nextId);
  writeLog('subirComprobante', 'COMPROBANTES_VENTA', nextId, 'OK', 'Comprobante para venta ' + idVenta);
  return { ok: true, id: nextId };
}

/**
 * Aprueba el pago de una venta: valida que la suma de PAGOS_VENTA coincida
 * con monto_total, y pasa estado_venta a "Pago aprobado".
 *
 * DECISIÓN (2026-07-15, confirmado con prueba real): esta función NO muta
 * VTEX. Se investigó automatizar el botón "Aprobar pago" del admin de VTEX
 * (mecanismo notifypayment) y se confirmó que requiere la cookie de sesión
 * autenticada del admin — no funciona con las credenciales de servicio
 * (App Key/Token) que usa un backend. Ver
 * vtex-control-center/apps-script/AprobacionPago.gs para el detalle de la
 * investigación. El agente sigue aprobando el pago a mano en VTEX admin
 * como paso aparte; esta función solo registra ese hecho del lado del
 * Sheet. La respuesta incluye "warning" para dejarlo explícito en el
 * frontend cuando se implemente.
 */
function aprobarPagoVenta(body) {
  var idVenta = Number(body.id);

  var venta = findRowById(VENTAS_SHEET, idVenta);
  if (!venta) return { ok: false, error: 'Venta no encontrada', code: 404 };
  if (venta.estado_venta === 'Pago aprobado') return { ok: false, error: 'La venta ya tiene el pago aprobado', code: 409 };
  if (venta.estado_venta === 'Cancelada') return { ok: false, error: 'No se puede aprobar el pago de una venta cancelada', code: 409 };

  var sumaPagos = _sumaPagosVenta(idVenta);
  var montoTotal = Number(venta.monto_total || 0);
  var diferencia = Math.round((montoTotal - sumaPagos) * 100) / 100; // evitar ruido de float

  if (diferencia !== 0) {
    return {
      ok: false,
      error: 'La suma de los medios de pago ($' + sumaPagos + ') no coincide con el total de la venta ($' + montoTotal + '). Diferencia: $' + diferencia,
      code: 409,
    };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(VENTAS_SHEET);
  var rowNum = findRowNumber(sheet, idVenta);
  var headers = sheet.getDataRange().getValues()[0];
  var email = String(body._sesEmail || '');
  var now   = new Date().toISOString();

  sheet.getRange(rowNum, headers.indexOf('estado_venta') + 1).setValue('Pago aprobado');
  sheet.getRange(rowNum, headers.indexOf('fecha_aprobacion_pago') + 1).setValue(now);
  sheet.getRange(rowNum, headers.indexOf('fecha_modificacion') + 1).setValue(now);
  sheet.getRange(rowNum, headers.indexOf('modificado_por') + 1).setValue(email);

  writeAuditLogDetail('UPDATE', 'VENTAS', idVenta, 'Pago aprobado', 'estado_venta', venta.estado_venta, 'Pago aprobado');
  writeLog('aprobarPagoVenta', 'VENTAS', idVenta, 'OK', 'Pago aprobado, suma=' + sumaPagos);

  return {
    ok: true,
    warning: 'El pedido en VTEX no se actualizó automáticamente — el agente debe aprobar el pago manualmente en el admin de VTEX (no es automatizable, ver comentario en Ventas.gs).',
  };
}

// ── RESUMEN (análisis y seguimiento) ──────────────────────────

function getResumen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var gestSheet = ss.getSheetByName(GESTIONES_SHEET);
  var gestData = gestSheet
    ? gestSheet.getDataRange().getValues().slice(1).filter(function(r) { return r[0] !== ''; })
    : [];
  var gestHeaders = gestSheet ? gestSheet.getDataRange().getValues()[0] : [];
  var idxEstadoGestion = gestHeaders.indexOf('estado_gestion');

  var totalGestiones = gestData.length;
  var porEstado = {};
  gestData.forEach(function(r) {
    var estado = r[idxEstadoGestion] || 'Sin estado';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
  });

  var contactados  = (porEstado['Contactado'] || 0) + (porEstado['Concretado'] || 0) + (porEstado['Descartado'] || 0);
  var concretados   = porEstado['Concretado'] || 0;
  var tasaContacto   = totalGestiones > 0 ? Math.round((contactados / totalGestiones) * 1000) / 10 : 0;
  var tasaConversion = totalGestiones > 0 ? Math.round((concretados / totalGestiones) * 1000) / 10 : 0;

  var ventasSheet = ss.getSheetByName(VENTAS_SHEET);
  var ventasData = ventasSheet
    ? ventasSheet.getDataRange().getValues().slice(1).filter(function(r) { return r[0] !== ''; })
    : [];
  var ventasHeaders = ventasSheet ? ventasSheet.getDataRange().getValues()[0] : [];
  var idxEstadoVenta = ventasHeaders.indexOf('estado_venta');
  var porEstadoVenta = {};
  ventasData.forEach(function(r) {
    var estado = r[idxEstadoVenta] || 'Sin estado';
    porEstadoVenta[estado] = (porEstadoVenta[estado] || 0) + 1;
  });

  return {
    ok: true,
    data: {
      gestiones: {
        total: totalGestiones,
        por_estado: porEstado,
        tasa_contacto_pct: tasaContacto,
        tasa_conversion_pct: tasaConversion,
      },
      ventas: {
        total: ventasData.length,
        por_estado: porEstadoVenta,
      },
    },
  };
}
