const express = require("express");
const { protect } = require("../middleware/auth");
const router = express.Router();
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch(e) {}
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "../data");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");
const CONFIG_FILE = path.join(DATA_DIR, "email_config.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadEmails() { try { return fs.existsSync(EMAILS_FILE) ? JSON.parse(fs.readFileSync(EMAILS_FILE, "utf8")) : []; } catch(e) { return []; } }
function saveEmails(e) { try { fs.writeFileSync(EMAILS_FILE, JSON.stringify(e.slice(0, 300), null, 2)); } catch(err) {} }

function normalizeConfig(raw) {
  const c = raw || {};
  let decano = c.decano || {};
  let gestor = c.gestor || {};
  // Compatibilidad hacia atras si era una sola cuenta
  if (!c.decano && !c.gestor && c.host) {
    decano = {
      host: c.host,
      port: c.port || 587,
      secure: Boolean(c.secure),
      user: c.user || "",
      pass: c.pass || "",
      fromAddress: c.fromAddress || c.user || "",
      fromName: c.fromName || "Decano de Investigación - ESFIM"
    };
  }
  return {
    decano: {
      host: decano.host || "smtp.office365.com",
      port: parseInt(decano.port) || 587,
      secure: Boolean(decano.secure),
      user: decano.user || "",
      pass: decano.pass || "",
      fromAddress: decano.fromAddress || decano.user || "",
      fromName: decano.fromName || "Decano de Investigación - ESFIM"
    },
    gestor: {
      host: gestor.host || "smtp.office365.com",
      port: parseInt(gestor.port) || 587,
      secure: Boolean(gestor.secure),
      user: gestor.user || "",
      pass: gestor.pass || "",
      fromAddress: gestor.fromAddress || gestor.user || "",
      fromName: gestor.fromName || "Gestor / Coordinador de Investigación - ESFIM"
    }
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")));
    }
  } catch(e) {}
  return normalizeConfig({});
}

function saveConfig(c) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
    cachedTransporters = {};
    cachedSignatures = {};
  } catch(err) {}
}

let cachedTransporters = {};
let cachedSignatures = {};

function getTransporterForAccount(accountCfg) {
  if (!nodemailer || !accountCfg || !accountCfg.host || !accountCfg.user || !accountCfg.pass) {
    return null;
  }
  const sig = `${accountCfg.host}:${accountCfg.port}:${accountCfg.user}:${accountCfg.pass}:${accountCfg.secure}`;
  const key = accountCfg.user || "default";
  if (cachedTransporters[key] && cachedSignatures[key] === sig) {
    return cachedTransporters[key];
  }
  cachedSignatures[key] = sig;
  cachedTransporters[key] = nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 1,
    host: accountCfg.host,
    port: parseInt(accountCfg.port) || 587,
    secure: Boolean(accountCfg.secure),
    auth: {
      user: accountCfg.user,
      pass: accountCfg.pass
    },
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false
    }
  });
  return cachedTransporters[key];
}

function resolveAccount(cfg, requestedAccount, user) {
  const norm = normalizeConfig(cfg);
  if (requestedAccount === "decano" && norm.decano.user && norm.decano.pass) {
    return { cfg: norm.decano, key: "decano" };
  }
  if (requestedAccount === "gestor" && norm.gestor.user && norm.gestor.pass) {
    return { cfg: norm.gestor, key: "gestor" };
  }

  // Detectar según el usuario autenticado
  if (user) {
    const userEmail = (user.email || "").toLowerCase().trim();
    const userName = (user.name || "").toLowerCase();
    const isDecano = userEmail.includes("decano") || userName.includes("decano") || userName.includes("perdomo");

    if (isDecano) {
      if (norm.decano.user && norm.decano.pass) return { cfg: norm.decano, key: "decano" };
      if (norm.gestor.user && norm.gestor.pass) return { cfg: norm.gestor, key: "gestor" };
    } else {
      // Es Gestor / Coordinador (ej. Katia López, Eduardo Puello u otro directivo)
      if (norm.gestor.user && norm.gestor.pass) return { cfg: norm.gestor, key: "gestor" };
      if (norm.decano.user && norm.decano.pass) return { cfg: norm.decano, key: "decano" };
    }
  }

  // Fallbacks
  if (norm.gestor.user && norm.gestor.pass) return { cfg: norm.gestor, key: "gestor" };
  if (norm.decano.user && norm.decano.pass) return { cfg: norm.decano, key: "decano" };
  return { cfg: norm.gestor.pass ? norm.gestor : norm.decano, key: norm.gestor.pass ? "gestor" : "decano" };
}

router.get("/email-config", protect, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  const cfg = loadConfig();
  const decanoConfigured = Boolean(cfg.decano.host && cfg.decano.user && cfg.decano.pass);
  const gestorConfigured = Boolean(cfg.gestor.host && cfg.gestor.user && cfg.gestor.pass);

  res.json({
    success: true,
    config: {
      decano: {
        ...cfg.decano,
        pass: cfg.decano.pass ? "****" : "",
        isConfigured: decanoConfigured
      },
      gestor: {
        ...cfg.gestor,
        pass: cfg.gestor.pass ? "****" : "",
        isConfigured: gestorConfigured
      },
      isConfigured: decanoConfigured || gestorConfigured
    }
  });
});

router.post("/email-config", protect, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  const existing = loadConfig();
  const body = req.body || {};

  let updatedDecano = { ...existing.decano };
  if (body.decano) {
    updatedDecano = { ...updatedDecano, ...body.decano };
    if (body.decano.pass === "****" || !body.decano.pass) {
      updatedDecano.pass = existing.decano.pass;
    }
  }

  let updatedGestor = { ...existing.gestor };
  if (body.gestor) {
    updatedGestor = { ...updatedGestor, ...body.gestor };
    if (body.gestor.pass === "****" || !body.gestor.pass) {
      updatedGestor.pass = existing.gestor.pass;
    }
  }

  const finalConfig = {
    decano: updatedDecano,
    gestor: updatedGestor
  };

  saveConfig(finalConfig);
  res.json({ success: true, message: "Configuraciones SMTP de Decano y Gestor guardadas exitosamente." });
});

router.get("/emails", protect, (req, res) => {
  res.json(loadEmails());
});

router.delete("/emails", protect, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  saveEmails([]);
  res.json({ success: true });
});

router.post("/test-email", protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  const { to, account } = req.body;
  const cfg = loadConfig();
  if (!to) return res.status(400).json({ success: false, message: "Destinatario requerido." });

  const resolved = resolveAccount(cfg, account || "decano", req.user);
  const targetCfg = resolved.cfg;

  if (!targetCfg || !targetCfg.host || !targetCfg.user || !targetCfg.pass) {
    return res.status(400).json({
      success: false,
      message: `La cuenta de ${resolved.key === 'decano' ? 'Decano' : 'Gestor'} no tiene credenciales SMTP completas.`
    });
  }

  try {
    const t = getTransporterForAccount(targetCfg);
    if (!t) return res.status(400).json({ success: false, message: "No se pudo inicializar el transporte SMTP." });

    const roleLabel = resolved.key === 'decano' ? 'Decano de Investigación' : 'Gestor / Coordinador';
    const fromStr = `"${targetCfg.fromName || roleLabel}" <${targetCfg.fromAddress || targetCfg.user}>`;

    const info = await t.sendMail({
      from: fromStr,
      to,
      subject: `⚓ [PRUEBA ${roleLabel.toUpperCase()}] Verificación SMTP EFIM`,
      text: `Prueba oficial de conexión del sistema de notificaciones enviada desde la cuenta de ${roleLabel} (${targetCfg.user}).`,
      html: `
        <div style="font-family:sans-serif; padding:20px; background:#f1f5f9; color:#1e293b;">
          <div style="max-width:550px; margin:0 auto; background:#fff; border-radius:8px; padding:24px; border:1px solid #cbd5e1; border-top:4px solid #0f2942;">
            <h2 style="color:#0f2942; margin-top:0;">⚓ Verificación de Correo Institucional</h2>
            <p>Este es un correo de prueba enviado exitosamente desde la cuenta oficial de <strong>${roleLabel}</strong> (${targetCfg.user}) para la <strong>Decanatura de Investigación - EFIM</strong>.</p>
            <p style="color:#059669; font-weight:bold;">✅ Conexión SMTP autenticada y entrega confirmada.</p>
            <hr style="border:0; border-top:1px solid #e2e8f0; margin:20px 0;" />
            <small style="color:#64748b;">Escuela de Formación de Infantería de Marina • Coveñas, Sucre</small>
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      senderAccount: resolved.key,
      from: fromStr,
      messageId: info.messageId,
      message: `Correo de prueba entregado correctamente vía SMTP desde la cuenta de ${roleLabel} (${targetCfg.user}).`
    });
  } catch (err) {
    console.error("Error en test-email:", err.message);
    res.status(500).json({ success: false, message: `Fallo SMTP (${resolved.key}): ${err.message}` });
  }
});

router.post("/send-email", protect, async (req, res) => {
  const { to, toName, subject, html, text, type, metadata, senderAccount } = req.body;
  const cfg = loadConfig();

  const resolved = resolveAccount(cfg, senderAccount, req.user);
  const targetCfg = resolved.cfg;

  const emailRecord = {
    id: "email-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    to,
    toName: toName || to,
    from: (targetCfg && (targetCfg.fromAddress || targetCfg.user)) || "decanatura@esfim.edu.co",
    fromName: (targetCfg && targetCfg.fromName) || "Decanatura de Investigación ESFIM",
    senderAccount: resolved.key,
    subject,
    html,
    text,
    type: type || "general",
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    status: "simulated"
  };

  let smtpSuccess = false;
  let smtpError = null;
  let messageId = null;

  let cleanTo = String(to || "").trim();
  if (!cleanTo) {
    return res.status(400).json({ success: false, message: "Destinatario requerido." });
  }

  let toStr = cleanTo;
  if (toName && !cleanTo.includes("<")) {
    toStr = `"${toName.replace(/"/g, "")}" <${cleanTo}>`;
  }

  try {
    const t = getTransporterForAccount(targetCfg);
    if (t) {
      const fromStr = `"${targetCfg.fromName}" <${targetCfg.fromAddress || targetCfg.user}>`;
      const replyTo = `"${targetCfg.fromName}" <${targetCfg.fromAddress || targetCfg.user}>`;

      const info = await t.sendMail({
        from: fromStr,
        replyTo: replyTo,
        to: toStr,
        subject,
        html,
        text
      });
      smtpSuccess = true;
      messageId = info.messageId;
      emailRecord.status = "sent_smtp";
      emailRecord.smtpMessage = `Entregado vía SMTP desde cuenta ${resolved.key === 'decano' ? 'Decano' : 'Gestor'} (${targetCfg.user}) [${info.messageId}]`;
    } else {
      emailRecord.status = "simulated";
      emailRecord.smtpMessage = `Servidor SMTP (${resolved.key}) no configurado (guardado en buzón virtual)`;
    }
  } catch(e) {
    console.error("Error SMTP al enviar a", to, ":", e.message);
    smtpError = e.message;
    emailRecord.status = "simulated";
    emailRecord.smtpMessage = `Fallo de envío SMTP (${resolved.key}): ${e.message} (Disponible en buzón virtual EFIM)`;
  }

  const emails = loadEmails();
  emails.unshift(emailRecord);
  saveEmails(emails);

  if (smtpSuccess) {
    res.json({
      success: true,
      status: "sent_smtp",
      senderAccount: resolved.key,
      messageId,
      message: `Correo entregado exitosamente vía SMTP desde la cuenta de ${resolved.key === 'decano' ? 'Decano' : 'Gestor'}.`
    });
  } else {
    res.json({
      success: true,
      status: "simulated",
      senderAccount: resolved.key,
      warning: smtpError,
      message: smtpError ? `Fallo SMTP (${smtpError}), registrado en buzón virtual.` : "Registrado en simulador."
    });
  }
});

module.exports = router;
