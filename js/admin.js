/* ==========================================================================
   GESTORPRO DECANATURA - ADMIN / DECANO MODULE (js/admin.js)
   ========================================================================== */

const AdminModule = {
  currentFilter: 'all',
  currentAreaFilter: 'all',
  currentSearch: '',
  currentAlertFilter: 'all',
  currentView: 'cards', // 'cards' | 'table'

  getAvatarHtml(avatarValue, initials = 'DC', size = '40px', className = 'user-avatar', extraStyle = '') {
    const isPhoto = avatarValue && (
      avatarValue.startsWith('data:image/') ||
      avatarValue.startsWith('http://') ||
      avatarValue.startsWith('https://') ||
      avatarValue.startsWith('/') ||
      avatarValue.startsWith('blob:')
    );
    if (isPhoto) {
      return `<div class="${className}" style="width:${size}; height:${size}; min-width:${size}; border-radius:50%; background-image:url('${avatarValue}'); background-size:cover; background-position:center; background-repeat:no-repeat; flex-shrink:0; ${extraStyle}"></div>`;
    }
    return `<div class="${className}" style="width:${size}; height:${size}; min-width:${size}; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0; ${extraStyle}">${avatarValue || initials}</div>`;
  },

  render() {
    const container = document.getElementById('adminView');
    if (!container) return;

    const tasks = window.appStore.getTasks();
    const employees = window.appStore.getEmployees();

    this.renderKPIs(tasks);
    AlertsEngine.renderAlertBanners(tasks, 'adminAlertBanners', false);
    this.renderDocentesSection(employees, tasks);
    this.updateDocentesOptgroup();
    this.renderTasks(tasks, employees);
  },

  renderDocentesSection(employees, tasks) {
    const grid = document.getElementById('adminDocentesGrid');
    const badge = document.getElementById('adminDocentesCountBadge');
    if (!grid) return;

    if (badge) {
      badge.textContent = `${employees.length} Docente${employees.length === 1 ? '' : 's'} Activo${employees.length === 1 ? '' : 's'}`;
    }

    if (!employees || employees.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">👥</div>
          <h4 style="color: var(--text-main); margin-bottom: 0.25rem;">No hay docentes investigadores registrados</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Crea los docentes investigadores de la Decanatura para asignarles tareas y despachar notificaciones institucionales.</p>
          <button type="button" class="btn btn-sm btn-primary" onclick="AdminModule.openCreateEmployeeModal('register')">
            ➕ Registrar Primer Docente
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = employees.map(emp => {
      const matchIds = [emp.id, emp._id, emp.email].filter(Boolean).map(x => String(x).toLowerCase());
      const empTasks = tasks.filter(t => {
        const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        return t.assignedTo === 'all' || assignees.some(a => matchIds.includes(String(typeof a === 'object' ? (a.id || a._id || a.email || '') : a).toLowerCase()));
      });

      const pendingCount = empTasks.filter(t => t.status === 'pendiente' || t.status === 'en_progreso').length;
      const completedCount = empTasks.filter(t => t.status === 'completado').length;
      const issuesCount = empTasks.filter(t => t.issueReport && t.issueReport.status === 'revision_pendiente').length;

      const areaObj = emp.area && window.DECANATURA_AREAS && window.DECANATURA_AREAS[emp.area] ? window.DECANATURA_AREAS[emp.area] : null;
      const areaName = areaObj ? areaObj.name : (emp.department || 'Investigación EFIM');
      const areaIcon = areaObj ? areaObj.icon : '🏛️';
      const areaClass = areaObj ? areaObj.badgeClass : 'badge-area-formativa';

      return `
        <div class="docente-summary-card">
          <div class="docente-card-header">
            <div class="docente-avatar-wrap" onclick="AdminModule.triggerDocentePhotoUpload('${emp.id || emp._id}')" title="Clic para subir o cambiar foto de ${emp.name}">
              ${this.getAvatarHtml(emp.avatar, emp.name ? emp.name.slice(0, 2).toUpperCase() : 'DC', '44px')}
              <span class="avatar-camera-pill" style="position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; background:var(--primary); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.62rem; border:2px solid var(--surface-1); box-shadow:0 1px 3px rgba(0,0,0,0.4);" title="Cambiar foto">📷</span>
              <span class="docente-online-dot" title="Docente activo en Decanatura"></span>
            </div>
            <div class="docente-info">
              <div class="docente-name" title="${emp.name}">${emp.name}</div>
              <div class="docente-email" title="${emp.email}">✉️ ${emp.email}</div>
            </div>
          </div>

          <div class="docente-card-meta">
            <span class="badge ${areaClass}" style="font-size: 0.72rem; padding: 2px 7px;">${areaIcon} ${areaName}</span>
          </div>

          <div class="docente-stats-bar">
            <div class="docente-stat-col" title="Compromisos en desarrollo">
              <span class="stat-num" style="color: var(--accent-cyan);">${pendingCount}</span>
              <span class="stat-lbl">En Curso</span>
            </div>
            <div class="docente-stat-divider"></div>
            <div class="docente-stat-col" title="Compromisos con novedades o dificultades">
              <span class="stat-num" style="color: ${issuesCount > 0 ? '#d946ef' : 'var(--text-muted)'};">${issuesCount}</span>
              <span class="stat-lbl">Novedad</span>
            </div>
            <div class="docente-stat-divider"></div>
            <div class="docente-stat-col" title="Compromisos cumplidos">
              <span class="stat-num" style="color: var(--success);">${completedCount}</span>
              <span class="stat-lbl">Cumplidos</span>
            </div>
          </div>

          <div class="docente-card-actions">
            <button type="button" class="btn btn-sm btn-secondary" onclick="AdminModule.filterByDocente('${emp.id || emp._id}')" title="Filtrar y ver tareas de este docente" style="flex:1; font-size:0.75rem; padding:0.4rem 0.6rem;">
              🔍 Ver Tareas (${empTasks.length})
            </button>
            <button type="button" class="btn btn-sm btn-primary" onclick="AdminModule.openCreateModalForDocente('${emp.id || emp._id}')" title="Asignar compromiso académico a este docente" style="font-size:0.75rem; padding:0.4rem 0.65rem;">
              ➕ Asignar
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  filterByDocente(docenteId) {
    const filterSelect = document.getElementById('adminFilterSelect');
    if (filterSelect) {
      filterSelect.value = `emp:${docenteId}`;
      this.currentFilter = `emp:${docenteId}`;
    }
    const tasksSec = document.querySelector('.tasks-section');
    if (tasksSec) {
      tasksSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.renderTasks(window.appStore.getTasks(), window.appStore.getEmployees());
  },

  openCreateModalForDocente(docenteId) {
    this.openCreateModal();
    setTimeout(() => {
      const checkboxes = document.querySelectorAll('input[name="assigneeDocenteCheckbox"]');
      checkboxes.forEach(cb => {
        cb.checked = (String(cb.value) === String(docenteId));
      });
      this.updateAssigneesSummary();
    }, 50);
  },

  renderKPIs(tasks) {
    const total = tasks.length;
    const inProgress = tasks.filter(t => (t.status === 'en_progreso' || t.status === 'pendiente') && !t.isDraft && t.status !== 'borrador').length;
    const completed = tasks.filter(t => t.status === 'completado').length;
    const drafts = tasks.filter(t => t.isDraft || t.status === 'borrador' || !t.assignedTo || (Array.isArray(t.assignedTo) && t.assignedTo.length === 0)).length;
    
    // Alert counts
    let overdueCount = 0;
    let dueSoonCount = 0;
    let issuesCount = 0;

    tasks.forEach(t => {
      const alert = AlertsEngine.getTaskAlertStatus(t);
      if (alert.level === 'danger') overdueCount++;
      if (alert.level === 'warning') dueSoonCount++;
      if (t.issueReport && t.issueReport.status === 'revision_pendiente') issuesCount++;
    });

    const kpiContainer = document.getElementById('adminKPIs');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
      <div class="kpi-card total" onclick="AdminModule.applyAlertFilter('all')" style="cursor:pointer;" title="Ver todas las tareas de la Decanatura">
        <div class="kpi-icon-wrapper">🏛️</div>
        <div class="kpi-details">
          <span class="kpi-value">${total}</span>
          <span class="kpi-label">Tareas Registradas</span>
        </div>
      </div>

      <div class="kpi-card draft" onclick="AdminModule.applyAlertFilter('borrador')" style="cursor:pointer;" title="Ver borradores guardados listos para asignar">
        <div class="kpi-icon-wrapper">📝</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #38bdf8;">${drafts}</span>
          <span class="kpi-label">Borradores / Por Asignar</span>
        </div>
      </div>

      <div class="kpi-card danger" onclick="AdminModule.applyAlertFilter('danger')" style="cursor:pointer;" title="Filtrar compromisos vencidos">
        <div class="kpi-icon-wrapper">🚨</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #ef4444;">${overdueCount}</span>
          <span class="kpi-label">Plazos Vencidos</span>
        </div>
      </div>

      <div class="kpi-card warning" onclick="AdminModule.applyAlertFilter('warning')" style="cursor:pointer;" title="Filtrar compromisos por vencer hoy">
        <div class="kpi-icon-wrapper">⏳</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #f59e0b;">${dueSoonCount}</span>
          <span class="kpi-label">Por Vencer (<24h)</span>
        </div>
      </div>

      <div class="kpi-card issues" onclick="AdminModule.applyAlertFilter('issue')" style="cursor:pointer;" title="Filtrar dificultades reportadas por docentes">
        <div class="kpi-icon-wrapper">🛑</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #d946ef;">${issuesCount}</span>
          <span class="kpi-label">Dificultades por Resolver</span>
        </div>
      </div>

      <div class="kpi-card pending">
        <div class="kpi-icon-wrapper">⚙️</div>
        <div class="kpi-details">
          <span class="kpi-value">${inProgress}</span>
          <span class="kpi-label">En Desarrollo</span>
        </div>
      </div>

      <div class="kpi-card completed" onclick="AdminModule.applyAlertFilter('completado')" style="cursor:pointer;" title="Ver tareas aprobadas y cumplidas">
        <div class="kpi-icon-wrapper">✅</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #10b981;">${completed}</span>
          <span class="kpi-label">Aprobadas / Cumplidas</span>
        </div>
      </div>
    `;
  },

  applyAlertFilter(alertType) {
    this.currentAlertFilter = alertType;
    const filterSelect = document.getElementById('adminAlertSelect');
    if (filterSelect) filterSelect.value = alertType;
    if (alertType === 'borrador') {
      const mainFilterSelect = document.getElementById('adminFilterSelect');
      if (mainFilterSelect) mainFilterSelect.value = 'borrador';
      this.currentFilter = 'borrador';
    }
    this.renderTasks(window.appStore.getTasks(), window.appStore.getEmployees());
  },

  renderTasks(tasks, employees) {
    const listContainer = document.getElementById('adminTasksContainer');
    if (!listContainer) return;

    // Filter by search, employee, area, status, alert
    let filtered = tasks.filter(t => {
      const alert = AlertsEngine.getTaskAlertStatus(t);

      // Search match
      const searchMatch = !this.currentSearch || 
        t.title.toLowerCase().includes(this.currentSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(this.currentSearch.toLowerCase());

      // Area Filter match
      const areaMatch = (this.currentAreaFilter === 'all') || (t.area === this.currentAreaFilter);

      // Status or assignee filter
      let filterMatch = true;
      if (this.currentFilter.startsWith('emp:')) {
        const empId = this.currentFilter.replace('emp:', '');
        const targetEmp = window.appStore.getUserById(empId);
        const matchIds = [empId, targetEmp?.id, targetEmp?._id, targetEmp?.email].filter(Boolean).map(x => String(x).toLowerCase());
        const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        filterMatch = t.assignedTo === 'all' || assignees.some(a => matchIds.includes(String(typeof a === 'object' ? (a.id || a._id || a.email || '') : a).toLowerCase()));
      } else if (this.currentFilter === 'borrador' || this.currentAlertFilter === 'borrador') {
        filterMatch = Boolean(t.status === 'borrador' || t.isDraft || !t.assignedTo || (Array.isArray(t.assignedTo) && t.assignedTo.length === 0));
      } else if (this.currentFilter !== 'all') {
        filterMatch = t.status === this.currentFilter && !t.isDraft && t.status !== 'borrador';
      }

      // Alert Filter
      let alertMatch = true;
      if (this.currentAlertFilter === 'borrador') {
        alertMatch = Boolean(t.status === 'borrador' || t.isDraft || !t.assignedTo || (Array.isArray(t.assignedTo) && t.assignedTo.length === 0));
      } else if (this.currentAlertFilter === 'danger') {
        alertMatch = alert.level === 'danger';
      } else if (this.currentAlertFilter === 'warning') {
        alertMatch = alert.level === 'warning' || alert.level === 'warning-soft';
      } else if (this.currentAlertFilter === 'issue') {
        alertMatch = t.issueReport && t.issueReport.status === 'revision_pendiente';
      } else if (this.currentAlertFilter === 'completado') {
        alertMatch = t.status === 'completado';
      }

      return searchMatch && areaMatch && filterMatch && alertMatch;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle); width: 100%;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
          <h3 style="margin-bottom: 0.5rem;">No se encontraron tareas en esta área o criterio</h3>
          <p>Prueba seleccionando otra área estratégica o delega una nueva tarea académica.</p>
          <button class="btn btn-primary" onclick="AdminModule.openCreateModal()" style="margin-top: 1.25rem;">+ Delegar Nueva Tarea Académica</button>
        </div>
      `;
      return;
    }

    if (this.currentView === 'cards') {
      listContainer.className = 'tasks-grid fade-in';
      listContainer.innerHTML = filtered.map(t => this.createTaskCardHtml(t, employees)).join('');
    } else {
      listContainer.className = 'tasks-table-container fade-in';
      listContainer.innerHTML = this.createTaskTableHtml(filtered, employees);
    }
  },

  getTaskAssignees(task) {
    if (!task || !task.assignedTo) return [];
    if (task.assignedTo === 'all') {
      return window.appStore.getEmployees();
    }
    const adminEmails = ['juan.perdomo@esfim.edu.co', 'eduardo.puello@esfim.edu.co'];
    const list = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    return list.map(item => {
      if (typeof item === 'object' && item && item.email) return item;
      const raw = typeof item === 'object' && item ? (item.id || item._id || item.email) : item;
      let u = window.appStore.getUserById(raw);
      if (!u && typeof raw === 'string' && raw.includes('@')) {
        u = {
          id: raw,
          name: (typeof item === 'object' && item.name) ? item.name : raw.split('@')[0],
          email: raw,
          role: 'employee'
        };
      }
      return u;
    }).filter(a => {
      if (!a) return false;
      if (a.role === 'admin') return false;
      const email = String(a.email || '').toLowerCase();
      if (adminEmails.some(ae => email.includes(ae))) return false;
      return true;
    });
  },

  createTaskCardHtml(task, employees) {
    const assignees = this.getTaskAssignees(task);
    const alert = AlertsEngine.getTaskAlertStatus(task);
    const areaInfo = (window.DECANATURA_AREAS && window.DECANATURA_AREAS[task.area]) || null;
    const isDraft = Boolean(task.isDraft || task.status === 'borrador' || !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0));
    const isGroup = !isDraft && (task.area === 'decanatura' || task.assignedTo === 'all' || assignees.length > 1);

    if (isGroup) {
      window.appStore.ensureAssigneeProgress(task);
    }
    const adminEmails = ['juan.perdomo@esfim.edu.co', 'eduardo.puello@esfim.edu.co'];
    const memberProgressList = isGroup ? (task.assigneeProgress || []).filter(mp => !adminEmails.some(ae => String(mp.userEmail || '').toLowerCase().includes(ae))) : [];

    const dueDateFormatted = task.dueDate ? new Date(task.dueDate).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Por definir';

    let cardBorderClass = '';
    if (isDraft) {
      cardBorderClass = 'alert-border-draft';
    } else if (task.issueReport && task.issueReport.status === 'revision_pendiente') {
      cardBorderClass = 'alert-border-issue';
    } else if (alert.level === 'danger') {
      cardBorderClass = 'alert-border-danger';
    } else if (alert.level === 'warning') {
      cardBorderClass = 'alert-border-warning';
    }

    const priorityLabel = {
      urgent: 'Urgente',
      urgente: 'Urgente',
      high: 'Alta',
      alta: 'Alta',
      medium: 'Media',
      media: 'Media',
      low: 'Baja',
      baja: 'Baja'
    }[String(task.priority || '').toLowerCase()] || 'Media';

    const assigneesNames = assignees.map(a => `${a.name} (${a.email})`).join(', ');

    return `
      <div class="task-card ${cardBorderClass}">
        <div class="task-card-header">
          <div class="task-badges">
            ${areaInfo ? `
              <span class="badge ${areaInfo.badgeClass}" title="${areaInfo.subtitle}">
                ${areaInfo.icon} ${areaInfo.name}
              </span>
            ` : ''}
            <span class="badge badge-priority-${task.priority}">${priorityLabel}</span>
            ${isDraft ? `
              <span class="badge badge-warning" style="font-weight:700;">📝 Borrador · Por Asignar</span>
            ` : `
              <span class="badge ${alert.badgeClass}">${alert.label}</span>
              ${isGroup ? '<span class="badge badge-info" style="font-size:0.68rem; padding:1px 6px;">👥 Grupal</span>' : ''}
            `}
          </div>
          <button class="btn-icon" onclick="App.openTaskDetailModal('${task.id}')" title="Ver detalles e historial">
            👁️
          </button>
        </div>

        <h3 class="task-title" onclick="App.openTaskDetailModal('${task.id}')" style="cursor: pointer;">
          ${task.title}
        </h3>

        <p class="task-description">${task.description}</p>

        ${task.issueReport && task.issueReport.status === 'revision_pendiente' ? `
          <div class="task-reported-issue-box">
            <div class="issue-box-title">
              <span>🛑</span> <strong>Dificultad Reportada (${task.issueReport.type}):</strong>
            </div>
            <div class="issue-box-desc">${task.issueReport.description}</div>
            <button class="btn btn-sm btn-warning" onclick="AdminModule.openVerifyIssueModal('${task.id}')" style="margin-top: 0.4rem; align-self: flex-start;">
              🔍 Verificar y Resolver con el Docente
            </button>
          </div>
        ` : ''}

        <!-- Progress bar -->
        <div class="progress-container">
          <div class="progress-header">
            <span>${isGroup ? 'Porcentaje de Avance (Promedio Grupal)' : 'Porcentaje de Avance'}</span>
            <span style="font-family:var(--font-mono); font-weight:700;">${task.progress}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${task.progress === 100 ? 'completado' : ''}" style="width: ${task.progress}%;"></div>
          </div>

          ${isGroup && memberProgressList.length > 0 ? `
            <div class="group-progress-micro-pills" style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.4rem;">
              ${memberProgressList.slice(0, 5).map(mp => {
                const shortName = mp.userName ? mp.userName.split(' ')[0] : 'Docente';
                const color = mp.progress === 100 ? '#10b981' : (mp.progress > 0 ? '#2563eb' : '#94a3b8');
                return `
                  <span class="member-pill" style="font-size:0.69rem; padding:1px 5px; border-radius:4px; background:var(--surface-2); border:1px solid ${color}; color:var(--text-main);" title="${mp.userName} (${mp.userEmail}): ${mp.progress}%">
                    ${shortName}: <strong style="color:${color};">${mp.progress}%</strong>
                  </span>
                `;
              }).join('')}
              ${memberProgressList.length > 5 ? `<span style="font-size:0.7rem; color:var(--text-muted); align-self:center;">+${memberProgressList.length - 5} más</span>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Metadata -->
        <div class="task-card-meta">
          <div class="task-assignee" title="${assigneesNames || 'Sin asignar'}">
            ${isDraft ? `
              <span style="color:var(--text-muted); font-size:0.82rem; font-style:italic;">👤 Pendiente de designar responsable</span>
            ` : (assignees.length > 1 ? `
              <div class="assignees-avatar-stack">
                ${assignees.slice(0, 3).map(a => this.getAvatarHtml(a.avatar, a.name ? a.name.slice(0, 2).toUpperCase() : '??', '24px', 'assignee-avatar')).join('')}
              </div>
              <span style="font-weight:600; color:var(--text-main);">
                ${task.area === 'decanatura' || assignees.length >= employees.length ? '🏛️ Plenaria (Todos los Miembros)' : `${assignees[0].name} (+${assignees.length - 1} docentes)`}
              </span>
            ` : `
              ${this.getAvatarHtml(assignees[0]?.avatar, assignees[0]?.name ? assignees[0].name.slice(0, 2).toUpperCase() : '??', '24px', 'assignee-avatar')}
              <span>${assignees[0] ? assignees[0].name : 'Sin asignar'}</span>
            `)}
          </div>

          <div class="task-deadline ${alert.level === 'danger' ? 'urgent' : (alert.level === 'warning' ? 'warning' : '')}" title="Fecha y Hora de Entrega">
            <span>📅 ${dueDateFormatted}</span>
          </div>
        </div>

        <!-- Quick Actions for Boss -->
        <div class="task-actions-bar" style="display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center;">
          ${isDraft ? `
            <button class="btn btn-sm btn-primary" onclick="AdminModule.openAssignDraftModal('${task.id}')" title="Asignar docente(s) responsable(s) y despachar la tarea">
              👤 Asignar Responsable(s)
            </button>
            <button class="btn btn-sm btn-danger" onclick="AdminModule.confirmDeleteTask('${task.id}')" title="Descartar borrador">
              🗑️
            </button>
          ` : (task.status === 'completado' || task.progress === 100 ? `
            <button class="btn btn-sm btn-danger" onclick="AdminModule.confirmDeleteTask('${task.id}')" title="Eliminar tarea cumplida de MongoDB para liberar espacio">
              🗑️ Eliminar
            </button>
            <button class="btn btn-sm btn-secondary" onclick="AdminModule.archiveTask('${task.id}')" title="Archivar tarea cumplida">
              📦 Archivar
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="AdminModule.openReminderModal('${task.id}')" title="Enviar recordatorio formal de Decanatura">
              ⏰ Recordatorio
            </button>
          `)}
          <button class="btn btn-primary btn-sm" onclick="App.openTaskDetailModal('${task.id}')" style="margin-left:auto;">
            Detalles (${(task.comments || []).length})
          </button>
        </div>
      </div>
    `;
  },

  createTaskTableHtml(tasks, employees) {
    return `
      <table class="tasks-table">
        <thead>
          <tr>
            <th>Área Estratégica</th>
            <th>Tarea Académica</th>
            <th>Docente(s) Asignado(s)</th>
            <th>Prioridad</th>
            <th>Fecha Límite</th>
            <th>Alerta / Estado</th>
            <th>Avance</th>
            <th style="text-align: right;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => {
            const assignees = this.getTaskAssignees(t);
            const alert = AlertsEngine.getTaskAlertStatus(t);
            const areaInfo = (window.DECANATURA_AREAS && window.DECANATURA_AREAS[t.area]) || null;
            const isDraft = Boolean(t.isDraft || t.status === 'borrador' || !t.assignedTo || (Array.isArray(t.assignedTo) && t.assignedTo.length === 0));
            const isGroup = !isDraft && (t.area === 'decanatura' || t.assignedTo === 'all' || assignees.length > 1);
            if (isGroup) window.appStore.ensureAssigneeProgress(t);

            const dueDateFormatted = t.dueDate ? new Date(t.dueDate).toLocaleString('es-ES', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : 'Sin definir';

            return `
              <tr>
                <td>
                  ${areaInfo ? `
                    <span class="badge ${areaInfo.badgeClass}" style="white-space:nowrap;">
                      ${areaInfo.icon} ${areaInfo.name}
                    </span>
                  ` : '<span class="badge">General</span>'}
                </td>
                <td>
                  <strong style="cursor:pointer; color: var(--text-main);" onclick="App.openTaskDetailModal('${t.id}')">${t.title}</strong>
                  ${isDraft ? '<span class="badge badge-warning" style="font-size:0.68rem; margin-left:0.3rem;">Borrador</span>' : ''}
                  ${t.issueReport ? '<span style="color:#d946ef; font-size:0.75rem; display:block;">🛑 Dificultad reportada</span>' : ''}
                </td>
                <td>
                  ${isDraft ? `
                    <span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">Por Asignar</span>
                  ` : (assignees.length > 1 ? `
                    <div style="display:flex; align-items:center; gap:0.4rem;" title="${assignees.map(a => a.name + ' (' + a.email + ')').join('\n')}">
                      <div class="assignees-avatar-stack">
                        ${assignees.slice(0, 3).map(a => this.getAvatarHtml(a.avatar, a.name ? a.name.slice(0, 2).toUpperCase() : '??', '22px', 'assignee-avatar')).join('')}
                      </div>
                      <span style="font-weight:600; font-size:0.83rem; color:var(--primary);">
                        ${t.area === 'decanatura' || assignees.length >= employees.length ? '🏛️ Plenaria General (' + assignees.length + ')' : `${assignees[0].name} (+${assignees.length - 1})`}
                      </span>
                    </div>
                  ` : `
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                      ${this.getAvatarHtml(assignees[0]?.avatar, assignees[0]?.name ? assignees[0].name.slice(0, 2).toUpperCase() : '??', '22px', 'assignee-avatar')}
                      <span style="font-size:0.85rem;">${assignees[0] ? assignees[0].name : 'Sin asignar'}</span>
                    </div>
                  `)}
                </td>
                <td><span class="badge badge-priority-${t.priority}">${{urgent:'Urgente',urgente:'Urgente',high:'Alta',alta:'Alta',medium:'Media',media:'Media',low:'Baja',baja:'Baja'}[String(t.priority || '').toLowerCase()] || 'Media'}</span></td>
                <td><span style="font-family: var(--font-mono); font-size:0.8rem;">${dueDateFormatted}</span></td>
                <td>
                  ${isDraft ? '<span class="badge badge-warning">📝 Por Asignar</span>' : `<span class="badge ${alert.badgeClass}">${alert.label}</span>`}
                </td>
                <td style="width: 120px;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div class="progress-bar-bg" style="height:5px;">
                      <div class="progress-bar-fill" style="width:${t.progress}%"></div>
                    </div>
                    <span style="font-size:0.75rem; font-family:var(--font-mono);">${t.progress}%</span>
                  </div>
                  ${isGroup && (t.assigneeProgress || []).length > 0 ? `
                    <span style="font-size:0.68rem; color:var(--primary); font-weight:600; display:block;" title="Avance grupal promediado de ${t.assigneeProgress.length} docentes">
                      👥 ${t.assigneeProgress.filter(a => a.progress === 100).length}/${t.assigneeProgress.length} listos
                    </span>
                  ` : ''}
                </td>
                <td style="text-align: right; white-space:nowrap;">
                  ${isDraft ? `
                    <button class="btn btn-sm btn-primary" onclick="AdminModule.openAssignDraftModal('${t.id}')" title="Asignar Responsable(s)">👤 Asignar</button>
                    <button class="btn btn-sm btn-danger" onclick="AdminModule.confirmDeleteTask('${t.id}')" title="Descartar borrador">🗑️</button>
                  ` : ((t.status === 'completado' || t.progress === 100) ? `
                    <button class="btn btn-sm btn-danger" onclick="AdminModule.confirmDeleteTask('${t.id}')" title="Eliminar tarea cumplida de MongoDB">🗑️</button>
                    <button class="btn btn-sm btn-secondary" onclick="AdminModule.archiveTask('${t.id}')" title="Archivar compromiso">📦</button>
                  ` : `
                    <button class="btn btn-sm btn-secondary" onclick="AdminModule.openReminderModal('${t.id}')" title="Enviar recordatorio oficial">⏰</button>
                  `)}
                  <button class="btn btn-sm btn-primary" onclick="App.openTaskDetailModal('${t.id}')">Ver</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  confirmDeleteTask(taskId) {
    const task = window.appStore.getTaskById(taskId);
    if (!task) return;

    const modal = document.getElementById('confirmDeleteTaskModal');
    if (modal) {
      document.getElementById('confirmDeleteTaskTitle').textContent = task.title;
      document.getElementById('confirmDeleteTaskId').value = task.id;
      modal.classList.add('active');
    } else {
      if (confirm(`¿Confirma eliminar definitivamente la tarea "${task.title}"? Esta acción liberará almacenamiento en MongoDB.`)) {
        this.executeDeleteTask(taskId);
      }
    }
  },

  async executeDeleteTask(taskId) {
    await window.appStore.deleteTask(taskId);
    AlertsEngine.showToast(
      'Tarea Eliminada',
      'El compromiso fue eliminado de MongoDB y se liberó espacio en la base de datos.',
      'success'
    );
    document.getElementById('confirmDeleteTaskModal')?.classList.remove('active');
    document.getElementById('taskDetailModal')?.classList.remove('active');
    this.render();
  },

  async archiveTask(taskId) {
    await window.appStore.archiveTask(taskId);
    AlertsEngine.showToast(
      'Tarea Archivada',
      'El compromiso cumplido fue archivado para mantener limpio el panel activo.',
      'info'
    );
    document.getElementById('taskDetailModal')?.classList.remove('active');
    this.render();
  },

  openPurgeCompletedModal() {
    const modal = document.getElementById('purgeCompletedModal');
    if (!modal) return;
    const tasks = window.appStore.getTasks();
    const completedTasks = tasks.filter(t => t.status === 'completado' || t.progress === 100);
    const countEl = document.getElementById('purgeCompletedCount');
    if (countEl) countEl.textContent = `${completedTasks.length} compromiso(s) cumplido(s)`;
    modal.classList.add('active');
  },

  async executePurgeCompleted() {
    AlertsEngine.showToast('Optimizando Base de Datos', 'Depurando compromisos cumplidos en MongoDB Atlas...', 'info', 3000);
    const res = await window.appStore.purgeCompletedTasks();
    AlertsEngine.showToast(
      'Base de Datos Optimizada',
      res.message || `Se eliminaron las tareas cumplidas, optimizando la cuota gratuita de MongoDB.`,
      'success',
      6000
    );
    document.getElementById('purgeCompletedModal')?.classList.remove('active');
    this.render();
  },

  // Open Create / Delegate Modal
  openCreateModal() {
    const modal = document.getElementById('createTaskModal');
    const areaSelect = document.getElementById('taskAreaSelect');
    const customEmailsInput = document.getElementById('customAssigneeEmailsInput');

    if (customEmailsInput) customEmailsInput.value = '';

    if (areaSelect) {
      areaSelect.value = 'formativa';
    }

    const draftCb = document.getElementById('taskIsDraftCheckbox');
    if (draftCb) {
      draftCb.checked = false;
      this.toggleDraftMode(false);
    }

    // Populate all registered teachers as checkboxes
    this.populateAssigneesChecklist();

    // Set default due date to tomorrow + 4 hours
    const dueInput = document.getElementById('taskDueDateInput');
    if (dueInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);
      dueInput.value = tomorrow.toISOString().slice(0, 16);
    }

    // Reset checklist container
    const checklistContainer = document.getElementById('checklistItemsContainer');
    if (checklistContainer) {
      checklistContainer.innerHTML = `
        <div class="checklist-item-row">
          <input type="text" class="form-control" placeholder="Entregable 1: Ej. Documento de avance técnico..." />
          <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">✕</button>
        </div>
        <div class="checklist-item-row">
          <input type="text" class="form-control" placeholder="Entregable 2: Ej. Ficha metodológica aprobada..." />
          <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">✕</button>
        </div>
      `;
    }

    modal.classList.add('active');
  },

  toggleDraftMode(isDraft) {
    const assigneesGroup = document.getElementById('assigneesFormGroup');
    const submitBtn = document.getElementById('btnSubmitTask');
    const draftBtn = document.getElementById('btnSaveDraftTask');
    if (isDraft) {
      if (submitBtn) submitBtn.textContent = '💾 Guardar Tarea como Borrador';
      if (draftBtn) draftBtn.style.display = 'none';
      if (assigneesGroup) assigneesGroup.style.opacity = '0.75';
    } else {
      if (submitBtn) submitBtn.textContent = '🚀 Delegar y Despachar Notificaciones Simultáneas';
      if (draftBtn) draftBtn.style.display = 'inline-block';
      if (assigneesGroup) assigneesGroup.style.opacity = '1';
    }
  },

  populateAssigneesChecklist() {
    const container = document.getElementById('assigneesCheckboxContainer');
    if (!container) return;
    const employees = window.appStore.getEmployees().filter(u => u.isActive !== false);

    if (employees.length === 0) {
      container.innerHTML = `
        <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem; border:1px dashed var(--border-subtle); border-radius:6px;">
          No hay docentes registrados en la planta aún. Registra docentes en "👥 Gestión de Docentes" o ingresa sus correos institucionales abajo.
        </div>
      `;
      this.updateAssigneesSummary();
      return;
    }

    container.innerHTML = employees.map(emp => {
      const uId = emp.id || emp._id;
      const areaObj = emp.area && window.DECANATURA_AREAS[emp.area] ? window.DECANATURA_AREAS[emp.area] : null;
      const areaBadge = areaObj ? `<span class="badge ${areaObj.badgeClass}" style="font-size:0.65rem; padding:1px 6px;">${areaObj.icon} ${areaObj.name}</span>` : '';
      return `
        <label class="assignee-checkbox-row" style="display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0.5rem; border-radius:6px; background:var(--surface-1); cursor:pointer; font-size:0.83rem; transition:background 0.15s; border:1px solid transparent;">
          <input type="checkbox" name="assigneeDocenteCheckbox" value="${uId}" data-email="${emp.email}" data-name="${emp.name}" onchange="AdminModule.updateAssigneesSummary()" style="cursor:pointer; width:16px; height:16px;" />
          <div style="flex:1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.25rem;">
            <div>
              <strong style="color:var(--text-main);">${emp.name}</strong>
              <span style="color:var(--text-muted); font-size:0.75rem; margin-left:0.3rem;">&lt;${emp.email}&gt;</span>
            </div>
            ${areaBadge}
          </div>
        </label>
      `;
    }).join('');

    this.updateAssigneesSummary();
  },

  selectAllAssignees(selectAll = true) {
    const checkboxes = document.querySelectorAll('input[name="assigneeDocenteCheckbox"]');
    checkboxes.forEach(cb => { cb.checked = selectAll; });
    this.updateAssigneesSummary();
  },

  onTaskAreaSelectChange(areaVal) {
    if (areaVal === 'decanatura') {
      this.selectAllAssignees(true);
      AlertsEngine.showToast('Actividades de Decanatura', 'Se han seleccionado todos los docentes de la Decanatura para este compromiso plenario institucional.', 'info', 4000);
    }
  },

  updateAssigneesSummary() {
    const checkboxes = document.querySelectorAll('input[name="assigneeDocenteCheckbox"]:checked');
    const customEmailsInput = document.getElementById('customAssigneeEmailsInput');
    const countBadge = document.getElementById('assigneesCountBadge');
    const preview = document.getElementById('assigneesListPreview');

    const selectedDocentes = [];
    checkboxes.forEach(cb => {
      selectedDocentes.push({
        id: cb.value,
        name: cb.getAttribute('data-name'),
        email: cb.getAttribute('data-email')
      });
    });

    const customEmails = (customEmailsInput ? customEmailsInput.value : '')
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    const totalCount = selectedDocentes.length + customEmails.length;

    if (countBadge) {
      countBadge.textContent = `${totalCount} destinatario${totalCount === 1 ? '' : 's'}`;
      countBadge.className = totalCount > 0 ? 'badge badge-success' : 'badge badge-warning';
    }

    if (preview) {
      if (totalCount === 0) {
        preview.innerHTML = '<span style="color:var(--text-muted);">⚠️ Ningún docente seleccionado aún. Marque las casillas arriba o ingrese correos.</span>';
      } else {
        const allNamesOrEmails = [
          ...selectedDocentes.map(d => `<strong>${d.name}</strong> (<code>${d.email}</code>)`),
          ...customEmails.map(e => `<code>${e}</code>`)
        ];
        preview.innerHTML = allNamesOrEmails.join(', ');
      }
    }
  },

  addChecklistItemInput() {
    const checklistContainer = document.getElementById('checklistItemsContainer');
    if (!checklistContainer) return;
    const row = document.createElement('div');
    row.className = 'checklist-item-row';
    row.innerHTML = `
      <input type="text" class="form-control" placeholder="Nuevo entregable académico requerido..." />
      <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">✕</button>
    `;
    checklistContainer.appendChild(row);
  },

  async handleSaveDraftClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    const title = document.getElementById('taskTitleInput')?.value.trim();
    const description = document.getElementById('taskDescInput')?.value.trim();
    const area = document.getElementById('taskAreaSelect')?.value || 'formativa';
    const priority = document.getElementById('taskPrioritySelect')?.value || 'alta';
    const dueDate = document.getElementById('taskDueDateInput')?.value;

    if (!title || !description) {
      AlertsEngine.showToast('Datos Incompletos', 'Ingrese al menos el título y la descripción para guardar el borrador.', 'warning');
      return;
    }

    // Collect any checked docentes (optional in draft mode)
    const checkboxes = document.querySelectorAll('input[name="assigneeDocenteCheckbox"]:checked');
    const customEmailsInput = document.getElementById('customAssigneeEmailsInput');
    const assignedIds = [];

    checkboxes.forEach(cb => {
      let u = window.appStore.getUserById(cb.value);
      if (!u && cb.dataset.email) u = window.appStore.getUserById(cb.dataset.email);
      const uId = (u && (u.id || u._id)) || cb.value;
      if (!assignedIds.includes(uId)) assignedIds.push(uId);
    });

    const customEmails = (customEmailsInput ? customEmailsInput.value : '')
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    customEmails.forEach(emailVal => {
      let u = window.appStore.getUsers().find(usr => usr.email && usr.email.toLowerCase() === emailVal.toLowerCase());
      const uId = (u && (u.id || u._id)) || emailVal;
      if (!assignedIds.includes(uId)) assignedIds.push(uId);
    });

    // Extract checklist
    const checklistInputs = document.querySelectorAll('#checklistItemsContainer input[type="text"]');
    const checklist = [];
    checklistInputs.forEach((inp, idx) => {
      const val = inp.value.trim();
      if (val) {
        checklist.push({
          id: 'chk-' + Date.now() + '-' + idx,
          text: val,
          completed: false
        });
      }
    });

    const newTask = await window.appStore.createTask({
      title,
      description,
      area,
      assignedTo: assignedIds.length === 1 ? assignedIds[0] : (assignedIds.length > 1 ? assignedIds : []),
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 86400000 * 2).toISOString(),
      checklist,
      isDraft: true,
      status: 'borrador'
    });

    document.getElementById('createTaskModal').classList.remove('active');
    document.getElementById('createTaskForm').reset();
    this.toggleDraftMode(false);

    AlertsEngine.showToast(
      'Borrador Guardado',
      `El compromiso "${newTask.title}" se guardó en borrador. Queda en el panel de Decanatura listo para asignar cuando determinen a quién compete.`,
      'success',
      6000
    );

    this.render();
  },

  async handleCreateTaskSubmit(e) {
    e.preventDefault();
    const isDraftChecked = Boolean(document.getElementById('taskIsDraftCheckbox')?.checked);
    if (isDraftChecked) {
      return this.handleSaveDraftClick(e);
    }

    const title = document.getElementById('taskTitleInput').value.trim();
    const description = document.getElementById('taskDescInput').value.trim();
    const area = document.getElementById('taskAreaSelect')?.value || 'formativa';
    const priority = document.getElementById('taskPrioritySelect').value;
    const dueDate = document.getElementById('taskDueDateInput').value;

    if (!title || !description || !dueDate) {
      AlertsEngine.showToast('Datos Incompletos', 'Por favor complete el título, descripción y fecha límite.', 'warning');
      return;
    }

    // Collect all checked docentes
    const checkboxes = document.querySelectorAll('input[name="assigneeDocenteCheckbox"]:checked');
    const customEmailsInput = document.getElementById('customAssigneeEmailsInput');

    const targetDocentes = [];
    const assignedIds = [];

    checkboxes.forEach(cb => {
      let u = window.appStore.getUserById(cb.value);
      if (!u && cb.dataset.email) {
        u = window.appStore.getUserById(cb.dataset.email);
      }
      const uId = (u && (u.id || u._id)) || cb.value;
      const uEmail = (u && u.email) || cb.dataset.email;
      const uName = (u && u.name) || cb.dataset.name || 'Docente Investigador';
      
      targetDocentes.push({
        id: uId,
        name: uName,
        email: uEmail
      });
      if (!assignedIds.includes(uId)) {
        assignedIds.push(uId);
      }
    });

    // Custom emails
    const customEmails = (customEmailsInput ? customEmailsInput.value : '')
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    customEmails.forEach(emailVal => {
      let existingUser = window.appStore.getUsers().find(u => u.email && u.email.toLowerCase() === emailVal.toLowerCase());
      if (!existingUser) {
        const cleanName = emailVal.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        existingUser = window.appStore.createEmployee({
          name: `Docente ${cleanName}`,
          email: emailVal,
          area: area,
          department: `Área de ${window.DECANATURA_AREAS[area]?.name || 'Investigación EFIM'}`
        });
        if (window.Auth && Auth.renderDemoSwitcher) {
          Auth.renderDemoSwitcher();
        }
      }
      const uId = existingUser.id || existingUser._id || emailVal;
      if (!assignedIds.includes(uId)) {
        targetDocentes.push({
          id: uId,
          name: existingUser.name,
          email: existingUser.email
        });
        assignedIds.push(uId);
      }
    });

    if (assignedIds.length === 0) {
      AlertsEngine.showToast('Docentes Requeridos', 'Seleccione al menos un docente para despachar inmediatamente, o use "Guardar Borrador" para asignarla después.', 'warning');
      return;
    }

    // Extract checklist
    const checklistInputs = document.querySelectorAll('#checklistItemsContainer input[type="text"]');
    const checklist = [];
    checklistInputs.forEach((inp, idx) => {
      const val = inp.value.trim();
      if (val) {
        checklist.push({
          id: 'chk-' + Date.now() + '-' + idx,
          text: val,
          completed: false
        });
      }
    });

    const newTask = await window.appStore.createTask({
      title,
      description,
      area,
      assignedTo: assignedIds.length === 1 ? assignedIds[0] : assignedIds,
      priority,
      dueDate: new Date(dueDate).toISOString(),
      checklist,
      isDraft: false,
      status: 'pendiente'
    });

    document.getElementById('createTaskModal').classList.remove('active');
    document.getElementById('createTaskForm').reset();
    this.toggleDraftMode(false);

    const recipientSummary = targetDocentes.map(d => d.name).join(', ');
    AlertsEngine.showToast(
      'Compromiso Delegado',
      `Asignado a ${targetDocentes.length} docente(s): ${recipientSummary}. Despachando notificaciones institucionales...`,
      'success',
      6000
    );

    // Dispatch institutional email notification sequentially to ALL target docentes
    if (window.EmailModule && targetDocentes.length > 0) {
      await EmailModule.notifyTaskAssignmentMulti(newTask, targetDocentes);
    }

    this.render();
  },

  // Open Draft Assignment Modal
  openAssignDraftModal(taskId) {
    const task = window.appStore.getTaskById(taskId);
    if (!task) return;

    const modal = document.getElementById('assignDraftModal');
    if (!modal) return;

    document.getElementById('assignDraftTaskId').value = task.id;
    document.getElementById('assignDraftTaskTitle').textContent = task.title;
    document.getElementById('assignDraftTaskDesc').textContent = task.description;

    const prio = document.getElementById('assignDraftPrioritySelect');
    if (prio && task.priority) prio.value = task.priority;

    const dueInput = document.getElementById('assignDraftDueDateInput');
    if (dueInput) {
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        dueInput.value = d.toISOString().slice(0, 16);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(18, 0, 0, 0);
        dueInput.value = tomorrow.toISOString().slice(0, 16);
      }
    }

    const customInput = document.getElementById('assignDraftCustomEmailsInput');
    if (customInput) customInput.value = '';

    this.populateDraftAssigneesChecklist(task);
    modal.classList.add('active');
  },

  populateDraftAssigneesChecklist(task) {
    const container = document.getElementById('assignDraftCheckboxContainer');
    if (!container) return;
    const employees = window.appStore.getEmployees().filter(u => u.isActive !== false);

    if (employees.length === 0) {
      container.innerHTML = `
        <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem; border:1px dashed var(--border-subtle); border-radius:6px;">
          No hay docentes registrados en la planta aún. Registra docentes o ingresa correos abajo.
        </div>
      `;
      this.updateDraftAssigneesSummary();
      return;
    }

    const currentlyAssigned = Array.isArray(task?.assignedTo) ? task.assignedTo : [task?.assignedTo].filter(Boolean);
    const assignedStrs = currentlyAssigned.map(x => String(typeof x === 'object' ? (x?.id || x?._id || x?.email) : x).toLowerCase());

    container.innerHTML = employees.map(emp => {
      const uId = emp.id || emp._id;
      const areaObj = emp.area && window.DECANATURA_AREAS[emp.area] ? window.DECANATURA_AREAS[emp.area] : null;
      const areaBadge = areaObj ? `<span class="badge ${areaObj.badgeClass}" style="font-size:0.65rem; padding:1px 6px;">${areaObj.icon} ${areaObj.name}</span>` : '';
      const isChecked = assignedStrs.includes(String(uId).toLowerCase()) || (emp.email && assignedStrs.includes(String(emp.email).toLowerCase()));

      return `
        <label class="assignee-checkbox-row" style="display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0.5rem; border-radius:6px; background:var(--surface-1); cursor:pointer; font-size:0.83rem; transition:background 0.15s; border:1px solid transparent;">
          <input type="checkbox" name="assignDraftDocenteCheckbox" value="${uId}" data-email="${emp.email}" data-name="${emp.name}" ${isChecked ? 'checked' : ''} onchange="AdminModule.updateDraftAssigneesSummary()" style="cursor:pointer; width:16px; height:16px;" />
          <div style="flex:1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.25rem;">
            <div>
              <strong style="color:var(--text-main);">${emp.name}</strong>
              <span style="color:var(--text-muted); font-size:0.75rem; margin-left:0.3rem;">&lt;${emp.email}&gt;</span>
            </div>
            ${areaBadge}
          </div>
        </label>
      `;
    }).join('');

    this.updateDraftAssigneesSummary();
  },

  selectAllDraftAssignees(selectAll = true) {
    const checkboxes = document.querySelectorAll('input[name="assignDraftDocenteCheckbox"]');
    checkboxes.forEach(cb => { cb.checked = selectAll; });
    this.updateDraftAssigneesSummary();
  },

  updateDraftAssigneesSummary() {
    const checkboxes = document.querySelectorAll('input[name="assignDraftDocenteCheckbox"]:checked');
    const customEmailsInput = document.getElementById('assignDraftCustomEmailsInput');
    const countBadge = document.getElementById('assignDraftCountBadge');
    const preview = document.getElementById('assignDraftListPreview');

    const selectedDocentes = [];
    checkboxes.forEach(cb => {
      selectedDocentes.push({
        id: cb.value,
        name: cb.getAttribute('data-name'),
        email: cb.getAttribute('data-email')
      });
    });

    const customEmails = (customEmailsInput ? customEmailsInput.value : '')
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    const totalCount = selectedDocentes.length + customEmails.length;
    if (countBadge) {
      countBadge.textContent = `${totalCount} seleccionado${totalCount === 1 ? '' : 's'}`;
      countBadge.className = totalCount > 0 ? 'badge badge-info' : 'badge badge-outline';
    }

    if (preview) {
      if (totalCount === 0) {
        preview.textContent = 'Ningún docente seleccionado.';
      } else {
        const allNamesOrEmails = [
          ...selectedDocentes.map(d => `<strong>${d.name}</strong> (<code>${d.email}</code>)`),
          ...customEmails.map(e => `<code>${e}</code>`)
        ];
        preview.innerHTML = allNamesOrEmails.join(', ');
      }
    }
  },

  async handleConfirmDraftAssignment(e) {
    e.preventDefault();
    const taskId = document.getElementById('assignDraftTaskId').value;
    const priority = document.getElementById('assignDraftPrioritySelect')?.value;
    const dueDate = document.getElementById('assignDraftDueDateInput')?.value;

    const checkboxes = document.querySelectorAll('input[name="assignDraftDocenteCheckbox"]:checked');
    const customEmailsInput = document.getElementById('assignDraftCustomEmailsInput');

    const targetDocentes = [];
    checkboxes.forEach(cb => {
      let u = window.appStore.getUserById(cb.value);
      if (!u && cb.dataset.email) u = window.appStore.getUserById(cb.dataset.email);
      targetDocentes.push({
        id: (u && (u.id || u._id)) || cb.value,
        name: (u && u.name) || cb.dataset.name || 'Docente Investigador',
        email: (u && u.email) || cb.dataset.email
      });
    });

    const customEmails = (customEmailsInput ? customEmailsInput.value : '')
      .split(/[\s,;]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    customEmails.forEach(emailVal => {
      let existingUser = window.appStore.getUsers().find(u => u.email && u.email.toLowerCase() === emailVal.toLowerCase());
      if (!existingUser) {
        const cleanName = emailVal.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        existingUser = window.appStore.createEmployee({
          name: `Docente ${cleanName}`,
          email: emailVal,
          department: 'Decanatura de Investigación ESFIM'
        });
      }
      const uId = existingUser.id || existingUser._id || emailVal;
      if (!targetDocentes.some(d => d.id === uId)) {
        targetDocentes.push({ id: uId, name: existingUser.name, email: existingUser.email });
      }
    });

    if (targetDocentes.length === 0) {
      AlertsEngine.showToast('Docentes Requeridos', 'Seleccione al menos un docente para asignar el compromiso.', 'warning');
      return;
    }

    const updatedTask = await window.appStore.assignDraftTask(taskId, targetDocentes, { priority, dueDate });
    document.getElementById('assignDraftModal').classList.remove('active');

    const names = targetDocentes.map(d => d.name).join(', ');
    AlertsEngine.showToast('Compromiso Asignado', `Se asignó a ${targetDocentes.length} docente(s): ${names}. Notificaciones despachadas.`, 'success', 6000);

    if (window.EmailModule && targetDocentes.length > 0) {
      await EmailModule.notifyTaskAssignmentMulti(updatedTask, targetDocentes);
    }

    this.render();
  },

  // Reminder Modal
  openReminderModal(taskId) {
    const task = window.appStore.getTaskById(taskId);
    if (!task) return;
    const assignees = this.getTaskAssignees(task);

    const modal = document.getElementById('reminderModal');
    document.getElementById('reminderTaskId').value = task.id;
    document.getElementById('reminderTargetName').textContent = assignees.length > 0 
      ? assignees.map(a => a.name).join(', ') 
      : 'Docentes Asignados';
    document.getElementById('reminderTaskTitle').textContent = task.title;

    const alert = AlertsEngine.getTaskAlertStatus(task);
    const textarea = document.getElementById('reminderMessageInput');
    
    if (alert.level === 'danger') {
      textarea.value = `RECORDATORIO URGENTE DECANATURA: El plazo de entrega para este compromiso académico ha expirado. Favor remitir a la brevedad el estado de avance de los entregables para su consolidación institucional.`;
    } else if (alert.level === 'warning') {
      textarea.value = `RECORDATORIO PREVENTIVO DECANATURA: Este compromiso vence hoy (${alert.formattedRemaining}). Favor asegurar el cumplimiento y cargue de los entregables a tiempo.`;
    } else {
      textarea.value = `SEGUIMIENTO DECANATURA: Favor mantener actualizado el porcentaje de avance y avances en la plataforma institucional.`;
    }

    modal.classList.add('active');
  },

  async handleSendReminderSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('reminderTaskId').value;
    const message = document.getElementById('reminderMessageInput').value.trim();

    if (!message) return;

    window.appStore.addComment(taskId, message, 'reminder');
    document.getElementById('reminderModal').classList.remove('active');

    const task = window.appStore.getTaskById(taskId);
    const assignees = this.getTaskAssignees(task);

    AlertsEngine.showToast(
      'Enviando Recordatorio',
      `Transmitiendo recordatorio oficial a ${assignees.length} docente(s) asignado(s)...`,
      'info',
      4000
    );

    if (window.EmailModule && assignees.length > 0 && task) {
      for (let i = 0; i < assignees.length; i++) {
        const docente = assignees[i];
        try {
          await EmailModule.notifyTaskReminder(task, docente, message);
          if (i < assignees.length - 1) {
            await new Promise(r => setTimeout(r, 600));
          }
        } catch (err) {
          console.warn('Error enviando recordatorio a', docente.email, err);
        }
      }
    }

    this.render();
  },

  // Verify and Resolve Employee Reported Issue
  openVerifyIssueModal(taskId) {
    const task = window.appStore.getTaskById(taskId);
    if (!task || !task.issueReport) return;

    const modal = document.getElementById('verifyIssueModal');
    document.getElementById('verifyIssueTaskId').value = task.id;
    document.getElementById('verifyIssueTaskTitle').textContent = task.title;
    document.getElementById('verifyIssueType').textContent = task.issueReport.type;
    document.getElementById('verifyIssueDescription').textContent = task.issueReport.description;
    document.getElementById('verifyIssueReportedBy').textContent = task.issueReport.reportedBy || 'Docente Investigador';

    // Pre-fill new date option
    const newDateInput = document.getElementById('verifyIssueNewDateInput');
    if (newDateInput) {
      newDateInput.value = new Date(task.dueDate).toISOString().slice(0, 16);
    }

    document.getElementById('verifyIssueResolutionInput').value = '';
    modal.classList.add('active');
  },

  handleVerifyIssueSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('verifyIssueTaskId').value;
    const resolution = document.getElementById('verifyIssueResolutionInput').value.trim();
    const shouldExtend = document.getElementById('verifyIssueExtendCheckbox').checked;
    const newDueDate = shouldExtend ? document.getElementById('verifyIssueNewDateInput').value : null;

    if (!resolution) {
      AlertsEngine.showToast('Instrucción requerida', 'Por favor proporcione las directrices del Decano para el docente.', 'warning');
      return;
    }

    window.appStore.resolveIssue(
      taskId,
      resolution,
      newDueDate ? new Date(newDueDate).toISOString() : null
    );

    document.getElementById('verifyIssueModal').classList.remove('active');

    const task = window.appStore.getTaskById(taskId);
    const assignedDocente = task ? window.appStore.getUserById(task.assignedTo) : null;
    if (window.EmailModule && assignedDocente && task) {
      EmailModule.notifyIssueResolution(task, assignedDocente, resolution, newDueDate);
    }

    AlertsEngine.showToast(
      'Dificultad Resuelta por Decanatura',
      'La tarea ha sido desbloqueada con las directrices oficiales notificadas al docente.',
      'success'
    );

    this.render();
  },

  // Open Create / Manage Employee Modal
  openCreateEmployeeModal(defaultTab = 'register') {
    const modal = document.getElementById('createEmployeeModal');
    if (modal) {
      document.getElementById('createEmployeeForm')?.reset();
      this.currentEmpPhoto = null;
      const preview = document.getElementById('empAvatarPreview');
      const removeBtn = document.getElementById('btnRemoveEmpPhoto');
      const photoInput = document.getElementById('empPhotoInput');
      if (preview) {
        preview.style.backgroundImage = 'none';
        preview.textContent = 'DOC';
      }
      if (removeBtn) removeBtn.style.display = 'none';
      if (photoInput) photoInput.value = '';
      this.switchDocenteTab(defaultTab);
      modal.classList.add('active');
    }
  },

  async handleEmpPhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await window.App.compressImageFile(file, 250, 0.85);
      this.currentEmpPhoto = dataUrl;
      const preview = document.getElementById('empAvatarPreview');
      const removeBtn = document.getElementById('btnRemoveEmpPhoto');
      if (preview) {
        preview.textContent = '';
        preview.style.backgroundImage = `url("${dataUrl}")`;
      }
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      AlertsEngine.showToast('Foto Cargada', 'Previsualización lista para el registro del docente.', 'info');
    } catch (err) {
      AlertsEngine.showToast('Error', err.message || 'No se pudo cargar la foto.', 'danger');
    }
  },

  removeEmpPhoto() {
    this.currentEmpPhoto = '';
    const preview = document.getElementById('empAvatarPreview');
    const removeBtn = document.getElementById('btnRemoveEmpPhoto');
    const input = document.getElementById('empPhotoInput');
    if (preview) {
      preview.style.backgroundImage = 'none';
      preview.textContent = 'DOC';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (input) input.value = '';
  },

  switchDocenteTab(tabName) {
    document.querySelectorAll('.doc-modal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.doc-modal-tab-pane').forEach(pane => {
      pane.style.display = pane.id === `tabDocentePane-${tabName}` ? 'block' : 'none';
    });
    if (tabName === 'directory') {
      this.renderEmployeesInModal();
    }
  },

  renderEmployeesInModal() {
    const container = document.getElementById('employeeDirectoryList');
    if (!container) return;
    const employees = window.appStore.getEmployees();
    const tasks = window.appStore.getTasks();

    if (employees.length === 0) {
      container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">No hay docentes registrados en la nómina.</div>';
      return;
    }

    container.innerHTML = employees.map(emp => {
      const matchIds = [emp.id, emp._id, emp.email].filter(Boolean).map(x => String(x).toLowerCase());
      const empTasks = tasks.filter(t => {
        const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        return t.assignedTo === 'all' || assignees.some(a => matchIds.includes(String(typeof a === 'object' ? (a.id || a._id || a.email || '') : a).toLowerCase()));
      });
      const areaObj = emp.area && window.DECANATURA_AREAS[emp.area] ? window.DECANATURA_AREAS[emp.area] : null;
      const areaBadge = areaObj ? areaObj.name : (emp.department || 'Investigación');

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:0.85rem 1rem; margin-bottom:0.6rem; gap:0.75rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="docente-avatar-wrap" onclick="AdminModule.triggerDocentePhotoUpload('${emp.id || emp._id}')" title="Clic para subir o cambiar foto de ${emp.name}">
              ${this.getAvatarHtml(emp.avatar, emp.name ? emp.name.slice(0, 2).toUpperCase() : 'DC', '40px')}
              <span class="avatar-camera-pill" style="position:absolute; bottom:-2px; right:-2px; width:16px; height:16px; background:var(--primary); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.58rem; border:1.5px solid var(--surface-2); box-shadow:0 1px 3px rgba(0,0,0,0.35);" title="Cambiar foto">📷</span>
            </div>
            <div>
              <div style="font-weight:700; color:var(--text-main); font-size:0.95rem;">${emp.name}</div>
              <div style="font-size:0.82rem; color:var(--text-muted); font-family:var(--font-mono);">${emp.email}</div>
              <div style="font-size:0.75rem; color:var(--primary); margin-top:0.25rem;">
                📌 Área: <strong>${areaBadge}</strong> • <span style="color:var(--text-muted);">${empTasks.length} compromiso(s) asignado(s)</span>
              </div>
            </div>
          </div>
          <div id="docenteActionBox-${emp.id}" style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="AdminModule.triggerDocentePhotoUpload('${emp.id || emp._id}')" title="Subir o cambiar foto de este docente" style="font-size:0.75rem; padding:0.35rem 0.65rem;">
              📷 Cambiar Foto
            </button>
            <button type="button" class="btn btn-sm btn-danger" onclick="AdminModule.askDeleteEmployee('${emp.id}')" title="Retirar docente de la Decanatura" style="font-size:0.75rem; padding:0.35rem 0.75rem;">
              🗑️ Retirar Docente
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  askDeleteEmployee(id) {
    const box = document.getElementById(`docenteActionBox-${id}`);
    const emp = window.appStore.getUserById(id);
    if (!box || !emp) return;

    box.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.4rem; background:rgba(231,76,60,0.12); padding:0.3rem 0.6rem; border-radius:6px; border:1px solid rgba(231,76,60,0.3);">
        <span style="font-size:0.75rem; color:#e74c3c; font-weight:700;">¿Confirmar retiro?</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="AdminModule.executeDeleteEmployee('${id}')" style="font-size:0.72rem; padding:0.25rem 0.55rem; font-weight:bold;">
          ✓ Sí, Retirar
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminModule.renderEmployeesInModal()" style="font-size:0.72rem; padding:0.25rem 0.55rem;">
          ✕ Cancelar
        </button>
      </div>
    `;
  },

  async executeDeleteEmployee(id) {
    const emp = window.appStore.getUserById(id);
    if (!emp) return;

    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));
    if (token) {
      try {
        await fetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn('Advertencia al eliminar en backend:', err);
      }
    }

    const res = window.appStore.deleteEmployee(id);
    if (res.success) {
      AlertsEngine.showToast(
        'Docente Retirado',
        `El docente ${emp.name} ha sido retirado formalmente de la nómina institucional.`,
        'success'
      );
      this.renderEmployeesInModal();
      this.updateAssigneeSelect();
      this.updateDocentesOptgroup();
      this.render();
    } else {
      AlertsEngine.showToast('No Permitido', res.error, 'danger');
    }
  },

  updateAssigneeSelect() {
    const select = document.getElementById('assigneeSelect');
    if (!select) return;
    const employees = window.appStore.getEmployees();
    select.innerHTML = `
      <option value="" disabled selected>-- Seleccione el Docente Destinatario --</option>
      ${employees.map(emp => {
        const areaBadge = emp.area && window.DECANATURA_AREAS[emp.area] ? `[${window.DECANATURA_AREAS[emp.area].name}]` : '';
        return `<option value="${emp.id}" data-email="${emp.email}">${emp.name} ${areaBadge} — (${emp.email})</option>`;
      }).join('')}
      <option value="custom">➕ Escribir otro correo electrónico nuevo...</option>
    `;
  },

  updateDocentesOptgroup() {
    const optgroup = document.getElementById('adminFilterDocentesOptgroup');
    if (!optgroup) return;
    const employees = window.appStore.getEmployees();
    optgroup.innerHTML = employees.map(emp => {
      const areaBadge = emp.area && window.DECANATURA_AREAS[emp.area] ? `[${window.DECANATURA_AREAS[emp.area].name}]` : '';
      return `<option value="emp:${emp.id}">${emp.name} ${areaBadge}</option>`;
    }).join('');
  },

  async handleCreateEmployeeSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('empNameInput').value.trim();
    const email = document.getElementById('empEmailInput').value.trim();
    const role = document.getElementById('empRoleInput')?.value || 'employee';
    const area = document.getElementById('empAreaInput')?.value || 'formativa';
    const areaName = (window.DECANATURA_AREAS && window.DECANATURA_AREAS[area]?.name) || 'Investigación';
    const lineOfResearch = document.getElementById('empDeptInput').value.trim();
    const department = lineOfResearch ? `${areaName} (${lineOfResearch})` : (role === 'admin' ? 'Decanatura de Investigación - Mando' : areaName);
    const password = document.getElementById('empPassInput').value.trim() || 'Efim2026*Docente';

    if (!name || !email) {
      AlertsEngine.showToast('Datos Incompletos', 'Nombre y correo institucional son obligatorios.', 'warning');
      return;
    }

    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));
    let createdDocente = null;

    if (token) {
      try {
        const payload = {
          name,
          email,
          password,
          role,
          area,
          department
        };
        if (this.currentEmpPhoto) {
          payload.avatar = this.currentEmpPhoto;
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.success) {
          AlertsEngine.showToast('Error de Registro', data.message || 'No se pudo crear el docente.', 'danger');
          return;
        }

        createdDocente = {
          id: data.user.id || data.user._id,
          name: data.user.name,
          email: data.user.email,
          role: 'employee',
          area: data.user.area,
          department: data.user.department,
          avatar: data.user.avatar
        };

        // Sincronizar usuarios desde backend a almacén local
        if (window.App && window.App.syncUsersFromServer) {
          await window.App.syncUsersFromServer();
        } else {
          const users = window.appStore.getUsers();
          users.push(createdDocente);
          window.appStore.saveUsers(users);
        }
      } catch (err) {
        console.warn('Error al guardar en backend:', err);
      }
    }

    if (!createdDocente) {
      // Fallback local
      const users = window.appStore.getUsers();
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        AlertsEngine.showToast('Correo Duplicado', 'Ya existe un docente con este correo electrónico.', 'danger');
        return;
      }
      createdDocente = window.appStore.createEmployee({
        name,
        email,
        area,
        department,
        password,
        avatar: this.currentEmpPhoto || undefined
      });
    }

    this.currentEmpPhoto = null;
    document.getElementById('createEmployeeModal').classList.remove('active');
    this.updateDocentesOptgroup();
    this.updateAssigneeSelect();
    if (this.populateAssigneesChecklist) this.populateAssigneesChecklist();

    AlertsEngine.showToast(
      'Docente Registrado en MongoDB',
      `El docente ${createdDocente.name} fue registrado con éxito. Ya se encuentra activo en el panel institucional.`,
      'success',
      6000
    );

    this.render();
  },

  // 📷 Trigger upload or change of photo for any docente
  triggerDocentePhotoUpload(docenteId) {
    this.pendingUploadDocenteId = docenteId;
    const input = document.getElementById('globalDocentePhotoInput');
    if (input) {
      input.value = '';
      input.click();
    }
  },

  async handleDirectDocentePhotoSelected(event) {
    const file = event.target.files?.[0];
    const docenteId = this.pendingUploadDocenteId;
    if (!file || !docenteId) return;

    try {
      AlertsEngine.showToast('Optimizando Imagen', 'Comprimiendo foto para el perfil...', 'info');
      const base64 = await window.App.compressImageFile(file, 250, 0.85);
      await this.saveDocentePhoto(docenteId, base64);
    } catch (err) {
      console.error('Error al procesar foto del docente:', err);
      AlertsEngine.showToast('Error', err.message || 'No se pudo procesar la foto.', 'danger');
    }
  },

  async saveDocentePhoto(docenteId, photoBase64) {
    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));
    const emp = window.appStore.getUserById(docenteId);
    const empName = emp ? emp.name : 'Docente';

    if (token) {
      try {
        const res = await fetch(`/api/users/${docenteId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ avatar: photoBase64 })
        });
        const data = await res.json();
        if (data.success && data.user) {
          const current = Auth.getCurrentUser();
          if (current && (current.id === docenteId || current._id === docenteId)) {
            current.avatar = photoBase64;
            sessionStorage.setItem('efim_user', JSON.stringify(current));
            localStorage.setItem('efim_user', JSON.stringify(current));
            Auth.updateUserUI();
          }
        }
      } catch (err) {
        console.warn('Error en backend al actualizar avatar:', err);
      }
    }

    if (window.appStore && window.appStore.updateUser) {
      window.appStore.updateUser(docenteId, { avatar: photoBase64 });
    }

    AlertsEngine.showToast(
      'Foto Actualizada',
      `La foto de perfil de ${empName} ha sido actualizada exitosamente.`,
      'success'
    );

    this.render();
    this.renderEmployeesInModal();
  }
};

window.AdminModule = AdminModule;
window.filterByAlert = (type) => AdminModule.applyAlertFilter(type);
