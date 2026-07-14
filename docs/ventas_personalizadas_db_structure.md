# Ventas Personalizadas — Estructura de Base de Datos
## Google Sheets + Apps Script
**Versión:** 1.0 | **Módulo:** Gestión de contactos + Ventas concretadas

> Sigue las convenciones de `../project-standards/google_sheets_standards.md`. Referencia de formato: `commerce-hub/docs/commerce_hub_db_structure.md`.

---

## RESUMEN

El modelo separa dos entidades con ciclos de vida distintos:

- **GESTIONES**: el contacto con el cliente. Nace de dos canales — consulta directa por bot, o recontacto de un cliente con pedido cancelado (identificado externamente por Power BI). Vive independientemente de si la venta se concreta o no; sirve para medir tasa de contacto y conversión.
- **VENTAS**: la venta ya concretada. Nace cuando el agente genera el pedido en VTEX vía Master Data (pago pendiente / promissory) y termina cuando el agente aprueba el pago y completa los datos operativos que pide administración.

Este proyecto **no** tiene una hoja de pedidos propia — el historial de pedidos de un cliente se consulta en vivo contra el endpoint de solo lectura de `vtex-control-center` (cache diaria). Ver `docs/decisions/001-cache-pedidos-vtex-control-center.md`.

---

## ARQUITECTURA DEL GOOGLE SHEET

### Nombre del archivo recomendado
`Ventas Personalizadas — Base de Datos Operativa`

> **Sin hojas `CAT_*`**: los vocabularios controlados de este proyecto son estables y chicos (< 10 valores) — viven como constantes en `apps-script/Config.gs`, no como hojas separadas. Ver §VOCABULARIOS CONTROLADOS más abajo.

### Hojas (Sheets) — Estructura completa

```
📊 Ventas Personalizadas — Base de Datos
│
├── 📋 GESTIONES              → Registro de contactos (bot / recontacto cancelados)
├── 📋 VENTAS                 → Ventas concretadas + datos operativos de aprobación de pago
├── 📋 PAGOS_VENTA            → Medios de pago aplicados a cada venta (1 a N por venta)
├── 📋 COMPROBANTES_VENTA     → Adjuntos de comprobante de pago (1 a N por venta, opcional)
├── 📊 RESUMEN                → Dashboard de métricas (fórmulas)
├── 📋 AUDIT_LOG              → Auditoría campo a campo (datos financieros)
├── 📋 LOGS                   → Log general de operaciones
├── 📋 ERRORS                 → Errores con detalle
└── ⚙️  CONFIG                 → Variables del sistema y metadatos
```

---

## HOJA: GESTIONES

**Propósito:** registrar cada contacto con un cliente, sin importar si termina en venta. Es la fuente de verdad para medir cuántos clientes se contactaron y desde qué canal.

### Columnas

| Col | Nombre | Tipo | Descripción | Validación |
|-----|--------|------|-------------|------------|
| A | `id` | Entero | ID único autoincremental | Único, no vacío |
| B | `canal_ingreso` | Lista | Cómo llegó la gestión a la herramienta | Ver `CANAL_INGRESO` en Config.gs: `Bot` / `Recontacto Cancelados` |
| C | `cliente_email` | Texto | Email del cliente — clave de búsqueda contra la cache de pedidos | `.trim().toLowerCase()` |
| D | `cliente_nombre` | Texto | Nombre del cliente, denormalizado desde el pedido consultado | Libre |
| E | `cliente_telefono` | Texto | Teléfono, denormalizado desde el pedido consultado | Libre |
| F | `pedido_referencia` | Texto | `orderId` VTEX del pedido cancelado a recontactar (vacío si es consulta directa por bot) | Texto, no número (evita perder ceros) |
| G | `cantidad_pedidos_cliente` | Entero | Snapshot de la cantidad de pedidos del cliente al momento de la consulta | ≥ 0 |
| H | `estado_gestion` | Lista | Estado del contacto | Ver `ESTADOS_GESTION` en Config.gs |
| I | `fecha_contacto` | Fecha-Hora | Cuándo el agente marcó "Contactado" | Vacío hasta que se contacta |
| J | `agente_contacto` | Texto | Email del agente que contactó | Apps Script (sesión) |
| K | `notas` | Texto | Notas libres del agente | Libre |
| L | `fecha_creacion` | Fecha-Hora | Timestamp de creación | Apps Script |
| M | `fecha_modificacion` | Fecha-Hora | Timestamp de última edición | Apps Script |
| N | `creado_por` | Texto | Email de quien creó el registro | Apps Script |
| O | `modificado_por` | Texto | Email de quien hizo la última modificación | Apps Script |

> **No se guarda `id_venta` en esta hoja.** Si una gestión termina en venta, la relación se resuelve buscando en `VENTAS` la fila con `id_gestion = GESTIONES.id` (ver §Relaciones). Evita mantener la misma relación en dos lugares.

---

## HOJA: VENTAS

**Propósito:** la venta concretada, desde que el agente genera el pedido en VTEX (pago pendiente) hasta que aprueba el pago y completa los datos que pide administración.

### Columnas

| Col | Nombre | Tipo | Descripción | Validación |
|-----|--------|------|-------------|------------|
| A | `id` | Entero | ID único autoincremental | Único, no vacío |
| B | `id_gestion` | Entero | FK opcional a `GESTIONES.id` | Vacío si la venta se cargó suelta, sin gestión previa registrada |
| C | `order_id_vtex` | Texto | Pedido creado en VTEX vía Master Data (pago pendiente / promissory) | Texto, no número |
| D | `cliente_email` | Texto | Email del cliente | `.trim().toLowerCase()` |
| E | `agente` | Texto | Email del agente que concretó la venta | Apps Script (sesión) |
| F | `estado_venta` | Lista | Estado de la venta | Ver `ESTADOS_VENTA` en Config.gs |
| G | `origen` | Lista (radio) | Cómo se originó la venta | Ver `ORIGENES_VENTA` en Config.gs: `Referido` / `Atención` / `Bot` / `Planilla` |
| H | `nro_caso` | Texto | Número de caso | Libre |
| I | `tipo_factura` | Lista | Tipo de factura | Ver `TIPO_FACTURA` en Config.gs, default `B` |
| J | `agente_retencion` | Boolean (SI/NO) | Si el cliente es agente de retención | Default `NO` |
| K | `razon_social` | Texto | Solo visible/obligatorio si `tipo_factura = A` | Libre |
| L | `cuit` | Texto | Solo visible/obligatorio si `tipo_factura = A` | Texto, no número (evita perder el 0 inicial) |
| M | `monto_total` | Número ARS | Total del pedido — usado para validar que la suma de `PAGOS_VENTA` coincida | > 0 |
| N | `fecha_aprobacion_pago` | Fecha-Hora | Cuándo el agente aprobó el pago (pasa el pedido a "pago aprobado" en VTEX) | Vacío hasta la aprobación |
| O | `fecha_creacion` | Fecha-Hora | Timestamp de creación | Apps Script |
| P | `fecha_modificacion` | Fecha-Hora | Timestamp de última edición | Apps Script |
| Q | `creado_por` | Texto | Email de quien creó el registro | Apps Script |
| R | `modificado_por` | Texto | Email de quien hizo la última modificación | Apps Script |

### Reglas de validación específicas (a nivel Apps Script, no Sheet)

- `razon_social` y `cuit` son obligatorios si y solo si `tipo_factura = A`.
- No se puede pasar `estado_venta` a `Pago aprobado` si `SUM(PAGOS_VENTA.monto donde id_venta=X) ≠ monto_total` (ver campo calculado `diferencia_montos`).
- Al aprobar el pago, la acción de backend que mute el pedido en VTEX (pasar a "pago aprobado") debe reutilizar el patrón de transición de estado de `vtex-control-center/apps-script/Pedidos.gs` (`executeOrderTransition_`) en vez de duplicar la integración VTEX en este proyecto — ver `docs/decisions/001-cache-pedidos-vtex-control-center.md`.

---

## HOJA: PAGOS_VENTA

**Propósito:** medios de pago aplicados a una venta. Relación **muchos a uno** con `VENTAS` — permite que el agente cargue el mismo medio de pago más de una vez (ej. dos transacciones de Payway) simplemente agregando otra fila.

### Columnas

| Col | Nombre | Tipo | Descripción | Validación |
|-----|--------|------|-------------|------------|
| A | `id` | Entero | ID único autoincremental | Único, no vacío |
| B | `id_venta` | Entero | FK a `VENTAS.id` | Obligatorio |
| C | `medio_pago` | Lista | Medio de pago usado | Ver `MEDIOS_PAGO` en Config.gs |
| D | `monto` | Número ARS | Monto de este medio de pago | > 0 |
| E | `nro_transaccion` | Texto | Número de transacción | Libre |
| F | `payway_tipo` | Lista | `Débito` / `Crédito` — solo si `medio_pago = Payway` | Vacío para otros medios |
| G | `tarjeta_entidad` | Lista | `Visa` / `Mastercard` — solo si `payway_tipo` está definido | Vacío si no aplica |
| H | `tarjeta_ultimos4` | Texto | Últimos 4 dígitos de la tarjeta | Exactamente 4 dígitos, texto (no número) |
| I | `cuotas` | Entero | Cantidad de cuotas — solo si `payway_tipo = Crédito` | ≥ 1 |
| J | `fecha_creacion` | Fecha-Hora | Timestamp de creación | Apps Script |
| K | `creado_por` | Texto | Email de quien cargó el pago | Apps Script |

> Estas filas no se editan una vez guardadas — si el agente se equivoca, se agrega una fila de corrección y se documenta en `notas` de `VENTAS` (no hay UPDATE de pagos, solo alta). Mantiene el registro financiero como un log append-only.

---

## HOJA: COMPROBANTES_VENTA

**Propósito:** adjuntos de comprobante de pago. Opcional — el flujo permite guardar sin adjuntar.

### Columnas

| Col | Nombre | Tipo | Descripción | Validación |
|-----|--------|------|-------------|------------|
| A | `id` | Entero | ID único autoincremental | Único, no vacío |
| B | `id_venta` | Entero | FK a `VENTAS.id` | Obligatorio |
| C | `nombre_archivo` | Texto | Nombre del archivo — debe contener el número de pedido | Validado en Apps Script antes de subir |
| D | `url_archivo` | URL | Link al archivo (Google Drive) | URL válida |
| E | `fecha_subida` | Fecha-Hora | Timestamp de subida | Apps Script |
| F | `subido_por` | Texto | Email de quien subió el comprobante | Apps Script |

---

## VOCABULARIOS CONTROLADOS — en código, no hojas `CAT_`

Todos estos catálogos tienen menos de 10 valores y son reglas de negocio estables (no cambian por operación del equipo). Siguiendo la excepción de `google_sheets_standards.md §9.4` ("si el catálogo tiene < 10 valores y nunca cambia → array en GAS, sin hoja CAT_") y el mismo patrón que `project-control-center/apps-script/Config.gs`, viven como constantes en `apps-script/Config.gs`, no como hojas `CAT_*` en el Sheet:

```javascript
const CANAL_INGRESO   = ['Bot', 'Recontacto Cancelados'];
const ESTADOS_GESTION = ['Pendiente', 'Contactado', 'Concretado', 'Descartado'];
const ESTADOS_VENTA   = ['Pago pendiente', 'Pago aprobado', 'Cancelada'];
const ORIGENES_VENTA  = ['Referido', 'Atención', 'Bot', 'Planilla'];
const TIPO_FACTURA    = ['B', 'A'];
const MEDIOS_PAGO     = ['Payway', 'MercadoPago', 'GOcuotas', 'Transferencia por Mercado Pago', 'Transferencia por Banco y retenciones', 'Giftcards'];
const PAYWAY_TIPO     = ['Débito', 'Crédito'];
const TARJETA_ENTIDAD = ['Visa', 'Mastercard'];
```

`Config.gs` es la única fuente de verdad para validar estos valores al escribir (mismo patrón que `PROYECTOS_COLS`/`ESTADOS_PROYECTO` en PCC). Si en el Sheet se quiere igual una validación de dropdown para edición manual, usar **"Lista de elementos"** con estos mismos valores pegados directo en `Datos > Validación de datos` (no `"Lista de rango"` contra una hoja aparte).

---

## CAMPOS CALCULADOS — nunca almacenados

Computados en Apps Script al momento de servir, nunca guardados en el Sheet (ver `google_sheets_standards.md §10`):

| Campo | Dónde aplica | Fórmula | Uso |
|-------|-------------|---------|-----|
| `suma_pagos` | VENTAS (por `id`) | `SUM(PAGOS_VENTA.monto donde id_venta=X)` | Comparar contra `monto_total` |
| `diferencia_montos` | VENTAS | `monto_total - suma_pagos` | Debe ser `0` para permitir aprobar el pago |
| `dias_desde_gestion` | GESTIONES | `HOY() - fecha_creacion` | Dashboard de seguimiento (gestiones que se están enfriando) |
| `tasa_contacto_pct` | RESUMEN | `Contactado+Concretado+Descartado / total gestiones × 100` | Métrica de gestión |
| `tasa_conversion_pct` | RESUMEN | `Concretado / total gestiones × 100` | Métrica de conversión |

---

## RELACIONES ENTRE HOJAS

```
GESTIONES.id  ←── VENTAS.id_gestion        (uno a uno opcional, FK solo en VENTAS)
VENTAS.id     ←── PAGOS_VENTA.id_venta     (uno a muchos)
VENTAS.id     ←── COMPROBANTES_VENTA.id_venta  (uno a muchos)
VENTAS.order_id_vtex  ──→ referencia externa (VTEX), no FK interna
```

- **`GESTIONES` → `VENTAS`**: para saber si una gestión se concretó, buscar en `VENTAS` la primera fila con `id_gestion = GESTIONES.id` (patrón §9.1 de `google_sheets_standards.md`, invertido para no duplicar la relación).
- **`VENTAS` → `PAGOS_VENTA` / `COMPROBANTES_VENTA`**: relación muchos-a-uno estándar, resuelta con `filter(id_venta === X)` al servir el detalle de una venta.
- **`VENTAS.cliente_email` / `GESTIONES.cliente_email`**: no tienen FK contra ninguna hoja propia — el cruce con el historial real de pedidos se hace en vivo contra el endpoint de `vtex-control-center`, nunca almacenado más que el snapshot puntual (`pedido_referencia`, `cantidad_pedidos_cliente`).

---

## FUNCIONES APPS SCRIPT PREVISTAS

Sin implementar todavía — nombres y contratos a definir cuando se arranque el backend, siguiendo `apps_script_standards.md`:

```
listGestiones(params)            → filtros: estado_gestion, canal_ingreso, agente_contacto
getGestionById(id)                → adjunta la venta asociada si existe (lookup por id_gestion)
buscarPedidosCliente(email)       → proxy hacia el endpoint de solo lectura de vtex-control-center
registrarContacto(id, data)       → marca estado_gestion, fecha_contacto, agente_contacto
crearVenta(data)                  → alta en VENTAS con estado_venta = "Pago pendiente"
agregarPagoVenta(idVenta, data)   → alta en PAGOS_VENTA (append-only)
subirComprobante(idVenta, data)   → alta en COMPROBANTES_VENTA, valida nombre de archivo
aprobarPagoVenta(idVenta)         → valida diferencia_montos = 0, muta VTEX (vía vtex-control-center), actualiza estado_venta y fecha_aprobacion_pago
getResumen()                      → métricas de RESUMEN (tasa_contacto_pct, tasa_conversion_pct, etc.)
```

---

## HOJA: CONFIG

```
SHEET_VERSION        1.0
ALLOWED_STORES        (no aplica — sin multi-store)
VTEX_CC_ENDPOINT       (URL del Web App de vtex-control-center, endpoint de pedidos)
LAST_SYNC              (no aplica en este proyecto — el sync de pedidos vive en vtex-control-center)
ESTADO_GESTION_VALUES  Pendiente,Contactado,Concretado,Descartado
ESTADO_VENTA_VALUES    Pago pendiente,Pago aprobado,Cancelada
```

---

## PRÓXIMOS PASOS

- [ ] Crear el Google Sheet con esta estructura
- [ ] Definir y documentar el contrato exacto del endpoint de `vtex-control-center` que expone la cache de pedidos (payload de request/response)
- [ ] Implementar `apps-script/` siguiendo las funciones previstas arriba
- [ ] Construir la interfaz: búsqueda de cliente → historial de pedidos → registrar contacto
- [ ] Construir el formulario de aprobación de pago con campos condicionales (Factura A, Payway débito/crédito)
