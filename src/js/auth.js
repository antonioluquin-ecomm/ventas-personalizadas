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

  if (SESSION.isAdmin()) {
    renderUserManagementSection();
  }
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

/* ─── ADMIN: USUARIOS / ROLES / PERMISOS ─────────────────────
   Mismo patrón que commerce-hub/apps-script auth.js §"USER MANAGEMENT UI"
   (backend ya implementado en apps-script/Users.gs — createUsuario,
   updateUsuario, getRoles, createRol, updateRol, getPermisos, updatePermisos). */

let _rolesData = [];

function renderUserManagementSection() {
  if (!SESSION.isAdmin()) return;
  const host = document.getElementById('cfg-tabs-host');
  if (!host || document.getElementById('user-mgmt-section')) return;

  const emptyState = document.getElementById('cfg-empty-state');
  if (emptyState) emptyState.hidden = true;

  const section = document.createElement('div');
  section.id = 'user-mgmt-section';
  section.innerHTML = `
    <div class="view-toggle" style="margin-bottom:14px">
      <button class="vtab active" id="ctab-usuarios" onclick="_showCfgTab('usuarios')">Usuarios</button>
      <button class="vtab" id="ctab-roles" onclick="_showCfgTab('roles')">Roles y permisos</button>
    </div>

    <!-- TAB: Usuarios -->
    <div id="ctab-content-usuarios">
      <div class="toolbar" style="margin-bottom:10px">
        <span id="usuarios-count" style="font-size:12px;color:var(--text2)">Cargando…</span>
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-sm" onclick="_openUserForm()">+ Nuevo usuario</button>
      </div>

      <div id="user-form-inline" hidden
           style="background:var(--s2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px">
        <div class="cfg-title" id="user-form-title" style="margin-bottom:12px;border:none;padding:0">Nuevo usuario</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre <span class="form-req">*</span></label>
            <input class="input" id="uf-nombre" placeholder="Nombre completo">
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="form-req">*</span></label>
            <input class="input" id="uf-email" type="email" placeholder="email@empresa.com">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contraseña <span id="uf-pw-req" class="form-req">*</span></label>
            <input class="input" id="uf-password" type="password"
                   placeholder="Mínimo 6 caracteres" autocomplete="new-password">
            <div class="form-hint" id="uf-pw-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Rol <span class="form-req">*</span></label>
            <select class="select" id="uf-rol"></select>
          </div>
        </div>
        <div id="uf-error" style="color:var(--danger);font-size:12px;margin-bottom:10px" hidden></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="_saveUser()">Guardar</button>
          <button class="btn btn-ghost btn-sm" onclick="_closeUserForm()">Cancelar</button>
        </div>
      </div>

      <div id="usuarios-table-wrap">
        <div class="loader-wrap"><div class="spinner"></div> Cargando usuarios…</div>
      </div>
    </div>

    <!-- TAB: Roles y permisos -->
    <div id="ctab-content-roles" hidden>
      <div class="toolbar" style="margin-bottom:10px">
        <span style="font-size:12px;color:var(--text2)">Roles del sistema</span>
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-sm" onclick="_openRolForm()">+ Nuevo rol</button>
      </div>

      <div id="rol-form-inline" hidden
           style="background:var(--s2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px">
        <div class="cfg-title" id="rol-form-title" style="margin-bottom:12px;border:none;padding:0">Nuevo rol</div>
        <div class="form-group">
          <label class="form-label">Nombre del rol <span class="form-req">*</span></label>
          <input class="input" id="rf-nombre" placeholder="Ej: Supervisión, Atención al cliente">
        </div>
        <div id="rf-error" style="color:var(--danger);font-size:12px;margin-bottom:10px" hidden></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="_saveRol()">Guardar</button>
          <button class="btn btn-ghost btn-sm" onclick="_closeRolForm()">Cancelar</button>
        </div>
      </div>

      <div id="roles-table-wrap">
        <div class="loader-wrap"><div class="spinner"></div> Cargando roles…</div>
      </div>

      <div id="permisos-matrix-wrap" style="margin-top:18px"></div>
    </div>
  `;

  host.appendChild(section);
  _loadRoles().then(_loadUsuarios);  // usuarios espera roles para mostrar nombres
}

/* ─── TABS ────────────────────────────────────────────────── */

function _showCfgTab(tab) {
  ['usuarios', 'roles'].forEach(function(t) {
    const content = document.getElementById('ctab-content-' + t);
    const btn     = document.getElementById('ctab-' + t);
    if (content) content.hidden = (t !== tab);
    if (btn)     btn.classList.toggle('active', t === tab);
  });
}

/* ─── ROLES (lista compartida) ────────────────────────────── */

function _rolNombre(id) {
  const r = _rolesData.find(function(x) { return Number(x.id) === Number(id); });
  return r ? r.nombre : ('Rol ' + id);
}

function _populateRolSelect(selectedId) {
  const sel = document.getElementById('uf-rol');
  if (!sel) return;
  const activos = _rolesData.filter(function(r) { return String(r.activo) !== 'NO'; });
  sel.innerHTML = activos.map(function(r) {
    return '<option value="' + r.id + '">' + _escHtml(r.nombre) + '</option>';
  }).join('');
  if (selectedId != null) sel.value = String(selectedId);
}

async function _loadRoles() {
  try {
    const res = await _apiAuthPost({ action: 'getRoles' });
    _rolesData = res.data || [];
  } catch (e) {
    _rolesData = [];
  }
  _renderRolesTable();
  _populateRolSelect();
}

/* ─── FORMULARIO DE USUARIO ───────────────────────────────── */

let _editingUserId = null;

function _openUserForm(usuario) {
  _editingUserId = usuario ? Number(usuario.id) : null;
  const form   = document.getElementById('user-form-inline');
  const title  = document.getElementById('user-form-title');
  const pwHint = document.getElementById('uf-pw-hint');
  const pwReq  = document.getElementById('uf-pw-req');
  const errEl  = document.getElementById('uf-error');

  if (errEl) errEl.hidden = true;

  if (usuario) {
    if (title)  title.textContent = 'Editar usuario';
    document.getElementById('uf-nombre').value   = usuario.nombre   || '';
    document.getElementById('uf-email').value    = usuario.email    || '';
    document.getElementById('uf-password').value = '';
    _populateRolSelect(usuario.id_rol);
    if (pwHint) pwHint.textContent = 'Dejar vacío para no cambiar la contraseña';
    if (pwReq)  pwReq.hidden = true;
  } else {
    if (title)  title.textContent = 'Nuevo usuario';
    document.getElementById('uf-nombre').value   = '';
    document.getElementById('uf-email').value    = '';
    document.getElementById('uf-password').value = '';
    _populateRolSelect();
    if (pwHint) pwHint.textContent = '';
    if (pwReq)  pwReq.hidden = false;
  }

  if (form) form.hidden = false;
  const nameEl = document.getElementById('uf-nombre');
  if (nameEl) nameEl.focus();
}

function _closeUserForm() {
  const form = document.getElementById('user-form-inline');
  if (form) form.hidden = true;
  _editingUserId = null;
}

async function _saveUser() {
  const nombre   = (document.getElementById('uf-nombre')   || {}).value || '';
  const email    = (document.getElementById('uf-email')    || {}).value || '';
  const password = (document.getElementById('uf-password') || {}).value || '';
  const id_rol   = Number((document.getElementById('uf-rol') || {}).value || 2);
  const errEl    = document.getElementById('uf-error');

  if (!nombre.trim() || !email.trim()) {
    if (errEl) { errEl.textContent = 'Nombre y email son requeridos.'; errEl.hidden = false; }
    return;
  }
  if (!_editingUserId && !password.trim()) {
    if (errEl) { errEl.textContent = 'La contraseña es requerida para nuevos usuarios.'; errEl.hidden = false; }
    return;
  }
  if (password.trim() && password.trim().length < 6) {
    if (errEl) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errEl.hidden = false; }
    return;
  }

  try {
    if (_editingUserId) {
      const data = { nombre: nombre.trim(), email: email.toLowerCase().trim(), id_rol };
      if (password) data.password_hash = await sha256(password);
      await _apiAuthPost({ action: 'updateUsuario', id: _editingUserId, data });
    } else {
      await _apiAuthPost({
        action: 'createUsuario',
        data: { nombre: nombre.trim(), email: email.toLowerCase().trim(), password_hash: await sha256(password), id_rol },
      });
    }
    _closeUserForm();
    _loadUsuarios();
    if (typeof toast === 'function') toast('✓', _editingUserId ? 'Usuario actualizado' : 'Usuario creado', 'success');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Error al guardar'; errEl.hidden = false; }
  }
}

/* ─── TABLA DE USUARIOS ───────────────────────────────────── */

async function _loadUsuarios() {
  const wrap = document.getElementById('usuarios-table-wrap');
  if (!wrap) return;

  try {
    const res      = await _apiAuthPost({ action: 'getUsuarios' });
    const usuarios = res.data || [];

    const countEl = document.getElementById('usuarios-count');
    if (countEl) countEl.textContent = usuarios.length + ' usuario' + (usuarios.length !== 1 ? 's' : '');

    if (!usuarios.length) {
      wrap.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No hay usuarios configurados.</div>';
      return;
    }

    wrap.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--s2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text2)">
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Nombre</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Email</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Rol</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border)">Estado</th>
            <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map(function(u) {
            const rolLabel = _rolNombre(u.id_rol);
            const rolStyle = Number(u.id_rol) === 1
              ? 'background:var(--primary-soft);color:var(--primary)'
              : 'background:var(--s3);color:var(--text2)';
            const activo   = u.activo === 'SI';
            const uJson    = JSON.stringify(u).replace(/"/g, '&quot;');
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:7px 10px;color:var(--text)">${_escHtml(u.nombre || '—')}</td>
              <td style="padding:7px 10px;color:var(--text2);font-family:'DM Mono',monospace;font-size:11px">${_escHtml(u.email || '—')}</td>
              <td style="padding:7px 10px">
                <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;${rolStyle}">${rolLabel}</span>
              </td>
              <td style="padding:7px 10px;text-align:center">
                <span class="dot ${activo ? 'dot-on' : 'dot-off'}"></span>
                <span style="font-size:10px;color:var(--text3);margin-left:3px">${activo ? 'Activo' : 'Inactivo'}</span>
              </td>
              <td style="padding:7px 10px;text-align:right;white-space:nowrap">
                <button class="btn btn-secondary btn-sm" style="margin-right:4px"
                        onclick="_openUserForm(${uJson})">Editar</button>
                <button class="btn btn-${activo ? 'danger' : 'ghost'} btn-sm"
                        onclick="_toggleUserActivo(${u.id},'${activo ? 'NO' : 'SI'}')">${activo ? 'Desactivar' : 'Activar'}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    wrap.innerHTML = '<div style="color:var(--danger);font-size:12px;padding:8px 0">Error: ' + (err.message || 'No se pudo cargar') + '</div>';
  }
}

async function _toggleUserActivo(id, nuevoActivo) {
  try {
    await _apiAuthPost({ action: 'updateUsuario', id: id, data: { activo: nuevoActivo } });
    _loadUsuarios();
    if (typeof toast === 'function') toast('✓', 'Usuario actualizado', 'success');
  } catch (err) {
    if (typeof toast === 'function') toast('⚠', err.message || 'Error', 'error');
  }
}

/* ─── TABLA DE ROLES ──────────────────────────────────────── */

function _renderRolesTable() {
  const wrap = document.getElementById('roles-table-wrap');
  if (!wrap) return;

  if (!_rolesData.length) {
    wrap.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No hay roles configurados.</div>';
    return;
  }

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--s2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text2)">
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Rol</th>
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Tipo</th>
          <th style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border)">Estado</th>
          <th style="padding:7px 10px;text-align:right;border-bottom:1px solid var(--border)">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${_rolesData.map(function(r) {
          const sistema = String(r.es_sistema) === 'SI';
          const activo  = String(r.activo) !== 'NO';
          const rJson   = JSON.stringify(r).replace(/"/g, '&quot;');
          const tipoStyle = sistema
            ? 'background:var(--primary-soft);color:var(--primary)'
            : 'background:var(--s3);color:var(--text2)';
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:7px 10px;color:var(--text);font-weight:500">${_escHtml(r.nombre || '—')}</td>
            <td style="padding:7px 10px">
              <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;${tipoStyle}">${sistema ? 'Sistema' : 'Personalizado'}</span>
            </td>
            <td style="padding:7px 10px;text-align:center">
              <span class="dot ${activo ? 'dot-on' : 'dot-off'}"></span>
              <span style="font-size:10px;color:var(--text3);margin-left:3px">${activo ? 'Activo' : 'Inactivo'}</span>
            </td>
            <td style="padding:7px 10px;text-align:right;white-space:nowrap">
              <button class="btn btn-secondary btn-sm" style="margin-right:4px" onclick="_selectRolForPermisos(${r.id})">Permisos</button>
              ${sistema ? '' :
                `<button class="btn btn-secondary btn-sm" style="margin-right:4px" onclick="_openRolForm(${rJson})">Editar</button>
                 <button class="btn btn-${activo ? 'danger' : 'ghost'} btn-sm" onclick="_toggleRolActivo(${r.id},'${activo ? 'NO' : 'SI'}')">${activo ? 'Desactivar' : 'Activar'}</button>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

/* ─── FORMULARIO DE ROL ───────────────────────────────────── */

let _editingRolId = null;

function _openRolForm(rol) {
  _editingRolId = rol ? Number(rol.id) : null;
  const form  = document.getElementById('rol-form-inline');
  const title = document.getElementById('rol-form-title');
  const err   = document.getElementById('rf-error');
  const inp   = document.getElementById('rf-nombre');
  if (err) err.hidden = true;
  if (title) title.textContent = rol ? 'Editar rol' : 'Nuevo rol';
  if (inp) inp.value = rol ? (rol.nombre || '') : '';
  if (form) form.hidden = false;
  if (inp) inp.focus();
}

function _closeRolForm() {
  const form = document.getElementById('rol-form-inline');
  if (form) form.hidden = true;
  _editingRolId = null;
}

async function _saveRol() {
  const nombre = (document.getElementById('rf-nombre') || {}).value || '';
  const err    = document.getElementById('rf-error');
  if (!nombre.trim()) {
    if (err) { err.textContent = 'El nombre del rol es requerido.'; err.hidden = false; }
    return;
  }
  try {
    if (_editingRolId) {
      await _apiAuthPost({ action: 'updateRol', id: _editingRolId, nombre: nombre.trim() });
    } else {
      await _apiAuthPost({ action: 'createRol', nombre: nombre.trim() });
    }
    _closeRolForm();
    _loadRoles();
    if (typeof toast === 'function') toast('✓', _editingRolId ? 'Rol actualizado' : 'Rol creado', 'success');
  } catch (e) {
    if (err) { err.textContent = e.message || 'Error al guardar'; err.hidden = false; }
  }
}

async function _toggleRolActivo(id, nuevoActivo) {
  try {
    await _apiAuthPost({ action: 'updateRol', id: id, activo: nuevoActivo });
    _loadRoles();
    if (typeof toast === 'function') toast('✓', 'Rol actualizado', 'success');
  } catch (e) {
    if (typeof toast === 'function') toast('⚠', e.message || 'Error', 'error');
  }
}

/* ─── MATRIZ DE PERMISOS (3 estados) ──────────────────────── */

let _permisosData = [];

function _selectRolForPermisos(idRol) {
  _renderPermisosMatrix(idRol);
  const wrap = document.getElementById('permisos-matrix-wrap');
  if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function _renderPermisosMatrix(idRol) {
  const wrap = document.getElementById('permisos-matrix-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loader-wrap"><div class="spinner"></div> Cargando permisos…</div>';

  try {
    const res = await _apiAuthPost({ action: 'getPermisos' });
    _permisosData = res.data || [];
  } catch (e) {
    wrap.innerHTML = '<div style="color:var(--danger);font-size:12px;padding:8px 0">Error: ' + (e.message || 'No se pudo cargar') + '</div>';
    return;
  }

  const rol     = _rolesData.find(function(r) { return Number(r.id) === Number(idRol); });
  const sistema = rol && String(rol.es_sistema) === 'SI';

  const idx = {};
  _permisosData.forEach(function(p) { if (Number(p.id_rol) === Number(idRol)) idx[p.modulo] = p; });

  function estadoDe(mod) {
    if (sistema) return 'editar';
    const p = idx[mod] || {};
    if (String(p.puede_ver) !== 'SI') return 'oculto';
    return String(p.puede_editar) === 'SI' ? 'editar' : 'ver';
  }

  function radio(mod, val, est) {
    const dis = sistema ? 'disabled' : '';
    return '<input type="radio" name="perm-' + mod + '" value="' + val + '"' + (est === val ? ' checked' : '') + ' ' + dis + '>';
  }

  wrap.innerHTML = `
    <div class="cfg-section">
      <div class="cfg-title" style="display:flex;align-items:center;gap:8px">
        Permisos — ${_escHtml(rol ? rol.nombre : '')}
      </div>
      ${sistema
        ? '<p style="font-size:12px;color:var(--text2);margin:4px 0 12px">El <strong>Administrador</strong> tiene acceso total a todos los módulos y no es configurable.</p>'
        : '<p style="font-size:12px;color:var(--text2);margin:4px 0 12px">Definí el acceso de este rol a cada módulo.</p>'}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--s2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text2)">
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Módulo</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border)">Oculto</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border)">Solo ver</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border)">Ver + editar</th>
          </tr>
        </thead>
        <tbody>
          ${MODULOS.map(function(mod) {
            const est = estadoDe(mod);
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:7px 10px;color:var(--text);font-weight:500">${MODULO_LABELS[mod] || mod}</td>
              <td style="padding:7px 10px;text-align:center">${radio(mod, 'oculto', est)}</td>
              <td style="padding:7px 10px;text-align:center">${radio(mod, 'ver', est)}</td>
              <td style="padding:7px 10px;text-align:center">${radio(mod, 'editar', est)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${sistema ? '' : `
        <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
          <button class="btn btn-primary btn-sm" onclick="_savePermisosMatrix(${idRol})">Guardar permisos</button>
          <span id="permisos-save-status" style="font-size:12px;color:var(--text2)"></span>
        </div>`}
    </div>
  `;
}

async function _savePermisosMatrix(idRol) {
  const statusEl = document.getElementById('permisos-save-status');
  if (statusEl) statusEl.textContent = 'Guardando…';

  const MAP = {
    oculto: { ver: 'NO', editar: 'NO' },
    ver:    { ver: 'SI', editar: 'NO' },
    editar: { ver: 'SI', editar: 'SI' },
  };

  try {
    const promises = [];
    MODULOS.forEach(function(mod) {
      const sel = document.querySelector('input[name="perm-' + mod + '"]:checked');
      const est = sel ? sel.value : 'oculto';
      const v   = MAP[est] || MAP.oculto;
      promises.push(_apiAuthPost({
        action:       'updatePermisos',
        id_rol:       idRol,
        modulo:       mod,
        puede_ver:    v.ver,
        puede_editar: v.editar,
      }));
    });
    await Promise.all(promises);
    if (statusEl) statusEl.textContent = '✓ Guardado';
    if (typeof toast === 'function') toast('✓', 'Permisos actualizados', 'success');
    setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Error: ' + (err.message || 'No se pudo guardar');
    if (typeof toast === 'function') toast('⚠', 'Error al guardar permisos', 'error');
  }
}
