/* ============================================================
   VENTAS PERSONALIZADAS — seguimiento.js
   Resumen/dashboard: tasa de contacto, conversión, estado de ventas.
   Alimenta tanto la página Inicio (resumen rápido) como Seguimiento.
   ============================================================ */

async function loadResumen() {
  try {
    const res = await apiGetResumen();
    STATE.resumen = res.data;
    renderResumenInicio();
    renderResumenSeguimiento();
  } catch (err) {
    console.error('loadResumen error:', err);
  }
}

function renderResumenInicio() {
  const el = document.getElementById('inicio-kpis');
  if (!el || !STATE.resumen) return;
  const g = STATE.resumen.gestiones;
  const v = STATE.resumen.ventas;
  el.innerHTML = `
    <div class="kpi"><div class="kpi-label">Gestiones totales</div><div class="kpi-val">${g.total}</div></div>
    <div class="kpi"><div class="kpi-label">Tasa de contacto</div><div class="kpi-val">${g.tasa_contacto_pct}%</div></div>
    <div class="kpi"><div class="kpi-label">Tasa de conversión</div><div class="kpi-val">${g.tasa_conversion_pct}%</div></div>
    <div class="kpi"><div class="kpi-label">Ventas totales</div><div class="kpi-val">${v.total}</div></div>
  `;
}

function renderResumenSeguimiento() {
  const el = document.getElementById('seg-body');
  if (!el || !STATE.resumen) return;
  const g = STATE.resumen.gestiones;
  const v = STATE.resumen.ventas;

  const barRow = (label, count, total, color) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-count">${count}</div>
    </div>`;
  };

  el.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Gestiones totales</div><div class="kpi-val">${g.total}</div></div>
      <div class="kpi"><div class="kpi-label">Tasa de contacto</div><div class="kpi-val">${g.tasa_contacto_pct}%</div></div>
      <div class="kpi"><div class="kpi-label">Tasa de conversión</div><div class="kpi-val">${g.tasa_conversion_pct}%</div></div>
    </div>
    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-title">Gestiones por estado</div>
        ${ESTADOS_GESTION.map(e => barRow(e, g.por_estado[e] || 0, g.total, 'var(--primary)')).join('')}
      </div>
      <div class="dash-card">
        <div class="dash-title">Ventas por estado</div>
        ${ESTADOS_VENTA.map(e => barRow(e, v.por_estado[e] || 0, v.total, 'var(--blue)')).join('')}
      </div>
    </div>
  `;
}
