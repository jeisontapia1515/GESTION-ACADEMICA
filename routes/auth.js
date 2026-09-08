const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Correo y contrasena son requeridos." });
    }
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas. Verifique su correo y contrasena." });
    }
    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/switch-token (allows switching token for demo / testing between Decano and Docentes in isolated tabs)
router.post("/switch-token", protect, async (req, res) => {
  try {
    const lookup = req.body.userId || req.body.email || req.body.id;
    let target = null;
    if (lookup) {
      try { target = await User.findById(lookup); } catch(e) {}
      if (!target) {
        target = await User.findOne({ email: String(lookup).toLowerCase() });
      }
    }
    if (!target) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    const token = signToken(target._id);
    res.json({ success: true, token, user: target.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al generar token de cambio." });
  }
});

module.exports = router;
