const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");
const router = express.Router();

// GET /api/users - All active users (authenticated users)
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select("-password").sort({ role: -1, name: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener usuarios." });
  }
});

// POST /api/users - Create new docente (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, area, department, avatar } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      if (!exists.isActive) {
        exists.name = name || exists.name;
        exists.isActive = true;
        if (role) exists.role = role;
        if (area) exists.area = area;
        if (department) exists.department = department;
        if (password) exists.password = password;
        if (avatar) exists.avatar = avatar;
        await exists.save();
        return res.status(200).json({ success: true, user: exists, message: "Docente reactivado e incorporado a la nómina institucional." });
      }
      return res.status(400).json({ success: false, message: "Ya existe una cuenta activa con este correo institucional." });
    }
    const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "US";
    const user = await User.create({ name, email, password: password || "Efim2025*Inicial", role: role || "employee", area: area || null, department: department || "Decanatura de Investigacion - EFIM", avatar: avatar || initials, mustChangePassword: !password });
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al crear usuario: " + err.message });
  }
});

// PUT /api/users/profile - Update own credentials and avatar photo (MUST be defined before /:id)
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword, avatar } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    // Validate email change
    if (email && email.toLowerCase().trim() !== user.email) {
      const formattedEmail = email.toLowerCase().trim();
      const emailTaken = await User.findOne({ email: formattedEmail, _id: { $ne: user._id } });
      if (emailTaken) {
        return res.status(400).json({ success: false, message: "Este correo institucional ya está en uso por otra cuenta." });
      }
      user.email = formattedEmail;
    }

    // Validate name change
    if (name && name.trim()) {
      user.name = name.trim();
    }

    // Validate avatar / photo change
    if (avatar !== undefined) {
      if (avatar && (avatar.startsWith("data:image/") || avatar.startsWith("http") || avatar.startsWith("/"))) {
        user.avatar = avatar;
      } else if (avatar === "" || avatar === null) {
        const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "US";
        user.avatar = initials;
      }
    } else if (!user.avatar || (!user.avatar.startsWith("data:image/") && !user.avatar.startsWith("http"))) {
      const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "US";
      user.avatar = initials;
    }

    // Validate password change
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ success: false, message: "La nueva contraseña debe tener mínimo 6 caracteres." });
      }
      if (currentPassword) {
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: "La contraseña actual no coincide." });
        }
      }
      user.password = newPassword.trim();
      user.mustChangePassword = false;
    }

    await user.save();
    res.json({ success: true, user: user.toJSON(), message: "Credenciales y foto de perfil actualizadas exitosamente." });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    res.status(500).json({ success: false, message: "Error al actualizar credenciales: " + err.message });
  }
});

// DELETE /api/users/:id - Soft delete (admin only, cannot delete self or last admin)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "ID de usuario inválido." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    if (user._id.toString() === req.user._id.toString()) return res.status(400).json({ success: false, message: "No puede eliminar su propia cuenta." });
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin", isActive: true });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: "No se puede eliminar el unico administrador." });
    }
    user.isActive = false;
    await user.save();
    res.json({ success: true, message: "Docente retirado correctamente." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al retirar usuario." });
  }
});

// PUT /api/users/:id/password - Change own password
router.put("/:id/password", protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "ID de usuario inválido." });
    }
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "No autorizado." });
    }
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    user.password = req.body.newPassword;
    user.mustChangePassword = false;
    await user.save();
    res.json({ success: true, message: "Contrasena actualizada." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al actualizar contrasena." });
  }
});

// PUT /api/users/:id - Update member details / photo by admin
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "ID de usuario inválido." });
    }
    const { name, email, role, area, department, avatar } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role) user.role = role;
    if (area !== undefined) user.area = area;
    if (department) user.department = department;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json({ success: true, user: user.toJSON(), message: "Datos y foto del docente actualizados." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al actualizar usuario: " + err.message });
  }
});

module.exports = router;
