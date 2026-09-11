require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static assets (css, js, images) but NOT html files directly
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/img", express.static(path.join(__dirname, "img")));
app.use("/fonts", express.static(path.join(__dirname, "fonts")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/tasks",         require("./routes/tasks"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/push",          require("./routes/push"));
app.use("/api",               require("./routes/email"));

// PWA Manifest and Service Worker
app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(path.join(__dirname, "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "sw.js"));
});

// Block direct access to index.html (must go through /app)
app.get("/index.html", (req, res) => res.redirect("/"));

// Login page (public)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "login.html")));

// Dashboard (requires JWT on client side)
app.get("/app", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/efim_decanatura";

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log("MongoDB conectado:", mongoose.connection.host);
    await seedInitialData();
    startServer();
  })
  .catch(err => {
    console.error("MongoDB no disponible:", err.message);
    startServer();
  });

function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log("Servidor EFIM en http://localhost:" + PORT);
  });
}

async function seedInitialData() {
  const User = require("./models/User");
  try {
    // Sincronizar o crear cuenta de Gestor (Eduardo Puello) con contraseña de plataforma diefi2026
    let gestor = await User.findOne({ email: "eduardo.puello@esfim.edu.co" });
    if (!gestor) {
      gestor = new User({
        name: "Eduardo Puello",
        email: "eduardo.puello@esfim.edu.co",
        password: "diefi2026",
        role: "admin",
        department: "Decanatura de Investigación - ESFIM",
        avatar: "EP",
        isActive: true
      });
      await gestor.save();
      console.log("Gestor creado con credenciales autorizadas (eduardo.puello@esfim.edu.co / diefi2026)");
    } else {
      gestor.password = "diefi2026";
      gestor.role = "admin";
      await gestor.save();
      console.log("Gestor sincronizado con contraseña de plataforma diefi2026.");
    }

    const count = await User.countDocuments();
    if (count > 1) { console.log(count + " usuarios en BD."); return; }

    const decano = await User.findOne({ email: "juan.perdomo@esfim.edu.co" });
    if (!decano) {
      const doc = new User({
        name: "Juan Perdomo",
        email: "juan.perdomo@esfim.edu.co",
        password: process.env.INITIAL_ADMIN_PASSWORD || "decanatura2026*",
        role: "admin",
        department: "Decanatura de Investigación - ESFIM",
        avatar: "JP",
        isActive: true
      });
      await doc.save();
      console.log("Decano inicial creado:", doc.email);
    }
    console.log("Inicialización lista: Cuentas de Decano y Gestor verificadas.");
  } catch (err) {
    console.error("Error en seedInitialData:", err.message);
  }
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Error interno." });
});
