# Roadmap — Ventas Personalizadas

## Próximos pasos

- [x] Definir modelo de datos del Sheet (gestiones, contactos, ventas, pagos, adjuntos) — ver `docs/ventas_personalizadas_db_structure.md`
- [x] Definir contrato del endpoint de solo lectura que expondrá `vtex-control-center` (cache diaria de pedidos) — ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md`
- [x] Implementar acción `getPedidosClienteCache` en `vtex-control-center` (`apps-script/PedidosCache.gs`) — 2 pivots el 2026-07-14: (1) proxy 100% en vivo en vez de cache diaria (el volumen real, ~32.000 pedidos/mes, hacía inviable pre-cargar todo); (2) busca por **DNI/documento**, no por email — VTEX anonimiza el email en la API para esta cuenta. Ver `vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md` (Addendum y Addendum 2). Modelo de datos actualizado: `GESTIONES.cliente_documento` / `VENTAS.cliente_documento` en vez de `cliente_email`.
- [x] Implementar backend GAS completo (`Code.gs`, `Schema.gs`, `Setup.gs`, `Helpers.gs`, `Users.gs`, `PedidosProxy.gs`, `Gestiones.gs`, `Ventas.gs`) — RBAC flexible (Administrador/Agente), CRUD de gestiones/ventas/pagos/comprobantes, `buscarPedidosCliente`, `getResumen`. Ver `docs/gas-setup.md` para el setup paso a paso.
- [x] Investigar mutación automática de VTEX en `aprobarPagoVenta` — **descartado** (2026-07-15): el mecanismo de "Aprobar pago" de VTEX (notifypayment, para Promissory) requiere cookie de sesión de admin, confirmado que no funciona con App Key/Token contra un pedido de prueba real. Ver `vtex-control-center/apps-script/AprobacionPago.gs`. `aprobarPagoVenta` solo actualiza el Sheet — el agente sigue aprobando el pago a mano en VTEX admin como paso aparte.
- [ ] Crear el Google Sheet real, correr `setupAll()`, configurar Script Properties (`VTEX_CC_ENDPOINT`, `VTEX_CC_SERVICE_TOKEN`) y hacer el primer deploy del Web App
- [ ] Confirmar con VTEX si existe API de creación de pedido (placement) o si v1 sigue usando Master Data
- [ ] Frontend: login + shell (SPA, RBAC flexible por módulo — ver `login_standard.md` y `application_shell.md`)
- [ ] Frontend: búsqueda de cliente por DNI/documento + historial de pedidos (backend listo: `buscarPedidosCliente`)
- [ ] Frontend: registro de gestión de contacto (backend listo: `createGestion`/`registrarContacto`)
- [ ] Frontend: formulario de aprobación de pago (backend listo: `crearVenta`/`agregarPagoVenta`/`subirComprobante`/`aprobarPagoVenta`) — recordar mostrar el aviso de que la aprobación en VTEX sigue siendo manual
- [ ] Frontend: análisis y seguimiento (backend listo: `getResumen`)

## Backlog

- Botón para generar mensaje automático de re-contacto
- Interfaz propia de creación de pedido (si VTEX lo permite) en vez de Master Data
