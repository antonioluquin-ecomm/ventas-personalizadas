/* ============================================================
   VENTAS PERSONALIZADAS — auth.js
   Sistema de autenticación y control de acceso por roles (RBAC)

   Carga: después de config.js, antes de api.js y ui.js.
   initAuth() se llama en window.onload antes de cargar los módulos.
   ============================================================ */

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
var escapeHtml = _escHtml;

/* ─── SESSION ─────────────────────────────────────────────── */

const SESSION = {
  get data()    { return JSON.parse(localStorage.getItem('vp_session') || 'null'); },
  set data(v)   { localStorage.setItem('vp_session', JSON.stringify(v)); },
  clear()       { localStorage.removeItem('vp_session'); },

  isLoggedIn()  {
    const d = this.data;
    return !!d && !!d.expira_en && new Date(d.expira_en) > new Date();
  },
  isAdmin()     { return this.isLoggedIn() && this.data.usuario.id_rol === 1; },

  canView(mod)  {
    if (CFG.isMock()) return true;
    if (!this.isLoggedIn()) return false;
    if (this.isAdmin()) return true;
    const d = this.data;
    return !!(d && d.permisos && d.permisos[mod] && d.permisos[mod].ver);
  },
  canEdit(mod)  {
    if (CFG.isMock()) return true;
    if (!this.isLoggedIn()) return false;
    if (this.isAdmin()) return true;
    const d = this.data;
    return !!(d && d.permisos && d.permisos[mod] && d.permisos[mod].editar);
  },
  canEditAny()  {
    if (CFG.isMock()) return true;
    if (!this.isLoggedIn()) return false;
    if (this.isAdmin()) return true;
    const d = this.data;
    if (!d || !d.permisos) return false;
    return Object.values(d.permisos).some(function(p) { return p.editar; });
  },

  get token()   { return (this.data && this.data.session_token) || ''; },
};

/* ─── LOGIN PATH ──────────────────────────────────────────── */

function _loginPath() {
  const tag = document.querySelector('script[src*="config.js"]');
  if (tag) {
    const src = tag.getAttribute('src');
    return src.replace('src/js/config.js', '') + 'login.html';
  }
  const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
  return '../'.repeat(Math.max(0, depth)) + 'login.html';
}

/* ─── INIT ────────────────────────────────────────────────── */

async function initAuth() {
  if (CFG.isMock()) return;

  try {
    const res = await fetch(CFG.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'checkSetup' }),
    });
    if (res.ok) {
      const json = await res.json();
      if (!json.usuarios_configured) {
        window.location.href = _loginPath();
        return;
      }
    }
  } catch (e) { /* sin conexión: fail-closed → login */ }

  if (SESSION.isLoggedIn()) {
    try {
      const fresh = await _apiAuthPost({ action: 'validateSession' });
      if (fresh && fresh.permisos) {
        const cur = SESSION.data;
        if (cur) SESSION.data = Object.assign({}, cur, { permisos: fresh.permisos });
      }
    } catch (e) { /* sin conexión o sesión expirada: logoutUser() ya fue llamado */ }

    if (!SESSION.isLoggedIn()) { window.location.href = _loginPath(); return; }
    _applySession();
    return;
  }

  window.location.href = _loginPath();
}

function _applySession() {
  document.querySelectorAll('input[type="search"]').forEach(function(el) { el.value = ''; });

  applyPermissionsToSidebar();

  if (!SESSION.canEditAny()) {
    document.body.classList.add('no-edit');
  } else {
    document.body.classList.remove('no-edit');
  }

  _renderUserIndicator();
}

/* ─── LOGOUT ──────────────────────────────────────────────── */

function logoutUser() {
  const token = SESSION.token;
  SESSION.clear();

  if (token && !CFG.isMock()) {
    fetch(CFG.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'logout', session_token: token }),
    }).catch(function() {});
  }

  window.location.href = _loginPath();
}

/* ─── CAMBIAR CONTRASEÑA ─────────────────────────────────────── */

function _showChangePasswordModal() {
  if (document.getElementById('chpw-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'chpw-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9998';
  overlay.innerHTML = `
    <div class="login-card" style="width:340px">
      <div class="page-title" style="font-size:15px;margin-bottom:12px">Cambiar contraseña</div>
      <div id="chpw-error" class="alert-err" hidden></div>
      <div class="form-group">
        <label class="form-label">Contraseña actual</label>
        <input class="input" id="chpw-actual" type="password" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label class="form-label">Nueva contraseña</label>
        <input class="input" id="chpw-nueva" type="password"
               autocomplete="new-password" placeholder="Mínimo 6 caracteres">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmar nueva contraseña</label>
        <input class="input" id="chpw-confirmar" type="password" autocomplete="new-password">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-primary" id="chpw-submit" onclick="_submitChangePassword()" style="flex:1">Guardar</button>
        <button class="btn btn-ghost" onclick="_closeChangePasswordModal()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(function() {
    const el = document.getElementById('chpw-actual');
    if (el) el.focus();
  }, 80);

  overlay.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  _submitChangePassword();
    if (e.key === 'Escape') _closeChangePasswordModal();
  });
}

function _closeChangePasswordModal() {
  const overlay = document.getElementById('chpw-overlay');
  if (overlay) overlay.remove();
}

async function _submitChangePassword() {
  const actualEl    = document.getElementById('chpw-actual');
  const nuevaEl     = document.getElementById('chpw-nueva');
  const confirmarEl = document.getElementById('chpw-confirmar');
  const errorEl     = document.getElementById('chpw-error');

  const actual    = actualEl    ? actualEl.value    : '';
  const nueva     = nuevaEl     ? nuevaEl.value     : '';
  const confirmar = confirmarEl ? confirmarEl.value : '';

  if (errorEl) errorEl.hidden = true;

  if (!actual) {
    if (errorEl) { errorEl.textContent = 'Ingresá tu contraseña actual.'; errorEl.hidden = false; }
    return;
  }
  if (!nueva || nueva.length < 6) {
    if (errorEl) { errorEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; errorEl.hidden = false; }
    return;
  }
  if (nueva !== confirmar) {
    if (errorEl) { errorEl.textContent = 'Las contraseñas no coinciden.'; errorEl.hidden = false; }
    return;
  }

  try {
    const actualHash = await sha256(actual);
    const nuevaHash  = await sha256(nueva);
    await _apiAuthPost({ action: 'changePassword', password_actual_hash: actualHash, password_nueva_hash: nuevaHash });
    _closeChangePasswordModal();
    if (typeof toast === 'function') toast('✓', 'Contraseña actualizada', 'success');
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message || 'Error al cambiar la contraseña.'; errorEl.hidden = false; }
  }
}

/* ─── USER INDICATOR EN SIDEBAR ─────────────────────────────── */

function _openUserDropdown() {
  const drop = document.getElementById('user-dropdown');
  const chip = document.getElementById('sidebar-user-chip');
  if (!drop || !chip) return;
  drop.style.display = 'block';
  if (window.innerWidth <= 900) {
    drop.style.bottom = '12px';
    drop.style.left   = '12px';
    drop.style.right  = '12px';
    drop.style.width  = 'auto';
  } else {
    const rect = chip.getBoundingClientRect();
    drop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    drop.style.left   = rect.left + 'px';
    drop.style.right  = 'auto';
    drop.style.width  = rect.width + 'px';
  }
  chip.setAttribute('aria-expanded', 'true');
  chip.classList.add('open');
}

function _closeUserDropdown() {
  const drop = document.getElementById('user-dropdown');
  const chip = document.getElementById('sidebar-user-chip');
  if (drop) drop.style.display = 'none';
  if (chip) { chip.setAttribute('aria-expanded', 'false'); chip.classList.remove('open'); }
}

function _renderUserIndicator() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || document.getElementById('sidebar-user-chip')) return;

  const user = SESSION.data && SESSION.data.usuario;
  if (!user) return;

  const chip = document.createElement('div');
  chip.id = 'sidebar-user-chip';
  chip.className = 'user-chip';
  chip.setAttribute('role', 'button');
  chip.setAttribute('aria-haspopup', 'true');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('title', user.nombre || user.email || '');
  chip.innerHTML =
    '<div class="user-chip-info">' +
      '<span class="user-chip-name">' + escapeHtml(user.nombre || user.email || '') +
        ' <span class="user-chip-chevron" aria-hidden="true">▾</span></span>' +
      '<span class="user-chip-role">' + escapeHtml(user.nombre_rol || '') + '</span>' +
    '</div>';
  chip.addEventListener('click', function (e) {
    e.stopPropagation();
    const drop = document.getElementById('user-dropdown');
    if (drop && drop.style.display !== 'none') _closeUserDropdown();
    else _openUserDropdown();
  });
  footer.appendChild(chip);

  if (!document.getElementById('user-dropdown')) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const drop = document.createElement('div');
    drop.id = 'user-dropdown';
    drop.className = 'user-dropdown';
    drop.setAttribute('role', 'menu');
    drop.style.display = 'none';
    drop.innerHTML =
      '<div class="user-dropdown-header">' +
        '<div class="sidebar-user-name">' + escapeHtml(user.nombre || user.email || '') + '</div>' +
        '<div class="sidebar-user-email">' + escapeHtml(user.email || '') + '</div>' +
        '<div class="sidebar-user-meta"><span class="auth-chip-role">' + escapeHtml(user.nombre_rol || '') + '</span></div>' +
      '</div>' +
      '<div class="user-dropdown-sep"></div>' +
      '<button class="user-dropdown-item theme-toggle" type="button" onclick="toggleTheme()">' +
        '<span class="nav-icon th-icon" style="font-size:13px">' + (isDark ? '🌙' : '☀️') + '</span>' +
        '<span class="th-text">' + (isDark ? 'Oscuro' : 'Claro') + '</span>' +
      '</button>' +
      '<div class="user-dropdown-sep"></div>' +
      '<button class="user-dropdown-item" type="button" onclick="_showChangePasswordModal()">Cambiar contraseña</button>' +
      '<div class="user-dropdown-sep"></div>' +
      '<button class="user-dropdown-item danger" type="button" onclick="logoutUser()">Cerrar sesión</button>';
    drop.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(drop);

    drop.querySelectorAll('.user-dropdown-item').forEach(function (btn) {
      btn.addEventListener('click', _closeUserDropdown);
    });
  }

  document.addEventListener('click', _closeUserDropdown);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') _closeUserDropdown(); });

  _updateThemeToggles();
}

/* ─── PERMISOS — SIDEBAR ─────────────────────────────────────── */

function applyPermissionsToSidebar() {
  if (!SESSION.isLoggedIn()) return;

  MODULOS.forEach(function(mod) {
    const el = document.querySelector('.nav-item[data-page="' + mod + '"]');
    if (!el) return;
    el.style.display = SESSION.canView(mod) ? '' : 'none';
  });

  const cfgEl = document.querySelector('.nav-item[data-page="config"]');
  if (cfgEl) cfgEl.style.display = SESSION.isAdmin() ? '' : 'none';
}

/* ─── ESCRITURA — deshabilitar controles sin permiso de editar ── */

// Deriva el módulo actual desde la página SPA activa (showPage lo llama tras
// cada navegación) — no depende de la URL porque esta app no cambia de URL.
function restrictWriteIfAgent(currentPage) {
  if (CFG.isMock()) { document.body.classList.remove('no-edit-module'); return; }
  const puedeEditar = SESSION.isAdmin() || (currentPage && SESSION.canEdit(currentPage));
  document.body.classList.toggle('no-edit-module', !puedeEditar);
  document.querySelectorAll('.admin-only').forEach(function(el) {
    el.disabled = !puedeEditar;
    el.title = puedeEditar ? '' : 'No tenés permiso de edición en este módulo';
  });
}

/* ─── SHA-256 (hash de contraseña, frontend) ─────────────────── */

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── API HELPER (RBAC) ───────────────────────────────────── */

async function _apiAuthPost(body) {
  const url = CFG.apiUrl;
  if (!url) throw new Error('No hay URL de API configurada');

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ session_token: SESSION.token }, body)),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) {
    if (json.code === 401) {
      logoutUser();
      throw new Error('Sesión expirada. Ingresá de nuevo.');
    }
    throw new Error(json.error || 'Error desconocido');
  }
  return json;
}
