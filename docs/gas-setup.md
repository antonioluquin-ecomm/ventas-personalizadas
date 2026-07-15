# Setup del GAS — Ventas Personalizadas

> Los pasos genéricos (crear proyecto GAS, publicar Web App, redeploy, límites) están en [`../project-standards/gas_setup_template.md`](../project-standards/gas_setup_template.md).
> Este archivo cubre solo lo específico de este proyecto.

---

## Archivos `.gs` a copiar

En el editor GAS, crear una pestaña por cada archivo y pegar su contenido:

| Archivo repo (`apps-script/`) | Pestaña GAS | Contenido |
|-------------------------------|-------------|-----------|
| `Code.gs` | `Code` | Router principal — RBAC por sesión, delega a módulos |
| `Schema.gs` | `Schema` | Columnas de cada hoja + datos semilla + vocabularios controlados |
| `Setup.gs` | `Setup` | `setupAll()` — creación idempotente de hojas y semillas |
| `Helpers.gs` | `Helpers` | `rowToObj`, `findRowById`, `getNextId`, logging (`LOGS`/`ERRORS`/`AUDIT_LOG`) |
| `Users.gs` | `Users` | Login, sesiones, roles y permisos (RBAC flexible) |
| `PedidosProxy.gs` | `PedidosProxy` | `buscarPedidosCliente` — proxy hacia `getPedidosClienteCache` de `vtex-control-center` |
| `Gestiones.gs` | `Gestiones` | CRUD de `GESTIONES` |
| `Ventas.gs` | `Ventas` | CRUD de `VENTAS`/`PAGOS_VENTA`/`COMPROBANTES_VENTA`, aprobación de pago, `getResumen` |

---

## Script Properties requeridas

| Propiedad | Descripción | Ejemplo |
|-----------|-------------|---------|
| `VTEX_CC_ENDPOINT` | URL del Web App de `vtex-control-center` | `https://script.google.com/macros/s/AKfycb.../exec` |
| `VTEX_CC_SERVICE_TOKEN` | Mismo valor que `VP_SERVICE_TOKEN` en Script Properties de `vtex-control-center` — ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md` | `uuid-...` |

Sin estas dos propiedades, `buscarPedidosCliente` falla con un error explícito (no silencioso).

---

## Setup paso a paso

1. Crear un Google Sheet nuevo: **`Ventas Personalizadas — Base de Datos`**.
2. `Extensiones > Apps Script` y copiar los archivos de la tabla de arriba, cada uno en su propia pestaña.
3. Configurar `VTEX_CC_ENDPOINT` y `VTEX_CC_SERVICE_TOKEN` en Script Properties (`⚙️ Configuración del proyecto`).
4. Ejecutar `setupAll()` una vez desde el editor (seleccionar la función en el dropdown → ▶ Ejecutar). Crea todas las hojas (`GESTIONES`, `VENTAS`, `PAGOS_VENTA`, `COMPROBANTES_VENTA`, `CONFIG`, `AUDIT_LOG`, `LOGS`, `ERRORS`, `USUARIOS`, `ROLES`, `PERMISOS_MODULOS`, `SESIONES`) y siembra roles/permisos/usuario admin inicial.
5. Revisar el log de ejecución (`Ver > Registros`) — el usuario admin semilla es `admin@ventas-personalizadas.com` / `admin123` (**cambiar la contraseña después del primer login**).
6. `Implementar > Nueva implementación > Aplicación web` — Ejecutar como "Yo", acceso "Cualquier usuario".
7. Copiar la URL del Web App al `config.js` del frontend (`APPS_SCRIPT_URL`) cuando se implemente.

---

## Verificación

Desde el editor GAS, con `VTEX_CC_ENDPOINT`/`VTEX_CC_SERVICE_TOKEN` ya configurados:

```js
function _testBuscarPedidosCliente() {
  var result = buscarPedidosCliente({ documento: '37658254' }); // reemplazar por un DNI real
  Logger.log(JSON.stringify(result));
}
```

Una respuesta `ok:true` con `pedidos` confirma que la cadena completa (este proyecto → `vtex-control-center` → VTEX) funciona.

---

## Roles y permisos semilla

| Rol | Gestiones | Ventas | Seguimiento |
|-----|-----------|--------|-------------|
| Administrador (id=1, sistema) | Ver + editar | Ver + editar | Ver + editar |
| Agente (id=2) | Ver + editar | Ver + editar | Solo ver |

Roles nuevos se crean desde `createRol` (arrancan sin acceso a ningún módulo — ver `apps_script_standards.md §7.2.1`).
