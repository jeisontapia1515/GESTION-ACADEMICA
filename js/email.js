/* ==========================================================================
   GESTORPRO JEFATURA - INSTITUTIONAL EMAIL & NOTIFICATION MODULE (js/email.js)
   Escuela de Formación de Infantería de Marina (ESFIM) - Decanatura de Investigación
   ========================================================================== */

const EmailModule = {
  currentConfig: null,

  async init() {
    await this.loadConfig();
  },

  getHeaders() {
    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('ESFIM_token') || localStorage.getItem('ESFIM_token'));
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  // Load SMTP config from server
  async loadConfig() {
    try {
      const res = await fetch('/api/email-config', {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (data.success && data.config) {
        this.currentConfig = data.config;
        this.updateConfigBadge();
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración SMTP del servidor:', e);
    }
  },

  updateConfigBadge() {
    const badge = document.getElementById('smtpStatusBadge');
    if (!badge) return;
    if (this.currentConfig && this.currentConfig.isConfigured) {
      badge.className = 'badge badge-success';
      badge.innerHTML = '🟢 SMTP Enlazado (' + (this.currentConfig.host || 'Activo') + ')';
      badge.title = 'Los correos saldrán directamente a las bandejas de entrada externas.';
    } else {
      badge.className = 'badge badge-warning';
      badge.innerHTML = '🟡 Modo Virtual ESFIM (Sin SMTP)';
      badge.title = 'Los correos se registran en el sistema institucional. Para entrega en bandejas de entrada reales externas, configure el servidor SMTP.';
    }
  },

  activeAccount: 'decano',

  // Obtiene dinámicamente la URL base de la aplicación (web desplegada o local)
  getAppUrl() {
    // 1. Si existe una URL configurada explícitamente en el servidor/módulo
    if (this.currentConfig && this.currentConfig.appUrl && this.currentConfig.appUrl.trim()) {
      let url = this.currentConfig.appUrl.trim();
      return url.endsWith('/') ? url : url + '/';
    }
    // 2. Origen dinámico del navegador (dominio donde está desplegado el aplicativo en la web)
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const origin = window.location.origin;
      if (origin && origin !== 'null' && !origin.startsWith('file:')) {
        return origin.endsWith('/') ? origin : origin + '/';
      }
    }
    // 3. Fallback por defecto en local
    return 'http://localhost:3000/';
  },

  // Alias for compatibility with topbar button
  openConfigModal(defaultTab = 'config') {
    return this.openEmailModal(defaultTab);
  },

  // Open the Email Configuration & Outbox Modal (Exclusivo Decano y Gestor)
  async openEmailModal(defaultTab = 'config') {
    const user = (window.Auth && window.Auth.getCurrentUser) ? window.Auth.getCurrentUser() : null;
    if (!user || user.role !== 'admin') {
      if (window.AlertsEngine) {
        AlertsEngine.showToast('Acceso Restringido', 'El apartado de configuración de correo está reservado exclusivamente para el Decano y el Gestor.', 'warning');
      }
      return;
    }

    const modal = document.getElementById('emailConfigModal');
    if (!modal) return;

    if (user) {
      const email = (user.email || '').toLowerCase();
      const name = (user.name || '').toLowerCase();
      if (email.includes('decano') || name.includes('decano') || name.includes('perdomo')) {
        this.activeAccount = 'decano';
      } else {
        this.activeAccount = 'gestor';
      }
    }

    await this.loadConfig();
    this.selectAccount(this.activeAccount);
    this.switchTab(defaultTab);
    modal.classList.add('active');
  },

  closeEmailModal() {
    const modal = document.getElementById('emailConfigModal');
    if (modal) modal.classList.remove('active');
  },

  selectAccount(accountKey) {
    this.activeAccount = (accountKey === 'gestor') ? 'gestor' : 'decano';
    
    // Update button styles
    const btnDecano = document.getElementById('btnSelectAccountDecano');
    const btnGestor = document.getElementById('btnSelectAccountGestor');
    if (btnDecano && btnGestor) {
      if (this.activeAccount === 'decano') {
        btnDecano.className = 'btn btn-sm btn-primary';
        btnGestor.className = 'btn btn-sm btn-secondary';
      } else {
        btnDecano.className = 'btn btn-sm btn-secondary';
        btnGestor.className = 'btn btn-sm btn-primary';
      }
    }

    // Sync test select if present
    const testSelect = document.getElementById('testEmailAccountSelect');
    if (testSelect) testSelect.value = this.activeAccount;

    this.populateConfigForm();
  },

  populateConfigForm() {
    if (!this.currentConfig) return;
    const cfg = (this.currentConfig[this.activeAccount]) || this.currentConfig.decano || this.currentConfig;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('smtpHostInput', cfg.host || 'smtp.office365.com');
    setVal('smtpPortInput', cfg.port || 587);
    setVal('smtpUserInput', cfg.user || '');
    setVal('smtpPassInput', cfg.pass || '');
    setVal('smtpFromAddressInput', cfg.fromAddress || cfg.user || '');
    
    const defaultFromName = this.activeAccount === 'decano' 
      ? 'Decano de Investigación - ESFIM' 
      : 'Gestor / Coordinador de Investigación - ESFIM';
    setVal('smtpFromNameInput', cfg.fromName || defaultFromName);
    setVal('smtpAppUrlInput', (this.currentConfig && this.currentConfig.appUrl) || '');
    
    const secureSelect = document.getElementById('smtpSecureSelect');
    if (secureSelect) {
      secureSelect.value = cfg.secure ? 'true' : 'false';
    }

    // Update label to indicate which account is being edited
    const userLabel = document.getElementById('smtpUserLabel');
    if (userLabel) {
      userLabel.textContent = `Usuario / Correo Institucional (${this.activeAccount === 'decano' ? 'Decano' : 'Gestor'}) *`;
    }

    // Pre-fill quick preset helper if detected
    const host = cfg.host || '';
    const presetSelect = document.getElementById('smtpPresetSelect');
    if (presetSelect) {
      if (host.includes('office365') || host.includes('outlook')) presetSelect.value = 'office365';
      else if (host.includes('gmail')) presetSelect.value = 'gmail';
      else presetSelect.value = 'custom';
    }
  },

  handlePresetChange() {
    const preset = document.getElementById('smtpPresetSelect')?.value;
    const hostInput = document.getElementById('smtpHostInput');
    const portInput = document.getElementById('smtpPortInput');
    const secureSelect = document.getElementById('smtpSecureSelect');

    if (preset === 'office365') {
      if (hostInput) hostInput.value = 'smtp.office365.com';
      if (portInput) portInput.value = '587';
      if (secureSelect) secureSelect.value = 'false';
    } else if (preset === 'gmail') {
      if (hostInput) hostInput.value = 'smtp.gmail.com';
      if (portInput) portInput.value = '587';
      if (secureSelect) secureSelect.value = 'false';
    }
  },

  async handleSaveConfig(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSaveSmtpConfig');
    if (btn) btn.disabled = true;

    const accountData = {
      host: document.getElementById('smtpHostInput').value.trim(),
      port: parseInt(document.getElementById('smtpPortInput').value.trim(), 10) || 587,
      secure: document.getElementById('smtpSecureSelect').value === 'true',
      user: document.getElementById('smtpUserInput').value.trim(),
      pass: document.getElementById('smtpPassInput').value,
      fromAddress: document.getElementById('smtpFromAddressInput').value.trim(),
      fromName: document.getElementById('smtpFromNameInput').value.trim()
    };

    const appUrlInput = document.getElementById('smtpAppUrlInput');
    const payload = {
      [this.activeAccount]: accountData
    };
    if (appUrlInput) {
      payload.appUrl = appUrlInput.value.trim();
    }

    try {
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        const roleLabel = this.activeAccount === 'decano' ? 'Decano' : 'Gestor';
        AlertsEngine.showToast('Configuración Guardada', `Credenciales SMTP para cuenta de ${roleLabel} guardadas exitosamente.`, 'success');
        await this.loadConfig();
      } else {
        AlertsEngine.showToast('Error', data.message || 'No se pudo guardar la configuración.', 'danger');
      }
    } catch (err) {
      AlertsEngine.showToast('Error de Conexión', err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async handleSendTestEmail(e) {
    if (e) e.preventDefault();
    const target = document.getElementById('testEmailRecipientInput').value.trim();
    if (!target) {
      AlertsEngine.showToast('Destinatario requerido', 'Ingrese el correo al cual enviar la prueba.', 'warning');
      return;
    }

    const accountToTest = document.getElementById('testEmailAccountSelect')?.value || this.activeAccount || 'decano';
    const roleLabel = accountToTest === 'decano' ? 'Decano' : 'Gestor';

    const btn = document.getElementById('btnSendTestEmail');
    const resultBox = document.getElementById('testEmailResult');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Enviando prueba...';
    }
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.className = 'alert-banner fade-in';
      resultBox.style.background = 'var(--surface-2)';
      resultBox.innerHTML = `<span>🔄 Conectando vía cuenta ${roleLabel} y transmitiendo correo a <strong>${target}</strong>...</span>`;
    }

    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ to: target, account: accountToTest })
      });
      const data = await res.json();

      if (data.success) {
        if (resultBox) {
          resultBox.style.background = 'rgba(46, 204, 113, 0.15)';
          resultBox.style.border = '1px solid #2ecc71';
          resultBox.innerHTML = `
            <div>
              <strong style="color:#2ecc71;">✅ Envío Exitoso:</strong> ${data.message}
              <p style="margin:0.25rem 0 0; font-size:0.8rem; color:var(--text-muted);">Revise la bandeja de entrada de <strong>${target}</strong> (Remitente: ${data.from || roleLabel}).</p>
            </div>
          `;
        }
        AlertsEngine.showToast('Correo de Prueba Despachado', `Entregado satisfactoriamente a ${target}`, 'success');
        if (window.appStore && window.appStore.addNotification) {
          window.appStore.addNotification({
            targetUserId: 'all',
            targetRole: 'admin',
            title: '✉️ Correo de Prueba SMTP Despachado',
            message: `Verificación SMTP transmitida exitosamente a ${target} vía cuenta de ${roleLabel}.`,
            type: 'success'
          });
        }
        this.loadEmailHistory();
      } else {
        if (resultBox) {
          resultBox.style.background = 'rgba(231, 76, 60, 0.15)';
          resultBox.style.border = '1px solid #e74c3c';
          resultBox.innerHTML = `
            <div>
              <strong style="color:#e74c3c;">❌ Error de Envío SMTP (${roleLabel}):</strong> ${data.message || data.error}
              <p style="margin:0.25rem 0 0; font-size:0.8rem; color:var(--text-muted);">Verifique el host, puerto, usuario y contraseña de aplicación en la pestaña de Configuración.</p>
            </div>
          `;
        }
        AlertsEngine.showToast('Fallo en Prueba SMTP', data.message || data.error, 'danger');
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.background = 'rgba(231, 76, 60, 0.15)';
        resultBox.innerHTML = `<strong>❌ Error de Red:</strong> ${err.message}`;
      }
      AlertsEngine.showToast('Error', err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✉️ Enviar Correo de Prueba';
      }
    }
  },

  async loadEmailHistory() {
    const listContainer = document.getElementById('emailHistoryContainer');
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">Cargando registro de correos...</div>';

    try {
      const res = await fetch('/api/emails', {
        headers: this.getHeaders()
      });
      const data = await res.json();
      const emailList = Array.isArray(data) ? data : (data.emails || []);
      if (emailList.length === 0) {
        listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">No hay correos registrados en la bandeja de salida.</div>';
        return;
      }

      listContainer.innerHTML = `
        <div style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85rem; color:var(--text-muted);">Mostrando los últimos <strong>${emailList.length}</strong> correos despachados:</span>
          <button class="btn btn-sm btn-secondary" onclick="EmailModule.clearHistory()">🗑️ Vaciar Historial</button>
        </div>
        <div class="email-history-list" style="max-height:350px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem;">
          ${emailList.map(em => `
            <div style="background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:0.85rem; display:flex; flex-direction:column; gap:0.35rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--text-main); font-size:0.95rem;">${em.subject}</strong>
                <span class="badge ${em.status === 'sent_smtp' ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem;">
                  ${em.status === 'sent_smtp' ? '🟢 Entregado SMTP' : '🟡 Buzón ESFIM'}
                </span>
              </div>
              <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:1rem; flex-wrap:wrap;">
                <span><strong>Para:</strong> ${em.toName || em.to} &lt;${em.to}&gt;</span>
                <span><strong>Fecha:</strong> ${new Date(em.createdAt || em.sentAt).toLocaleString()}</span>
              </div>
              ${em.smtpMessage ? `<div style="font-size:0.75rem; color:${em.status === 'sent_smtp' ? '#2ecc71' : 'var(--text-muted)'}; background:rgba(0,0,0,0.15); padding:0.25rem 0.5rem; border-radius:4px;">${em.smtpMessage}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listContainer.innerHTML = `<div style="padding:1rem; color:var(--danger);">Error cargando historial: ${e.message}</div>`;
    }
  },

  async clearHistory() {
    if (!confirm('¿Desea vaciar el registro histórico de correos despachados?')) return;
    try {
      await fetch('/api/emails', { method: 'DELETE', headers: this.getHeaders() });
      AlertsEngine.showToast('Historial Vaciado', 'El registro de correos fue limpiado.', 'info');
      this.loadEmailHistory();
    } catch (e) {
      AlertsEngine.showToast('Error', e.message, 'danger');
    }
  },

  switchTab(tabName) {
    document.querySelectorAll('.email-modal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.email-modal-tab-pane').forEach(pane => {
      pane.style.display = pane.id === `tabPane-${tabName}` ? 'block' : 'none';
    });
    if (tabName === 'history') {
      this.loadEmailHistory();
    }
  },

  // =========================================================================
  // AUTOMATED NOTIFICATION DISPATCHERS
  // =========================================================================

  // Construye el HTML y texto formal del correo para asignación de tareas
  buildTaskEmailContent(task, docente) {
    const appUrl = this.getAppUrl();
    const areaObj = window.DECANATURA_AREAS && task.area ? window.DECANATURA_AREAS[task.area] : null;
    const areaName = areaObj ? areaObj.name : 'Investigación ESFIM';
    const dueDateFormatted = new Date(task.dueDate).toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const priorityObj = (() => {
      const p = String(task.priority || '').toLowerCase().trim();
      if (p === 'urgent' || p === 'urgente') {
        return { label: 'URGENTE', color: '#b91c1c', bg: '#fee2e2', border: '#f87171', icon: '🚨' };
      }
      if (p === 'high' || p === 'alta') {
        return { label: 'ALTA', color: '#b45309', bg: '#fef3c7', border: '#f59e0b', icon: '🔥' };
      }
      if (p === 'low' || p === 'baja') {
        return { label: 'BAJA', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: '📋' };
      }
      return { label: 'MEDIA', color: '#0369a1', bg: '#e0f2fe', border: '#38bdf8', icon: '⚡' };
    })();

    const checklistHtml = (task.checklist && task.checklist.length > 0)
      ? `
        <div style="margin-top:14px; padding:12px 14px; background:#f8fafc; border-radius:6px; border-left:4px solid #0a192f; border:1px solid #e2e8f0; border-left-width:4px;">
          <strong style="color:#0a192f; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Entregables y Compromisos Obligatorios:</strong>
          <ul style="margin:6px 0 0 0; padding-left:18px; font-size:13px; color:#334155;">
            ${task.checklist.map(item => `<li style="margin-bottom:4px;">${item.text}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f1f5f9; margin:0; padding:16px; color:#1e293b; }
          .card { max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.06); border:1px solid #cbd5e1; }
          .body { padding:22px 26px; font-size:14px; line-height:1.6; background-color:#ffffff; }
          .greeting { font-size:15px; font-weight:600; color:#0f2942; margin-bottom:12px; }
          .task-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:14px 0; }
          .task-title { font-size:15.5px; font-weight:700; color:#0f2942; margin-bottom:6px; }
          .meta-grid { display:table; width:100%; margin-top:10px; font-size:13px; }
          .meta-row { display:table-row; }
          .meta-cell-label { display:table-cell; font-weight:600; color:#64748b; padding:4px 10px 4px 0; width:36%; }
          .meta-cell-val { display:table-cell; color:#0f2942; padding:4px 0; }
          .footer { background:#f8fafc; padding:14px 20px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0; line-height:1.5; }
        </style>
      </head>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#f1f5f9; margin:0; padding:16px; color:#1e293b;">
        <div class="card" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <!-- Encabezado Compacto Oficial con Escudo de Decanatura -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a192f" style="background-color:#0a192f; border-bottom:3px solid #c99736; text-align:center;">
            <tr>
              <td align="center" style="padding:14px 18px 12px; text-align:center; background-color:#0a192f;">
                <img src="cid:esfim_logo" alt="Escudo Decanatura de Investigación ESFIM" width="56" height="56" border="0" style="display:block; margin:0 auto 6px; width:56px; height:56px; max-width:56px; border:0; outline:none;" />
                <div style="color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; letter-spacing:0.8px; margin:0; line-height:1.2; text-transform:uppercase;">
                  ARMADA NACIONAL DE COLOMBIA
                </div>
                <div style="color:#c99736; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin:3px 0 0 0;">
                  Escuela de Formación de Infantería de Marina • Decanatura de Investigación
                </div>
              </td>
            </tr>
          </table>

          <div class="body" style="padding:22px 26px; font-size:14px; line-height:1.6; background-color:#ffffff;">
            <div class="greeting" style="font-size:15px; font-weight:600; color:#0f2942; margin-bottom:12px;">Estimado(a) ${docente.name},</div>
            <p style="margin:0 0 14px; font-size:13.5px; color:#334155; line-height:1.6;">
              Por disposición de la Jefatura de la <strong>Decanatura de Investigación - ESFIM</strong>, se le ha asignado y delegado formalmente el siguiente compromiso académico e investigativo:
            </p>
            
            <div class="task-box" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:14px 0;">
              <div class="task-title" style="font-size:15.5px; font-weight:700; color:#0f2942; margin-bottom:6px;">${task.title}</div>
              <p style="margin:0 0 10px; color:#475569; font-size:13px; line-height:1.5;">${task.description}</p>
              
              <div class="meta-grid" style="display:table; width:100%; margin-top:10px; font-size:13px;">
                <div class="meta-row" style="display:table-row;">
                  <div class="meta-cell-label" style="display:table-cell; font-weight:600; color:#64748b; padding:4px 10px 4px 0; width:36%;">Área Estratégica:</div>
                  <div class="meta-cell-val" style="display:table-cell; color:#0f2942; padding:4px 0;"><strong>${areaName}</strong></div>
                </div>
                <div class="meta-row" style="display:table-row;">
                  <div class="meta-cell-label" style="display:table-cell; font-weight:600; color:#64748b; padding:4px 10px 4px 0;">Prioridad Institucional:</div>
                  <div class="meta-cell-val" style="display:table-cell; padding:4px 0;">
                    <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:11.5px; font-weight:700; text-transform:uppercase; background-color:${priorityObj.bg}; color:${priorityObj.color}; border:1px solid ${priorityObj.border};">
                      ${priorityObj.icon} ${priorityObj.label}
                    </span>
                  </div>
                </div>
                <div class="meta-row" style="display:table-row;">
                  <div class="meta-cell-label" style="display:table-cell; font-weight:600; color:#64748b; padding:4px 10px 4px 0;">Fecha y Hora Límite:</div>
                  <div class="meta-cell-val" style="display:table-cell; color:#b91c1c; font-weight:700; padding:4px 0;">📅 ${dueDateFormatted}</div>
                </div>
              </div>

              ${checklistHtml}
            </div>

            <p style="font-size:13px; color:#475569; margin:14px 0 18px;">
              Le solicitamos ingresar oportunamente a la plataforma institucional para actualizar su porcentaje de avance, reportar avances periódicos o declarar novedades y dificultades oportunamente.
            </p>

            <div style="text-align:center; margin:20px 0 8px;">
              <a href="${appUrl}" style="display:inline-block; background-color:#0a192f; color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight:700; padding:11px 24px; border-radius:6px; text-decoration:none; font-size:13px; letter-spacing:0.5px; border-bottom:3px solid #c99736;">
                🏛️ Acceder al Sistema de Gestión ESFIM
              </a>
            </div>
          </div>
          <div class="footer" style="background-color:#f8fafc; padding:14px 20px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0; line-height:1.5;">
            Decanatura de Investigación — Escuela de Formación de Infantería de Marina (ESFIM)<br/>
            Coveñas, Sucre — República de Colombia • "Ciencia, Honor y Doctrina"
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
ARMADA NACIONAL DE COLOMBIA - ESCUELA DE FORMACIÓN DE INFANTERÍA DE MARINA (ESFIM)
Decanatura de Investigación - Notificación Oficial de Tarea Delegada

Estimado(a) ${docente.name},

Por directriz de la Jefatura se le ha asignado la siguiente tarea:
- TÍTULO: ${task.title}
- ÁREA: ${areaName}
- PRIORIDAD: ${priorityObj.label}
- FECHA LÍMITE: ${dueDateFormatted}
- DESCRIPCIÓN: ${task.description}

Favor acceder a la plataforma institucional en ${appUrl} para reportar su avance.
    `.trim();

    return { areaName, dueDateFormatted, html, text };
  },

  // Despacha notificaciones a múltiples docentes mediante /api/send-email-batch
  async notifyTaskAssignmentMulti(task, docentes) {
    if (!Array.isArray(docentes)) docentes = [docentes].filter(Boolean);
    if (docentes.length === 0) return [];

    const validDocentes = docentes.filter(d => d && d.email && d.email.includes('@'));
    if (validDocentes.length === 0) return [];

    const namesOrEmails = validDocentes.map(d => d.name || d.email).join(', ');
    const recipients = validDocentes.map(doc => {
      const content = this.buildTaskEmailContent(task, doc);
      return {
        to: doc.email.trim(),
        toName: doc.name || doc.email,
        subject: `⚓ [ESFIM ${content.areaName}] ${task.title}`,
        html: content.html,
        text: content.text
      };
    });

    try {
      const res = await fetch('/api/send-email-batch', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          recipients,
          type: 'task_assignment',
          metadata: { taskId: task.id, area: task.area, priority: task.priority }
        })
      });
      const data = await res.json();

      if (data.success) {
        const sentCount = data.sentCount || 0;
        if (sentCount > 0) {
          AlertsEngine.showToast(
            'Despacho de Correos Completado',
            `📧 Se transmitieron exitosamente ${sentCount} de ${recipients.length} notificaciones vía SMTP a los docentes asignados (${namesOrEmails}).`,
            'success',
            8000
          );
        } else {
          AlertsEngine.showToast(
            'Notificaciones Registradas',
            `Registradas para ${recipients.length} docentes en el buzón institucional ESFIM.`,
            'info',
            6000
          );
        }
        return data.results || [];
      }
    } catch (e) {
      console.warn('Error en despacho por lote, reintentando secuencialmente:', e);
    }

    // Fallback secuencial si falla el lote
    const results = [];
    for (let i = 0; i < validDocentes.length; i++) {
      const doc = validDocentes[i];
      const r = await this.notifyTaskAssignment(task, doc, false);
      results.push(r);
      if (i < validDocentes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    return results;
  },

  // Dispatches email when Decano assigns a new academic task
  async notifyTaskAssignment(task, docente, showToast = true) {
    if (!docente || !docente.email) return null;

    const { areaName, html, text } = this.buildTaskEmailContent(task, docente);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          to: docente.email.trim(),
          toName: docente.name || docente.email,
          subject: `⚓ [ESFIM ${areaName}] ${task.title}`,
          html,
          text,
          type: 'task_assignment',
          metadata: { taskId: task.id, area: task.area, priority: task.priority }
        })
      });

      const data = await res.json();
      if (showToast && data.success) {
        if (data.status === 'sent_smtp') {
          AlertsEngine.showToast(
            'Notificación Despachada',
            `📧 Correo entregado exitosamente a la bandeja de entrada de ${docente.email}`,
            'success',
            6000
          );
        } else {
          // Encoded snippet for 1-click Outlook open
          const safeSubject = encodeURIComponent(`⚓ [ESFIM ${areaName}] ${task.title}`);
          const safeBody = encodeURIComponent(text);
          AlertsEngine.showToast(
            'Tarea Asignada a Docente',
            `<div>
              <div>Registrada para <strong>${docente.name}</strong> (<code>${docente.email}</code>).</div>
              <div style="margin-top:0.4rem; display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-primary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="EmailModule.openOutlookWeb('${docente.email}', decodeURIComponent('${safeSubject}'), decodeURIComponent('${safeBody}'))">
                  🚀 Abrir en Outlook Web
                </button>
                <button type="button" class="btn btn-sm btn-secondary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="EmailModule.openMailto('${docente.email}', decodeURIComponent('${safeSubject}'), decodeURIComponent('${safeBody}'))">
                  💻 Abrir en App de Correo
                </button>
              </div>
            </div>`,
            'info',
            12000
          );
        }
      }
      return data;
    } catch (e) {
      console.warn('Error al despachar correo:', e);
      return { success: false, error: e.message };
    }
  },

  // Dispatches reminder email
  async notifyTaskReminder(task, docente, reminderText) {
    if (!docente || !docente.email) return;
    const appUrl = this.getAppUrl();

    const htmlBody = `
      <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:16px; background-color:#f1f5f9; color:#1e293b;">
        <div style="max-width:580px; margin:0 auto; background-color:#ffffff; border-radius:8px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a192f" style="background-color:#0a192f; border-bottom:3px solid #c99736; text-align:center;">
            <tr>
              <td align="center" style="padding:14px 18px; text-align:center; background-color:#0a192f;">
                <img src="cid:esfim_logo" alt="Escudo Decanatura ESFIM" width="50" height="50" border="0" style="display:block; margin:0 auto 6px; width:50px; height:50px; max-width:50px;" />
                <div style="color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:14px; font-weight:700; letter-spacing:0.8px; margin:0; line-height:1.2; text-transform:uppercase;">
                  RECORDATORIO OFICIAL - DECANATURA DE INVESTIGACIÓN ESFIM
                </div>
              </td>
            </tr>
          </table>
          <div style="padding:22px 24px;">
            <p style="margin-top:0;">Estimado(a) <strong>${docente.name}</strong>,</p>
            <p style="color:#334155;">La Jefatura de la Decanatura le transmite el siguiente requerimiento urgente de seguimiento sobre la tarea:</p>
            <blockquote style="background-color:#f8fafc; border-left:4px solid #c99736; padding:12px 14px; margin:14px 0; font-style:italic; border:1px solid #e2e8f0; border-left-width:4px; border-radius:4px; color:#1e293b;">
              "${reminderText}"
            </blockquote>
            <p style="margin-bottom:0;"><strong>Tarea:</strong> ${task.title}<br/>
            <strong>Fecha Límite:</strong> <span style="color:#b91c1c; font-weight:bold;">${new Date(task.dueDate).toLocaleString('es-CO')}</span></p>
            <div style="text-align:center; margin-top:20px;">
              <a href="${appUrl}" style="display:inline-block; background-color:#0a192f; color:#ffffff; padding:10px 22px; text-decoration:none; border-radius:6px; font-size:13px; font-weight:bold; border-bottom:3px solid #c99736;">🏛️ Acceder a ESFIM</a>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          to: docente.email,
          toName: docente.name,
          subject: `⏰ [RECORDATORIO ESFIM] ${task.title}`,
          html: htmlBody,
          text: `RECORDATORIO DECANATURA ESFIM: ${reminderText} | Tarea: ${task.title} | Acceso a la plataforma: ${appUrl}`,
          type: 'reminder',
          metadata: { taskId: task.id }
        })
      });
      const data = await res.json();
      if (data.status === 'sent_smtp') {
        AlertsEngine.showToast('Recordatorio Entregado', `Correo remitido a ${docente.email} vía SMTP.`, 'success');
      } else {
        const reminderSubject = encodeURIComponent(`⏰ [RECORDATORIO ESFIM] ${task.title}`);
        const reminderBody = encodeURIComponent(`Estimado(a) ${docente.name},\n\nLa Jefatura de Decanatura de Investigación ESFIM le recuerda:\n\n"${reminderText}"\n\nCompromiso: ${task.title}\nPlazo: ${new Date(task.dueDate).toLocaleString('es-CO')}\n\nAcceso a la plataforma: ${appUrl}`);
        AlertsEngine.showToast(
          'Recordatorio Registrado',
          `<div>
            <div>Registrado en el buzón institucional para <strong>${docente.name}</strong>.</div>
            <div style="margin-top:0.4rem;">
              <button type="button" class="btn btn-sm btn-primary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="EmailModule.openOutlookWeb('${docente.email}', decodeURIComponent('${reminderSubject}'), decodeURIComponent('${reminderBody}'))">
                🚀 Abrir en Outlook Web
              </button>
            </div>
          </div>`,
          'reminder',
          12000
        );
      }
      return data;
    } catch (e) {
      console.warn('Error enviando recordatorio:', e);
      return { success: false, error: e.message };
    }
  },

  // Dispatches issue resolution email
  async notifyIssueResolution(task, docente, resolution, newDueDate) {
    if (!docente || !docente.email) return;
    const appUrl = this.getAppUrl();

    const htmlBody = `
      <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:16px; background-color:#f1f5f9; color:#1e293b;">
        <div style="max-width:580px; margin:0 auto; background-color:#ffffff; border-radius:8px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a192f" style="background-color:#0a192f; border-bottom:3px solid #059669; text-align:center;">
            <tr>
              <td align="center" style="padding:14px 18px; text-align:center; background-color:#0a192f;">
                <img src="cid:esfim_logo" alt="Escudo Decanatura ESFIM" width="50" height="50" border="0" style="display:block; margin:0 auto 6px; width:50px; height:50px; max-width:50px;" />
                <div style="color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:14px; font-weight:700; letter-spacing:0.8px; margin:0; line-height:1.2; text-transform:uppercase;">
                  DIRECTRIZ DE JEFATURA - DIFICULTAD RESUELTA
                </div>
              </td>
            </tr>
          </table>
          <div style="padding:22px 24px;">
            <p style="margin-top:0;">Estimado(a) <strong>${docente.name}</strong>,</p>
            <p style="color:#334155;">El Decano de Investigación ha revisado la dificultad reportada para el compromiso <strong>"${task.title}"</strong> y emitió las siguientes directrices:</p>
            <div style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:14px; margin:14px 0; color:#065f46; font-size:13.5px; line-height:1.5;">
              <strong style="display:block; margin-bottom:4px;">Directriz de Jefatura:</strong>
              ${resolution}
            </div>
            ${newDueDate ? `<p><strong>Nueva Fecha de Entrega Concedida:</strong> <span style="color:#059669; font-weight:bold;">📅 ${new Date(newDueDate).toLocaleString('es-CO')}</span></p>` : ''}
            <div style="text-align:center; margin-top:20px;">
              <a href="${appUrl}" style="display:inline-block; background-color:#0a192f; color:#ffffff; padding:10px 22px; text-decoration:none; border-radius:6px; font-size:13px; font-weight:bold; border-bottom:3px solid #059669;">🏛️ Continuar Tarea en Plataforma</a>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          to: docente.email,
          toName: docente.name,
          subject: `✅ [ESFIM Resolución] Directriz para: ${task.title}`,
          html: htmlBody,
          text: `DIRECTRIZ DECANO ESFIM: ${resolution}\n\nAcceso a la plataforma: ${appUrl}`,
          type: 'issue_resolution',
          metadata: { taskId: task.id }
        })
      });
    } catch (e) {
      console.warn('Error notificando resolucion:', e);
    }
  },

  // 1-Click Outlook Web Composer (No SMTP credentials required)
  openOutlookWeb(to, subject, bodyText) {
    const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(url, '_blank');
  },

  // 1-Click Desktop Mail Client (Outlook Desktop / Windows Mail)
  openMailto(to, subject, bodyText) {
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  }
};

window.EmailModule = EmailModule;
