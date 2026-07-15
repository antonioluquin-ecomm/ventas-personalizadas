# Roadmap — Ventas Personalizadas

## Próximos pasos

- [x] Definir modelo de datos del Sheet (gestiones, contactos, ventas, pagos, adjuntos) — ver `docs/ventas_personalizadas_db_structure.md`
- [x] Definir contrato del endpoint de solo lectura que expondrá `vtex-control-center` (cache diaria de pedidos) — ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md`
- [x] Implementar acción `getPedidosClienteCache` en `vtex-control-center` (`apps-script/PedidosCache.gs`) — 2 pivots el 2026-07-14: (1) proxy 100% en vivo en vez de cache diaria (el volumen real, ~32.000 pedidos/mes, hacía inviable pre-cargar todo); (2) busca por **DNI/documento**, no por email — VTEX anonimiza el email en la API para esta cuenta. Ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md` (Addendum y Addendum 2). Modelo de datos actualizado: `GESTIONES.cliente_documento` / `VENTAS.cliente_documento` en vez de `cliente_email`.
- [ ] Generar `VP_SERVICE_TOKEN` en Script Properties de `vtex-control-center` y copiarlo como `VTEX_CC_SERVICE_TOKEN` en Script Properties de este proyecto (cuando se implemente el backend acá)
- [ ] Confirmar con VTEX si existe API de creación de pedido (placement) o si v1 sigue usando Master Data
- [ ] Login + shell (SPA, RBAC flexible por módulo — ver `login_standard.md` y `application_shell.md`)
- [ ] Módulo: búsqueda de cliente por DNI/documento + historial de pedidos
- [ ] Módulo: registro de gestión de contacto (pendiente/contactado/concretado)
- [ ] Módulo: formulario de aprobación de pago (origen, factura, medios de pago múltiples, adjuntos) + impacto en VTEX
- [ ] Módulo: análisis y seguimiento (dashboard de gestiones)

## Backlog

- Botón para generar mensaje automático de re-contacto
- Interfaz propia de creación de pedido (si VTEX lo permite) en vez de Master Data
