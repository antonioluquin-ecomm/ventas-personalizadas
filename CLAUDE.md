# Ventas Personalizadas — Instrucciones para Claude Code y Codex

> Las reglas generales y los docs maestros están en `../project-standards/` (`ai_rules.md`, `style_guide.md`, `apps_script_standards.md`).
> Este archivo contiene solo lo específico de este proyecto.

---

## Reglas activas — específicas de este proyecto

- **Nunca `fetch()` directo** — toda llamada al backend usa un helper único (`apiPost()` o equivalente) en `src/js/api.js`, siguiendo el mismo patrón que `commerce-hub`.
- **Este proyecto no tiene integración directa con VTEX.** La consulta de pedidos se hace contra el endpoint de solo lectura de `vtex-control-center` (cache diaria), nunca contra la API de VTEX directamente. Ver `docs/decisions/001-cache-pedidos-vtex-control-center.md`.
- **Mock mode**: si no hay URL de API configurada, las funciones deben retornar datos de ejemplo compatibles con la estructura real (`src/data/*.json`). Todo endpoint nuevo necesita su rama mock.
- **No tocar `Auth.gs`** ni el módulo de sesiones sin auditoría previa.
- **No hacer push** sin confirmación explícita del usuario.
- **Datos sensibles del cliente** (email, teléfono, medios de pago) — enmascarar en vistas de lista, igual que hace `vtex-control-center/apps-script/Pedidos.gs` (`maskEmail_`, `maskTail_`).

---

## Stack específico

- **SPA** — un solo `index.html`, navegación por tabs sin cambio de URL (mismo patrón que `commerce-hub`)
- **Estructura**: `src/js/` (lógica) · `src/css/` (estilos) · `src/data/` (JSON mock) · `apps-script/` (backend GAS)
- **Auth**: sesión con `id_rol` / `permisos` por módulo (RBAC flexible — ver `login_standard.md` y `application_shell.md §6.4`), no roles hardcodeados `admin`/`agente`
- **Sin multi-store** — contexto único

---

## Dependencia externa: cache de pedidos

Este proyecto **no** guarda credenciales VTEX ni llama a la API de VTEX. Para evitar consultas ilimitadas y no consumir cuota de API, `vtex-control-center` mantiene una hoja cache (`Pedidos_DB`) actualizada una vez al día vía trigger, y expone un endpoint de solo lectura sobre esa cache.

- El endpoint y su contrato (payload, campos devueltos) se documentan en `vtex-control-center/docs/gas-setup.md` cuando se implemente.
- Si el flujo de aprobación de pago necesita mutar el pedido en VTEX en tiempo real (pasar a "pago aprobado"), evaluar si esa escritura la hace `vtex-control-center` (que ya tiene el patrón de transición de estado en `Pedidos.gs`) expuesta como acción, en vez de duplicar la integración acá.

---

## Arquitectura de archivos JS (a definir a medida que se implementa)

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

1. **Re-contacto de clientes con pedidos cancelados** — identificados externamente por un Power BI que cruza clientes con pedidos cancelados y sin compra posterior. El agente busca al cliente por email, ve su historial de pedidos (vía cache de `vtex-control-center`), y registra si lo contactó.
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
