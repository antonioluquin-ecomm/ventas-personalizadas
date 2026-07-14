# 001 — Cache de pedidos vía vtex-control-center en vez de integración VTEX propia

**Fecha:** 2026-07-14
**Estado:** Aceptada

## Contexto

Ventas Personalizadas necesita consultar el historial de pedidos de un cliente por email (cantidad, estado, medios de pago, items) para gestionar re-contactos y ventas. Consultar la API de VTEX en tiempo real desde un proyecto nuevo implicaría:

- Duplicar credenciales VTEX (App Key/Token) en un tercer lugar del ecosistema.
- Sumar consultas a la cuota de API de VTEX sin necesidad, ya que el caso de uso no requiere datos en tiempo real (una vez al día alcanza).

`vtex-control-center` ya es dueño de la integración VTEX (`apps-script/Pedidos.gs`: `listOrders`, `getOrder`, transiciones de estado) con credenciales en Script Properties.

## Decisión

`vtex-control-center` mantiene una hoja cache (`Pedidos_DB`) actualizada una vez al día por trigger, y expone un endpoint de solo lectura sobre esa cache. `Ventas Personalizadas` consume ese endpoint en vez de integrar VTEX directamente.

Si en el futuro el flujo de aprobación de pago necesita mutar el estado del pedido en VTEX (no solo leer), evaluar si esa escritura puntual la expone también `vtex-control-center` como una acción específica, reutilizando el patrón ya existente de `executeOrderTransition_`.

## Alternativas descartadas

- **Integración VTEX propia en Ventas Personalizadas**: descartada por duplicar credenciales y consultas innecesarias a VTEX.
- **Módulo dentro de `vtex-control-center`**: descartada porque el dominio (gestión de agentes de venta, contactos, pagos) no encaja con el rol de `vtex-control-center` (admin de catálogo/pedidos), que además tiene freeze zones propias.
- **Módulo dentro de `commerce-hub`**: descartada porque el dominio (calendario comercial) es distinto y `commerce-hub` no tiene multi-store ni el modelo de datos necesario.

## Impacto

- `Ventas Personalizadas` es un proyecto nuevo e independiente (repo propio).
- Queda pendiente definir el contrato exacto del endpoint de lectura en `vtex-control-center` (ver `docs/roadmap.md`).
