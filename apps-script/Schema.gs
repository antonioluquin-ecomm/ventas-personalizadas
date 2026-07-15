// ============================================================
// VENTAS PERSONALIZADAS — Schema.gs
// Definiciones de columnas y datos semilla para el setup.
//
// Este archivo es de solo configuración: no contiene lógica
// de ejecución. Editarlo no afecta al sistema hasta que se
// corra setupAll() nuevamente.
//
// Ver docs/ventas_personalizadas_db_structure.md para el diseño completo.
// ============================================================

// ── SCHEMAS DE COLUMNAS ──────────────────────────────────────
// El orden de cada array define el orden de columnas en la hoja.
// Modificar el orden aquí requiere migración manual de la hoja.

/** Hoja GESTIONES — registro de contactos (bot / recontacto cancelados) */
var SCHEMA_GESTIONES = [
  'id',                       // A — clave primaria, auto-increment
  'canal_ingreso',            // B — enum: Bot | Recontacto Cancelados
  'cliente_documento',        // C — DNI/CUIT, clave de búsqueda contra vtex-control-center (no email — VTEX lo anonimiza)
  'cliente_nombre',           // D — denormalizado desde el pedido consultado
  'cliente_telefono',         // E — denormalizado desde el pedido consultado
  'pedido_referencia',        // F — orderId VTEX del pedido cancelado a recontactar (vacío si es bot)
  'cantidad_pedidos_cliente', // G — snapshot al momento de la consulta
  'estado_gestion',           // H — enum: Pendiente | Contactado | Concretado | Descartado
  'fecha_contacto',           // I — timestamp ISO, cuándo se marcó "Contactado"
  'agente_contacto',          // J — email del agente que contactó
  'notas',                    // K — texto libre
  'fecha_creacion',           // L — timestamp ISO
  'fecha_modificacion',       // M — timestamp ISO
  'creado_por',               // N — email
  'modificado_por',           // O — email
];

/** Hoja VENTAS — venta concretada + datos operativos de aprobación de pago */
var SCHEMA_VENTAS = [
  'id',                    // A — clave primaria, auto-increment
  'id_gestion',            // B — FK opcional a GESTIONES.id
  'order_id_vtex',         // C — pedido VTEX (Master Data, pago pendiente/promissory)
  'cliente_documento',     // D — DNI/CUIT
  'agente',                // E — email del agente que concretó la venta
  'estado_venta',          // F — enum: Pago pendiente | Pago aprobado | Cancelada
  'origen',                // G — enum: Referido | Atención | Bot | Planilla
  'nro_caso',              // H — texto libre
  'tipo_factura',          // I — enum: B | A
  'agente_retencion',      // J — SI | NO
  'razon_social',          // K — solo si tipo_factura = A
  'cuit',                  // L — solo si tipo_factura = A (texto, no número)
  'monto_total',           // M — total del pedido, valida contra SUM(PAGOS_VENTA.monto)
  'fecha_aprobacion_pago', // N — timestamp ISO, vacío hasta aprobar
  'fecha_creacion',        // O — timestamp ISO
  'fecha_modificacion',    // P — timestamp ISO
  'creado_por',            // Q — email
  'modificado_por',        // R — email
];

/** Hoja PAGOS_VENTA — medios de pago aplicados (1 a N por venta, append-only) */
var SCHEMA_PAGOS_VENTA = [
  'id',              // A — clave primaria, auto-increment
  'id_venta',        // B — FK a VENTAS.id
  'medio_pago',      // C — Payway | MercadoPago | GOcuotas | Transferencia por Mercado Pago | Transferencia por Banco y retenciones | Giftcards
  'monto',           // D — número ARS
  'nro_transaccion', // E — texto libre
  'payway_tipo',     // F — Débito | Crédito (solo si medio_pago = Payway)
  'tarjeta_entidad', // G — Visa | Mastercard (solo si payway_tipo definido)
  'tarjeta_ultimos4',// H — 4 dígitos, texto
  'cuotas',          // I — entero (solo si payway_tipo = Crédito)
  'fecha_creacion',  // J — timestamp ISO
  'creado_por',      // K — email
];

/** Hoja COMPROBANTES_VENTA — adjuntos de comprobante (opcional) */
var SCHEMA_COMPROBANTES_VENTA = [
  'id',             // A — clave primaria, auto-increment
  'id_venta',       // B — FK a VENTAS.id
  'nombre_archivo', // C — debe contener el número de pedido (validado en Apps Script)
  'url_archivo',    // D — link a Drive
  'fecha_subida',   // E — timestamp ISO
  'subido_por',     // F — email
];

/** Hoja CONFIG — 4 columnas */
var SCHEMA_CONFIG = [
  'clave',              // A
  'valor',              // B
  'descripcion',        // C
  'fecha_modificacion', // D
];

/** Hoja AUDIT_LOG — cambios campo a campo en GESTIONES/VENTAS */
var SCHEMA_AUDIT_LOG = [
  'id',             // A
  'timestamp',      // B
  'accion',         // C — CREATE | UPDATE | DELETE
  'entidad',        // D — GESTIONES | VENTAS | PAGOS_VENTA | COMPROBANTES_VENTA
  'entidad_id',     // E
  'usuario',        // F
  'detalle',        // G
  'campo',          // H
  'valor_anterior', // I
  'valor_nuevo',    // J
];

/** Hoja LOGS — resumen de cada operación (éxito o error) */
var SCHEMA_LOGS = [
  'id',        // A
  'timestamp', // B
  'accion',    // C
  'entidad',   // D
  'entidad_id',// E
  'usuario',   // F
  'resultado', // G — OK | ERROR
  'detalle',   // H
];

/** Hoja ERRORS — errores técnicos con stack trace */
var SCHEMA_ERRORS = [
  'id',        // A
  'timestamp', // B
  'accion',    // C
  'usuario',   // D
  'mensaje',   // E
  'stack',     // F
];

// ── SCHEMAS RBAC (idénticos al patrón de commerce-hub) ────────

/** Hoja USUARIOS — tabla de usuarios del sistema */
var SCHEMA_USUARIOS = [
  'id',             // A — auto-increment
  'nombre',         // B
  'email',          // C — clave única de login (lowercase)
  'password_hash',  // D — SHA-256(salt + password)
  'salt',           // E — UUID por usuario
  'id_rol',         // F — FK a ROLES.id
  'activo',         // G — SI | NO
  'fecha_creacion', // H — timestamp ISO
  'ultimo_acceso',  // I — timestamp ISO, actualizado en login
  'creado_por',     // J — email del admin que creó el usuario
];

/** Hoja ROLES — Administrador (fijo) + roles personalizados configurables */
var SCHEMA_ROLES = [
  'id',          // A — 1=Administrador (sistema); resto auto-increment
  'nombre',      // B
  'descripcion', // C
  'activo',      // D — SI | NO
  'es_sistema',  // E — SI = rol fijo Administrador
];

/** Hoja PERMISOS_MODULOS — matriz de permisos por rol */
var SCHEMA_PERMISOS_MODULOS = [
  'id_rol',       // A — FK a ROLES.id
  'modulo',       // B — gestiones | ventas | seguimiento
  'puede_ver',    // C — SI | NO
  'puede_editar', // D — SI | NO
];

/** Hoja SESIONES — tokens de sesión activos */
var SCHEMA_SESIONES = [
  'session_token', // A — UUID, clave primaria
  'id_usuario',    // B — FK a USUARIOS.id
  'email',         // C — denormalizado para lookup rápido
  'id_rol',        // D — snapshot del rol al momento del login
  'expira_en',     // E — timestamp ISO (login + 8 horas)
  'creada_en',     // F — timestamp ISO
  'activa',        // G — SI | NO
];

// ── DATOS SEMILLA RBAC ────────────────────────────────────────

/** Módulos del sistema sujetos a permisos */
var MODULOS_RBAC = ['gestiones', 'ventas', 'seguimiento'];

/**
 * Roles semilla.
 * - id=1 Administrador: rol del sistema (es_sistema=SI), acceso total, indestructible.
 * - id=2 Agente: rol personalizado inicial, editable desde la UI.
 */
var SEED_ROLES = [
  { id: 1, nombre: 'Administrador', descripcion: 'Acceso total a todos los módulos. Rol del sistema.', activo: 'SI', es_sistema: 'SI' },
  { id: 2, nombre: 'Agente',        descripcion: 'Gestiona contactos y ventas. Sin acceso de edición a seguimiento.', activo: 'SI', es_sistema: 'NO' },
];

/** Permisos por módulo — Agente ve+edita gestiones/ventas, solo ve seguimiento */
var SEED_PERMISOS_MODULOS = [
  { id_rol: 1, modulo: 'gestiones',   puede_ver: 'SI', puede_editar: 'SI' },
  { id_rol: 1, modulo: 'ventas',      puede_ver: 'SI', puede_editar: 'SI' },
  { id_rol: 1, modulo: 'seguimiento', puede_ver: 'SI', puede_editar: 'SI' },
  { id_rol: 2, modulo: 'gestiones',   puede_ver: 'SI', puede_editar: 'SI' },
  { id_rol: 2, modulo: 'ventas',      puede_ver: 'SI', puede_editar: 'SI' },
  { id_rol: 2, modulo: 'seguimiento', puede_ver: 'SI', puede_editar: 'NO' },
];

/**
 * Usuario admin inicial.
 * La contraseña en texto plano se hashea en seedUsuarios().
 * CAMBIAR la contraseña después del primer login.
 */
var SEED_USUARIOS = [
  { nombre: 'Admin', email: 'admin@ventas-personalizadas.com', password: 'admin123', id_rol: 1 },
];

// ── DATOS SEMILLA — CONFIG ────────────────────────────────────
// Solo se insertan si la fila correspondiente no existe ya.

var SEED_CONFIG = [
  {
    clave:       'version',
    valor:       '1.0',
    descripcion: 'Versión del schema de la base de datos',
  },
  {
    clave:       'vtex_cc_endpoint',
    valor:       '',
    descripcion: 'URL del Web App de vtex-control-center (completar en Script Properties, no acá — ver CLAUDE.md)',
  },
];

// ── VOCABULARIOS CONTROLADOS (código, no hojas CAT_) ──────────
// Ver docs/ventas_personalizadas_db_structure.md — catálogos con < 10
// valores estables, no ameritan hoja propia (google_sheets_standards §9.4).

var CANAL_INGRESO   = ['Bot', 'Recontacto Cancelados'];
var ESTADOS_GESTION = ['Pendiente', 'Contactado', 'Concretado', 'Descartado'];
var ESTADOS_VENTA   = ['Pago pendiente', 'Pago aprobado', 'Cancelada'];
var ORIGENES_VENTA  = ['Referido', 'Atención', 'Bot', 'Planilla'];
var TIPO_FACTURA    = ['B', 'A'];
var MEDIOS_PAGO     = ['Payway', 'MercadoPago', 'GOcuotas', 'Transferencia por Mercado Pago', 'Transferencia por Banco y retenciones', 'Giftcards'];
var PAYWAY_TIPO     = ['Débito', 'Crédito'];
var TARJETA_ENTIDAD = ['Visa', 'Mastercard'];
