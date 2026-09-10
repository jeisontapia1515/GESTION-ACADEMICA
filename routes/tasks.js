const express = require("express");
const Task = require("../models/Task");
const { protect, adminOnly } = require("../middleware/auth");
const router = express.Router();

// En-memory version tracker for zero-cost polling across multi-user sessions
let tasksVersion = Date.now();

function touchTasksVersion() {
  tasksVersion = Date.now();
}

// GET /api/tasks/version - Lightweight heartbeat check (0 MongoDB queries)
router.get("/version", (req, res) => {
  res.json({ success: true, version: tasksVersion });
});

// GET /api/tasks - Retrieve tasks (filtered by user role and archive status)
router.get("/", protect, async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    let filter = {};

    if (!includeArchived) {
      filter.isArchived = { $ne: true };
      filter.status = { $ne: "archivado" };
    }

    if (req.user.role === "employee") {
      filter.isDraft = { $ne: true };
      filter.status = { $nin: ["archivado", "borrador"] };

      const uid = req.user._id.toString();
      const uEmail = req.user.email ? req.user.email.toLowerCase() : "";
      const matches = [uid, req.user._id];
      if (uEmail) matches.push(uEmail);

      const userMatchCondition = {
        $or: [
          { assignedTo: { $in: matches } },
          { assignedTo: "all" },
          { "assignedTo.id": { $in: matches } },
          { "assignedTo._id": { $in: matches } },
          { "assignedTo.email": uEmail }
        ]
      };

      filter = { $and: [filter, userMatchCondition] };
    }

    const tasks = await Task.find(filter).sort({ dueDate: 1, createdAt: -1 });
    const formatted = tasks.map(t => {
      const obj = t.toJSON ? t.toJSON() : t.toObject();
      obj.id = obj._id ? obj._id.toString() : obj.id;
      return obj;
    });
    res.json({ success: true, tasks: formatted, version: tasksVersion });
  } catch (err) {
    console.error("Error al obtener tareas:", err);
    res.status(500).json({ success: false, message: "Error al obtener tareas." });
  }
});

// POST /api/tasks - Create task (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const taskData = { ...req.body };
    delete taskData._id;
    delete taskData.id;
    if (!taskData.area) taskData.area = "formativa";
    if (taskData.priority) taskData.priority = String(taskData.priority).toLowerCase().trim();
    const task = await Task.create({ ...taskData, createdBy: req.user._id });
    const obj = task.toJSON ? task.toJSON() : task.toObject();
    obj.id = obj._id ? obj._id.toString() : task._id.toString();
    touchTasksVersion();
    res.status(201).json({ success: true, task: obj });
  } catch (err) {
    console.error("Error al crear tarea:", err);
    res.status(500).json({ success: false, message: "Error al crear tarea: " + err.message });
  }
});

// POST /api/tasks/purge-completed - Permanently delete all completed/archived tasks to free MongoDB Atlas storage
router.post("/purge-completed", protect, adminOnly, async (req, res) => {
  try {
    const filter = {
      $or: [
        { status: "completado" },
        { status: "archivado" },
        { isArchived: true },
        { progress: 100 }
      ]
    };
    const result = await Task.deleteMany(filter);
    touchTasksVersion();
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Se depuraron y eliminaron ${result.deletedCount} tareas cumplidas de MongoDB.`
    });
  } catch (err) {
    console.error("Error al depurar tareas:", err);
    res.status(500).json({ success: false, message: "Error al depurar tareas cumplidas." });
  }
});

// PUT /api/tasks/:id/archive - Archive a completed task
router.put("/:id/archive", protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Tarea no encontrada." });

    task.isArchived = true;
    task.status = "archivado";
    task.updatedAt = new Date();
    await task.save();

    touchTasksVersion();
    const obj = task.toJSON ? task.toJSON() : task.toObject();
    obj.id = obj._id ? obj._id.toString() : task._id.toString();
    res.json({ success: true, task: obj, message: "Tarea archivada correctamente." });
  } catch (err) {
    console.error("Error al archivar tarea:", err);
    res.status(500).json({ success: false, message: "Error al archivar tarea." });
  }
});

// PUT /api/tasks/:id - Update task (progress, comments, checklist, status)
router.put("/:id", protect, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    delete updateData.id;
    if (updateData.priority) updateData.priority = String(updateData.priority).toLowerCase().trim();

    if (updateData.status === "completado" || updateData.progress === 100) {
      updateData.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ success: false, message: "Tarea no encontrada." });
    
    touchTasksVersion();
    const obj = task.toJSON ? task.toJSON() : task.toObject();
    obj.id = obj._id ? obj._id.toString() : task._id.toString();
    res.json({ success: true, task: obj });
  } catch (err) {
    console.error("Error al actualizar tarea:", err);
    res.status(500).json({ success: false, message: "Error al actualizar tarea." });
  }
});

// DELETE /api/tasks/:id - Permanently delete task
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    touchTasksVersion();
    res.json({ success: true, message: "Tarea eliminada de la base de datos." });
  } catch (err) {
    console.error("Error al eliminar tarea:", err);
    res.status(500).json({ success: false, message: "Error al eliminar tarea." });
  }
});

module.exports = router;