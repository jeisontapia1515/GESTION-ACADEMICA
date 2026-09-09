/* ==========================================================================
   GESTORPRO JEFATURA - EMPLOYEE MODULE (js/employee.js)
   ========================================================================== */

const EmployeeModule = {
  currentFilter: 'all', // 'all' | 'pendiente' | 'en_progreso' | 'bloqueado' | 'completado'
  currentSearch: '',

  isTaskAssignedToUser(task, user) {
    if (!task || !user) return false;
    if (task.assignedTo === 'all') return true;
    const userIdentifiers = [user.id, user._id, user.email]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());

    const assignedList = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    return assignedList.some(assignee => {
      if (!assignee) return false;
      if (typeof assignee === 'object') {
        const itemIds = [assignee.id, assignee._id, assignee.email]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        return itemIds.some(id => userIdentifiers.includes(id));
      }
      return userIdentifiers.includes(String(assignee).toLowerCase());
    });
  },

  render() {
    const container = document.getElementById('employeeView');
    if (!container) return;

    const currentUser = window.appStore.getCurrentUser();
    if (!currentUser) return;

    // Filter tasks assigned to this employee (supports single ID, array of IDs, or email)
    const allTasks = window.appStore.getTasks();
    const myTasks = allTasks.filter(t => this.isTaskAssignedToUser(t, currentUser));

    this.renderKPIs(myTasks);
    AlertsEngine.renderAlertBanners(myTasks, 'employeeAlertBanners', true);
    this.renderTaskList(myTasks);
  },

  renderKPIs(myTasks) {
    const total = myTasks.length;
    const pending = myTasks.filter(t => t.status === 'en_progreso' || t.status === 'pendiente').length;
    const blocked = myTasks.filter(t => t.status === 'bloqueado' || (t.issueReport && t.issueReport.status === 'revision_pendiente')).length;
    const completed = myTasks.filter(t => t.status === 'completado').length;

    let overdueCount = 0;
    let dueSoonCount = 0;

    myTasks.forEach(t => {
      const alert = AlertsEngine.getTaskAlertStatus(t);
      if (alert.level === 'danger') overdueCount++;
      if (alert.level === 'warning') dueSoonCount++;
    });

    const container = document.getElementById('employeeKPIs');
    if (!container) return;

    container.innerHTML = `
      <div class="kpi-card total">
        <div class="kpi-icon-wrapper">🎯</div>
        <div class="kpi-details">
          <span class="kpi-value">${total}</span>
          <span class="kpi-label">Mis Asignaciones</span>
        </div>
      </div>

      <div class="kpi-card danger">
        <div class="kpi-icon-wrapper">🚨</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #ef4444;">${overdueCount}</span>
          <span class="kpi-label">Vencidas</span>
        </div>
      </div>

      <div class="kpi-card warning">
        <div class="kpi-icon-wrapper">⏳</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #f59e0b;">${dueSoonCount}</span>
          <span class="kpi-label">Por Vencer Hoy</span>
        </div>
      </div>

      <div class="kpi-card issues">
        <div class="kpi-icon-wrapper">🛑</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #d946ef;">${blocked}</span>
          <span class="kpi-label">Con Dificultad Reportada</span>
        </div>
      </div>

      <div class="kpi-card completed">
        <div class="kpi-icon-wrapper">✅</div>
        <div class="kpi-details">
          <span class="kpi-value" style="color: #10b981;">${completed}</span>
          <span class="kpi-label">Entregadas / Cumplidas</span>
        </div>
      </div>
    `;
  },

  renderTaskList(tasks) {
    const listContainer = document.getElementById('employeeTasksContainer');
    if (!listContainer) return;

    let filtered = tasks.filter(t => {
      const searchMatch = !this.currentSearch ||
        t.title.toLowerCase().includes(this.currentSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(this.currentSearch.toLowerCase());

      let filterMatch = true;
      if (this.currentFilter !== 'all') {
        filterMatch = t.status === this.currentFilter;
      }

      return searchMatch && filterMatch;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle); width: 100%;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
          <h3 style="margin-bottom: 0.5rem;">No tienes tareas pendientes con este filtro</h3>
          <p>¡Buen trabajo! Todas tus asignaciones en esta categoría están al día.</p>
        </div>
      `;
      return;
    }

    listContainer.className = 'tasks-grid fade-in';
    listContainer.innerHTML = filtered.map(t => this.createEmployeeTaskCardHtml(t)).join('');
  },

  createEmployeeTaskCardHtml(task) {
    const alert = AlertsEngine.getTaskAlertStatus(task);
    const areaInfo = (window.DECANATURA_AREAS && window.DECANATURA_AREAS[task.area]) || null;
    const dueDateFormatted = new Date(task.dueDate).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let cardBorderClass = '';
    if (task.issueReport && task.issueReport.status === 'revision_pendiente') {
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

    const hasReminders = (task.comments || []).some(c => c.type === 'reminder');

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
            <span class="badge ${alert.badgeClass}">${alert.label}</span>
            ${hasReminders ? '<span class="badge badge-alert due-soon" title="Tiene directrices o recordatorios del Decano">⏰ Recordatorio del Decano</span>' : ''}
          </div>
          <button class="btn-icon" onclick="App.openTaskDetailModal('${task.id}')" title="Ver entregables y comentarios">
            👁️
          </button>
        </div>

        <h3 class="task-title" onclick="App.openTaskDetailModal('${task.id}')" style="cursor: pointer;">
          ${task.title}
        </h3>

        <p class="task-description">${task.description}</p>

        <!-- If Issue is pending verification -->
        ${task.issueReport && task.issueReport.status === 'revision_pendiente' ? `
          <div class="task-reported-issue-box">
            <div class="issue-box-title">
              <span>🛑</span> <strong>Reporte en espera de revisión por el Decano:</strong>
            </div>
            <div class="issue-box-desc">${task.issueReport.description}</div>
            <span class="issue-box-subtext">La Decanatura ha sido notificada para verificación y resolución.</span>
          </div>
        ` : ''}

        <!-- Progress bar and Interactive Controller -->
        <div class="card-quick-progress">
          <div class="progress-header">
            <span>Porcentaje de Avance</span>
            <span id="percentLabel-${task.id}" style="font-family:var(--font-mono); font-weight:800; color:var(--primary); font-size:1.05rem;">${task.progress}%</span>
          </div>

          <div class="progress-bar-bg">
            <div id="barFill-${task.id}" class="progress-bar-fill ${task.progress === 100 ? 'completado' : ''}" style="width: ${task.progress}%;"></div>
          </div>

          <!-- Interactive Slider & Quick Pills -->
          <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
            <input type="range" class="progress-range-slider" min="0" max="100" step="5" value="${task.progress}" 
              id="slider-${task.id}"
              oninput="EmployeeModule.handleSliderInput('${task.id}', this.value)"
            />
          </div>

          <div class="quick-percent-pills">
            <button type="button" class="btn-percent-pill ${task.progress === 0 ? 'active' : ''}" onclick="EmployeeModule.applyQuickPercent('${task.id}', 0)">0%</button>
            <button type="button" class="btn-percent-pill ${task.progress === 25 ? 'active' : ''}" onclick="EmployeeModule.applyQuickPercent('${task.id}', 25)">25%</button>
            <button type="button" class="btn-percent-pill ${task.progress === 50 ? 'active' : ''}" onclick="EmployeeModule.applyQuickPercent('${task.id}', 50)">50%</button>
            <button type="button" class="btn-percent-pill ${task.progress === 75 ? 'active' : ''}" onclick="EmployeeModule.applyQuickPercent('${task.id}', 75)">75%</button>
            <button type="button" class="btn-percent-pill ${task.progress === 100 ? 'active' : ''}" onclick="EmployeeModule.applyQuickPercent('${task.id}', 100)">100%</button>
          </div>

          <button class="btn btn-sm btn-secondary" onclick="EmployeeModule.saveCardProgress('${task.id}')" style="margin-top:0.25rem;">
            💾 Confirmar Avance (<span id="btnPercentVal-${task.id}">${task.progress}</span>%)
          </button>
        </div>

        <!-- Meta -->
        <div class="task-card-meta">
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Entregables: ${(task.checklist || []).filter(c => c.completed).length}/${(task.checklist || []).length}
          </div>

          <div class="task-deadline ${alert.level === 'danger' ? 'urgent' : (alert.level === 'warning' ? 'warning' : '')}">
            <span>📅 Entrega: ${dueDateFormatted}</span>
          </div>
        </div>

        <!-- Employee Actions -->
        <div class="task-actions-bar">
          <button class="btn btn-warning btn-sm" onclick="EmployeeModule.openReportIssueModal('${task.id}')" title="Notificar novedades o dificultades al Decano">
            🛑 Reportar Dificultad
          </button>
          <button class="btn btn-primary btn-sm" onclick="App.openTaskDetailModal('${task.id}')">
            Detalles & Entregables
          </button>
        </div>
      </div>
    `;
  },

  handleSliderInput(taskId, value) {
    const label = document.getElementById(`percentLabel-${taskId}`);
    const bar = document.getElementById(`barFill-${taskId}`);
    const btnVal = document.getElementById(`btnPercentVal-${taskId}`);
    if (label) label.textContent = `${value}%`;
    if (bar) {
      bar.style.width = `${value}%`;
      if (parseInt(value, 10) === 100) {
        bar.classList.add('completado');
      } else {
        bar.classList.remove('completado');
      }
    }
    if (btnVal) btnVal.textContent = value;
  },

  applyQuickPercent(taskId, value) {
    const slider = document.getElementById(`slider-${taskId}`);
    if (slider) slider.value = value;
    this.handleSliderInput(taskId, value);
    this.saveCardProgress(taskId, value);
  },

  saveCardProgress(taskId, overrideValue = null) {
    const slider = document.getElementById(`slider-${taskId}`);
    const value = overrideValue !== null ? overrideValue : (slider ? slider.value : 0);
    const updated = window.appStore.updateTaskProgress(taskId, value, '');
    
    AlertsEngine.showToast(
      'Porcentaje Actualizado',
      `El avance de la actividad "${updated.title}" se registró al ${value}%.`,
      parseInt(value, 10) === 100 ? 'success' : 'info'
    );

    this.render();
  },

  // Open Report Issue Modal
  openReportIssueModal(taskId) {
    const task = window.appStore.getTaskById(taskId);
    if (!task) return;

    const modal = document.getElementById('reportIssueModal');
    document.getElementById('reportIssueTaskId').value = task.id;
    document.getElementById('reportIssueTaskTitle').textContent = task.title;
    document.getElementById('reportIssueDescriptionInput').value = '';
    modal.classList.add('active');
  },

  handleReportIssueSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('reportIssueTaskId').value;
    const issueType = document.getElementById('reportIssueTypeSelect').value;
    const description = document.getElementById('reportIssueDescriptionInput').value.trim();

    if (!description) {
      AlertsEngine.showToast('Descripción requerida', 'Explique detalladamente el problema para que la jefatura pueda resolverlo.', 'warning');
      return;
    }

    window.appStore.reportIssue(taskId, issueType, description);
    document.getElementById('reportIssueModal').classList.remove('active');

    AlertsEngine.showToast(
      'Dificultad Reportada a Decanatura',
      'La novedad o dificultad ha sido transmitida con alerta prioritaria al Decano de Investigación.',
      'danger'
    );

    this.render();
  },

  // Update Checklist Item completion
  toggleChecklistItem(taskId, checkId, completed) {
    const task = window.appStore.getTaskById(taskId);
    if (!task || !task.checklist) return;

    const item = task.checklist.find(c => c.id === checkId);
    if (item) {
      item.completed = completed;
      // Recalculate progress percentage
      const completedCount = task.checklist.filter(c => c.completed).length;
      const progress = Math.round((completedCount / task.checklist.length) * 100);
      
      const updates = {
        checklist: task.checklist,
        progress: progress
      };

      if (progress === 100) {
        updates.status = 'completado';
      } else if (progress > 0 && task.status === 'pendiente') {
        updates.status = 'en_progreso';
      }

      window.appStore.updateTask(taskId, updates);
      
      const currentUser = window.appStore.getCurrentUser();
      const userName = currentUser ? currentUser.name : 'Un docente';

      if (completed) {
        window.appStore.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: progress === 100 ? '✅ Tarea Completada al 100%' : '☑️ Entregable Cumplido',
          message: `${userName} completó el entregable "${item.text}" en "${task.title}" (Progreso: ${progress}%).`,
          type: progress === 100 ? 'success' : 'info',
          taskId: task.id
        });
      }

      if (progress === 100) {
        AlertsEngine.showToast('¡Tarea Completada!', 'Has completado todos los entregables requeridos.', 'success');
      }

      // Re-render task detail modal and lists
      App.openTaskDetailModal(taskId);
      this.render();
    }
  }
};

window.EmployeeModule = EmployeeModule;

