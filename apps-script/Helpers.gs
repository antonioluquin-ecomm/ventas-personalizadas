// ============================================================
// VENTAS PERSONALIZADAS — Helpers.gs
// Utilidades comunes: rowToObj, findRow, getNextId, logging.
// ============================================================

/**
 * Convierte una fila de valores en un objeto usando el array de headers.
 * Normaliza celdas de tipo Date a string ISO.
 */
function rowToObj(row, headers) {
  var obj = {};
  headers.forEach(function(h, i) {
    var val = row[i];
    if (val instanceof Date) {
      val = val.toISOString();
    } else if (val === null || val === undefined) {
      val = '';
    }
    obj[h] = val;
  });
  return obj;
}

/**
 * Devuelve el número de fila (1-indexed) donde la col A coincide con id.
 * Retorna null si no se encuentra.
 */
function findRowNumber(sheet, id) {
  var ids = sheet.getRange('A:A').getValues().flat();
  var idx = ids.indexOf(id);
  return idx === -1 ? null : idx + 1;
}

/**
 * Busca una fila por ID y la retorna como objeto con campos nombrados.
 */
function findRowById(sheetName, id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Hoja no encontrada: ' + sheetName);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var row     = data.find(function(r, i) { return i > 0 && r[0] === id; });
  return row ? rowToObj(row, headers) : null;
}

/**
 * Obtiene el próximo ID auto-incremental para una hoja.
 * Toma el máximo ID existente en la columna A y le suma 1.
 */
function getNextId(sheet) {
  var ids = sheet.getRange('A:A').getValues().flat()
    .filter(function(v) { return typeof v === 'number' && v > 0; });
  return ids.length > 0 ? Math.max.apply(null, ids) + 1 : 1;
}

/** Deja solo dígitos — el DNI/CUIT puede llegar con puntos/guiones. */
function normalizeDocumento(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Valida que un valor esté dentro de un dominio controlado (ver Schema.gs). */
function validateEnum(value, name, allowed) {
  if (allowed.indexOf(value) === -1) {
    throw new Error(name + ' inválido: "' + value + '". Permitidos: ' + allowed.join(', '));
  }
  return value;
}

function requireParam(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error('Parámetro requerido: ' + name);
  }
  return value;
}

// ── UTILIDADES DE CONFIG ──────────────────────────────────────

function getConfigValue(clave) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('CONFIG');
    if (!sheet) return '';
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === clave) return String(data[i][1]);
    }
    return '';
  } catch (e) {
    return '';
  }
}

// ── LOGGING (LOGS / ERRORS — ver google_sheets_standards §11) ─

/**
 * writeLog(accion, entidad, entidadId, resultado, detalle)
 * Best-effort: si falla (hoja no existe, error de permisos), no interrumpe
 * la operación principal — solo se registra en el log de ejecución de GAS.
 */
function writeLog(accion, entidad, entidadId, resultado, detalle) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('LOGS');
    if (!sheet) return;
    var id = sheet.getLastRow();
    sheet.appendRow([
      id,
      new Date().toISOString(),
      accion,
      entidad || '',
      entidadId || '',
      getSessionEmail_(),
      resultado,
      detalle || '',
    ]);
  } catch (e) {
    Logger.log('writeLog error (no bloqueante): ' + e.message);
  }
}

function writeError(accion, mensaje, stack) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ERRORS');
    if (!sheet) return;
    var id = sheet.getLastRow();
    sheet.appendRow([
      id,
      new Date().toISOString(),
      accion,
      getSessionEmail_(),
      mensaje || '',
      stack || '',
    ]);
  } catch (e) {
    Logger.log('writeError error (no bloqueante): ' + e.message);
  }
}

// Email del usuario de sesión actual, si el router lo dejó en una variable
// global de request (ver Code.gs). Fallback a Session.getActiveUser() (casi
// siempre vacío en un Web App público) y por último a 'sistema'.
var _CURRENT_SESSION_EMAIL = '';
function setSessionEmail_(email) { _CURRENT_SESSION_EMAIL = email || ''; }
function getSessionEmail_() {
  if (_CURRENT_SESSION_EMAIL) return _CURRENT_SESSION_EMAIL;
  try { return Session.getActiveUser().getEmail() || 'sistema'; }
  catch (e) { return 'sistema'; }
}

// ── AUDITORÍA CAMPO A CAMPO (AUDIT_LOG) ───────────────────────
// Mismo patrón que commerce-hub/apps-script/AuditLog.gs.

function writeAuditLog(accion, entidad, entidadId) {
  writeAuditLogDetail(accion, entidad, entidadId, '', '', null, null);
}

function writeAuditLogDetail(accion, entidad, entidadId, detalle, campo, valorAnterior, valorNuevo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return;
    var id = sheet.getLastRow();
    sheet.appendRow([
      id,
      new Date().toISOString(),
      accion,
      entidad,
      Number(entidadId) || 0,
      getSessionEmail_(),
      detalle || '',
      campo || '',
      valorAnterior == null ? '' : String(valorAnterior),
      valorNuevo == null ? '' : String(valorNuevo),
    ]);
  } catch (e) {
    Logger.log('writeAuditLogDetail error (no bloqueante): ' + e.message);
  }
}
