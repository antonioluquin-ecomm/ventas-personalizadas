# Ventas Personalizadas

Gestión operativa y seguimiento de ventas personalizadas: re-contacto de clientes con pedidos cancelados, ventas por consulta de bot, y el circuito completo de aprobación de pago hasta que el pedido entra al flujo operativo normal en VTEX.

## Qué es

Herramienta interna para el equipo de agentes de venta. Permite:

- Consultar el historial de pedidos de un cliente (vía cache diaria de `vtex-control-center`) para gestionar re-contactos.
- Registrar gestiones de contacto (contactado / pendiente / concretado) para análisis posterior.
- Cargar los datos operativos de una venta concretada (origen, tipo de factura, medios de pago, retenciones, comprobantes) y aprobar el pago en VTEX.

## Stack

- Frontend: HTML/CSS/Vanilla JS (SPA) · GitHub Pages
- Backend: Google Apps Script
- Base de datos: Google Sheets
- Dependencia externa: endpoint de solo lectura de pedidos expuesto por `vtex-control-center` (cache diaria, sin llamar a VTEX directamente desde este proyecto)

## Cómo usar

Instrucciones mínimas — completar cuando el flujo esté implementado.

## Cómo validar

Qué verificar para confirmar que funciona — completar cuando el flujo esté implementado.
