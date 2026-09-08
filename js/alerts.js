/* ==========================================================================
   GESTORPRO JEFATURA - ALERTS & NOTIFICATION ENGINE (js/alerts.js)
   ========================================================================== */

const AlertsEngine = {
  // Synthesize Web Audio chime without needing external mp3 files
  playChime(type = 'info') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'reminder') {
        // High attention dual beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc1.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.15); // C6
        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.35);
      } else if (type === 'danger') {
        // Urgent alert
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else {
        // Pleasant confirmation ding
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback not permitted without user gesture yet', e);
    }
  },

  // Calculate detailed date alert status
  getTaskAlertStatus(task) {
    if (task.status === 'completed') {
      return {
        level: 'completed',
        label: 'Completada',
        badgeClass: 'badge-status-completed',
        isOverdue: false,
        hoursRemaining: null,
        formattedRemaining: 'Finalizada'
      };
    }

    if (task.issueReport && task.issueReport.status === 'pending_review') {
      return {
        level: 'issue',
        label: 'Problema Reportado',
        badgeClass: 'badge-alert issue-reported',
        isOverdue: false,
        hasIssue: true,
        formattedRemaining: 'Requiere Verificación'
      };
    }

    const now = new Date();
    const due = new Date(task.dueDate);
    const diffMs = due - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs <= 0) {
      const overdueHours = Math.abs(diffHours);
      return {
        level: 'danger',
        label: '¡Vencida!',
        badgeClass: 'badge-alert overdue',
        isOverdue: true,
        hoursRemaining: diffHours,
        formattedRemaining: `Venció hace ${overdueHours > 24 ? Math.floor(overdueHours / 24) + 'd' : overdueHours + 'h'}`
      };
    }

    if (diffHours < 24) {
      return {
        level: 'warning',
        label: 'Vence Hoy',
        badgeClass: 'badge-alert due-soon',
        isDueSoon: true,
        hoursRemaining: diffHours,
        formattedRemaining: `Quedan ${diffHours}h ${diffMinutes}m`
      };
    }

    if (diffHours < 48) {
      return {
        level: 'warning-soft',
        label: 'Vence Mañana',
        badgeClass: 'badge-alert due-soon',
        isDueSoon: true,
        hoursRemaining: diffHours,
        formattedRemaining: `Quedan ~${diffHours}h`
      };
    }

    const days = Math.floor(diffHours / 24);
    return {
      level: 'ontrack',
      label: 'En Plazo',
      badgeClass: 'badge-alert on-track',
      isOverdue: false,
      hoursRemaining: diffHours,
      formattedRemaining: `${days} días restantes`
    };
  },

  // Display toast notification
  showToast(title, message, type = 'info', duration = 4500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    this.playChime(type);

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '🔔';
    if (type === 'danger') icon = '🚨';
    if (type === 'warning') icon = '⚠️';
    if (type === 'success') icon = '✅';
    if (type === 'reminder') icon = '⏰';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" title="Cerrar">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  },

  // Generate top alerts summary for Admin and Employee
  renderAlertBanners(tasks, containerId, isEmployee = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const overdueTasks = tasks.filter(t => t.status !== 'completed' && this.getTaskAlertStatus(t).level === 'danger');
    const dueTodayTasks = tasks.filter(t => t.status !== 'completed' && this.getTaskAlertStatus(t).level === 'warning');
    const issueTasks = tasks.filter(t => t.issueReport && t.issueReport.status === 'pending_review');

    // Overdue Alert Banner
    if (overdueTasks.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'alert-banner danger fade-in';
      banner.innerHTML = `
        <div class="alert-banner-left">
          <span style="font-size: 1.25rem;">🚨</span>
          <div>
            <strong>ALERTA DE RETRASO:</strong> Hay <strong>${overdueTasks.length}</strong> ${overdueTasks.length === 1 ? 'tarea vencida' : 'tareas vencidas'} fuera del plazo establecido.
          </div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="filterByAlert('danger')">Ver Tareas Vencidas</button>
      `;
      container.appendChild(banner);
    }

    // Issues Reported Banner
    if (issueTasks.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'alert-banner issue fade-in';
      banner.innerHTML = `
        <div class="alert-banner-left">
          <span style="font-size: 1.25rem;">🛑</span>
          <div>
            <strong>PROBLEMAS REPORTADOS:</strong> Hay <strong>${issueTasks.length}</strong> ${issueTasks.length === 1 ? 'tarea con reporte de bloqueo' : 'tareas con bloqueos'} que requieren verificación de Jefatura.
          </div>
        </div>
        <button class="btn btn-sm btn-warning" onclick="filterByAlert('issue')">Ver Obstáculos</button>
      `;
      container.appendChild(banner);
    }

    // Due Soon Banner
    if (dueTodayTasks.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'alert-banner warning fade-in';
      banner.innerHTML = `
        <div class="alert-banner-left">
          <span style="font-size: 1.25rem;">⏳</span>
          <div>
            <strong>PLAZO INMINENTE:</strong> Hay <strong>${dueTodayTasks.length}</strong> ${dueTodayTasks.length === 1 ? 'tarea que vence hoy' : 'tareas que vencen en menos de 24 horas'}.
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="filterByAlert('warning')">Revisar Urgentes</button>
      `;
      container.appendChild(banner);
    }
  }
};

window.AlertsEngine = AlertsEngine;
