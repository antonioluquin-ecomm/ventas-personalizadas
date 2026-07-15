// ============================================================
// VENTAS PERSONALIZADAS — PedidosProxy.gs
// Proxy hacia getPedidosClienteCache de vtex-control-center.
//
// Este proyecto NO guarda credenciales VTEX ni llama a la API de VTEX
// directamente — ver docs/decisions/001-cache-pedidos-vtex-control-center.md.
// El contrato completo (incluyendo el pivot de email a documento) está en
// vtex-control-center/docs/decisions/004-endpoint-pedidos-ventas-personalizadas.md.
//
// Script Properties requeridas en ESTE proyecto:
//   VTEX_CC_ENDPOINT      → URL del Web App de vtex-control-center
//   VTEX_CC_SERVICE_TOKEN → mismo valor que VP_SERVICE_TOKEN en
//                           Script Properties de vtex-control-center
// ============================================================

/**
 * Busca los pedidos de un cliente por DNI/CUIT contra vtex-control-center.
 * payload: { session_token, documento }
 * Respuesta: { ok, data: { documento, total_pedidos, pedidos: [...] } }
 */
function buscarPedidosCliente(body) {
  var documento = normalizeDocumento(body.documento);
  if (!documento) return { ok: false, error: 'documento es obligatorio', code: 400 };

  var props    = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('VTEX_CC_ENDPOINT');
  var token    = props.getProperty('VTEX_CC_SERVICE_TOKEN');
  if (!endpoint) return { ok: false, error: 'Falta VTEX_CC_ENDPOINT en Script Properties.', code: 500 };
  if (!token)    return { ok: false, error: 'Falta VTEX_CC_SERVICE_TOKEN en Script Properties.', code: 500 };

  var payload = {
    action: 'getPedidosClienteCache',
    serviceToken: token,
    params: { documento: documento },
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var status = response.getResponseCode();
    var data = null;
    try { data = JSON.parse(response.getContentText()); } catch (parseErr) { data = null; }

    if (status < 200 || status >= 300 || !data) {
      writeError('buscarPedidosCliente', 'HTTP ' + status + ' — ' + response.getContentText().slice(0, 300), '');
      return { ok: false, error: 'No se pudo consultar los pedidos del cliente (vtex-control-center no respondió correctamente).', code: 502 };
    }
    if (!data.ok) {
      return { ok: false, error: data.error || 'Error desconocido consultando pedidos.', code: 502 };
    }

    writeLog('buscarPedidosCliente', 'GESTIONES', '', 'OK', documento + ': ' + data.data.total_pedidos + ' pedido(s)');
    return { ok: true, data: data.data };
  } catch (err) {
    writeError('buscarPedidosCliente', err.message, err.stack);
    return { ok: false, error: 'No se pudo consultar los pedidos del cliente: ' + err.message, code: 502 };
  }
}
