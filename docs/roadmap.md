# Roadmap — Ventas Personalizadas

## Próximos pasos

- [x] Definir modelo de datos del Sheet (gestiones, contactos, ventas, pagos, adjuntos) — ver `docs/ventas_personalizadas_db_structure.md`
- [x] Definir contrato del endpoint de solo lectura que expondrá `vtex-control-center` (cache diaria de pedidos) — ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md`
- [x] Implementar acción `getPedidosClienteCache` en `vtex-control-center` (`apps-script/PedidosCache.gs`) — pivot 2026-07-14: es un proxy 100% en vivo (búsqueda por email vs VTEX en el momento), no una cache diaria — el volumen real (~32.000 pedidos/mes) hacía inviable pre-cargar todo. Ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md` (addendum). Sin cambios de contrato para este proyecto.
- [ ] Generar `VP_SERVICE_TOKEN` en Script Properties de `vtex-control-center` y copiarlo como `VTEX_CC_SERVICE_TOKEN` en Script Properties de este proyecto (cuando se implemente el backend acá)
- [ ] Confirmar con VTEX si existe API de creación de pedido (placement) o si v1 sigue usando Master Data
- [ ] Login + shell (SPA, RBAC flexible por módulo — ver `login_standard.md` y `application_shell.md`)
- [ ] Módulo: búsqueda de cliente por email + historial de pedidos
- [ ] Módulo: registro de gestión de contacto (pendiente/contactado/concretado)
- [ ] Módulo: formulario de aprobación de pago (origen, factura, medios de pago múltiples, adjuntos) + impacto en VTEX
- [ ] Módulo: análisis y seguimiento (dashboard de gestiones)

## Backlog

- Botón para generar mensaje automático de re-contacto
- Interfaz propia de creación de pedido (si VTEX lo permite) en vez de Master Data
