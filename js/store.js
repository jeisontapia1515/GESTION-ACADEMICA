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

    // Validar sesión con token JWT y límite de inactividad de 5 minutos
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
    const token = this.getToken();
    const lastActivity = sessionStorage.getItem('efim_last_activity') || localStorage.getItem('efim_last_activity');
    const now = Date.now();
    const isInactive = !lastActivity || (now - parseInt(lastActivity, 10)) > INACTIVITY_TIMEOUT_MS;

    const authUser = sessionStorage.getItem('efim_user') || localStorage.getItem('efim_user');
    if (token && authUser && !isInactive) {
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
    sessionStorage.removeItem('efim_last_activity');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem('efim_user');
    localStorage.removeItem('efim_token');
    localStorage.removeItem('efim_last_activity');
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
    const isDraft = Boolean(taskData.isDraft || taskData.status === 'borrador');
    let newTask = {
      id: tempId,
      createdAt: new Date().toISOString(),
      progress: 0,
      status: isDraft ? 'borrador' : 'pendiente',
      isDraft: isDraft,
      issueReport: null,
      comments: [],
      checklist: taskData.checklist || [],
      assigneeProgress: [],
      ...taskData
    };

    if (!isDraft) {
      this.ensureAssigneeProgress(newTask);
    }

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
          body: JSON.stringify(newTask)
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

    if (isDraft) {
      this.addNotification({
        targetUserId: 'admin',
        targetRole: 'admin',
        title: '📝 Borrador Guardado',
        message: `La tarea "${newTask.title}" se guardó en borrador. Queda lista para asignar cuando se determine a quién le compete.`,
        type: 'info',
        taskId: newTask.id
      });
      return newTask;
    }

    // Notificaciones para los docentes asignados y para la Decanatura (Gestor/Decano)
    const targetUserIds = Array.isArray(newTask.assignedTo) ? newTask.assignedTo : [newTask.assignedTo].filter(Boolean);
    const areaName = window.DECANATURA_AREAS && newTask.area ? window.DECANATURA_AREAS[newTask.area]?.name : 'Investigación';
    const dueDateStr = newTask.dueDate ? new Date(newTask.dueDate).toLocaleString('es-CO') : 'Sin definir';

    targetUserIds.forEach(uId => {
      this.addNotification({
        targetUserId: uId,
        targetRole: 'employee',
        title: '📋 Nuevo Compromiso Asignado',
        message: `Jefatura le ha asignado la tarea "${newTask.title}" (${areaName}) con fecha límite ${dueDateStr}.`,
        type: 'info',
        taskId: newTask.id
      });
    });

    const isPlenary = newTask.area === 'decanatura' || targetUserIds.length > 2;
    const namesList = targetUserIds.map(id => {
      const u = this.getUserById(id);
      return u ? u.name : id;
    }).join(', ');

    // Notificación de compromiso delegado para Decanatura
    this.addNotification({
      targetUserId: 'admin',
      targetRole: 'admin',
      title: isPlenary ? '🏛️ Tarea Plenaria de Decanatura Delegada' : '📋 Tarea Delegada',
      message: `Se delegó el compromiso "${newTask.title}" (${areaName}) a: ${namesList || 'docentes seleccionados'}. Plazo: ${dueDateStr}.`,
      type: isPlenary ? 'warning' : 'info',
      taskId: newTask.id
    });

    return newTask;
  }

  // Ensure individual progress tracking records exist for all assignees in a task
  ensureAssigneeProgress(task) {
    if (!task) return [];
    if (!Array.isArray(task.assigneeProgress)) {
      task.assigneeProgress = [];
    }

    let targetDocentes = [];
    if (task.assignedTo === 'all') {
      targetDocentes = this.getEmployees();
    } else if (Array.isArray(task.assignedTo)) {
      targetDocentes = task.assignedTo.map(item => {
        if (typeof item === 'object' && item && item.email) return item;
        const raw = typeof item === 'object' && item ? (item.id || item._id || item.email) : item;
        return this.getUserById(raw) || { id: raw, name: String(raw).split('@')[0], email: raw };
      }).filter(Boolean);
    } else if (task.assignedTo) {
      const single = typeof task.assignedTo === 'object' ? task.assignedTo : (this.getUserById(task.assignedTo) || { id: task.assignedTo, name: 'Docente', email: task.assignedTo });
      targetDocentes = [single];
    }

    const templateChecklist = Array.isArray(task.checklist) ? task.checklist.map(c => ({
      id: c.id,
      text: c.text,
      completed: false
    })) : [];

    targetDocentes.forEach(doc => {
      const dId = String(doc.id || doc._id || doc.email || '').toLowerCase();
      const dEmail = String(doc.email || '').toLowerCase();
      let entry = task.assigneeProgress.find(ap => {
        const apId = String(ap.userId || '').toLowerCase();
        const apEmail = String(ap.userEmail || '').toLowerCase();
        return (dId && apId === dId) || (dEmail && apEmail === dEmail);
      });

      if (!entry) {
        task.assigneeProgress.push({
          userId: doc.id || doc._id || doc.email,
          userName: doc.name || 'Docente Investigador',
          userEmail: doc.email || '',
          avatar: doc.avatar || (doc.name ? doc.name.slice(0, 2).toUpperCase() : 'DC'),
          progress: 0,
          status: 'pendiente',
          checklist: templateChecklist.map(item => ({ ...item })),
          lastNote: '',
          updatedAt: new Date().toISOString()
        });
      } else {
        if (!Array.isArray(entry.checklist)) {
          entry.checklist = templateChecklist.map(item => ({ ...item }));
        } else {
          templateChecklist.forEach(chk => {
            if (!entry.checklist.some(ec => ec.id === chk.id)) {
              entry.checklist.push({ ...chk });
            }
          });
        }
      }
    });

    return task.assigneeProgress;
  }

  // Get user's individual progress inside a task
  getUserTaskProgress(task, user) {
    if (!task) return { progress: 0, status: 'pendiente', checklist: [], lastNote: '' };
    if (!user) return { progress: task.progress || 0, status: task.status || 'pendiente', checklist: task.checklist || [], lastNote: '' };

    this.ensureAssigneeProgress(task);

    const uIds = [user.id, user._id, user.email].filter(Boolean).map(x => String(x).toLowerCase());
    const entry = (task.assigneeProgress || []).find(ap => {
      const apId = String(ap.userId || '').toLowerCase();
      const apEmail = String(ap.userEmail || '').toLowerCase();
      return uIds.includes(apId) || (apEmail && uIds.includes(apEmail));
    });

    if (entry) {
      return entry;
    }

    return {
      progress: task.progress || 0,
      status: task.status || 'pendiente',
      checklist: task.checklist || [],
      lastNote: ''
    };
  }

  // Assign or delegate a draft task to selected docentes
  async assignDraftTask(taskId, targetDocentes, extraOptions = {}) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const assignedIds = targetDocentes.map(d => d.id || d._id || d.email);
    if (assignedIds.length === 0) return null;

    const updates = {
      assignedTo: assignedIds.length === 1 ? assignedIds[0] : assignedIds,
      isDraft: false,
      status: 'pendiente',
      updatedAt: new Date().toISOString()
    };

    if (extraOptions.dueDate) {
      updates.dueDate = new Date(extraOptions.dueDate).toISOString();
    }
    if (extraOptions.priority) {
      updates.priority = extraOptions.priority;
    }
    if (extraOptions.area) {
      updates.area = extraOptions.area;
    }

    task.assignedTo = updates.assignedTo;
    this.ensureAssigneeProgress(task);
    updates.assigneeProgress = task.assigneeProgress;

    const updated = this.updateTask(taskId, updates);

    // Dispatch notifications
    const areaName = window.DECANATURA_AREAS && updated.area ? window.DECANATURA_AREAS[updated.area]?.name : 'Investigación';
    const dueDateStr = updated.dueDate ? new Date(updated.dueDate).toLocaleString('es-CO') : 'Sin definir';

    assignedIds.forEach(uId => {
      this.addNotification({
        targetUserId: uId,
        targetRole: 'employee',
        title: '📋 Nuevo Compromiso Asignado',
        message: `La Decanatura le ha asignado la tarea "${updated.title}" (${areaName}) con fecha límite ${dueDateStr}.`,
        type: 'info',
        taskId: updated.id
      });
    });

    const isPlenary = updated.area === 'decanatura' || assignedIds.length > 2;
    const namesList = targetDocentes.map(d => d.name || d.email).join(', ');

    this.addNotification({
      targetUserId: 'admin',
      targetRole: 'admin',
      title: isPlenary ? '🏛️ Tarea Plenaria Delegada' : '📋 Tarea Delegada',
      message: `El borrador "${updated.title}" ha sido asignado a: ${namesList}. Plazo: ${dueDateStr}.`,
      type: isPlenary ? 'warning' : 'info',
      taskId: updated.id
    });

    return updated;
  }

  // Toggle checklist item for user (maintaining individual checklist in group tasks)
  toggleUserChecklistItem(taskId, checkId, completed, targetUser = null) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const user = targetUser || this.getCurrentUser();
    this.ensureAssigneeProgress(task);

    const isGroup = task.area === 'decanatura' || task.assignedTo === 'all' || (Array.isArray(task.assignedTo) && task.assignedTo.length > 1) || (task.assigneeProgress && task.assigneeProgress.length > 1);

    const uIds = user ? [user.id, user._id, user.email].filter(Boolean).map(x => String(x).toLowerCase()) : [];
    const entry = (task.assigneeProgress || []).find(ap => {
      const apId = String(ap.userId || '').toLowerCase();
      const apEmail = String(ap.userEmail || '').toLowerCase();
      return uIds.includes(apId) || (apEmail && uIds.includes(apEmail));
    });

    let individualProgress = 0;
    let completedItemText = '';

    if (entry && isGroup) {
      entry.checklist = entry.checklist || [];
      const item = entry.checklist.find(c => c.id === checkId);
      if (item) {
        item.completed = completed;
        completedItemText = item.text;
      }
      const completedCount = entry.checklist.filter(c => c.completed).length;
      individualProgress = entry.checklist.length > 0 ? Math.round((completedCount / entry.checklist.length) * 100) : 0;
      entry.progress = individualProgress;
      entry.status = individualProgress === 100 ? 'completado' : (individualProgress > 0 ? 'en_progreso' : 'pendiente');
      entry.updatedAt = new Date().toISOString();
      if (individualProgress === 100) entry.completedAt = new Date().toISOString();

      // Recalculate team average
      const sum = task.assigneeProgress.reduce((acc, curr) => acc + (curr.progress || 0), 0);
      const avg = Math.round(sum / task.assigneeProgress.length);
      const allCompleted = task.assigneeProgress.every(a => a.progress === 100);

      const updates = {
        assigneeProgress: task.assigneeProgress,
        progress: avg,
        status: allCompleted ? 'completado' : (avg > 0 ? 'en_progreso' : 'pendiente')
      };

      if (allCompleted) updates.completedAt = new Date().toISOString();

      this.updateTask(taskId, updates);

      const userName = user ? user.name : 'Un docente';
      if (completed) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: individualProgress === 100 ? '✅ Entregables Completados por Docente' : '☑️ Entregable Individual Cumplido',
          message: `${userName} completó "${completedItemText}" en "${task.title}" (Avance propio: ${individualProgress}%, Promedio grupal: ${avg}%).`,
          type: individualProgress === 100 ? 'success' : 'info',
          taskId: task.id
        });
      }

      return { task, userProgress: individualProgress, teamProgress: avg };
    } else {
      // Single-user or global checklist fallback
      task.checklist = task.checklist || [];
      const item = task.checklist.find(c => c.id === checkId);
      if (item) {
        item.completed = completed;
        completedItemText = item.text;
      }
      const completedCount = task.checklist.filter(c => c.completed).length;
      const progress = task.checklist.length > 0 ? Math.round((completedCount / task.checklist.length) * 100) : 0;

      const updates = {
        checklist: task.checklist,
        progress: progress
      };
      if (progress === 100) {
        updates.status = 'completado';
        updates.completedAt = new Date().toISOString();
      } else if (progress > 0 && task.status === 'pendiente') {
        updates.status = 'en_progreso';
      }

      if (entry) {
        entry.checklist = task.checklist;
        entry.progress = progress;
        entry.status = updates.status || entry.status;
        entry.updatedAt = new Date().toISOString();
        updates.assigneeProgress = task.assigneeProgress;
      }

      this.updateTask(taskId, updates);

      const userName = user ? user.name : 'Un docente';
      if (completed) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: progress === 100 ? '✅ Tarea Completada al 100%' : '☑️ Entregable Cumplido',
          message: `${userName} completó el entregable "${completedItemText}" en "${task.title}" (Progreso: ${progress}%).`,
          type: progress === 100 ? 'success' : 'info',
          taskId: task.id
        });
      }

      return { task, userProgress: progress, teamProgress: progress };
    }
  }

  // Update Task Progress Percentage directly
  updateTaskProgress(taskId, progressPercentage, progressNote = '') {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const currentUser = this.getCurrentUser();
    const prevProgress = task.progress || 0;
    const newProgress = Math.min(100, Math.max(0, parseInt(progressPercentage, 10)));
    const userName = currentUser ? currentUser.name : 'Un docente';

    this.ensureAssigneeProgress(task);

    const isGroup = task.area === 'decanatura' || task.assignedTo === 'all' || (Array.isArray(task.assignedTo) && task.assignedTo.length > 1) || (task.assigneeProgress && task.assigneeProgress.length > 1);

    const uIds = currentUser ? [currentUser.id, currentUser._id, currentUser.email].filter(Boolean).map(x => String(x).toLowerCase()) : [];
    const entry = (task.assigneeProgress || []).find(ap => {
      const apId = String(ap.userId || '').toLowerCase();
      const apEmail = String(ap.userEmail || '').toLowerCase();
      return uIds.includes(apId) || (apEmail && uIds.includes(apEmail));
    });

    const updates = {};

    if (entry && isGroup && currentUser && currentUser.role !== 'admin') {
      // Individual employee updating their own progress in a group task
      const prevUserProgress = entry.progress || 0;
      entry.progress = newProgress;
      entry.lastNote = progressNote || '';
      entry.updatedAt = new Date().toISOString();
      entry.status = newProgress === 100 ? 'completado' : (newProgress > 0 ? 'en_progreso' : 'pendiente');
      if (newProgress === 100) entry.completedAt = new Date().toISOString();

      // Recalculate team average
      const sum = task.assigneeProgress.reduce((acc, curr) => acc + (curr.progress || 0), 0);
      const avg = Math.round(sum / task.assigneeProgress.length);
      const allDone = task.assigneeProgress.every(a => a.progress === 100);

      updates.progress = avg;
      updates.assigneeProgress = task.assigneeProgress;
      updates.status = allDone ? 'completado' : (avg > 0 ? 'en_progreso' : 'pendiente');
      if (allDone) updates.completedAt = new Date().toISOString();

      const commentText = progressNote
        ? `[AVANCE INDIVIDUAL - ${userName}: ${newProgress}%]: ${progressNote}`
        : `[AVANCE INDIVIDUAL - ${userName}]: Progreso personal actualizado del ${prevUserProgress}% al ${newProgress}%.`;

      task.comments = task.comments || [];
      task.comments.push({
        id: 'c-' + Date.now(),
        authorId: currentUser.id || currentUser._id,
        authorName: userName,
        text: commentText,
        timestamp: new Date().toISOString(),
        type: 'general'
      });
      updates.comments = task.comments;

      const updated = this.updateTask(taskId, updates);

      // Notify Decanatura of this specific docente's individual advance
      if (newProgress === 100) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: '✅ Docente Completó su Compromiso al 100%',
          message: `${userName} cumplió el 100% en la tarea grupal "${task.title}". Promedio grupal general: ${avg}%.`,
          type: 'success',
          taskId: task.id
        });
      } else if (newProgress !== prevUserProgress || progressNote) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: `📈 Avance Individual de ${userName}: ${newProgress}%`,
          message: `${userName} reportó ${newProgress}% de avance en "${task.title}". (Promedio global del equipo: ${avg}%)${progressNote ? `: "${progressNote}"` : '.'}`,
          type: 'info',
          taskId: task.id
        });
      }

      return updated;
    } else {
      // Single task or admin setting progress
      updates.progress = newProgress;
      if (newProgress === 100) {
        updates.status = 'completado';
        updates.completedAt = new Date().toISOString();
      } else if (newProgress > 0 && task.status === 'pendiente') {
        updates.status = 'en_progreso';
      }

      if (entry) {
        entry.progress = newProgress;
        entry.lastNote = progressNote || '';
        entry.updatedAt = new Date().toISOString();
        entry.status = updates.status || entry.status;
        if (newProgress === 100) entry.completedAt = new Date().toISOString();
        updates.assigneeProgress = task.assigneeProgress;
      }

      const commentText = progressNote 
        ? `[ACTUALIZACIÓN DE AVANCE: ${newProgress}%]: ${progressNote}`
        : `[AVANCE REGISTRADO]: Progreso actualizado del ${prevProgress}% al ${newProgress}%.`;

      task.comments = task.comments || [];
      task.comments.push({
        id: 'c-' + Date.now(),
        authorId: currentUser ? currentUser.id : 'unknown',
        authorName: userName,
        text: commentText,
        timestamp: new Date().toISOString(),
        type: 'general'
      });
      updates.comments = task.comments;

      const updated = this.updateTask(taskId, updates);

      // Notificar a Decanatura ante cada actualización de avance realizada
      if (newProgress === 100) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: '✅ Compromiso Cumplido al 100%',
          message: `${userName} ha reportado el cumplimiento del 100% en: "${task.title}".`,
          type: 'success',
          taskId: task.id
        });
      } else if (newProgress !== prevProgress || progressNote) {
        this.addNotification({
          targetUserId: 'admin',
          targetRole: 'admin',
          title: `📈 Avance Registrado: ${newProgress}%`,
          message: `${userName} registró un avance del ${newProgress}% en "${task.title}"${progressNote ? `: "${progressNote}"` : '.'}`,
          type: 'info',
          taskId: task.id
        });
      }

      return updated;
    }
  }

  // Add Comment or Reminder
  addComment(taskId, commentText, type = 'general') {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const currentUser = this.getCurrentUser();
    const newComment = {
      id: 'c-' + Date.now(),
      authorId: currentUser ? (currentUser.id || currentUser._id) : 'unknown',
      authorName: currentUser ? currentUser.name : 'Usuario',
      text: commentText,
      timestamp: new Date().toISOString(),
      type: type // 'general' | 'reminder' | 'issue-report' | 'resolution'
    };

    task.comments = task.comments || [];
    task.comments.push(newComment);

    this.updateTask(taskId, { comments: task.comments });

    // Si es recordatorio emitido por la Jefatura
    if (type === 'reminder') {
      const targetUserIds = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo].filter(Boolean);
      targetUserIds.forEach(uId => {
        this.addNotification({
          targetUserId: uId,
          targetRole: 'employee',
          title: '⚠️ Recordatorio Oficial de Jefatura',
          message: `La Decanatura le recuerda sobre "${task.title}": "${commentText}"`,
          type: 'warning',
          taskId: task.id
        });
      });
      // Registro para el panel de Decano / Gestor
      this.addNotification({
        targetUserId: 'admin',
        targetRole: 'admin',
        title: '⏰ Recordatorio Despachado',
        message: `Se emitió recordatorio para "${task.title}": "${commentText}"`,
        type: 'warning',
        taskId: task.id
      });
    } else if (type === 'general' && commentText) {
      // Notificar a la contraparte
      const isAdmin = currentUser && currentUser.role === 'admin';
      this.addNotification({
        targetUserId: isAdmin ? (task.assignedTo || 'all') : 'admin',
        targetRole: isAdmin ? 'employee' : 'admin',
        title: `💬 Observación en "${task.title}"`,
        message: `${currentUser ? currentUser.name : 'Usuario'}: "${commentText.substring(0, 100)}"`,
        type: 'info',
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
        title: '🚨 Dificultad Reportada por Docente',
        message: `${currentUser ? currentUser.name : 'Un docente'} reportó una dificultad en el compromiso "${task.title}": ${issueDescription}`,
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
      authorName: currentUser ? currentUser.name : 'Decanatura',
      text: `[DIFICULTAD RESUELTA POR DECANATURA]: ${resolutionNote}${newDueDate ? ` (Nueva fecha límite: ${new Date(newDueDate).toLocaleString()})` : ''}`,
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
      title: '✅ Dificultad Verificada y Resuelta por Decanatura',
      message: `La Decanatura ha verificado y resuelto tu reporte en "${task.title}": ${resolutionNote}`,
      type: 'success',
      taskId: task.id
    });

    return updated;
  }

  // Sincronización de notificaciones con el servidor institucional
  async syncNotificationsFromServer() {
    const token = this.getToken();
    if (!token) return this.getNotifications();
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data.notifications));
        if (window.App && window.App.updateNotificationBadge) {
          window.App.updateNotificationBadge();
        }
        return data.notifications;
      }
    } catch (e) {
      console.warn('No se pudieron sincronizar notificaciones del servidor:', e);
    }
    return this.getNotifications();
  }

  // Notifications
  getNotifications(userId) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const list = data ? JSON.parse(data) : [];
    const currentUser = this.getCurrentUser();
    const isAdmin = currentUser && currentUser.role === 'admin';
    const targetId = String(userId || (currentUser ? (currentUser.id || currentUser._id) : '')).toLowerCase().trim();
    const targetEmail = currentUser && currentUser.email ? currentUser.email.toLowerCase().trim() : '';

    if (!targetId && !isAdmin) return list;

    return list.filter(n => {
      // El Decano y el Gestor ven todas las notificaciones institucionales de tareas delegadas y actividades de Decanatura
      if (isAdmin) {
        return true;
      }

      const notifTarget = String(n.targetUserId || '').toLowerCase().trim();
      const notifRole = String(n.targetRole || '').toLowerCase().trim();

      if (notifTarget === 'all' || notifRole === 'all' || notifRole === 'employee') return true;
      if (notifTarget === targetId || (targetEmail && notifTarget === targetEmail)) return true;
      if (Array.isArray(n.targetUserId) && n.targetUserId.some(id => String(id).toLowerCase().trim() === targetId || (targetEmail && String(id).toLowerCase().trim() === targetEmail))) return true;
      if (Array.isArray(n.targetUserIds) && n.targetUserIds.some(id => String(id).toLowerCase().trim() === targetId || (targetEmail && String(id).toLowerCase().trim() === targetEmail))) return true;
      return false;
    });
  }

  addNotification(notif) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const list = data ? JSON.parse(data) : [];
    const newNotif = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      read: false,
      ...notif
    };
    list.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list.slice(0, 100)));

    // Persistir en servidor backend en segundo plano
    const token = this.getToken();
    if (token) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newNotif)
      }).catch(e => console.warn('Error persistiendo notificacion en servidor:', e));
    }

    if (window.App && window.App.updateNotificationBadge) {
      window.App.updateNotificationBadge();
    }

    return newNotif;
  }

  markNotificationsAsRead(userId) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    let list = data ? JSON.parse(data) : [];
    list = list.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));

    const token = this.getToken();
    if (token) {
      fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(e => console.warn('Error marcando leidas en servidor:', e));
    }
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

    const token = this.getToken();
    if (token && notifId) {
      fetch(`/api/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(e => console.warn('Error marcando leida en servidor:', e));
    }
  }
}

// Global Store Instance
window.appStore = new AppStore();
