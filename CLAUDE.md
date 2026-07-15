# Ventas Personalizadas — Instrucciones para Claude Code y Codex

> Las reglas generales y los docs maestros están en `../project-standards/` (`ai_rules.md`, `style_guide.md`, `apps_script_standards.md`).
> Este archivo contiene solo lo específico de este proyecto.

---

## Reglas activas — específicas de este proyecto

- **Nunca `fetch()` directo** — toda llamada al backend usa un helper único (`apiPost()` o equivalente) en `src/js/api.js`, siguiendo el mismo patrón que `commerce-hub`.
- **Este proyecto no tiene integración directa con VTEX.** La consulta de pedidos se hace contra el endpoint de solo lectura de `vtex-control-center` (cache diaria), nunca contra la API de VTEX directamente. Ver `docs/decisions/001-cache-pedidos-vtex-control-center.md`.
- **Mock mode**: si no hay URL de API configurada, las funciones deben retornar datos de ejemplo compatibles con la estructura real (`src/data/*.json`). Todo endpoint nuevo necesita su rama mock.
- **No tocar `apps-script/Users.gs`** (login, sesiones, roles/permisos) sin auditoría previa.
- **No hacer push** sin confirmación explícita del usuario.
- **Datos sensibles del cliente** (teléfono, documento, medios de pago) — enmascarar en vistas de lista, igual que hace `vtex-control-center/apps-script/Pedidos.gs` (`maskTail_`). No hay email real disponible desde VTEX para este proyecto (ver dependencia externa más abajo).

---

## Stack específico

- **SPA** — un solo `index.html`, navegación por tabs sin cambio de URL (mismo patrón que `commerce-hub`)
- **Estructura**: `src/js/` (lógica) · `src/css/` (estilos) · `src/data/` (JSON mock) · `apps-script/` (backend GAS)
- **Auth**: sesión con `id_rol` / `permisos` por módulo (RBAC flexible — ver `login_standard.md` y `application_shell.md §6.4`), no roles hardcodeados `admin`/`agente`
- **Sin multi-store** — contexto único

---

## Dependencia externa: pedidos por cliente (vtex-control-center)

Este proyecto **no** guarda credenciales VTEX ni llama a la API de VTEX. `vtex-control-center` expone la acción `getPedidosClienteCache`, que consulta VTEX **en vivo** (no una cache diaria — se descartó por volumen real de pedidos, ver decisión 004).

- **Contrato completo del endpoint** (request/response, auth): `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md` (Addendum 2 tiene el contrato vigente).
- **Se busca por DNI/documento del cliente, no por email.** VTEX anonimiza el email en su API para esta cuenta (`clientProfileData.email` devuelve un valor tipo `...@ct.vtex.com.br`, no el real) — confirmado en vivo el 2026-07-14. El teléfono y el documento sí son reales. Por eso `GESTIONES.cliente_documento` es la clave de búsqueda, no `cliente_email` (ver `docs/ventas_personalizadas_db_structure.md`).
- Auth: token de servicio (`VTEX_CC_SERVICE_TOKEN` en Script Properties de este proyecto), no sesión de usuario — es una llamada backend-a-backend.
- El endpoint devuelve teléfono del cliente **sin enmascarar** (a diferencia de la UI propia de `vtex-control-center`), porque el propósito de este proyecto es justamente contactar al cliente. No devuelve email (ver punto anterior). Cada llamada queda logueada del lado de `vtex-control-center`.
- Multi-store transparente: el endpoint busca en ambas tiendas (Sporting, Woker) y devuelve `store_id` por pedido — este proyecto no necesita selector de tienda.
- Si el flujo de aprobación de pago necesita mutar el pedido en VTEX en tiempo real (pasar a "pago aprobado"), evaluar si esa escritura la hace `vtex-control-center` (que ya tiene el patrón de transición de estado en `Pedidos.gs`) expuesta como una acción nueva, en vez de duplicar la integración acá.

---

## Arquitectura de archivos GAS (backend — implementado)

| Archivo | Responsabilidad |
|---------|----------------|
| `apps-script/Code.gs` | Router (RBAC por sesión, mismo patrón que `commerce-hub/apps-script/Code.gs`) |
| `apps-script/Schema.gs` | Columnas de cada hoja + datos semilla + vocabularios controlados (sin hojas `CAT_*`) |
| `apps-script/Setup.gs` | `setupAll()` — creación idempotente de hojas y semillas |
| `apps-script/Helpers.gs` | `rowToObj`, `findRowById`, `getNextId`, logging (`LOGS`/`ERRORS`/`AUDIT_LOG`) |
| `apps-script/Users.gs` | Login, sesiones, roles y permisos (RBAC flexible) |
| `apps-script/PedidosProxy.gs` | `buscarPedidosCliente` — proxy hacia `vtex-control-center` |
| `apps-script/Gestiones.gs` | CRUD de `GESTIONES` |
| `apps-script/Ventas.gs` | CRUD de `VENTAS`/`PAGOS_VENTA`/`COMPROBANTES_VENTA`, aprobación de pago, `getResumen` |

Ver `docs/gas-setup.md` para el setup paso a paso.

**Pendiente conocido:** `aprobarPagoVenta` solo actualiza el Sheet — todavía no muta el pedido en VTEX a "pago aprobado" (necesita una acción nueva en `vtex-control-center`, ver comentario en `Ventas.gs`).

## Arquitectura de archivos JS (frontend — a definir a medida que se implementa)

| Archivo | Responsabilidad |
|---------|----------------|
| `src/js/config.js` | Constantes, `STATE` global, `CFG`, tema |
| `src/js/api.js` | `apiPost()`, llamadas al endpoint de pedidos y al backend propio |
| `src/js/ui.js` | Badges, toast, drawer, navegación entre módulos |
| `src/js/gestiones.js` | Búsqueda de cliente, historial de pedidos, registro de contacto |
| `src/js/ventas.js` | Formulario de aprobación de pago, medios de pago múltiples, adjuntos |

**Regla**: cada archivo tiene una responsabilidad única. No agregar lógica de API en `ui.js` ni lógica de render en `api.js`.

---

## Versionado

Usar commits descriptivos con prefijo convencional (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`). Versión y changelog en `CHANGELOG.md` (no hay `config.js` con versión embebida todavía — evaluar si se agrega cuando el proyecto tenga primera versión funcional).

---

## Contexto del proyecto

Herramienta operativa para el equipo de agentes de venta (Sporting + Woker eCommerce). Cubre dos flujos:

1. **Re-contacto de clientes con pedidos cancelados** — identificados externamente por un Power BI que cruza clientes con pedidos cancelados y sin compra posterior. El agente busca al cliente por DNI/documento, ve su historial de pedidos (consulta en vivo vía `vtex-control-center`), y registra si lo contactó.
2. **Concreción de venta** — una vez el cliente confirma, el agente genera el pedido en VTEX vía Master Data (pago pendiente, promissory/pagaré), envía el link de pago, y cuando el cliente abona, el agente aprueba el pago y completa los datos operativos requeridos por administración (origen, tipo de factura, agente de retención, medios de pago con montos/transacciones, comprobantes).

Ver estructura del Sheet en [`docs/ventas_personalizadas_db_structure.md`](docs/ventas_personalizadas_db_structure.md).

---

## Documentación estándar compartida

La documentación estándar compartida se encuentra en `../project-standards/`:

- [`../project-standards/ai_rules.md`](../project-standards/ai_rules.md) — reglas de colaboración con IA
- [`../project-standards/style_guide.md`](../project-standards/style_guide.md) — colores, tipografía, componentes CSS, Git
- [`../project-standards/apps_script_standards.md`](../project-standards/apps_script_standards.md) — convenciones GAS
- [`../project-standards/google_sheets_standards.md`](../project-standards/google_sheets_standards.md) — estructura de Sheets
- [`../project-standards/login_standard.md`](../project-standards/login_standard.md) — patrón de autenticación
- [`../project-standards/application_shell.md`](../project-standards/application_shell.md) — shell de aplicación

### Entorno de trabajo

- El desarrollo se realiza desde `C:\Users\gluna\Documents\Repos`
- No usar OneDrive/SharePoint como carpeta de desarrollo
- GitHub es la fuente principal para versionado y colaboración
- OneDrive/SharePoint queda reservado para documentación funcional: archivos compartidos, PDFs, presentaciones, actas e imágenes
