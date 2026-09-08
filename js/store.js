/* ==========================================================================
   GESTORPRO DECANATURA - STATE MANAGEMENT & STORAGE (js/store.js)
   Decanatura de Investigación - Escuela de Formación de Infantería de Marina
   ========================================================================== */

const STORAGE_KEYS = {
  USERS: 'gestorpro_users_decanatura',
  TASKS: 'gestorpro_tasks_decanatura',
  CURRENT_USER: 'gestorpro_current_user_decanatura',
  NOTIFICATIONS: 'gestorpro_notifications_decanatura'
};

// Áreas Estructuradas de la Decanatura de Investigación
const DECANATURA_AREAS = {
  formativa: {
    id: 'formativa',
    name: 'Investigación Formativa',
    subtitle: 'Semilleros de Investigación',
    icon: '🔬',
    badgeClass: 'badge-area-formativa'
  },
  aplicada: {
    id: 'aplicada',
    name: 'Investigación Aplicada',
    subtitle: 'Proyectos y Grupos de Investigación',
    icon: '🚀',
    badgeClass: 'badge-area-aplicada'
  },
  editorial: {
    id: 'editorial',
    name: 'Sello Editorial',
    subtitle: 'Libros y Revistas Científicas',
    icon: '📚',
    badgeClass: 'badge-area-editorial'
  },
  doctrina: {
    id: 'doctrina',
    name: 'Doctrina',
    subtitle: 'Manuales y Cartillas Doctrinarias',
    icon: '📜',
    badgeClass: 'badge-area-doctrina'
  },
  decanatura: {
    id: 'decanatura',
    name: 'Actividades de Decanatura',
    subtitle: 'Compromisos Generales y Plenarias Institucionales',
    icon: '🏛️',
    badgeClass: 'badge-area-decanatura'
  }
};
window.DECANATURA_AREAS = DECANATURA_AREAS;

// Usuarios Oficiales de la Decanatura de Investigación
const DEFAULT_USERS = [
  {
    id: 'admin-1',
    name: 'Juan Perdomo',
    email: 'juan.perdomo@esfim.edu.co',
    role: 'admin',
    department: 'Decanatura de Investigación - ESFIM',
    avatar: 'JP'
  },
  {
    id: 'admin-2',
    name: 'Eduardo Puello',
    email: 'eduardo.puello@esfim.edu.co',
    role: 'admin',
    department: 'Decanatura de Investigación - ESFIM',
    avatar: 'EP'
  }
];

// Helper to get formatted relative ISO dates
function getDateOffset(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const DEFAULT_TASKS = [];

class AppStore {
  constructor() {
    this.init();
  }

  init() {
    const existingUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!existingUsers) {
      this.saveUsers(DEFAULT_USERS);
    } else {
      try {
        const parsed = JSON.parse(existingUsers);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          this.saveUsers(DEFAULT_USERS);
        }
      } catch (e) {
        this.saveUsers(DEFAULT_USERS);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      this.saveTasks(DEFAULT_TASKS);
    }

    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      const initialNotifs = [
        {
          id: 'notif-welcome',
          targetUserId: 'all',
          title: '🛡️ Sistema de Gestión Académica Activo',
          message: 'Bienvenido al panel de control de la Decanatura de Investigación ESFIM. Las alertas y novedades se notificarán aquí.',
          type: 'info',
          read: false,
          timestamp: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initialNotifs));
    }
    
    // Token JWT helper (prioriza pestaña actual con sessionStorage)
    this.getToken = function() {
      return sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token');
    };

    // Validar sesion con token JWT
    const token = this.getToken();
    const authUser = sessionStorage.getItem('efim_user') || localStorage.getItem('efim_user');
    if (token && authUser) {
      try {
        this.setCurrentUser(JSON.parse(authUser));
      } catch (e) {
        this.clearCurrentUser();
      }
    } else {
      this.clearCurrentUser();
    }
  }

  resetData() {
    this.saveUsers(DEFAULT_USERS);
    this.saveTasks(DEFAULT_TASKS);
    this.setCurrentUser(DEFAULT_USERS[0]);
    const initialNotifs = [
      {
        id: 'notif-welcome',
        targetUserId: 'all',
        title: '🛡️ Sistema de Gestión Académica Activo',
        message: 'Bienvenido al panel de control de la Decanatura de Investigación ESFIM. Las alertas y novedades se notificarán aquí.',
        type: 'info',
        read: false,
        timestamp: new Date().toISOString()
      }
    ];
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initialNotifs));
  }

  // Users
  getUsers() {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : DEFAULT_USERS;
  }

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  getUserById(id) {
    if (!id) return null;
    const target = String(id).toLowerCase();
    return this.getUsers().find(u => 
      (u.id && String(u.id).toLowerCase() === target) ||
      (u._id && String(u._id).toLowerCase() === target) ||
      (u.email && String(u.email).toLowerCase() === target)
    );
  }

  getEmployees() {
    return this.getUsers().filter(u => u.role === 'employee');
  }

  createEmployee(employeeData) {
    const users = this.getUsers();
    const initials = employeeData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'DC';
    const newEmp = {
      id: 'doc-' + Date.now(),
      name: employeeData.name,
      email: employeeData.email,
      password: employeeData.password || '123',
      role: 'employee',
      area: employeeData.area || 'formativa',
      department: employeeData.department || 'Decanatura de Investigación',
      avatar: initials
    };
    users.push(newEmp);
    this.saveUsers(users);
    return newEmp;
  }

  deleteEmployee(employeeId) {
    let users = this.getUsers();
    const target = users.find(u => u.id === employeeId);
    if (!target) {
      return { success: false, error: 'Docente no encontrado.' };
    }
    if (target.role === 'admin') {
      return { success: false, error: 'No se puede eliminar la cuenta principal del Decano.' };
    }

    users = users.filter(u => u.id !== employeeId);
    this.saveUsers(users);

    // If active session is the deleted employee, restore to Decano
    const current = this.getCurrentUser();
    if (current && current.id === employeeId) {
      this.setCurrentUser(users[0]);
    }

    return { success: true, deleted: target };
  }

  updateUser(userId, partialData) {
    const users = this.getUsers();
    const target = String(userId).toLowerCase();
    const index = users.findIndex(u => 
      (u.id && String(u.id).toLowerCase() === target) ||
      (u._id && String(u._id).toLowerCase() === target) ||
      (u.email && String(u.email).toLowerCase() === target)
    );
    if (index === -1) return null;
    users[index] = { ...users[index], ...partialData };
    this.saveUsers(users);

    const current = this.getCurrentUser();
    if (current && (
      (current.id && String(current.id).toLowerCase() === target) ||
      (current._id && String(current._id).toLowerCase() === target) ||
      (current.email && String(current.email).toLowerCase() === target)
    )) {
      this.setCurrentUser(users[index]);
    }
    return users[index];
  }

  // Current Session (Aislado por pestaña con sessionStorage)
  getCurrentUser() {
    const authUser = sessionStorage.getItem('efim_user') || localStorage.getItem('efim_user');
    if (authUser) {
      try {
        const u = JSON.parse(authUser);
        if (u) {
          u.id = u.id || u._id;
          return u;
        }
      } catch(e) {}
    }
    const data = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) return null;
    try {
      const u = JSON.parse(data);
      if (u) u.id = u.id || u._id;
      return u;
    } catch(e) { return null; }
  }

  setCurrentUser(user) {
    if (user) {
      user.id = user.id || user._id;
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      sessionStorage.setItem('efim_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      sessionStorage.removeItem('efim_user');
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('efim_user');
    }
  }

  clearCurrentUser() {
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    sessionStorage.removeItem('efim_user');
    sessionStorage.removeItem('efim_token');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem('efim_user');
    localStorage.removeItem('efim_token');
  }

  // Tasks
  getTasks() {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  }

  saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  getTaskById(id) {
    if (!id) return null;
    const sId = String(id);
    return this.getTasks().find(t => String(t.id) === sId || String(t._id) === sId);
  }

  lastKnownTasksVersion = 0;

  async syncTasksFromServer(includeArchived = false) {
    const token = this.getToken();
    if (!token) return this.getTasks();
    try {
      const res = await fetch(`/api/tasks${includeArchived ? '?includeArchived=true' : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        if (data.version) this.lastKnownTasksVersion = data.version;
        const mapped = data.tasks.map(t => ({
          ...t,
          id: t.id || (t._id ? t._id.toString() : 'task-' + Date.now())
        }));
        this.saveTasks(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('No se pudo sincronizar tareas desde el servidor:', e);
    }
    return this.getTasks();
  }

  async checkAndSyncIfOutdated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/tasks/version');
      const data = await res.json();
      if (data.success && data.version && data.version !== this.lastKnownTasksVersion) {
        await this.syncTasksFromServer();
        return true;
      }
    } catch (e) {}
    return false;
  }

  async archiveTask(id) {
    const sId = String(id);
    const target = this.getTasks().find(t => String(t.id) === sId || String(t._id) === sId);
    if (!target) return null;

    target.isArchived = true;
    target.status = 'archivado';
    const remaining = this.getTasks().filter(t => String(t.id) !== sId && String(t._id) !== sId);
    this.saveTasks(remaining);

    const token = this.getToken();
    const realId = target._id || target.id;
    if (token && realId && !String(realId).startsWith('task-')) {
      try {
        await fetch(`/api/tasks/${realId}/archive`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      } catch(e) {
        console.warn('Error archivando tarea en servidor:', e);
      }
    }
    return target;
  }

  async purgeCompletedTasks() {
    const token = this.getToken();
    let deletedCount = 0;
    if (token) {
      try {
        const res = await fetch('/api/tasks/purge-completed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        deletedCount = data.deletedCount || 0;
      } catch (e) {
        console.warn('Error purgando tareas en servidor:', e);
      }
    }
    const activeTasks = this.getTasks().filter(t => t.status !== 'completado' && t.status !== 'archivado' && !t.isArchived && (t.progress || 0) < 100);
    this.saveTasks(activeTasks);
    return { success: true, deletedCount };
  }

  async createTask(taskData) {
    const tasks = this.getTasks();
    const tempId = 'task-' + Date.now();
    let newTask = {
      id: tempId,
      createdAt: new Date().toISOString(),
      progress: 0,
      status: 'pendiente',
      issueReport: null,
      comments: [],
      ...taskData
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);

    // Persist to MongoDB backend if authenticated
    const token = this.getToken();
    if (token) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(taskData)
        });
        const data = await res.json();
        if (data.success && data.task) {
          const serverTask = {
            ...data.task,
            id: data.task.id || data.task._id.toString()
          };
          const currentTasks = this.getTasks();
          const idx = currentTasks.findIndex(t => t.id === tempId);
          if (idx !== -1) {
            currentTasks[idx] = serverTask;
            this.saveTasks(currentTasks);
          }
          newTask = serverTask;
        }
      } catch (err) {
        console.warn('Error al persistir tarea en backend:', err);
      }
    }

    // Create notifications for assigned employee(s)
    const targetUserIds = Array.isArray(newTask.assignedTo) ? newTask.assignedTo : [newTask.assignedTo].filter(Boolean);
    targetUserIds.forEach(uId => {
      this.addNotification({
        targetUserId: uId,
        title: 'Nueva Tarea Asignada',
        message: `Jefatura ha asignado el compromiso: "${newTask.title}" con fecha límite ${new Date(newTask.dueDate).toLocaleString('es-CO')}.`,
        type: 'info',
        taskId: newTask.id
      });
    });

    return newTask;
  }

  updateTask(id, updates) {
    const tasks = this.getTasks();
    const sId = String(id);
    const index = tasks.findIndex(t => String(t.id) === sId || String(t._id) === sId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates };
      this.saveTasks(tasks);

      // Persist to MongoDB backend if authenticated
      const token = this.getToken();
      const realId = tasks[index]._id || tasks[index].id;
      if (token && realId && !String(realId).startsWith('task-')) {
        fetch(`/api/tasks/${realId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        }).catch(e => console.warn('Error actualizando tarea en servidor:', e));
      }

      return tasks[index];
    }
    return null;
  }

  deleteTask(id) {
    const sId = String(id);
    const target = this.getTasks().find(t => String(t.id) === sId || String(t._id) === sId);
    const tasks = this.getTasks().filter(t => String(t.id) !== sId && String(t._id) !== sId);
    this.saveTasks(tasks);

    const token = this.getToken();
    const realId = target ? (target._id || target.id) : id;
    if (token && realId && !String(realId).startsWith('task-')) {
      fetch(`/api/tasks/${realId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(e => console.warn('Error eliminando tarea en servidor:', e));
    }
  }

  // Update Task Progress Percentage directly
  updateTaskProgress(taskId, progressPercentage, progressNote = '') {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const prevProgress = task.progress || 0;
    const newProgress = Math.min(100, Math.max(0, parseInt(progressPercentage, 10)));
    const updates = { progress: newProgress };

    if (newProgress === 100) {
      updates.status = 'completado';
    } else if (newProgress > 0 && task.status === 'pendiente') {
      updates.status = 'en_progreso';
    }

    const currentUser = this.getCurrentUser();
    const commentText = progressNote 
      ? `[ACTUALIZACIÓN DE AVANCE: ${newProgress}%]: ${progressNote}`
      : `[AVANCE REGISTRADO]: Progreso actualizado del ${prevProgress}% al ${newProgress}%.`;

    task.comments = task.comments || [];
    task.comments.push({
      id: 'c-' + Date.now(),
      authorId: currentUser ? currentUser.id : 'unknown',
      authorName: currentUser ? currentUser.name : 'Empleado',
      text: commentText,
      timestamp: new Date().toISOString(),
      type: 'general'
    });
    updates.comments = task.comments;

    const updated = this.updateTask(taskId, updates);

    // If completed or significant milestone, notify admins
    if (newProgress === 100) {
      const admins = this.getUsers().filter(u => u.role === 'admin');
      admins.forEach(admin => {
        this.addNotification({
          targetUserId: admin.id,
          title: '✅ Tarea Cumplida al 100%',
          message: `${currentUser ? currentUser.name : 'El empleado'} ha reportado el cumplimiento del 100% en: "${task.title}".`,
          type: 'success',
          taskId: task.id
        });
      });
    }

    return updated;
  }

  // Add Comment or Reminder
  addComment(taskId, commentText, type = 'general') {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const currentUser = this.getCurrentUser();
    const newComment = {
      id: 'c-' + Date.now(),
      authorId: currentUser ? currentUser.id : 'unknown',
      authorName: currentUser ? currentUser.name : 'Usuario',
      text: commentText,
      timestamp: new Date().toISOString(),
      type: type // 'general' | 'reminder' | 'issue-report' | 'resolution'
    };

    task.comments = task.comments || [];
    task.comments.push(newComment);

    this.updateTask(taskId, { comments: task.comments });

    // If type is reminder, send targeted notification
    if (type === 'reminder') {
      this.addNotification({
        targetUserId: task.assignedTo,
        title: '⚠️ Recordatorio de Jefatura',
        message: `El Administrador ha enviado un recordatorio para: "${task.title}": "${commentText}"`,
        type: 'warning',
        taskId: task.id
      });
    }

    return newComment;
  }

  // Report Issue by Employee
  reportIssue(taskId, issueType, issueDescription) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const currentUser = this.getCurrentUser();
    const issueReport = {
      reportedAt: new Date().toISOString(),
      reportedBy: currentUser ? currentUser.name : 'Empleado',
      type: issueType,
      description: issueDescription,
      status: 'revision_pendiente'
    };

    const comment = {
      id: 'c-' + Date.now(),
      authorId: currentUser ? currentUser.id : 'unknown',
      authorName: currentUser ? currentUser.name : 'Empleado',
      text: `[PROBLEMA REPORTADO - ${issueType}]: ${issueDescription}`,
      timestamp: new Date().toISOString(),
      type: 'issue-report'
    };

    task.comments = task.comments || [];
    task.comments.push(comment);

    // Update task with issue and mark as blocked/needs review
    const updated = this.updateTask(taskId, {
      issueReport: issueReport,
      status: 'bloqueado',
      comments: task.comments
    });

    // Notify Administrator
    const admins = this.getUsers().filter(u => u.role === 'admin');
    admins.forEach(admin => {
      this.addNotification({
        targetUserId: admin.id,
        title: '🚨 Obstáculo Reportado por Empleado',
        message: `${currentUser ? currentUser.name : 'Un empleado'} reportó un problema en la tarea "${task.title}": ${issueDescription}`,
        type: 'danger',
        taskId: task.id
      });
    });

    return updated;
  }

  // Resolve Issue by Admin
  resolveIssue(taskId, resolutionNote, newDueDate = null) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const currentUser = this.getCurrentUser();
    const updates = {
      status: 'en_progreso',
      issueReport: null
    };

    if (newDueDate) {
      updates.dueDate = newDueDate;
    }

    const comment = {
      id: 'c-' + Date.now(),
      authorId: currentUser ? currentUser.id : 'admin-1',
      authorName: currentUser ? currentUser.name : 'Jefatura',
      text: `[PROBLEMA RESUELTO POR JEFATURA]: ${resolutionNote}${newDueDate ? ` (Nueva fecha límite: ${new Date(newDueDate).toLocaleString()})` : ''}`,
      timestamp: new Date().toISOString(),
      type: 'resolution'
    };

    task.comments = task.comments || [];
    task.comments.push(comment);
    updates.comments = task.comments;

    const updated = this.updateTask(taskId, updates);

    // Notify assigned employee
    this.addNotification({
      targetUserId: task.assignedTo,
      title: '✅ Problema Verificado y Resuelto por Jefatura',
      message: `Jefatura ha verificado y resuelto tu reporte en "${task.title}": ${resolutionNote}`,
      type: 'success',
      taskId: task.id
    });

    return updated;
  }

  // Notifications
  getNotifications(userId) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const list = data ? JSON.parse(data) : [];
    if (!userId) return list;
    return list.filter(n => n.targetUserId === userId || n.targetUserId === 'all' || (Array.isArray(n.targetUserId) && n.targetUserId.includes(userId)));
  }

  addNotification(notif) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const list = data ? JSON.parse(data) : [];
    const newNotif = {
      id: 'notif-' + Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notif
    };
    list.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list.slice(0, 50)));
    return newNotif;
  }

  markNotificationsAsRead(userId) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    let list = data ? JSON.parse(data) : [];
    list = list.map(n => {
      if (!userId || n.targetUserId === userId || n.targetUserId === 'all' || (Array.isArray(n.targetUserId) && n.targetUserId.includes(userId))) {
        return { ...n, read: true };
      }
      return n;
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  }

  markNotificationAsRead(notifId) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    let list = data ? JSON.parse(data) : [];
    list = list.map(n => {
      if (n.id === notifId) {
        return { ...n, read: true };
      }
      return n;
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  }
}

// Global Store Instance
window.appStore = new AppStore();
