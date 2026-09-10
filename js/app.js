/* ==========================================================================
   GESTORPRO JEFATURA - APP ORCHESTRATOR & UI LOGIC (js/app.js)
   ========================================================================== */

const App = {
  activeTaskIdForDetail: null,

  async init() {
    this.initTheme();
    this.initPwa();
    this.bindEvents();
    Auth.init();
    await this.syncUsersFromServer();
    await window.appStore.syncTasksFromServer();
    if (window.appStore.syncNotificationsFromServer) {
      await window.appStore.syncNotificationsFromServer();
    }
    if (window.EmailModule) EmailModule.init();
    this.setupRealtimeSync();
    this.refreshCurrentView();
    this.updateNotificationBadge();
    this.startLiveSyncTimer();
  },

  liveSyncIntervalId: null,

  startLiveSyncTimer() {
    if (this.liveSyncIntervalId) clearInterval(this.liveSyncIntervalId);

    // Heartbeat check cada 2.5 segundos con costo 0 a MongoDB Atlas
    this.liveSyncIntervalId = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      await this.checkLiveUpdates();
    }, 2500);

    // Re-check inmediatamente al recuperar foco
    window.addEventListener('focus', () => {
      this.checkLiveUpdates();
    });
  },

  setupRealtimeSync() {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('esfim_decanatura_realtime_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'TASK_UPDATED') {
          if (Array.isArray(data.tasks)) {
            window.appStore.saveTasks(data.tasks);
          } else if (data.task) {
            const currentTasks = window.appStore.getTasks();
            const sId = String(data.task.id || data.task._id);
            const idx = currentTasks.findIndex(t => String(t.id) === sId || String(t._id) === sId);
            if (idx !== -1) {
              currentTasks[idx] = data.task;
            } else {
              currentTasks.unshift(data.task);
            }
            window.appStore.saveTasks(currentTasks);
          }
          this.refreshCurrentView();
          this.updateNotificationBadge();
        } else if (data.type === 'TASK_DELETED') {
          if (Array.isArray(data.tasks)) {
            window.appStore.saveTasks(data.tasks);
          } else if (data.taskId) {
            const currentTasks = window.appStore.getTasks().filter(t => String(t.id) !== String(data.taskId) && String(t._id) !== String(data.taskId));
            window.appStore.saveTasks(currentTasks);
          }
          this.refreshCurrentView();
          this.updateNotificationBadge();
        } else if (data.type === 'NOTIFICATION_ADDED') {
          this.updateNotificationBadge();
        }
      };
    }

    // Storage event listener nativo para sincronizar pestañas paralelas
    window.addEventListener('storage', (e) => {
      if (e.key === 'gestorpro_tasks_decanatura') {
        this.refreshCurrentView();
        this.updateNotificationBadge();
      } else if (e.key === 'gestorpro_notifications_decanatura') {
        this.updateNotificationBadge();
      }
    });
  },

  async checkLiveUpdates() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    try {
      const changed = await window.appStore.checkAndSyncIfOutdated();
      if (window.appStore.syncNotificationsFromServer) {
        await window.appStore.syncNotificationsFromServer();
      }
      if (changed) {
        // Only refresh view if no form input is currently focused to avoid interrupting user typing
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (!isTyping) {
          this.refreshCurrentView();
        }
      }
      this.updateNotificationBadge();
    } catch (e) {
      console.warn('Error comprobando actualizaciones en vivo:', e);
    }
  },

  async syncUsersFromServer() {
    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));
    if (!token) return;
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const mapped = data.users.map(u => ({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          area: u.area,
          department: u.department,
          avatar: u.avatar
        }));
        window.appStore.saveUsers(mapped);

        const current = Auth.getCurrentUser();
        if (current) {
          const match = mapped.find(u => 
            (u.id && String(u.id).toLowerCase() === String(current.id || current._id).toLowerCase()) ||
            (u.email && String(u.email).toLowerCase() === String(current.email).toLowerCase())
          );
          if (match && match.avatar !== current.avatar) {
            current.avatar = match.avatar;
            sessionStorage.setItem('efim_user', JSON.stringify(current));
            localStorage.setItem('efim_user', JSON.stringify(current));
            Auth.updateUserUI();
            this.refreshCurrentView();
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo sincronizar usuarios desde el servidor:', e);
    }
  },

  initTheme() {
    // Check if user has explicit saved preference, otherwise follow PC system
    const savedMode = localStorage.getItem('gestorpro_theme_mode');
    const effectiveTheme = (savedMode === 'light' || savedMode === 'dark')
      ? savedMode
      : this.getSystemTheme();

    this.applyTheme(effectiveTheme, savedMode || 'system');

    // Listen to PC / OS changes dynamically
    if (window.matchMedia) {
      const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeMedia.addEventListener('change', (e) => {
        const currentSaved = localStorage.getItem('gestorpro_theme_mode');
        if (!currentSaved || currentSaved === 'system') {
          this.applyTheme(e.matches ? 'dark' : 'light', 'system');
        }
      });
    }
  },

  getSystemTheme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  },

  applyTheme(theme, mode = 'manual') {
    // Always explicitly set data-theme attribute on <html> to ensure CSS applies immediately
    document.documentElement.setAttribute('data-theme', theme);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      if (theme === 'light') {
        btn.innerHTML = '☀️ <span class="btn-label-sm">Tema</span>';
        btn.title = `Modo Claro activo. Clic para cambiar a Modo Oscuro`;
      } else {
        btn.innerHTML = '🌙 <span class="btn-label-sm">Tema</span>';
        btn.title = `Modo Oscuro activo. Clic para cambiar a Modo Claro`;
      }
    }
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    localStorage.setItem('gestorpro_theme_mode', nextTheme);
    this.applyTheme(nextTheme, 'manual');

    const msg = nextTheme === 'dark' ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado';
    AlertsEngine.showToast('Tema Visual', msg, 'info', 1800);
  },

  bindEvents() {
    // Notifications Bell & Dropdown
    const notifBtn = document.getElementById('btnNotifications');
    if (notifBtn) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNotificationsDropdown();
      });
    }

    const notifDropdown = document.getElementById('notificationsDropdown');
    if (notifDropdown) {
      notifDropdown.addEventListener('click', (e) => {
        // Prevent closing dropdown when clicking inside it, except when clicking action buttons/items
        e.stopPropagation();
      });
    }

    // Close notifications dropdown and user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notifications-wrapper')) {
        this.closeNotificationsDropdown();
      }
      if (!e.target.closest('#userProfileWrapper')) {
        this.closeUserDropdown();
      }
    });

    // Reset data
    const resetBtn = document.getElementById('btnResetData');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('¿Desea restaurar los datos de demostración iniciales con tareas y usuarios de prueba?')) {
          window.appStore.resetData();
          Auth.init();
          this.refreshCurrentView();
          AlertsEngine.showToast('Datos Restaurados', 'Se han restablecido los datos demo del sistema.', 'success');
        }
      });
    }

    // Modal Close Buttons
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    document.querySelectorAll('.btn-close-modal, .btn-modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Create Task Form
    const createForm = document.getElementById('createTaskForm');
    if (createForm) {
      createForm.addEventListener('submit', (e) => AdminModule.handleCreateTaskSubmit(e));
    }

    // Create Employee Form
    const createEmpForm = document.getElementById('createEmployeeForm');
    if (createEmpForm) {
      createEmpForm.addEventListener('submit', (e) => AdminModule.handleCreateEmployeeSubmit(e));
    }

    // Add checklist item button
    const addChecklistBtn = document.getElementById('btnAddChecklistItem');
    if (addChecklistBtn) {
      addChecklistBtn.addEventListener('click', () => AdminModule.addChecklistItemInput());
    }

    // Send Reminder Form
    const reminderForm = document.getElementById('reminderForm');
    if (reminderForm) {
      reminderForm.addEventListener('submit', (e) => AdminModule.handleSendReminderSubmit(e));
    }

    // Report Issue Form (Employee)
    const reportIssueForm = document.getElementById('reportIssueForm');
    if (reportIssueForm) {
      reportIssueForm.addEventListener('submit', (e) => EmployeeModule.handleReportIssueSubmit(e));
    }

    // Verify Issue Form (Admin)
    const verifyIssueForm = document.getElementById('verifyIssueForm');
    if (verifyIssueForm) {
      verifyIssueForm.addEventListener('submit', (e) => AdminModule.handleVerifyIssueSubmit(e));
    }

    // Add Comment in Task Detail Form
    const commentForm = document.getElementById('taskCommentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => this.handleAddCommentSubmit(e));
    }

    // Search and Filters for Admin
    const adminSearch = document.getElementById('adminSearchInput');
    if (adminSearch) {
      adminSearch.addEventListener('input', (e) => {
        AdminModule.currentSearch = e.target.value;
        AdminModule.render();
      });
    }

    const adminFilter = document.getElementById('adminFilterSelect');
    if (adminFilter) {
      adminFilter.addEventListener('change', (e) => {
        AdminModule.currentFilter = e.target.value;
        AdminModule.render();
      });
    }

    const adminAreaFilter = document.getElementById('adminAreaFilterSelect');
    if (adminAreaFilter) {
      adminAreaFilter.addEventListener('change', (e) => {
        AdminModule.currentAreaFilter = e.target.value;
        AdminModule.render();
      });
    }

    const adminAlertSelect = document.getElementById('adminAlertSelect');
    if (adminAlertSelect) {
      adminAlertSelect.addEventListener('change', (e) => {
        AdminModule.currentAlertFilter = e.target.value;
        AdminModule.render();
      });
    }

    // Search and Filters for Employee
    const employeeSearch = document.getElementById('employeeSearchInput');
    if (employeeSearch) {
      employeeSearch.addEventListener('input', (e) => {
        EmployeeModule.currentSearch = e.target.value;
        EmployeeModule.render();
      });
    }

    const employeeFilter = document.getElementById('employeeFilterSelect');
    if (employeeFilter) {
      employeeFilter.addEventListener('change', (e) => {
        EmployeeModule.currentFilter = e.target.value;
        EmployeeModule.render();
      });
    }

    // Auth Modal / Screen Forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const res = Auth.login(email, pass);
        if (!res.success) {
          AlertsEngine.showToast('Acceso Denegado', res.message, 'danger');
        } else {
          document.getElementById('authModal').classList.remove('active');
        }
      });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;
        const department = document.getElementById('regDepartment').value;

        const res = Auth.register({ name, email, password, role, department });
        if (!res.success) {
          AlertsEngine.showToast('Error de Registro', res.message, 'danger');
        } else {
          document.getElementById('authModal').classList.remove('active');
        }
      });
    }
  },

  refreshCurrentView() {
    const user = Auth.getCurrentUser();
    const adminView = document.getElementById('adminView');
    const employeeView = document.getElementById('employeeView');
    const authHero = document.getElementById('authHeroSection');

    if (!user) {
      if (adminView) adminView.style.display = 'none';
      if (employeeView) employeeView.style.display = 'none';
      if (authHero) authHero.style.display = 'block';
      return;
    }

    if (authHero) authHero.style.display = 'none';

    if (user.role === 'admin') {
      if (adminView) adminView.style.display = 'block';
      if (employeeView) employeeView.style.display = 'none';
      AdminModule.render();
    } else {
      if (adminView) adminView.style.display = 'none';
      if (employeeView) employeeView.style.display = 'block';
      EmployeeModule.render();
    }

    this.updateNotificationBadge();
  },

  // View switch for Admin between Cards and Table
  setAdminView(viewType) {
    AdminModule.currentView = viewType;
    document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`viewTab-${viewType}`);
    if (activeBtn) activeBtn.classList.add('active');
    AdminModule.render();
  },

  // Open Detailed Task Modal (with checklist, alerts, full timeline and comments)
  openTaskDetailModal(taskId) {
    this.activeTaskIdForDetail = taskId;
    const task = window.appStore.getTaskById(taskId);
    if (!task) return;

    const currentUser = Auth.getCurrentUser();
    const assignees = task.assignedTo === 'all'
      ? window.appStore.getEmployees()
      : (Array.isArray(task.assignedTo)
        ? task.assignedTo.map(id => (typeof id === 'object' && id && id.name) ? id : window.appStore.getUserById(id)).filter(Boolean)
        : [typeof task.assignedTo === 'object' && task.assignedTo ? task.assignedTo : window.appStore.getUserById(task.assignedTo)].filter(Boolean));
    const alert = AlertsEngine.getTaskAlertStatus(task);
    const modal = document.getElementById('taskDetailModal');

    document.getElementById('detailTaskTitle').textContent = task.title;
    document.getElementById('detailTaskDesc').textContent = task.description;
    
    // Header badges
    const badgesContainer = document.getElementById('detailTaskBadges');
    const areaInfo = (window.DECANATURA_AREAS && window.DECANATURA_AREAS[task.area]) || null;
    const isDraft = Boolean(task.isDraft || task.status === 'borrador' || !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0));
    const isGroup = !isDraft && (task.area === 'decanatura' || task.assignedTo === 'all' || assignees.length > 1);

    badgesContainer.innerHTML = `
      ${areaInfo ? `
        <span class="badge ${areaInfo.badgeClass}" title="${areaInfo.subtitle}">
          ${areaInfo.icon} ${areaInfo.name}
        </span>
      ` : ''}
      <span class="badge badge-priority-${task.priority}">${{urgent:'URGENTE',urgente:'URGENTE',high:'ALTA',alta:'ALTA',medium:'MEDIA',media:'MEDIA',low:'BAJA',baja:'BAJA'}[String(task.priority || '').toLowerCase()] || 'MEDIA'}</span>
      ${isDraft ? `
        <span class="badge badge-warning" style="font-weight:700;">📝 Borrador · Por Asignar</span>
      ` : `
        <span class="badge ${alert.badgeClass}">${alert.label}</span>
        ${isGroup ? '<span class="badge badge-info" style="font-size:0.7rem; padding:2px 7px;">👥 Compromiso Grupal</span>' : ''}
        <span class="badge badge-status-${task.status}">ESTADO: ${task.status.replace(/_/g, ' ').toUpperCase()}</span>
      `}
    `;

    // Metadata
    const dueDateFormatted = task.dueDate ? new Date(task.dueDate).toLocaleString('es-ES', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Sin definir';
    document.getElementById('detailAssigneeName').innerHTML = isDraft
      ? '<span style="color:var(--text-muted); font-style:italic;">Por asignar responsable</span>'
      : (assignees.length > 0
        ? assignees.map(a => `<span class="badge badge-secondary" style="font-size:0.8rem; margin:2px;">👤 ${a.name} &lt;${a.email}&gt;</span>`).join('')
        : 'Sin asignar');
    document.getElementById('detailDueDate').textContent = dueDateFormatted;
    document.getElementById('detailTimeRemaining').textContent = isDraft ? 'En espera de asignación' : alert.formattedRemaining;

    // Draft Banner
    const draftBanner = document.getElementById('detailDraftBanner');
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (draftBanner) {
      if (isDraft) {
        draftBanner.style.display = 'block';
        draftBanner.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
            <div>
              <strong style="color:#d97706; font-size:0.9rem;">📝 Compromiso Guardado en Borrador</strong>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Esta actividad académica fue guardada sin despachar. El Decano o Gestor pueden asignarla cuando decidan a quién le compete.</div>
            </div>
            ${isAdmin ? `
              <button class="btn btn-sm btn-primary" onclick="document.getElementById('taskDetailModal').classList.remove('active'); AdminModule.openAssignDraftModal('${task.id}')">
                👤 Asignar Responsable(s) Ahora
              </button>
            ` : ''}
          </div>
        `;
      } else {
        draftBanner.style.display = 'none';
      }
    }

    // Issue status box in detail
    const issueBox = document.getElementById('detailIssueBox');
    if (task.issueReport && task.issueReport.status === 'revision_pendiente') {
      issueBox.style.display = 'block';
      issueBox.innerHTML = `
        <div class="task-reported-issue-box" style="padding: 1rem;">
          <div class="issue-box-title" style="margin-bottom: 0.35rem;">
            <span>🛑</span> <strong>Dificultad Reportada por el Docente (${task.issueReport.type}):</strong>
          </div>
          <p class="issue-box-desc" style="margin-bottom: 0.75rem;">"${task.issueReport.description}"</p>
          <div class="issue-box-subtext" style="margin-bottom: 0.5rem;">
            Reportado el: ${new Date(task.issueReport.reportedAt).toLocaleString()}
          </div>
          ${isAdmin ? `
            <button class="btn btn-sm btn-warning" onclick="AdminModule.openVerifyIssueModal('${task.id}')">
              🔍 Verificar y Resolver con el Docente
            </button>
          ` : `
            <span class="issue-box-subtext" style="font-style:italic;">En revisión por el Decano de Investigación.</span>
          `}
        </div>
      `;
    } else {
      issueBox.style.display = 'none';
    }

    // Group Tasks Individual Breakdown
    const breakdownContainer = document.getElementById('detailGroupProgressBreakdown');
    if (breakdownContainer) {
      if (isGroup) {
        window.appStore.ensureAssigneeProgress(task);
        const members = task.assigneeProgress || [];
        breakdownContainer.style.display = 'block';
        breakdownContainer.innerHTML = `
          <div class="individual-progress-panel" style="background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <h4 style="margin:0; font-size:0.95rem; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
                  <span>👥</span> Avance Individual por Docente (${members.length} miembros asignados)
                </h4>
                <span style="font-size:0.78rem; color:var(--text-muted);">Seguimiento independiente y transparente del cumplimiento individual de cada docente</span>
              </div>
              <span class="badge badge-info" style="font-size:0.8rem; font-weight:700;">Promedio Grupal: ${task.progress}%</span>
            </div>

            <div class="individual-members-grid" style="display:flex; flex-direction:column; gap:0.6rem;">
              ${members.map(m => {
                const mCompletedChk = (m.checklist || []).filter(c => c.completed).length;
                const mTotalChk = (m.checklist || []).length;
                const statusBadge = m.progress === 100
                  ? '<span class="badge badge-success" style="font-size:0.7rem;">✅ Completado (100%)</span>'
                  : (m.progress > 0
                    ? '<span class="badge badge-info" style="font-size:0.7rem;">⚡ En Progreso</span>'
                    : '<span class="badge" style="font-size:0.7rem;">⏳ Pendiente</span>');
                const updatedStr = m.updatedAt ? new Date(m.updatedAt).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Sin registros';

                return `
                  <div class="member-progress-card" style="background:var(--surface-1); border:1px solid var(--border-subtle); border-radius:8px; padding:0.75rem; display:flex; flex-direction:column; gap:0.4rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        ${AdminModule.getAvatarHtml(m.avatar, m.userName ? m.userName.slice(0,2).toUpperCase() : '??', '28px', 'assignee-avatar')}
                        <div>
                          <strong style="font-size:0.875rem; color:var(--text-main);">${m.userName}</strong>
                          <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.35rem;">&lt;${m.userEmail}&gt;</span>
                        </div>
                      </div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        ${statusBadge}
                        <span style="font-family:var(--font-mono); font-weight:800; color:var(--primary); font-size:0.95rem;">${m.progress}%</span>
                      </div>
                    </div>

                    <div class="progress-bar-bg" style="height:6px;">
                      <div class="progress-bar-fill ${m.progress === 100 ? 'completado' : ''}" style="width:${m.progress}%;"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap; gap:0.35rem;">
                      <span>Entregables propios completados: <strong>${mCompletedChk}/${mTotalChk}</strong></span>
                      <span>${m.lastNote ? `Último reporte: <em>"${m.lastNote}"</em> • ` : ''}Actualizado: ${updatedStr}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        breakdownContainer.style.display = 'none';
      }
    }

    // Resolve user progress for Checklist and Controller
    const myIds = currentUser ? [currentUser.id, currentUser._id, currentUser.email].filter(Boolean).map(x => String(x).toLowerCase()) : [];
    const isEmployeeAssigned = currentUser && (
      task.assignedTo === 'all' ||
      (Array.isArray(task.assignedTo)
        ? task.assignedTo.some(a => myIds.includes(String(typeof a === 'object' ? (a?.id || a?._id || a?.email || '') : a).toLowerCase()))
        : myIds.includes(String(typeof task.assignedTo === 'object' ? (task.assignedTo?.id || task.assignedTo?.email || '') : task.assignedTo).toLowerCase())
      )
    );

    const userProgressObj = isGroup && !isAdmin ? window.appStore.getUserTaskProgress(task, currentUser) : null;
    const activeChecklist = userProgressObj ? (userProgressObj.checklist || []) : (task.checklist || []);
    const activeProgressVal = userProgressObj ? (userProgressObj.progress || 0) : (task.progress || 0);
    const canToggle = isEmployeeAssigned || isAdmin;

    // Render Checklist
    const checklistContainer = document.getElementById('detailChecklistContainer');
    if (!activeChecklist || activeChecklist.length === 0) {
      checklistContainer.innerHTML = '<p style="font-size:0.85rem; color:var(--text-dim);">No se definieron entregables específicos.</p>';
    } else {
      checklistContainer.innerHTML = activeChecklist.map(item => `
        <label class="checklist-checkbox-item ${item.completed ? 'checked' : ''}">
          <input type="checkbox" 
            ${item.completed ? 'checked' : ''} 
            ${canToggle ? '' : 'disabled'}
            onchange="EmployeeModule.toggleChecklistItem('${task.id}', '${item.id}', this.checked)"
          />
          <span>${item.text}</span>
        </label>
      `).join('');
    }

    // Progress bar
    document.getElementById('detailProgressBar').style.width = `${activeProgressVal}%`;
    document.getElementById('detailProgressText').textContent = isGroup && !isAdmin
      ? `${activeProgressVal}% (Promedio del equipo: ${task.progress}%)`
      : `${activeProgressVal}%`;

    // Render Interactive Percentage Controller
    const progressCtrl = document.getElementById('detailProgressController');
    if (progressCtrl) {
      if ((isEmployeeAssigned || isAdmin) && !isDraft) {
        progressCtrl.style.display = 'block';
        progressCtrl.innerHTML = `
          <div class="progress-updater-box">
            <div class="progress-updater-header">
              <span class="progress-updater-title">📊 ${isGroup && !isAdmin ? 'Actualizar Mi Porcentaje de Avance Individual' : 'Actualizar Porcentaje de Avance'}</span>
              <span class="progress-numeric-badge" id="modalProgressVal">${activeProgressVal}%</span>
            </div>
            <div class="progress-slider-wrapper">
              <input type="range" class="progress-range-slider" min="0" max="100" step="5" value="${activeProgressVal}" 
                id="modalProgressSlider"
                oninput="document.getElementById('modalProgressVal').textContent = this.value + '%'"
              />
            </div>
            <div class="quick-percent-pills">
              <button type="button" class="btn-percent-pill ${activeProgressVal === 0 ? 'active' : ''}" onclick="document.getElementById('modalProgressSlider').value=0; document.getElementById('modalProgressVal').textContent='0%';">0%</button>
              <button type="button" class="btn-percent-pill ${activeProgressVal === 25 ? 'active' : ''}" onclick="document.getElementById('modalProgressSlider').value=25; document.getElementById('modalProgressVal').textContent='25%';">25%</button>
              <button type="button" class="btn-percent-pill ${activeProgressVal === 50 ? 'active' : ''}" onclick="document.getElementById('modalProgressSlider').value=50; document.getElementById('modalProgressVal').textContent='50%';">50%</button>
              <button type="button" class="btn-percent-pill ${activeProgressVal === 75 ? 'active' : ''}" onclick="document.getElementById('modalProgressSlider').value=75; document.getElementById('modalProgressVal').textContent='75%';">75%</button>
              <button type="button" class="btn-percent-pill ${activeProgressVal === 100 ? 'active' : ''}" onclick="document.getElementById('modalProgressSlider').value=100; document.getElementById('modalProgressVal').textContent='100%';">100%</button>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.35rem;">
              <input type="text" id="modalProgressNote" class="form-control" placeholder="Detalle o justificación del avance (opcional)..." style="font-size:0.8rem;" />
              <button type="button" class="btn btn-sm btn-primary" onclick="App.saveModalProgress('${task.id}')">
                Guardar Avance
              </button>
            </div>
          </div>
        `;
      } else {
        progressCtrl.style.display = 'none';
      }
    }

    // Render Comments Timeline
    this.renderCommentsList(task.comments || []);

    // Bottom Action Buttons in Modal
    const actionsFooter = document.getElementById('detailModalActions');
    actionsFooter.innerHTML = '';

    if (isAdmin) {
      if (isDraft) {
        const btnAssign = document.createElement('button');
        btnAssign.className = 'btn btn-primary btn-sm';
        btnAssign.innerHTML = '👤 Asignar Responsable(s)';
        btnAssign.onclick = () => {
          document.getElementById('taskDetailModal').classList.remove('active');
          AdminModule.openAssignDraftModal(task.id);
        };
        actionsFooter.appendChild(btnAssign);

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-danger btn-sm';
        btnDelete.innerHTML = '🗑️ Descartar Borrador';
        btnDelete.onclick = () => {
          AdminModule.confirmDeleteTask(task.id);
        };
        actionsFooter.appendChild(btnDelete);
      } else {
        const btnReminder = document.createElement('button');
        btnReminder.className = 'btn btn-secondary btn-sm';
        btnReminder.innerHTML = '⏰ Recordatorio Decano';
        btnReminder.onclick = () => {
          AdminModule.openReminderModal(task.id);
        };
        actionsFooter.appendChild(btnReminder);

        if (task.status !== 'completado') {
          const btnApprove = document.createElement('button');
          btnApprove.className = 'btn btn-primary btn-sm';
          btnApprove.innerHTML = '✅ Validar y Marcar Aprobada';
          btnApprove.onclick = () => {
            window.appStore.updateTask(task.id, { status: 'completado', progress: 100 });
            AlertsEngine.showToast('Compromiso Aprobado', 'La tarea académica ha sido validada como completada por la Decanatura.', 'success');
            App.openTaskDetailModal(task.id);
            AdminModule.render();
          };
          actionsFooter.appendChild(btnApprove);
        } else {
          const btnArchive = document.createElement('button');
          btnArchive.className = 'btn btn-secondary btn-sm';
          btnArchive.innerHTML = '📦 Archivar Compromiso';
          btnArchive.onclick = async () => {
            await window.appStore.archiveTask(task.id);
            AlertsEngine.showToast('Tarea Archivada', 'El compromiso cumplido ha sido archivado.', 'info');
            document.getElementById('taskDetailModal').classList.remove('active');
            AdminModule.render();
          };
          actionsFooter.appendChild(btnArchive);

          const btnDelete = document.createElement('button');
          btnDelete.className = 'btn btn-danger btn-sm';
          btnDelete.innerHTML = '🗑️ Eliminar Tarea (Liberar BD)';
          btnDelete.onclick = () => {
            AdminModule.confirmDeleteTask(task.id);
          };
          actionsFooter.appendChild(btnDelete);
        }
      }
    } else if (isEmployeeAssigned) {
      const btnReport = document.createElement('button');
      btnReport.className = 'btn btn-warning btn-sm';
      btnReport.innerHTML = '🛑 Reportar Dificultad al Decano';
      btnReport.onclick = () => {
        EmployeeModule.openReportIssueModal(task.id);
      };
      actionsFooter.appendChild(btnReport);

      if (task.status !== 'completado') {
        const btnMarkDone = document.createElement('button');
        btnMarkDone.className = 'btn btn-primary btn-sm';
        btnMarkDone.innerHTML = '📤 Entregar Compromiso a Decanatura';
        btnMarkDone.onclick = () => {
          window.appStore.updateTask(task.id, { status: 'completado', progress: 100 });
          window.appStore.addComment(task.id, 'He finalizado los entregables y productos académicos para revisión de la Decanatura.', 'general');
          AlertsEngine.showToast('Tarea Entregada', 'Has marcado la tarea como cumplida para revisión del Decano.', 'success');
          App.openTaskDetailModal(task.id);
          EmployeeModule.render();
        };
        actionsFooter.appendChild(btnMarkDone);
      } else {
        const btnHide = document.createElement('button');
        btnHide.className = 'btn btn-secondary btn-sm';
        btnHide.innerHTML = '📦 Archivar / Ocultar de mi Tablero';
        btnHide.onclick = async () => {
          await window.appStore.archiveTask(task.id);
          AlertsEngine.showToast('Tarea Archivada', 'Has archivado este compromiso cumplido.', 'info');
          document.getElementById('taskDetailModal').classList.remove('active');
          EmployeeModule.render();
        };
        actionsFooter.appendChild(btnHide);
      }
    }

    modal.classList.add('active');
  },

  renderCommentsList(comments) {
    const container = document.getElementById('detailCommentsList');
    if (!container) return;

    if (comments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 1.5rem; color: var(--text-dim); font-size: 0.85rem;">
          No hay comentarios o recordatorios registrados en esta tarea aún.
        </div>
      `;
      return;
    }

    container.innerHTML = comments.map(c => {
      const timeStr = new Date(c.timestamp).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      let bubbleClass = '';
      let badgeTag = '';
      if (c.type === 'reminder') {
        bubbleClass = 'reminder';
        badgeTag = '<span style="background:#f59e0b; color:#000; font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px;">RECORDATORIO FORMAL</span>';
      } else if (c.type === 'issue-report') {
        bubbleClass = 'issue-report';
        badgeTag = '<span style="background:#d946ef; color:#fff; font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px;">REPORTE DE BLOQUEO</span>';
      } else if (c.type === 'resolution') {
        bubbleClass = 'resolution';
        badgeTag = '<span style="background:#10b981; color:#fff; font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px;">RESOLUCIÓN DE JEFE</span>';
      }

      return `
        <div class="comment-bubble ${bubbleClass}">
          <div class="comment-header">
            <span class="comment-author">
              ${c.authorName} ${badgeTag}
            </span>
            <span class="comment-time">${timeStr}</span>
          </div>
          <div class="comment-text">${c.text}</div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  },

  saveModalProgress(taskId) {
    const slider = document.getElementById('modalProgressSlider');
    const noteInput = document.getElementById('modalProgressNote');
    if (!slider) return;
    const value = parseInt(slider.value, 10);
    const note = noteInput ? noteInput.value.trim() : '';

    const updated = window.appStore.updateTaskProgress(taskId, value, note);
    AlertsEngine.showToast(
      'Porcentaje Actualizado',
      `Avance registrado al ${value}% en "${updated ? updated.title : 'Actividad'}".`,
      value === 100 ? 'success' : 'info'
    );
    this.openTaskDetailModal(taskId);
    this.refreshCurrentView();
  },

  handleAddCommentSubmit(e) {
    e.preventDefault();
    if (!this.activeTaskIdForDetail) return;
    const input = document.getElementById('taskCommentInput');
    const text = input.value.trim();
    if (!text) return;

    window.appStore.addComment(this.activeTaskIdForDetail, text, 'general');
    input.value = '';

    const updatedTask = window.appStore.getTaskById(this.activeTaskIdForDetail);
    this.renderCommentsList(updatedTask.comments || []);
    
    // Refresh background cards
    const user = Auth.getCurrentUser();
    if (user.role === 'admin') {
      AdminModule.render();
    } else {
      EmployeeModule.render();
    }
  },

  // ==========================================================================
  // NOTIFICATIONS SYSTEM (DROPDOWN, MODAL & BADGE)
  // ==========================================================================
  toggleNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');
    if (isActive) {
      this.closeNotificationsDropdown();
    } else {
      this.closeUserDropdown();
      this.renderNotificationsDropdown();
      dropdown.classList.add('active');
    }
  },

  closeNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.classList.remove('active');
    }
  },

  renderNotificationsDropdown() {
    const list = document.getElementById('notifList');
    if (!list) return;

    const user = Auth.getCurrentUser();
    if (!user) {
      list.innerHTML = `
        <div class="notif-empty">
          <span>Inicia sesión para ver notificaciones</span>
        </div>
      `;
      return;
    }

    const notifs = window.appStore.getNotifications(user.id);

    if (!notifs || notifs.length === 0) {
      list.innerHTML = `
        <div class="notif-empty">
          <span>No tienes notificaciones en este momento</span>
        </div>
      `;
      return;
    }

    list.innerHTML = notifs.slice(0, 15).map(n => {
      const icon = n.type === 'danger' ? '🚨' : (n.type === 'warning' ? '⏰' : (n.type === 'success' ? '✅' : '📢'));
      const timeStr = this.formatNotificationTime(n.timestamp);
      const isUnread = !n.read;
      const taskAttr = n.taskId ? `onclick="App.handleNotificationClick('${n.id}', '${n.taskId}')"` : `onclick="App.handleNotificationClick('${n.id}', null)"`;

      return `
        <div class="notif-item ${isUnread ? 'unread' : ''}" ${taskAttr} title="${n.taskId ? 'Clic para ver detalles del compromiso' : ''}">
          <div class="notif-icon">${icon}</div>
          <div class="notif-content">
            <div class="notif-title">${this.escapeHtml(n.title || 'Aviso de Decanatura')}</div>
            <div class="notif-desc">${this.escapeHtml(n.message || '')}</div>
            <div class="notif-time">${timeStr} ${n.taskId ? '· 🔍 Ver compromiso' : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  handleNotificationClick(notifId, taskId) {
    if (notifId && window.appStore && window.appStore.markNotificationAsRead) {
      window.appStore.markNotificationAsRead(notifId);
      this.updateNotificationBadge();
      this.renderNotificationsDropdown();
    }

    this.closeNotificationsDropdown();

    if (taskId) {
      this.openTaskDetailModal(taskId);
    }
  },

  markAllNotificationsRead() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    window.appStore.markNotificationsAsRead(user.id);
    this.updateNotificationBadge();
    this.renderNotificationsDropdown();

    const modal = document.getElementById('notificationsModal');
    if (modal && modal.classList.contains('active')) {
      this.openNotificationsModal();
    }

    if (window.AlertsEngine && AlertsEngine.showToast) {
      AlertsEngine.showToast('Notificaciones', 'Todas las notificaciones se marcaron como leídas.', 'info', 2000);
    }
  },

  updateNotificationBadge() {
    const user = Auth.getCurrentUser();
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    if (!user) {
      badge.style.display = 'none';
      return;
    }

    const notifs = window.appStore.getNotifications(user.id);
    const unread = notifs.filter(n => !n.read).length;

    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  },

  openNotificationsModal() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const modal = document.getElementById('notificationsModal');
    const list = document.getElementById('notificationsList');
    if (!modal || !list) return;

    const notifs = window.appStore.getNotifications(user.id);

    if (notifs.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">🔔</div>
          No tienes notificaciones registradas en tu historial.
        </div>
      `;
    } else {
      list.innerHTML = notifs.map(n => `
        <div onclick="${n.taskId ? `App.openTaskDetailModal('${n.taskId}'); document.getElementById('notificationsModal').classList.remove('active');` : ''}" 
             style="padding: 0.9rem; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 0.75rem; align-items: flex-start; cursor: ${n.taskId ? 'pointer' : 'default'}; border-radius: var(--radius-sm); margin-bottom: 0.25rem; ${n.read ? 'opacity: 0.75;' : 'background: rgba(59, 130, 246, 0.08); font-weight: 500;'}"
             title="${n.taskId ? 'Clic para ver compromiso asociado' : ''}">
          <div style="font-size: 1.3rem; line-height: 1; flex-shrink: 0; margin-top: 2px;">
            ${n.type === 'danger' ? '🚨' : (n.type === 'warning' ? '⏰' : (n.type === 'success' ? '✅' : '📢'))}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${this.escapeHtml(n.title || '')}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem; line-height: 1.4;">${this.escapeHtml(n.message || '')}</div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 0.4rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>🕒 ${new Date(n.timestamp).toLocaleString()}</span>
              ${n.taskId ? '<span style="color: var(--primary); font-weight: 600;">· 🔍 Ver compromiso</span>' : ''}
              ${!n.read ? '<span style="color: var(--primary); font-weight: 700;">● No leída</span>' : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    modal.classList.add('active');
  },

  formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Hace un momento';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  openAuthModal(tab = 'login') {
    const modal = document.getElementById('authModal');
    document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'login') {
      document.getElementById('authTabLogin').classList.add('active');
      document.getElementById('loginFormContainer').style.display = 'block';
      document.getElementById('registerFormContainer').style.display = 'none';
    } else {
      document.getElementById('authTabRegister').classList.add('active');
      document.getElementById('loginFormContainer').style.display = 'none';
      document.getElementById('registerFormContainer').style.display = 'block';
    }

    modal.classList.add('active');
  },

  // ==========================================================================
  // USER PROFILE DROPDOWN (Abre hacia abajo y contiene botón Salir al fondo)
  // ==========================================================================
  toggleUserDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('userDropdownMenu');
    const trigger = document.getElementById('userProfileTrigger');
    if (!menu) return;

    const isOpen = menu.classList.contains('active');
    if (isOpen) {
      this.closeUserDropdown();
    } else {
      this.closeNotificationsDropdown();
      menu.classList.add('active');
      if (trigger) {
        trigger.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    }
  },

  closeUserDropdown() {
    const menu = document.getElementById('userDropdownMenu');
    const trigger = document.getElementById('userProfileTrigger');
    if (menu) menu.classList.remove('active');
    if (trigger) {
      trigger.classList.remove('active');
      trigger.setAttribute('aria-expanded', 'false');
    }
  },

  // ==========================================================================
  // PWA (PROGRESSIVE WEB APP) - INSTALACIÓN Y DESCARGA EN DISPOSITIVOS
  // ==========================================================================
  deferredPwaPrompt: null,

  initPwa() {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('✅ Service Worker ESFIM activo:', reg.scope);
        }).catch((err) => {
          console.warn('Registro de SW omitido o fallido:', err);
        });
      });
    }

    // Capturar evento nativo de instalación antes de que el navegador lo oculte
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;

      // Mostrar botón de descarga en barra superior
      const topbarBtn = document.getElementById('btnInstallPwa');
      if (topbarBtn) topbarBtn.style.display = 'inline-flex';

      const pwaText = document.getElementById('dropdownPwaText');
      if (pwaText) pwaText.textContent = '1-clic disponible';
    });

    // Evento de instalación exitosa
    window.addEventListener('appinstalled', () => {
      this.deferredPwaPrompt = null;
      const topbarBtn = document.getElementById('btnInstallPwa');
      if (topbarBtn) topbarBtn.style.display = 'none';

      const pwaText = document.getElementById('dropdownPwaText');
      if (pwaText) pwaText.textContent = 'Aplicación ya instalada';

      AlertsEngine.showToast('Aplicativo Instalado', 'El sistema ESFIM se ha instalado en tu dispositivo.', 'success');
    });
  },

  promptPwaInstall() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      AlertsEngine.showToast('Aplicativo Instalado', 'Ya estás utilizando la versión instalada del aplicativo.', 'info');
      return;
    }

    const modal = document.getElementById('pwaModal');
    const nativeSec = document.getElementById('pwaNativeSection');
    const iosSec = document.getElementById('pwaIosSection');

    if (this.deferredPwaPrompt) {
      if (nativeSec) nativeSec.style.display = 'block';
      if (iosSec) iosSec.style.display = 'none';
    } else {
      if (nativeSec) nativeSec.style.display = 'none';
      if (iosSec) iosSec.style.display = isIos ? 'flex' : 'none';
    }

    if (modal) modal.classList.add('active');
  },

  async executePwaPrompt() {
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      const choiceResult = await this.deferredPwaPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        AlertsEngine.showToast('Instalando', 'Descarga e instalación iniciada.', 'success');
      }
      this.deferredPwaPrompt = null;
      this.closePwaModal();
    } else {
      AlertsEngine.showToast('Instalación Manual', 'Usa las opciones del menú de tu navegador para añadir a la pantalla de inicio.', 'info');
    }
  },

  closePwaModal() {
    const modal = document.getElementById('pwaModal');
    if (modal) modal.classList.remove('active');
  },

  processImageToDataUrl(img, mode = 'smart', offsetYPercent = 15, zoom = 1.0, maxSize = 250, quality = 0.85) {
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext('2d');

    if (mode === 'fit') {
      // Fondo elegante tipo insignia naval para que la foto completa encaje sin deformarse
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, maxSize, maxSize);

      const scale = maxSize / Math.max(img.width, img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (maxSize - drawW) / 2;
      const dy = (maxSize - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      return canvas.toDataURL('image/jpeg', quality);
    }

    // Modo recorte: encuadre centrado o inteligente enfocado al rostro
    let cropSize = Math.min(img.width, img.height) / (zoom || 1.0);
    cropSize = Math.min(cropSize, Math.min(img.width, img.height));

    let sx = (img.width - cropSize) / 2;
    let sy = (img.height - cropSize) / 2;

    if (img.height > img.width) {
      // Foto vertical de celular: el rostro está típicamente en el tercio superior (12%-25%)
      const maxScrollY = img.height - cropSize;
      const pct = (mode === 'center') ? 50 : Math.max(0, Math.min(100, offsetYPercent));
      sy = maxScrollY * (pct / 100);
    } else if (img.width > img.height) {
      // Foto horizontal
      const maxScrollX = img.width - cropSize;
      const pct = (mode === 'center') ? 50 : Math.max(0, Math.min(100, offsetYPercent));
      sx = maxScrollX * (pct / 100);
    }

    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, maxSize, maxSize);
    return canvas.toDataURL('image/jpeg', quality);
  },

  compressImageFile(file, maxSize = 250, quality = 0.85, options = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('El archivo seleccionado no es una imagen válida.'));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const mode = options.mode || 'smart';
          const offset = options.offsetYPercent !== undefined ? options.offsetYPercent : 15;
          const dataUrl = App.processImageToDataUrl(img, mode, offset, options.zoom || 1.0, maxSize, quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      reader.readAsDataURL(file);
    });
  },

  async handlePhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.currentLoadedImage = img;
          this.currentCropMode = 'smart';
          this.currentCropOffsetY = 15;

          const dataUrl = this.processImageToDataUrl(img, 'smart', 15, 1.0, 250, 0.85);
          this.currentProfilePhoto = dataUrl;

          const preview = document.getElementById('profileAvatarPreview');
          const removeBtn = document.getElementById('btnRemoveProfilePhoto');
          const cropControls = document.getElementById('avatarCropControls');
          const slider = document.getElementById('avatarPositionSlider');
          const sliderVal = document.getElementById('avatarSliderVal');

          if (preview) {
            preview.textContent = '';
            preview.style.backgroundImage = `url("${dataUrl}")`;
          }
          if (removeBtn) removeBtn.style.display = 'inline-flex';
          if (cropControls) cropControls.style.display = 'block';
          if (slider) slider.value = 15;
          if (sliderVal) sliderVal.textContent = '15%';

          this.updateCropButtonsUI('smart');
          AlertsEngine.showToast('Foto Cargada con Éxito', 'Rostro encuadrado automáticamente. Puedes usar los botones de ajuste para perfeccionarlo.', 'success');
        };
        img.onerror = () => AlertsEngine.showToast('Error', 'No se pudo decodificar la imagen.', 'danger');
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error al procesar foto:', err);
      AlertsEngine.showToast('Error', err.message || 'No se pudo cargar la imagen.', 'danger');
    }
  },

  setCropMode(mode) {
    if (!this.currentLoadedImage) return;
    this.currentCropMode = mode;
    this.updateCropButtonsUI(mode);

    const sliderRow = document.getElementById('avatarSliderRow');
    const slider = document.getElementById('avatarPositionSlider');
    const sliderVal = document.getElementById('avatarSliderVal');

    if (mode === 'fit') {
      if (sliderRow) sliderRow.style.display = 'none';
    } else {
      if (sliderRow) sliderRow.style.display = 'flex';
      const offset = (mode === 'center') ? 50 : 15;
      this.currentCropOffsetY = offset;
      if (slider) slider.value = offset;
      if (sliderVal) sliderVal.textContent = `${offset}%`;
    }

    const dataUrl = this.processImageToDataUrl(
      this.currentLoadedImage,
      mode,
      this.currentCropOffsetY,
      1.0,
      250,
      0.85
    );
    this.currentProfilePhoto = dataUrl;

    const preview = document.getElementById('profileAvatarPreview');
    if (preview) {
      preview.textContent = '';
      preview.style.backgroundImage = `url("${dataUrl}")`;
    }
  },

  handlePositionSlider(val) {
    if (!this.currentLoadedImage) return;
    const num = parseInt(val, 10) || 0;
    this.currentCropOffsetY = num;
    const sliderVal = document.getElementById('avatarSliderVal');
    if (sliderVal) sliderVal.textContent = `${num}%`;

    const dataUrl = this.processImageToDataUrl(
      this.currentLoadedImage,
      this.currentCropMode || 'smart',
      num,
      1.0,
      250,
      0.85
    );
    this.currentProfilePhoto = dataUrl;

    const preview = document.getElementById('profileAvatarPreview');
    if (preview) {
      preview.textContent = '';
      preview.style.backgroundImage = `url("${dataUrl}")`;
    }
  },

  updateCropButtonsUI(activeMode) {
    const btnFace = document.getElementById('btnCropFace');
    const btnCenter = document.getElementById('btnCropCenter');
    const btnFit = document.getElementById('btnCropFit');

    if (btnFace) btnFace.classList.toggle('active', activeMode === 'smart');
    if (btnCenter) btnCenter.classList.toggle('active', activeMode === 'center');
    if (btnFit) btnFit.classList.toggle('active', activeMode === 'fit');
  },

  removeProfilePhoto() {
    this.currentProfilePhoto = '';
    this.currentLoadedImage = null;
    const user = Auth.getCurrentUser() || (window.appStore && window.appStore.getCurrentUser());
    const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
    const preview = document.getElementById('profileAvatarPreview');
    const removeBtn = document.getElementById('btnRemoveProfilePhoto');
    const cropControls = document.getElementById('avatarCropControls');
    const input = document.getElementById('profilePhotoInput');

    if (preview) {
      preview.style.backgroundImage = 'none';
      preview.textContent = initials;
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (cropControls) cropControls.style.display = 'none';
    if (input) input.value = '';
    AlertsEngine.showToast('Foto Removida', 'Se restablecieron las iniciales. Guarde los cambios para confirmar.', 'info');
  },

  // 📷 Trigger 1-click photo upload directly from user dropdown
  triggerDirectProfilePhotoUpload() {
    this.closeUserDropdown();
    const input = document.getElementById('directProfilePhotoInput');
    if (input) {
      input.value = '';
      input.click();
    }
  },

  async handleDirectProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));

    try {
      AlertsEngine.showToast('Subiendo Foto', 'Optimizando foto para tu perfil...', 'info');
      const dataUrl = await this.compressImageFile(file, 250, 0.85);

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ avatar: dataUrl })
      });

      const data = await res.json();
      if (data.success && data.user) {
        const updatedUser = data.user;
        if (window.appStore) {
          window.appStore.setCurrentUser(updatedUser);
          if (window.appStore.updateUser) {
            window.appStore.updateUser(updatedUser.id || updatedUser._id, updatedUser);
          }
        }
        sessionStorage.setItem('efim_user', JSON.stringify(updatedUser));
        localStorage.setItem('efim_user', JSON.stringify(updatedUser));

        Auth.updateUserUI();
        this.refreshCurrentView();

        AlertsEngine.showToast(
          'Foto de Avatar Actualizada',
          'Tu nueva foto se ha guardado exitosamente y ya se refleja en todo el sistema.',
          'success'
        );
      } else {
        AlertsEngine.showToast('Error', data.message || 'No se pudo guardar la foto.', 'danger');
      }
    } catch (err) {
      console.error('Error al subir foto de perfil:', err);
      AlertsEngine.showToast('Error', 'No se pudo actualizar la foto de perfil.', 'danger');
    }
  },

  openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    const user = Auth.getCurrentUser() || (window.appStore && window.appStore.getCurrentUser());
    if (!user) {
      AlertsEngine.showToast('Sesión Requerida', 'Debe iniciar sesión para ver su perfil.', 'warning');
      return;
    }

    const nameInput = document.getElementById('profileNameInput');
    const emailInput = document.getElementById('profileEmailInput');
    const roleDisplay = document.getElementById('profileRoleDisplay');
    const newPassInput = document.getElementById('profileNewPassInput');
    const confirmPassInput = document.getElementById('profileConfirmPassInput');
    const preview = document.getElementById('profileAvatarPreview');
    const removeBtn = document.getElementById('btnRemoveProfilePhoto');
    const photoInput = document.getElementById('profilePhotoInput');

    this.currentProfilePhoto = user.avatar || null;
    if (photoInput) photoInput.value = '';

    const isPhoto = user.avatar && (
      user.avatar.startsWith('data:image/') ||
      user.avatar.startsWith('http://') ||
      user.avatar.startsWith('https://') ||
      user.avatar.startsWith('/')
    );
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';

    if (preview) {
      if (isPhoto) {
        preview.textContent = '';
        preview.style.backgroundImage = `url("${user.avatar}")`;
      } else {
        preview.style.backgroundImage = 'none';
        preview.textContent = user.avatar || initials;
      }
    }
    if (removeBtn) {
      removeBtn.style.display = isPhoto ? 'inline-flex' : 'none';
    }
    const cropControls = document.getElementById('avatarCropControls');
    if (cropControls) cropControls.style.display = 'none';

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleDisplay) {
      roleDisplay.value = user.role === 'admin' 
        ? '🎖️ Decano / Mando Directivo (Administrador)' 
        : '👨‍🏫 Docente Investigador';
    }
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';

    modal.classList.add('active');
  },

  async handleProfileSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    const name = document.getElementById('profileNameInput')?.value.trim();
    const email = document.getElementById('profileEmailInput')?.value.trim();
    const newPassword = document.getElementById('profileNewPassInput')?.value.trim();
    const confirmPassword = document.getElementById('profileConfirmPassInput')?.value.trim();

    if (!name || !email) {
      AlertsEngine.showToast('Datos Incompletos', 'Nombre y correo institucional son obligatorios.', 'warning');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      AlertsEngine.showToast('Contraseña Corta', 'La nueva contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      AlertsEngine.showToast('Contraseña No Coincide', 'La confirmación de la contraseña no coincide.', 'warning');
      return;
    }

    const token = (window.appStore && window.appStore.getToken) ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Guardando...';
      }

      const payload = {
        name,
        email,
        newPassword: newPassword || undefined
      };

      if (this.currentProfilePhoto !== undefined) {
        payload.avatar = this.currentProfilePhoto;
      }

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.user) {
        const updatedUser = data.user;
        if (window.appStore) {
          window.appStore.setCurrentUser(updatedUser);
          if (window.appStore.updateUser) {
            window.appStore.updateUser(updatedUser.id || updatedUser._id, updatedUser);
          }
        }
        sessionStorage.setItem('efim_user', JSON.stringify(updatedUser));
        localStorage.setItem('efim_user', JSON.stringify(updatedUser));

        Auth.updateUserUI();
        this.refreshCurrentView();
        document.getElementById('profileModal')?.classList.remove('active');

        AlertsEngine.showToast(
          'Perfil Actualizado',
          `Las credenciales y foto de perfil para ${updatedUser.name} han sido guardadas con éxito.`,
          'success'
        );
      } else {
        AlertsEngine.showToast('Error', data.message || 'No se pudieron actualizar las credenciales.', 'danger');
      }
    } catch (err) {
      console.error('Error actualizando credenciales:', err);
      AlertsEngine.showToast('Error de Red', 'No se pudo conectar con el servidor para actualizar el perfil.', 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '💾 Guardar Credenciales';
      }
    }
  }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
