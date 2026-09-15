const fs = require("fs");
const path = require("path");
const Task = require("../models/Task");
const User = require("../models/User");
const { sendNotificationPush } = require("./push");

const NOTIFS_FILE = path.join(__dirname, "../data/notifications.json");

function loadNotifications() {
  try {
    return fs.existsSync(NOTIFS_FILE)
      ? JSON.parse(fs.readFileSync(NOTIFS_FILE, "utf8"))
      : [];
  } catch (error) {
    console.error("Error leyendo notificaciones para recordatorios:", error.message);
    return [];
  }
}

function saveNotifications(notifications) {
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifications.slice(0, 300), null, 2));
}

function getTaskTargetValues(task) {
  const values = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
  return values
    .filter(Boolean)
    .flatMap(value => typeof value === "object"
      ? [value.id, value._id, value.email].filter(Boolean).map(String)
      : [String(value)])
    .filter(value => value.toLowerCase() !== "all");
}

async function resolveInvolvedUsers(task) {
  const targetValues = getTaskTargetValues(task);
  const assignedToAll = (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo])
    .some(value => String(value || "").toLowerCase() === "all");
  const filters = [];
  if (assignedToAll) filters.push({ role: "employee", isActive: true });
  if (targetValues.length) {
    filters.push({ email: { $in: targetValues.map(value => value.toLowerCase()) } });
    const ids = targetValues.filter(value => /^[a-f0-9]{24}$/i.test(value));
    if (ids.length) filters.push({ _id: { $in: ids } });
  }
  if (task.createdBy) filters.push({ _id: task.createdBy });
  return filters.length ? User.find({ $or: filters, isActive: true }).select("_id email name role").lean() : [];
}

async function sendDueDateReminders() {
  const now = Date.now();
  const lowerBound = new Date(now + 71 * 60 * 60 * 1000);
  const upperBound = new Date(now + 72 * 60 * 60 * 1000);
  const tasks = await Task.find({
    dueDate: { $gt: lowerBound, $lte: upperBound },
    status: { $nin: ["completado", "archivado"] },
    isArchived: { $ne: true },
    isDraft: { $ne: true }
  }).lean();
  if (!tasks.length) return 0;

  const notifications = loadNotifications();
  let created = 0;
  for (const task of tasks) {
    const notificationId = `deadline-reminder-${task._id}-${new Date(task.dueDate).getTime()}`;
    if (notifications.some(notification => notification.id === notificationId)) continue;

    const users = await resolveInvolvedUsers(task);
    const targets = users.map(user => user._id.toString());
    const notification = {
      id: notificationId,
      title: "⏰ Recordatorio: faltan 3 días",
      message: `El plazo del compromiso "${task.title}" vence en aproximadamente 3 días.`,
      type: "reminder",
      taskId: task._id.toString(),
      targetUserIds: targets,
      targetUserId: targets.length ? null : "employee",
      targetRole: targets.length ? null : "employee",
      metadata: { reminder: "three_days_before_due_date", dueDate: task.dueDate },
      createdBy: { id: "system", name: "Sistema ESFIM", role: "system" },
      timestamp: new Date().toISOString(),
      read: false,
      readBy: []
    };
    notifications.unshift(notification);
    saveNotifications(notifications);
    try {
      await sendNotificationPush(notification);
    } catch (error) {
      console.error(`Error enviando push para la tarea ${task._id}:`, error.message);
    }
    created += 1;
  }
  return created;
}

module.exports = { sendDueDateReminders };
