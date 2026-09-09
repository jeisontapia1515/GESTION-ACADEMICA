const express = require("express");
const { protect } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const DATA_DIR = path.join(__dirname, "../data");
const NOTIFS_FILE = path.join(DATA_DIR, "notifications.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadNotifications() {
  try {
    if (fs.existsSync(NOTIFS_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFS_FILE, "utf8"));
    }
  } catch (e) {
    console.warn("Error leyendo notifications.json:", e.message);
  }
  return [];
}

function saveNotifications(notifs) {
  try {
    fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifs.slice(0, 300), null, 2));
  } catch (e) {
    console.error("Error guardando notifications.json:", e.message);
  }
}

// GET /api/notifications
router.get("/", protect, (req, res) => {
  const allNotifs = loadNotifications();
  const user = req.user;
  const uid = user._id ? user._id.toString() : (user.id || "");
  const uEmail = (user.email || "").toLowerCase().trim();
  const isAdmin = user.role === "admin";

  const filtered = allNotifs.filter(n => {
    if (isAdmin) {
      // El Decano y el Gestor ven todas las actividades de Decanatura, tareas delegadas y notificaciones
      return true;
    }
    // Docente / empleado ve las que le pertenecen
    const target = String(n.targetUserId || "").toLowerCase().trim();
    const targetRole = String(n.targetRole || "").toLowerCase().trim();
    if (target === "all" || targetRole === "all" || targetRole === "employee") return true;
    if (target === uid || target === uEmail) return true;
    if (Array.isArray(n.targetUserIds) && (n.targetUserIds.includes(uid) || n.targetUserIds.includes(uEmail))) return true;
    return false;
  });

  res.json({ success: true, notifications: filtered });
});

// POST /api/notifications
router.post("/", protect, (req, res) => {
  const { title, message, type, taskId, targetUserId, targetUserIds, targetRole, metadata } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: "Título y mensaje requeridos." });
  }

  const allNotifs = loadNotifications();
  const newNotif = {
    id: "notif-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    title,
    message,
    type: type || "info",
    taskId: taskId || null,
    targetUserId: targetUserId || "all",
    targetUserIds: Array.isArray(targetUserIds) ? targetUserIds : [],
    targetRole: targetRole || null,
    metadata: metadata || {},
    createdBy: {
      id: req.user._id ? req.user._id.toString() : req.user.id,
      name: req.user.name,
      role: req.user.role
    },
    timestamp: new Date().toISOString(),
    read: false,
    readBy: []
  };

  allNotifs.unshift(newNotif);
  saveNotifications(allNotifs);

  res.status(201).json({ success: true, notification: newNotif });
});

// PUT /api/notifications/:id/read
router.put("/:id/read", protect, (req, res) => {
  const allNotifs = loadNotifications();
  const notifId = req.params.id;
  const uid = req.user._id ? req.user._id.toString() : req.user.id;

  let found = false;
  allNotifs.forEach(n => {
    if (n.id === notifId) {
      n.read = true;
      if (!Array.isArray(n.readBy)) n.readBy = [];
      if (!n.readBy.includes(uid)) n.readBy.push(uid);
      found = true;
    }
  });

  if (found) {
    saveNotifications(allNotifs);
    return res.json({ success: true, message: "Notificación marcada como leída." });
  }
  res.status(404).json({ success: false, message: "Notificación no encontrada." });
});

// PUT /api/notifications/read-all
router.put("/read-all", protect, (req, res) => {
  const allNotifs = loadNotifications();
  const uid = req.user._id ? req.user._id.toString() : req.user.id;

  allNotifs.forEach(n => {
    n.read = true;
    if (!Array.isArray(n.readBy)) n.readBy = [];
    if (!n.readBy.includes(uid)) n.readBy.push(uid);
  });

  saveNotifications(allNotifs);
  res.json({ success: true, message: "Todas las notificaciones marcadas como leídas." });
});

module.exports = router;
