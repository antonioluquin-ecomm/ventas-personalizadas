// ============================================================
// VENTAS PERSONALIZADAS — Setup.gs
// Creación automática e idempotente de la estructura de datos.
//
// USO: ejecutar setupAll() una vez desde el editor de Apps Script.
// Es seguro correrlo más de una vez: nunca destruye datos existentes.
//
// DEPENDENCIAS: requiere Schema.gs cargado en el mismo proyecto.
// Mismo patrón que commerce-hub/apps-script/Setup.gs.
// ============================================================

function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('╔══════════════════════════════════════╗');
  Logger.log('║  Ventas Personalizadas — Setup        ║');
  Logger.log('╚══════════════════════════════════════╝');

  var definitions = [
    { name: 'GESTIONES',          schema: SCHEMA_GESTIONES },
    { name: 'VENTAS',              schema: SCHEMA_VENTAS },
    { name: 'PAGOS_VENTA',         schema: SCHEMA_PAGOS_VENTA },
    { name: 'COMPROBANTES_VENTA',  schema: SCHEMA_COMPROBANTES_VENTA },
    { name: 'CONFIG',              schema: SCHEMA_CONFIG },
    { name: 'AUDIT_LOG',           schema: SCHEMA_AUDIT_LOG },
    { name: 'LOGS',                schema: SCHEMA_LOGS },
    { name: 'ERRORS',              schema: SCHEMA_ERRORS },
    // RBAC
    { name: 'USUARIOS',            schema: SCHEMA_USUARIOS },
    { name: 'ROLES',               schema: SCHEMA_ROLES },
    { name: 'PERMISOS_MODULOS',    schema: SCHEMA_PERMISOS_MODULOS },
    { name: 'SESIONES',            schema: SCHEMA_SESIONES },
  ];

  Logger.log('\n── Paso 1: Hojas y headers ──────────────');
  var sheets = {};
  definitions.forEach(function(def) {
    var sheet = ensureSheet(ss, def.name);
    ensureHeaders(sheet, def.schema);
    applyHeaderFormat(sheet, def.schema.length);
    sheets[def.name] = sheet;
  });

  Logger.log('\n── Paso 2: Datos semilla ────────────────');
  seedConfig(sheets['CONFIG']);
  seedRoles(sheets['ROLES']);
  seedPermisosModulos(sheets['PERMISOS_MODULOS']);
  seedUsuarios(sheets['USUARIOS']);

  Logger.log('\n── Paso 3: Registro de auditoría ────────');
  writeSetupLog(sheets['AUDIT_LOG']);

  Logger.log('\n✓ Setup completo. Revisar el Spreadsheet para verificar.');
}

// ── FUNCIONES AUXILIARES ─────────────────────────────────────

function ensureSheet(ss, nombre) {
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    Logger.log('  [CREADA]    ' + nombre);
  } else {
    Logger.log('  [EXISTENTE] ' + nombre);
  }
  return sheet;
}

function ensureHeaders(sheet, columnas) {
  var currentHeaders = sheet.getRange(1, 1, 1, columnas.length).getValues()[0];
  var isEmpty = currentHeaders.every(function(cell) { return cell === ''; });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    Logger.log('  [HEADERS]   ' + sheet.getName() + ': escritos (' + columnas.length + ' columnas)');
    return;
  }

  var matches = columnas.every(function(col, i) { return currentHeaders[i] === col; });
  if (matches) {
    Logger.log('  [HEADERS]   ' + sheet.getName() + ': ya correctos, sin cambios');
    return;
  }

  var diff = columnas
    .map(function(col, i) {
      return currentHeaders[i] !== col ? ('col ' + (i + 1) + ': esperado "' + col + '", encontrado "' + currentHeaders[i] + '"') : null;
    })
    .filter(function(x) { return x !== null; });

  Logger.log('  [ADVERTENCIA] ' + sheet.getName() + ': headers difieren del schema. '
    + 'No se modificó. Diferencias: ' + diff.join(' | '));
}

function applyHeaderFormat(sheet, numColumnas) {
  var range = sheet.getRange(1, 1, 1, numColumnas);
  range.setBackground('#21262d');
  range.setFontColor('#e6edf3');
  range.setFontWeight('bold');
  range.setFontSize(11);
  range.setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
}

function seedConfig(sheet) {
  var data     = sheet.getDataRange().getValues();
  var claveIdx = 0;

  var existingKeys = {};
  data.slice(1).forEach(function(row) {
    if (row[claveIdx] !== '') existingKeys[row[claveIdx]] = true;
  });

  var insertadas = 0;
  SEED_CONFIG.forEach(function(item) {
    if (existingKeys[item.clave]) {
      Logger.log('  [CONFIG]    "' + item.clave + '": ya existe, sin cambios');
      return;
    }
    sheet.appendRow([item.clave, item.valor, item.descripcion, new Date().toISOString()]);
    existingKeys[item.clave] = true;
    insertadas++;
    Logger.log('  [CONFIG]    "' + item.clave + '": insertada');
  });
  if (insertadas === 0) Logger.log('  [CONFIG]    Todos los valores semilla ya existían');
}

function seedRoles(sheet) {
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx   = headers.indexOf('id');

  var existingIds = {};
  data.slice(1).forEach(function(row) {
    if (row[idIdx] !== '') existingIds[row[idIdx]] = true;
  });

  var insertados = 0;
  SEED_ROLES.forEach(function(item) {
    if (existingIds[item.id]) {
      Logger.log('  [ROLES]     id=' + item.id + ' (' + item.nombre + '): ya existe');
      return;
    }
    sheet.appendRow([item.id, item.nombre, item.descripcion, item.activo, item.es_sistema]);
    existingIds[item.id] = true;
    insertados++;
    Logger.log('  [ROLES]     id=' + item.id + ' (' + item.nombre + '): insertado');
  });
  if (insertados === 0) Logger.log('  [ROLES]     Todos los roles semilla ya existían');
}

function seedPermisosModulos(sheet) {
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxRol  = headers.indexOf('id_rol');
  var idxMod  = headers.indexOf('modulo');

  var existingKeys = {};
  data.slice(1).forEach(function(row) {
    if (row[idxRol] !== '') existingKeys[row[idxRol] + '|' + row[idxMod]] = true;
  });

  var insertados = 0;
  SEED_PERMISOS_MODULOS.forEach(function(item) {
    var key = item.id_rol + '|' + item.modulo;
    if (existingKeys[key]) {
      Logger.log('  [PERMISOS]  "' + key + '": ya existe');
      return;
    }
    sheet.appendRow([item.id_rol, item.modulo, item.puede_ver, item.puede_editar]);
    existingKeys[key] = true;
    insertados++;
    Logger.log('  [PERMISOS]  "' + key + '": insertado');
  });
  if (insertados === 0) Logger.log('  [PERMISOS]  Todos los permisos semilla ya existían');
}

function seedUsuarios(sheet) {
  var data     = sheet.getDataRange().getValues();
  var headers  = data[0];
  var idxEmail = headers.indexOf('email');

  var existingEmails = {};
  data.slice(1).forEach(function(row) {
    if (row[0] !== '') existingEmails[String(row[idxEmail]).toLowerCase()] = true;
  });

  var insertados = 0;
  SEED_USUARIOS.forEach(function(item) {
    var emailKey = item.email.toLowerCase();
    if (existingEmails[emailKey]) {
      Logger.log('  [USUARIOS]  "' + item.email + '": ya existe, sin cambios');
      return;
    }
    var nextId = getNextId(sheet);
    var salt   = Utilities.getUuid();
    var bytes  = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + item.password, Utilities.Charset.UTF_8);
    var hash   = bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
    var now    = new Date().toISOString();
    sheet.appendRow([nextId, item.nombre, item.email, hash, salt, item.id_rol, 'SI', now, '', 'setup']);
    existingEmails[emailKey] = true;
    insertados++;
    Logger.log('  [USUARIOS]  "' + item.email + '" (id=' + nextId + '): insertado (contraseña: ' + item.password + ')');
  });
  if (insertados === 0) Logger.log('  [USUARIOS]  Todos los usuarios semilla ya existían');
}

function writeSetupLog(sheet) {
  var id        = sheet.getLastRow();
  var timestamp = new Date().toISOString();
  sheet.appendRow([id, timestamp, 'SETUP', 'SISTEMA', 0, 'setupAll()', '', '', '', '']);
  Logger.log('  [AUDIT]     Setup registrado (id=' + id + ', timestamp=' + timestamp + ')');
}
