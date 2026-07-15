// ============================================================
// VENTAS PERSONALIZADAS — Code.gs
// Router principal: doGet (rechazado) + doPost.
// Autenticación exclusivamente por sesión RBAC (session_token).
// Mismo patrón que commerce-hub/apps-script/Code.gs.
// ============================================================

/** Acciones públicas — no requieren ningún tipo de auth. */
var PUBLIC_ACTIONS = ['login', 'checkSetup'];

/** Acciones de lectura — válidas con sesión de cualquier rol. */
var READONLY_ACTIONS = [
  'listGestiones',
  'getGestionById',
  'buscarPedidosCliente',
  'getResumen',
  // RBAC — sesión / logout
  'validateSession',
  'logout',
  'getPermisos',
  'changePassword',
];

/** Acciones de gestión (usuarios, roles, permisos) — requieren sesión Admin (id=1). */
var ADMIN_SESSION_ACTIONS = [
  'getUsuarios',
  'createUsuario',
  'updateUsuario',
  'getRoles',
  'createRol',
  'updateRol',
  'updatePermisos',
];

/**
 * Mapa acción de escritura → módulos que la habilitan.
 * Un rol no-admin puede ejecutar la acción si tiene puede_editar=SI en
 * AL MENOS UNO de los módulos listados. El Administrador (id_rol=1) siempre puede.
 */
var ACTION_MODULE_MAP = {
  createGestion:      ['gestiones'],
  registrarContacto:  ['gestiones'],
  crearVenta:         ['ventas'],
  agregarPagoVenta:   ['ventas'],
  subirComprobante:   ['ventas'],
  aprobarPagoVenta:   ['ventas'],
};

// ── GET ──────────────────────────────────────────────────────
function doGet(e) {
  return jsonResp({ ok: false, error: 'Usar POST para todas las operaciones', code: 405 });
}

// ── POST ─────────────────────────────────────────────────────
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResp({ ok: false, error: 'JSON inválido', code: 400 });
  }

  var action        = body.action;
  var session_token = body.session_token;

  // ── 0. Acciones públicas (sin auth) ──────────────────────
  if (PUBLIC_ACTIONS.indexOf(action) !== -1) {
    try {
      if (action === 'login')      return jsonResp(login(body));
      if (action === 'checkSetup') return jsonResp(checkSetup());
    } catch (err) {
      return jsonResp({ ok: false, error: err.message, code: 500 });
    }
  }

  // ── 1. Validar sesión ─────────────────────────────────────
  if (!session_token) {
    return jsonResp({ ok: false, error: 'Unauthorized', code: 401 });
  }

  var sesVal = _validateSessionToken(session_token);
  if (!sesVal.ok) {
    return jsonResp({ ok: false, error: sesVal.error, code: 401 });
  }

  var sesRol   = sesVal.id_rol;
  var sesEmail = sesVal.email;
  body._sesRol   = sesRol;
  body._sesEmail = sesEmail;
  body._sesId    = sesVal.id_usuario;
  setSessionEmail_(sesEmail);

  // ── 2. Acciones de gestión: requieren sesión admin ────────
  if (ADMIN_SESSION_ACTIONS.indexOf(action) !== -1) {
    if (sesRol !== 1) {
      return jsonResp({ ok: false, error: 'Requiere sesión de Administrador', code: 403 });
    }
  }

  // ── 3. Escrituras: requieren permiso de edición en el módulo ──
  var isReadOnly  = READONLY_ACTIONS.indexOf(action) !== -1;
  var isAdminOnly = ADMIN_SESSION_ACTIONS.indexOf(action) !== -1;
  var isWrite     = !isReadOnly && !isAdminOnly;

  if (isWrite && sesRol !== 1) {
    var modulos  = ACTION_MODULE_MAP[action] || [];
    var permisos = getPermisosForRol(sesRol);
    var puede = modulos.some(function(m) { return permisos[m] && permisos[m].editar === true; });
    if (!puede) {
      return jsonResp({ ok: false, error: 'Forbidden — esta operación requiere permiso de edición', code: 403 });
    }
  }

  // ── 4. Routing ────────────────────────────────────────────
  try {
    switch (action) {
      // Lecturas
      case 'listGestiones':         return jsonResp(listGestiones(body));
      case 'getGestionById':        return jsonResp(getGestionById(body.id));
      case 'buscarPedidosCliente':  return jsonResp(buscarPedidosCliente(body));
      case 'getResumen':            return jsonResp(getResumen());
      // RBAC — sesión
      case 'validateSession':       return jsonResp(validateSession(body));
      case 'logout':                return jsonResp(logoutUser(body));
      case 'getPermisos':           return jsonResp(getPermisos());
      case 'changePassword':        return jsonResp(changePassword(body));
      // RBAC — gestión (solo admin)
      case 'getUsuarios':           return jsonResp(getUsuarios(body));
      case 'createUsuario':         return jsonResp(createUsuario(body));
      case 'updateUsuario':         return jsonResp(updateUsuario(body));
      case 'getRoles':              return jsonResp(getRoles());
      case 'createRol':             return jsonResp(createRol(body));
      case 'updateRol':             return jsonResp(updateRol(body));
      case 'updatePermisos':        return jsonResp(updatePermisos(body));
      // Escrituras de dominio
      case 'createGestion':         return jsonResp(createGestion(body));
      case 'registrarContacto':     return jsonResp(registrarContacto(body));
      case 'crearVenta':            return jsonResp(crearVenta(body));
      case 'agregarPagoVenta':      return jsonResp(agregarPagoVenta(body));
      case 'subirComprobante':      return jsonResp(subirComprobante(body));
      case 'aprobarPagoVenta':      return jsonResp(aprobarPagoVenta(body));
      default:
        return jsonResp({ ok: false, error: 'Acción no reconocida', code: 400 });
    }
  } catch (err) {
    writeError(action, err.message, err.stack);
    Logger.log('doPost error: ' + err.message);
    return jsonResp({ ok: false, error: err.message, code: 500 });
  }
}

// ── Helper JSON ───────────────────────────────────────────────
function jsonResp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
