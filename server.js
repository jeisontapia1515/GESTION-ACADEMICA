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

app.use("/api/auth",  require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api",       require("./routes/email"));

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
  const count = await User.countDocuments();
  if (count > 0) { console.log(count + " usuarios en BD."); return; }
  const admins = [
    {
      name: "Juan Perdomo",
      email: "juan.perdomo@esfim.edu.co",
      password: process.env.INITIAL_ADMIN_PASSWORD || "decanatura2026*",
      role: "admin",
      department: "Decanatura de Investigación - ESFIM",
      avatar: "JP"
    },
    {
      name: "Eduardo Puello",
      email: "eduardo.puello@esfim.edu.co",
      password: process.env.INITIAL_GESTOR_PASSWORD || "coordinador2026*",
      role: "admin",
      department: "Decanatura de Investigación - ESFIM",
      avatar: "EP"
    }
  ];
  for (const a of admins) {
    const doc = new User(a);
    await doc.save();
    console.log("Administrador inicial creado:", a.email);
  }
  console.log("Inicialización lista: Cuentas de Decano y Coordinador creadas.");
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Error interno." });
});
