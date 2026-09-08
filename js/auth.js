/* ==========================================================================
   GESTORPRO JEFATURA - AUTH & USER ROLES (js/auth.js)
   ========================================================================== */

const Auth = {
  init() {
    this.updateUserUI();
    this.renderDemoSwitcher();
  },

  getCurrentUser() {
    if (window.appStore) {
      return window.appStore.getCurrentUser();
    }
    const stored = sessionStorage.getItem('efim_user') || localStorage.getItem('efim_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u) u.id = u.id || u._id;
        return u;
      } catch(e) {}
    }
    return null;
  },

  login(email, password) {
    const users = window.appStore.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, message: 'Usuario no encontrado. Verifique el correo o regístrese.' };
    }

    if (user.password !== password) {
      return { success: false, message: 'Contraseña incorrecta.' };
    }

    window.appStore.setCurrentUser(user);
    this.updateUserUI();
    window.App.refreshCurrentView();

    AlertsEngine.showToast(
      'Sesión Iniciada',
      `Bienvenido(a), ${user.name} (${user.role === 'admin' ? 'Jefatura' : 'Empleado'})`,
      'success'
    );

    return { success: true, user };
  },

  register(userData) {
    const users = window.appStore.getUsers();
    const exists = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());

    if (exists) {
      return { success: false, message: 'Ya existe una cuenta con este correo electrónico.' };
    }

    const initials = userData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';

    const newUser = {
      id: (userData.role === 'admin' ? 'admin-' : 'emp-') + Date.now(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role, // 'admin' | 'employee'
      department: userData.department || (userData.role === 'admin' ? 'Jefatura de Operaciones' : 'Operaciones Generales'),
      avatar: initials
    };

    users.push(newUser);
    window.appStore.saveUsers(users);
    window.appStore.setCurrentUser(newUser);

    this.updateUserUI();
    this.renderDemoSwitcher();
    window.App.refreshCurrentView();

    AlertsEngine.showToast(
      'Registro Exitoso',
      `Cuenta creada correctamente para ${newUser.name}.`,
      'success'
    );

    return { success: true, user: newUser };
  },

  async switchUser(userId) {
    const user = window.appStore.getUserById(userId);
    if (!user) return;

    // Obtener token JWT aislado para esta pestaña
    const currentToken = window.appStore ? window.appStore.getToken() : (sessionStorage.getItem('efim_token') || localStorage.getItem('efim_token'));
    if (currentToken) {
      try {
        const res = await fetch('/api/auth/switch-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentToken
          },
          body: JSON.stringify({ userId: user.id || user._id, email: user.email })
        });
        const data = await res.json();
        if (data.success && data.token) {
          sessionStorage.setItem('efim_token', data.token);
        }
      } catch (err) {
        console.warn('Error al obtener token aislado para cambio de perfil:', err);
      }
    }

    window.appStore.setCurrentUser(user);
    this.updateUserUI();
    this.renderDemoSwitcher();
    window.App.refreshCurrentView();

    AlertsEngine.showToast(
      'Cambio de Perfil',
      `Ahora estás visualizando el sistema como: ${user.name} [${user.role === 'admin' ? 'Jefatura' : 'Empleado'}]`,
      'info'
    );
  },

  logout() {
    // Clear JWT session
    sessionStorage.removeItem('efim_token');
    sessionStorage.removeItem('efim_user');
    localStorage.removeItem('efim_token');
    localStorage.removeItem('efim_user');

    // Also clear appStore session
    if (window.appStore) window.appStore.clearCurrentUser();

    AlertsEngine.showToast(
      'Sesion Finalizada',
      'Ha cerrado sesion correctamente. Hasta pronto.',
      'info'
    );

    // Redirect to login after brief delay
    setTimeout(() => { window.location.replace('/'); }, 1200);
  },

  updateUserUI() {
    const user = this.getCurrentUser();
    const avatarEl = document.getElementById('topbarAvatar') || document.getElementById('userAvatar');
    const nameEl = document.getElementById('topbarUserName') || document.getElementById('userName');
    const roleEl = document.getElementById('topbarUserDept') || document.getElementById('userRole');
    const rolePill = document.getElementById('rolePill');
    const authActions = document.getElementById('authActions');
    const userMenu = document.getElementById('userProfileWrapper') || document.querySelector('.user-profile-wrapper') || document.querySelector('.user-profile-menu');
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownUserBadge = document.getElementById('dropdownUserBadge');
    const dropdownBtnEmail = document.getElementById('dropdownBtnEmail');

    const btnEmailConfig = document.getElementById('btnEmailConfig');

    if (!user) {
      if (userMenu) userMenu.style.display = 'none';
      if (btnEmailConfig) btnEmailConfig.style.display = 'none';
      if (authActions) authActions.style.display = 'flex';
      return;
    }

    if (userMenu) userMenu.style.display = 'inline-flex';
    if (authActions) authActions.style.display = 'none';

    // 🔒 El apartado de configuración de correo es EXCLUSIVO para Decano y Gestor (rol admin)
    const isAdmin = user.role === 'admin';
    if (btnEmailConfig) {
      btnEmailConfig.style.display = isAdmin ? 'inline-flex' : 'none';
    }
    if (dropdownBtnEmail) {
      dropdownBtnEmail.style.display = isAdmin ? 'flex' : 'none';
    }

    const uEmail = (user.email || '').toLowerCase();
    const uName = (user.name || '').toLowerCase();
    const isDecano = uEmail.includes('decano') || uName.includes('decano') || uName.includes('perdomo');

    const isPhoto = user.avatar && (
      user.avatar.startsWith('data:image/') ||
      user.avatar.startsWith('http://') ||
      user.avatar.startsWith('https://') ||
      user.avatar.startsWith('/') ||
      user.avatar.startsWith('blob:')
    );
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';

    [avatarEl, dropdownAvatar].forEach(el => {
      if (!el) return;
      if (isPhoto) {
        el.textContent = '';
        el.style.backgroundImage = `url("${user.avatar}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = user.avatar || initials;
      }
    });

    if (nameEl) {
      nameEl.textContent = user.name;
      nameEl.title = user.name;
    }
    if (dropdownUserName) dropdownUserName.textContent = user.name;
    if (dropdownUserEmail) dropdownUserEmail.textContent = user.email || 'correo@armada.mil.co';
    if (dropdownUserBadge) {
      dropdownUserBadge.textContent = isDecano ? '🛡️ Decano' : (isAdmin ? '📋 Gestor de Mando' : '🎓 Docente Investigador');
    }
    
    // Subtítulo de cargo compacto y estético
    if (roleEl) {
      if (isAdmin) {
        roleEl.textContent = isDecano ? 'Decano' : 'Gestor';
      } else {
        roleEl.textContent = 'Docente Investigador';
      }
      roleEl.title = isDecano ? 'Decano de Investigación' : (isAdmin ? 'Gestor / Coordinador de Investigación' : 'Docente Investigador');
    }

    if (rolePill) {
      if (isAdmin) {
        rolePill.className = 'role-pill admin';
        rolePill.innerHTML = isDecano ? `🛡️ DECANO` : `📋 GESTOR`;
      } else {
        rolePill.className = 'role-pill employee';
        const areaIcon = user.area && window.DECANATURA_AREAS[user.area] ? window.DECANATURA_AREAS[user.area].icon : '🎓';
        rolePill.innerHTML = `${areaIcon} DOCENTE`;
      }
    }
  },

  renderDemoSwitcher() {
    const container = document.getElementById('demoPillsContainer');
    if (!container) return;

    const current = this.getCurrentUser();
    const users = window.appStore.getUsers();

    container.innerHTML = '';
    users.forEach(u => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-demo-switch ${current && current.id === u.id ? 'active' : ''}`;
      
      let icon = '🎓';
      let areaLabel = 'Docente';
      if (u.role === 'admin') {
        icon = '🛡️';
        areaLabel = 'Decano';
      } else if (u.area && window.DECANATURA_AREAS[u.area]) {
        icon = window.DECANATURA_AREAS[u.area].icon;
        areaLabel = window.DECANATURA_AREAS[u.area].name;
      }

      btn.innerHTML = `${icon} ${u.name} <span style="opacity:0.75; font-size:0.7rem; margin-left:0.2rem;">[${areaLabel}]</span>`;
      btn.onclick = () => this.switchUser(u.id);
      container.appendChild(btn);
    });
  }
};

window.Auth = Auth;
