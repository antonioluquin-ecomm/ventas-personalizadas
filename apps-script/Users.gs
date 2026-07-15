// ============================================================
// VENTAS PERSONALIZADAS — Users.gs
// Autenticación, sesiones y gestión de usuarios/roles/permisos.
// Mismo patrón que commerce-hub/apps-script/Users.gs.
// ============================================================

// ── HASHING ───────────────────────────────────────────────────

function computeSha256Hex(str) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// Almacenamiento: SHA256(salt + password_hash), donde password_hash = SHA256(plainPassword) del frontend.
function hashPassword(salt, passwordHash) {
  return computeSha256Hex(salt + passwordHash);
}

// ── SETUP CHECK ───────────────────────────────────────────────

function checkSetup() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: true, usuarios_configured: false };
  var data = sheet.getDataRange().getValues();
  return { ok: true, usuarios_configured: data.length > 1 && data[1][0] !== '' };
}

// ── PERMISOS HELPER ───────────────────────────────────────────

function getPermisosForRol(id_rol) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PERMISOS_MODULOS');
  if (!sheet) return {};
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxRol  = headers.indexOf('id_rol');
  var idxMod  = headers.indexOf('modulo');
  var idxVer  = headers.indexOf('puede_ver');
  var idxEdt  = headers.indexOf('puede_editar');
  var permisos = {};
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idxRol]) === Number(id_rol)) {
      permisos[String(data[i][idxMod])] = {
        ver:    data[i][idxVer] === 'SI',
        editar: data[i][idxEdt] === 'SI',
      };
    }
  }
  return permisos;
}

function getNombreRol(id_rol) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return 'Agente';
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var idIdx  = h.indexOf('id');
  var nomIdx = h.indexOf('nombre');
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idIdx]) === Number(id_rol)) return String(data[i][nomIdx]);
  }
  return 'Agente';
}

// ── SESSION VALIDATION ────────────────────────────────────────

function _validateSessionToken(session_token) {
  if (!session_token) return { ok: false, error: 'Token requerido' };
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('SESIONES');
  if (!sheet) return { ok: false, error: 'Sesión no válida' };
  var data = sheet.getDataRange().getValues();
  var h       = data[0];
  var tokIdx  = h.indexOf('session_token');
  var uidIdx  = h.indexOf('id_usuario');
  var emlIdx  = h.indexOf('email');
  var rolIdx  = h.indexOf('id_rol');
  var expIdx  = h.indexOf('expira_en');
  var actIdx  = h.indexOf('activa');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][tokIdx]) === session_token) {
      if (data[i][actIdx] !== 'SI') return { ok: false, error: 'Sesión inactiva' };
      if (new Date(data[i][expIdx]) < new Date()) return { ok: false, error: 'Sesión expirada' };
      var idUsuario = data[i][uidIdx];
      var rolActual = Number(data[i][rolIdx]);

      var usSheet = ss.getSheetByName('USUARIOS');
      if (usSheet) {
        var usData  = usSheet.getDataRange().getValues();
        var usH     = usData[0];
        var uIdIdx  = usH.indexOf('id');
        var uRolIdx = usH.indexOf('id_rol');
        var uActIdx = usH.indexOf('activo');
        for (var j = 1; j < usData.length; j++) {
          if (String(usData[j][uIdIdx]) === String(idUsuario)) {
            if (usData[j][uActIdx] !== 'SI') return { ok: false, error: 'Usuario inactivo' };
            rolActual = Number(usData[j][uRolIdx]);
            break;
          }
        }
      }

      if (!_rolActivo(rolActual)) return { ok: false, error: 'Rol desactivado' };

      return {
        ok:         true,
        id_usuario: idUsuario,
        email:      String(data[i][emlIdx]),
        id_rol:     rolActual,
      };
    }
  }
  return { ok: false, error: 'Sesión no encontrada' };
}

// ── LOGIN ─────────────────────────────────────────────────────

function login(body) {
  var email         = String(body.email         || '').toLowerCase().trim();
  var password_hash = String(body.password_hash || '');
  if (!email || !password_hash) {
    return { ok: false, error: 'Email y contraseña requeridos', code: 400 };
  }

  var cache     = CacheService.getScriptCache();
  var cacheKey  = 'lf_' + email.replace(/[^a-z0-9]/g, '_');
  var failCount = parseInt(cache.get(cacheKey) || '0', 10);
  if (failCount >= 5) {
    return { ok: false, error: 'Demasiados intentos fallidos. Esperá 15 minutos e intentá de nuevo.', code: 429 };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: false, error: 'Sistema de usuarios no configurado. Ejecutá setupAll() en Apps Script.', code: 500 };

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId     = headers.indexOf('id');
  var idxNombre = headers.indexOf('nombre');
  var idxEmail  = headers.indexOf('email');
  var idxHash   = headers.indexOf('password_hash');
  var idxSalt   = headers.indexOf('salt');
  var idxRol    = headers.indexOf('id_rol');
  var idxActivo = headers.indexOf('activo');
  var idxUltimo = headers.indexOf('ultimo_acceso');

  var userRow    = null;
  var userRowNum = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxEmail]).toLowerCase() === email) {
      userRow    = data[i];
      userRowNum = i + 1;
      break;
    }
  }
  if (!userRow) {
    cache.put(cacheKey, String(failCount + 1), 900);
    return { ok: false, error: 'Email o contraseña incorrectos', code: 401 };
  }
  if (userRow[idxActivo] !== 'SI') return { ok: false, error: 'Usuario inactivo. Contactá al administrador.', code: 403 };

  var hash = hashPassword(String(userRow[idxSalt]), password_hash);
  if (hash !== String(userRow[idxHash])) {
    cache.put(cacheKey, String(failCount + 1), 900);
    return { ok: false, error: 'Email o contraseña incorrectos', code: 401 };
  }

  var userId = userRow[idxId];
  var idRol  = Number(userRow[idxRol]);
  var nombre = String(userRow[idxNombre]);

  if (!_rolActivo(idRol)) {
    return { ok: false, error: 'Tu rol está desactivado. Contactá al administrador.', code: 403 };
  }

  sheet.getRange(userRowNum, idxUltimo + 1).setValue(new Date().toISOString());

  var sessionToken = Utilities.getUuid();
  var expiraEn     = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  var ahoraIso     = new Date().toISOString();

  var sesSheet = ss.getSheetByName('SESIONES');
  if (sesSheet) {
    sesSheet.appendRow([sessionToken, userId, email, idRol, expiraEn, ahoraIso, 'SI']);
  }

  cache.remove(cacheKey);
  return {
    ok:            true,
    session_token: sessionToken,
    usuario: { id: userId, nombre: nombre, email: email, id_rol: idRol, nombre_rol: getNombreRol(idRol) },
    permisos:      getPermisosForRol(idRol),
    expira_en:     expiraEn,
  };
}

// ── LOGOUT ────────────────────────────────────────────────────

function logoutUser(body) {
  var token = String(body.session_token || '');
  if (!token) return { ok: true };
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('SESIONES');
  if (!sheet) return { ok: true };
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxTok = headers.indexOf('session_token');
  var idxAct = headers.indexOf('activa');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxTok]) === token) {
      sheet.getRange(i + 1, idxAct + 1).setValue('NO');
      return { ok: true };
    }
  }
  return { ok: true };
}

// ── VALIDATE SESSION ───────────────────────────────────────────

function validateSession(body) {
  var res = _validateSessionToken(body.session_token);
  if (!res.ok) return { ok: false, error: res.error, code: 401 };
  return {
    ok:       true,
    usuario: { id: res.id_usuario, email: res.email, id_rol: res.id_rol, nombre_rol: getNombreRol(res.id_rol) },
    permisos: getPermisosForRol(res.id_rol),
  };
}

// ── CAMBIAR CONTRASEÑA (self-service) ────────────────────────

function changePassword(body) {
  var id_usuario           = body._sesId;
  var password_actual_hash = String(body.password_actual_hash || '');
  var password_nueva_hash  = String(body.password_nueva_hash  || '');

  if (!id_usuario) return { ok: false, error: 'Sesión no válida', code: 401 };
  if (!password_actual_hash || !password_nueva_hash) {
    return { ok: false, error: 'Todos los campos son requeridos', code: 400 };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: false, error: 'Tabla de usuarios no disponible', code: 500 };

  var rowNum = findRowNumber(sheet, id_usuario);
  if (!rowNum) return { ok: false, error: 'Usuario no encontrado', code: 404 };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var row     = allData[rowNum - 1];
  var idxHash = headers.indexOf('password_hash');
  var idxSalt = headers.indexOf('salt');

  var currentHash = hashPassword(String(row[idxSalt]), password_actual_hash);
  if (currentHash !== String(row[idxHash])) {
    return { ok: false, error: 'La contraseña actual es incorrecta', code: 401 };
  }

  var newSalt = Utilities.getUuid();
  var newHash = hashPassword(newSalt, password_nueva_hash);
  sheet.getRange(rowNum, idxHash + 1).setValue(newHash);
  sheet.getRange(rowNum, idxSalt + 1).setValue(newSalt);

  return { ok: true };
}

// ── USUARIOS CRUD (solo admin) ────────────────────────────────

function getUsuarios(body) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: true, data: [] };
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var usuarios = data.slice(1)
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      var obj = rowToObj(r, headers);
      delete obj.password_hash;
      delete obj.salt;
      return obj;
    });
  return { ok: true, data: usuarios };
}

function createUsuario(body) {
  var data          = body.data || {};
  var nombre        = String(data.nombre        || '').trim();
  var email         = String(data.email         || '').toLowerCase().trim();
  var password_hash = String(data.password_hash || '');
  var id_rol        = Number(data.id_rol        || 2);

  if (!nombre || !email || !password_hash) {
    return { ok: false, error: 'Nombre, email y contraseña son requeridos', code: 400 };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: false, error: 'Tabla de usuarios no disponible', code: 500 };

  var existing  = sheet.getDataRange().getValues();
  var eEmailIdx = existing[0].indexOf('email');
  for (var i = 1; i < existing.length; i++) {
    if (String(existing[i][eEmailIdx]).toLowerCase() === email) {
      return { ok: false, error: 'El email ya está en uso', code: 409 };
    }
  }

  var nextId    = getNextId(sheet);
  var salt      = Utilities.getUuid();
  var hash      = hashPassword(salt, password_hash);
  var now       = new Date().toISOString();
  var creadoPor = String(body._sesEmail || '');

  sheet.appendRow([nextId, nombre, email, hash, salt, id_rol, 'SI', now, '', creadoPor]);
  return { ok: true, id: nextId };
}

function updateUsuario(body) {
  var id   = Number(body.id);
  var data = body.data || {};

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return { ok: false, error: 'Tabla de usuarios no disponible', code: 500 };

  var rowNum = findRowNumber(sheet, id);
  if (!rowNum) return { ok: false, error: 'Usuario no encontrado', code: 404 };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];

  var rolColIdx = headers.indexOf('id_rol');
  var actColIdx = headers.indexOf('activo');
  var rowActual = allData[rowNum - 1];
  var eraAdmin  = Number(rowActual[rolColIdx]) === 1 && String(rowActual[actColIdx]) === 'SI';
  if (eraAdmin) {
    var quitaAdmin = data.id_rol !== undefined && Number(data.id_rol) !== 1;
    var desactiva  = data.activo !== undefined && data.activo !== 'SI';
    if (quitaAdmin || desactiva) {
      var otrosAdmins = 0;
      for (var a = 1; a < allData.length; a++) {
        if (a === rowNum - 1) continue;
        if (Number(allData[a][rolColIdx]) === 1 && String(allData[a][actColIdx]) === 'SI') otrosAdmins++;
      }
      if (otrosAdmins === 0) {
        return { ok: false, error: 'Debe quedar al menos un Administrador activo en el sistema', code: 409 };
      }
    }
  }

  if (data.email !== undefined) {
    var newEmail = String(data.email).toLowerCase().trim();
    var colId    = headers.indexOf('id');
    var colEm    = headers.indexOf('email');
    for (var j = 1; j < allData.length; j++) {
      if (Number(allData[j][colId]) !== id && String(allData[j][colEm]).toLowerCase() === newEmail) {
        return { ok: false, error: 'El email ya está en uso', code: 409 };
      }
    }
    sheet.getRange(rowNum, colEm + 1).setValue(newEmail);
  }

  if (data.nombre !== undefined) sheet.getRange(rowNum, headers.indexOf('nombre') + 1).setValue(String(data.nombre).trim());
  if (data.id_rol !== undefined) sheet.getRange(rowNum, headers.indexOf('id_rol') + 1).setValue(Number(data.id_rol));
  if (data.activo !== undefined) sheet.getRange(rowNum, headers.indexOf('activo') + 1).setValue(data.activo === 'SI' ? 'SI' : 'NO');
  if (data.password_hash && String(data.password_hash).trim()) {
    var newSalt = Utilities.getUuid();
    var newHash = hashPassword(newSalt, String(data.password_hash));
    sheet.getRange(rowNum, headers.indexOf('password_hash') + 1).setValue(newHash);
    sheet.getRange(rowNum, headers.indexOf('salt')          + 1).setValue(newSalt);
  }

  return { ok: true };
}

// ── PERMISOS CRUD ─────────────────────────────────────────────

function getPermisos() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PERMISOS_MODULOS');
  if (!sheet) return { ok: true, data: [] };
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var permisos = data.slice(1)
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) { return rowToObj(r, headers); });
  return { ok: true, data: permisos };
}

function updatePermisos(body) {
  var id_rol       = Number(body.id_rol);
  var modulo       = String(body.modulo || '');
  var puede_ver    = (body.puede_ver    === 'SI' || body.puede_ver    === true) ? 'SI' : 'NO';
  var puede_editar = (body.puede_editar === 'SI' || body.puede_editar === true) ? 'SI' : 'NO';
  if (puede_ver === 'NO') puede_editar = 'NO';

  if (_esRolSistema(id_rol)) {
    return { ok: false, error: 'El rol Administrador no se puede modificar', code: 403 };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PERMISOS_MODULOS');
  if (!sheet) return { ok: false, error: 'Tabla de permisos no disponible', code: 500 };

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxRol  = headers.indexOf('id_rol');
  var idxMod  = headers.indexOf('modulo');
  var idxVer  = headers.indexOf('puede_ver');
  var idxEdt  = headers.indexOf('puede_editar');

  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idxRol]) === id_rol && String(data[i][idxMod]) === modulo) {
      sheet.getRange(i + 1, idxVer + 1).setValue(puede_ver);
      sheet.getRange(i + 1, idxEdt + 1).setValue(puede_editar);
      return { ok: true };
    }
  }
  sheet.appendRow([id_rol, modulo, puede_ver, puede_editar]);
  return { ok: true };
}

// ── ROLES CRUD (solo admin) ───────────────────────────────────

function _esRolSistema(id_rol) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return id_rol === 1;
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var idIdx  = h.indexOf('id');
  var sisIdx = h.indexOf('es_sistema');
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idIdx]) === Number(id_rol)) {
      return sisIdx !== -1 ? String(data[i][sisIdx]) === 'SI' : Number(id_rol) === 1;
    }
  }
  return false;
}

function _rolActivo(id_rol) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return true;
  var data = sheet.getDataRange().getValues();
  var h = data[0];
  var idIdx  = h.indexOf('id');
  var actIdx = h.indexOf('activo');
  var sisIdx = h.indexOf('es_sistema');
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][idIdx]) === Number(id_rol)) {
      if (sisIdx !== -1 && String(data[i][sisIdx]) === 'SI') return true;
      return actIdx === -1 ? true : String(data[i][actIdx]) !== 'NO';
    }
  }
  return false;
}

function getRoles() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return { ok: true, data: [] };
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var roles = data.slice(1)
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) { return rowToObj(r, headers); });
  return { ok: true, data: roles };
}

function createRol(body) {
  var nombre = String(body.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'El nombre del rol es requerido', code: 400 };

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return { ok: false, error: 'Tabla de roles no disponible', code: 500 };

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var nomIdx  = headers.indexOf('nombre');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nomIdx]).toLowerCase() === nombre.toLowerCase()) {
      return { ok: false, error: 'Ya existe un rol con ese nombre', code: 409 };
    }
  }

  var nextId = getNextId(sheet);
  sheet.appendRow([nextId, nombre, String(body.descripcion || ''), 'SI', 'NO']);

  var permSheet = ss.getSheetByName('PERMISOS_MODULOS');
  if (permSheet) {
    MODULOS_RBAC.forEach(function(mod) {
      permSheet.appendRow([nextId, mod, 'NO', 'NO']);
    });
  }

  return { ok: true, id: nextId };
}

function updateRol(body) {
  var id = Number(body.id);
  if (!id) return { ok: false, error: 'ID de rol requerido', code: 400 };

  if (_esRolSistema(id)) {
    return { ok: false, error: 'El rol Administrador no se puede modificar', code: 403 };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ROLES');
  if (!sheet) return { ok: false, error: 'Tabla de roles no disponible', code: 500 };

  var rowNum = findRowNumber(sheet, id);
  if (!rowNum) return { ok: false, error: 'Rol no encontrado', code: 404 };

  var headers = sheet.getDataRange().getValues()[0];

  if (body.nombre !== undefined) {
    var nuevoNombre = String(body.nombre).trim();
    if (!nuevoNombre) return { ok: false, error: 'El nombre no puede quedar vacío', code: 400 };
    var allData = sheet.getDataRange().getValues();
    var idIdx   = headers.indexOf('id');
    var nomIdx  = headers.indexOf('nombre');
    for (var j = 1; j < allData.length; j++) {
      if (Number(allData[j][idIdx]) !== id && String(allData[j][nomIdx]).toLowerCase() === nuevoNombre.toLowerCase()) {
        return { ok: false, error: 'Ya existe un rol con ese nombre', code: 409 };
      }
    }
    sheet.getRange(rowNum, nomIdx + 1).setValue(nuevoNombre);
  }

  if (body.descripcion !== undefined) {
    sheet.getRange(rowNum, headers.indexOf('descripcion') + 1).setValue(String(body.descripcion));
  }

  if (body.activo !== undefined) {
    sheet.getRange(rowNum, headers.indexOf('activo') + 1).setValue(body.activo === 'SI' ? 'SI' : 'NO');
  }

  return { ok: true };
}
