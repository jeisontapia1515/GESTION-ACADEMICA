const express = require("express");
const { protect } = require("../middleware/auth");
const EmailConfig = require("../models/EmailConfig");
const router = express.Router();
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch(e) {}
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "../data");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");
const CONFIG_FILE = path.join(DATA_DIR, "email_config.json");
const LOGO_PATH = path.join(__dirname, "../img/logo.png");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getLogoAttachment() {
  if (fs.existsSync(LOGO_PATH)) {
    return [{
      filename: "escudo-decanatura.png",
      path: LOGO_PATH,
      cid: "esfim_logo"
    }];
  }
  return [];
}

function loadEmails() { try { return fs.existsSync(EMAILS_FILE) ? JSON.parse(fs.readFileSync(EMAILS_FILE, "utf8")) : []; } catch(e) { return []; } }
function saveEmails(e) { try { fs.writeFileSync(EMAILS_FILE, JSON.stringify(e.slice(0, 300), null, 2)); } catch(err) {} }

function getEnvConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.office365.com";
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1" || port === 465;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  const fromAddress = (process.env.SMTP_FROM || process.env.EMAIL_FROM || user).trim();
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "Decanatura de Investigación - ESFIM";

  return { host, port, secure, user, pass, fromAddress, fromName };
}

function normalizeConfig(raw) {
  const c = raw || {};
  const env = getEnvConfig();

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

  // Variables específicas opcionales
  const decanoEnvUser = (process.env.DECANO_SMTP_USER || "").trim() || env.user;
  const decanoEnvPass = (process.env.DECANO_SMTP_PASS || "").trim() || env.pass;
  const decanoEnvHost = (process.env.DECANO_SMTP_HOST || "").trim() || env.host;
  const decanoEnvPort = parseInt(process.env.DECANO_SMTP_PORT, 10) || env.port;

  const gestorEnvUser = (process.env.GESTOR_SMTP_USER || "").trim() || env.user;
  const gestorEnvPass = (process.env.GESTOR_SMTP_PASS || "").trim() || env.pass;
  const gestorEnvHost = (process.env.GESTOR_SMTP_HOST || "").trim() || env.host;
  const gestorEnvPort = parseInt(process.env.GESTOR_SMTP_PORT, 10) || env.port;

  const resolvedDecano = {
    host: decano.host || decanoEnvHost,
    port: parseInt(decano.port, 10) || decanoEnvPort,
    secure: decano.secure !== undefined ? Boolean(decano.secure) : env.secure,
    user: (decano.user || decanoEnvUser).trim(),
    pass: (decano.pass && decano.pass !== "****") ? decano.pass : decanoEnvPass,
    fromAddress: (decano.fromAddress || decano.user || env.fromAddress || decanoEnvUser).trim(),
    fromName: decano.fromName || env.fromName || "Decano de Investigación - ESFIM"
  };

  const resolvedGestor = {
    host: gestor.host || gestorEnvHost,
    port: parseInt(gestor.port, 10) || gestorEnvPort,
    secure: gestor.secure !== undefined ? Boolean(gestor.secure) : env.secure,
    user: (gestor.user || gestorEnvUser).trim(),
    pass: (gestor.pass && gestor.pass !== "****") ? gestor.pass : gestorEnvPass,
    fromAddress: (gestor.fromAddress || gestor.user || env.fromAddress || gestorEnvUser).trim(),
    fromName: gestor.fromName || env.fromName || "Gestor / Coordinador de Investigación - ESFIM"
  };

  // Cross-fallback institucional: si una cuenta tiene credenciales y la otra no, compartir credenciales
  if (!resolvedGestor.pass && resolvedDecano.pass) {
    resolvedGestor.host = resolvedDecano.host;
    resolvedGestor.port = resolvedDecano.port;
    resolvedGestor.secure = resolvedDecano.secure;
    resolvedGestor.user = resolvedDecano.user;
    resolvedGestor.pass = resolvedDecano.pass;
    resolvedGestor.fromAddress = resolvedDecano.fromAddress;
  } else if (!resolvedDecano.pass && resolvedGestor.pass) {
    resolvedDecano.host = resolvedGestor.host;
    resolvedDecano.port = resolvedGestor.port;
    resolvedDecano.secure = resolvedGestor.secure;
    resolvedDecano.user = resolvedGestor.user;
    resolvedDecano.pass = resolvedGestor.pass;
    resolvedDecano.fromAddress = resolvedGestor.fromAddress;
  }

  return {
    appUrl: (c.appUrl || process.env.APP_URL || "").trim(),
    decano: resolvedDecano,
    gestor: resolvedGestor
  };
}

async function loadConfig() {
  try {
    const stored = await EmailConfig.findOne({ key: "institutional" }).lean();
    if (stored) {
      return normalizeConfig(stored);
    }
  } catch (e) {
    console.error("Error leyendo configuración SMTP desde MongoDB:", e.message);
  }

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")));
    }
  } catch(e) {}
  return normalizeConfig({});
}

async function saveConfig(c) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
  } catch(err) {}
  clearTransporterCache();
  await EmailConfig.findOneAndUpdate(
    { key: "institutional" },
    { ...c, key: "institutional", updatedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

let cachedTransporters = {};
let cachedSignatures = {};

function clearTransporterCache() {
  Object.values(cachedTransporters).forEach(transporter => {
    try { transporter.close(); } catch(e) {}
  });
  cachedTransporters = {};
  cachedSignatures = {};
}

function invalidateTransporter(accountCfg) {
  if (!accountCfg) return;
  const key = `${accountCfg.host}:${accountCfg.port}:${accountCfg.user}`.toLowerCase();
  if (cachedTransporters[key]) {
    try { cachedTransporters[key].close(); } catch(e) {}
    delete cachedTransporters[key];
    delete cachedSignatures[key];
  }
}

function getTransporterForAccount(accountCfg) {
  if (!nodemailer || !accountCfg || !accountCfg.host || !accountCfg.user || !accountCfg.pass) {
    return null;
  }

  const key = `${accountCfg.host}:${accountCfg.port}:${accountCfg.user}`.toLowerCase();
  const signature = JSON.stringify({
    host: accountCfg.host,
    port: accountCfg.port,
    secure: Boolean(accountCfg.secure),
    user: accountCfg.user,
    pass: accountCfg.pass
  });
  if (cachedTransporters[key] && cachedSignatures[key] === signature) {
    return cachedTransporters[key];
  }
  if (cachedTransporters[key]) {
    try { cachedTransporters[key].close(); } catch(e) {}
  }

  const port = parseInt(accountCfg.port, 10) || 587;
  const isSecure = Boolean(accountCfg.secure) || port === 465;
  const isOffice365 = /office365|outlook/i.test(accountCfg.host);

  const transporterOptions = {
    host: accountCfg.host,
    port: port,
    secure: isSecure,
    auth: {
      user: accountCfg.user,
      pass: accountCfg.pass
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 35000,
    pool: false, // pool: false evita desconexiones y sockets muertos en hosting cloud / Render
    tls: {
      rejectUnauthorized: false,
      minVersion: "TLSv1.2"
    }
  };

  if (isOffice365 && !isSecure) {
    transporterOptions.requireTLS = true;
  }

  const transporter = nodemailer.createTransport(transporterOptions);
  cachedTransporters[key] = transporter;
  cachedSignatures[key] = signature;
  return transporter;
}

function formatFrom(name, address) {
  return `"${String(name || 'Decanatura ESFIM').replace(/"/g, '')}" <${String(address || '').trim()}>`;
}

function getOptimalFrom(accountCfg) {
  // En Microsoft 365, usar la cuenta autenticada en el encabezado From previene 554 SendAsDenied
  const address = accountCfg.user || accountCfg.fromAddress || "";
  const name = accountCfg.fromName || "Decanatura de Investigación ESFIM";
  return formatFrom(name, address);
}

function isSendAsDenied(error) {
  return error.responseCode === 554 && /SendAsDenied|not allowed to send as/i.test(error.message || '');
}

function isTemporarySmtpLimit(error) {
  return error.responseCode === 432 || /Concurrent connections limit exceeded/i.test(error.message || '');
}

async function sendMailWithRetry(transporter, mailOptions, accountCfg) {
  let options = { ...mailOptions };
  let usedAuthenticatedSender = false;
  let attempts = 0;

  while (attempts < 3) {
    try {
      const info = await transporter.sendMail(options);
      return { info, from: options.from, usedAuthenticatedSender };
    } catch (error) {
      attempts += 1;
      console.error(`Intento ${attempts}/3 de envío SMTP fallido:`, error.message);

      // Si SendAsDenied, reintentar con el correo autenticado
      if (!usedAuthenticatedSender && isSendAsDenied(error) && accountCfg.user) {
        options = {
          ...options,
          from: formatFrom(accountCfg.fromName, accountCfg.user),
          replyTo: accountCfg.fromAddress && accountCfg.fromAddress !== accountCfg.user
            ? formatFrom(accountCfg.fromName, accountCfg.fromAddress)
            : options.replyTo
        };
        usedAuthenticatedSender = true;
        continue;
      }

      // Invalidar transporte en caso de socket caído / timeout
      invalidateTransporter(accountCfg);

      if (attempts >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempts * 1500));

      const fresh = getTransporterForAccount(accountCfg);
      if (fresh) transporter = fresh;
    }
  }
}

function resolveAccount(cfg, requestedAccount, user) {
  const norm = normalizeConfig(cfg);
  const decanoReady = Boolean(norm.decano.host && norm.decano.user && norm.decano.pass);
  const gestorReady = Boolean(norm.gestor.host && norm.gestor.user && norm.gestor.pass);

  if (requestedAccount === "decano" && decanoReady) {
    return { cfg: norm.decano, key: "decano" };
  }
  if (requestedAccount === "gestor" && gestorReady) {
    return { cfg: norm.gestor, key: "gestor" };
  }

  // Detectar según el usuario autenticado
  if (user) {
    const userEmail = (user.email || "").toLowerCase().trim();
    const userName = (user.name || "").toLowerCase();
    const isDecano = userEmail.includes("decano") || userName.includes("decano") || userName.includes("perdomo");

    if (isDecano) {
      if (decanoReady) return { cfg: norm.decano, key: "decano" };
      if (gestorReady) return { cfg: norm.gestor, key: "gestor" };
    } else {
      if (gestorReady) return { cfg: norm.gestor, key: "gestor" };
      if (decanoReady) return { cfg: norm.decano, key: "decano" };
    }
  }

  // Fallbacks: usar la cuenta que tenga credenciales activas
  if (gestorReady) return { cfg: norm.gestor, key: "gestor" };
  if (decanoReady) return { cfg: norm.decano, key: "decano" };

  return { cfg: norm.gestor.pass ? norm.gestor : norm.decano, key: norm.gestor.pass ? "gestor" : "decano" };
}

function sanitizeAppUrl(content, req, cfg) {
  if (!content || typeof content !== "string") return content;
  if (!content.includes("http://localhost:3000")) return content;

  let targetUrl = (cfg && cfg.appUrl) || process.env.APP_URL;
  if (!targetUrl && req) {
    const origin = req.get("origin");
    const host = req.get("host");
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    if (origin && !origin.includes("localhost")) {
      targetUrl = origin;
    } else if (host && !host.includes("localhost")) {
      targetUrl = `${proto}://${host}`;
    }
  }

  if (targetUrl) {
    targetUrl = targetUrl.replace(/\/+$/, "") + "/";
    return content.replace(/http:\/\/localhost:3000\/?/g, targetUrl);
  }
  return content;
}

router.get("/email-config", protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  const cfg = await loadConfig();
  const decanoConfigured = Boolean(cfg.decano.host && cfg.decano.user && cfg.decano.pass);
  const gestorConfigured = Boolean(cfg.gestor.host && cfg.gestor.user && cfg.gestor.pass);

  res.json({
    success: true,
    config: {
      appUrl: cfg.appUrl || process.env.APP_URL || "",
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

router.post("/email-config", protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Acceso restringido al Decano y Gestor." });
  }
  const existing = await loadConfig();
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
    appUrl: body.appUrl !== undefined ? String(body.appUrl).trim() : (existing.appUrl || ""),
    decano: updatedDecano,
    gestor: updatedGestor
  };

  await saveConfig(finalConfig);
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
  const cfg = await loadConfig();
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
    const fromStr = formatFrom(targetCfg.fromName || roleLabel, targetCfg.fromAddress || targetCfg.user);

    const { info, from } = await sendMailWithRetry(t, {
      from: fromStr,
      to,
      subject: `[PRUEBA ${roleLabel.toUpperCase()}] Verificación SMTP ESFIM`,
      text: `Prueba oficial de conexión del sistema de notificaciones enviada desde la cuenta de ${roleLabel} (${targetCfg.user}).`,
      html: `
        <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:20px; background:#f1f5f9; color:#1e293b;">
          <div style="max-width:550px; margin:0 auto; background:#fff; border-radius:8px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
            <div style="background-color:#0a192f; padding:16px 20px; text-align:center; border-bottom:3px solid #c99736;">
              <img src="cid:esfim_logo" alt="Escudo Decanatura ESFIM" width="55" height="55" border="0" style="display:block; margin:0 auto 6px; width:55px; height:55px; max-width:55px;" />
              <h2 style="color:#ffffff; margin:0; font-size:15px; letter-spacing:0.8px; text-transform:uppercase;">ARMADA NACIONAL DE COLOMBIA</h2>
              <div style="color:#c99736; font-size:12px; margin-top:2px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Escuela de Formación de Infantería de Marina • Decanatura de Investigación</div>
            </div>
            <div style="padding:22px 24px;">
              <h3 style="color:#0a192f; margin-top:0; font-size:16px;">Verificación de Correo Institucional</h3>
              <p style="font-size:13.5px; line-height:1.5; color:#334155;">Este es un correo de prueba enviado exitosamente desde la cuenta oficial de <strong>${roleLabel}</strong> (<code>${targetCfg.user}</code>) para la <strong>Decanatura de Investigación - ESFIM</strong>.</p>
              <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:10px 14px; margin:14px 0; color:#065f46; font-size:13px; font-weight:600;">
                ✅ Conexión SMTP autenticada y correo aceptado por el servidor.
              </div>
              <hr style="border:0; border-top:1px solid #e2e8f0; margin:18px 0;" />
              <small style="color:#64748b; font-size:11px;">Escuela de Formación de Infantería de Marina • Coveñas, Sucre — República de Colombia</small>
            </div>
          </div>
        </div>
      `,
      attachments: getLogoAttachment()
    }, targetCfg);

    const emails = loadEmails();
    emails.unshift({
      id: "email-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      to,
      toName: to,
      from,
      fromName: targetCfg.fromName || roleLabel,
      senderAccount: resolved.key,
      subject: `[PRUEBA ${roleLabel.toUpperCase()}] Verificación SMTP ESFIM`,
      type: "test_email",
      createdAt: new Date().toISOString(),
      status: "sent_smtp",
      smtpMessage: `Aceptado por SMTP desde ${from} [${info.messageId}]`
    });
    saveEmails(emails);

    res.json({
      success: true,
      senderAccount: resolved.key,
      from,
      messageId: info.messageId,
      message: `El servidor SMTP aceptó el correo de prueba desde la cuenta de ${roleLabel} (${targetCfg.user}).`
    });
  } catch (err) {
    console.error("Error en test-email:", err.message);
    const emails = loadEmails();
    emails.unshift({
      id: "email-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      to,
      toName: to,
      from: targetCfg.fromAddress || targetCfg.user,
      fromName: targetCfg.fromName,
      senderAccount: resolved.key,
      subject: "[PRUEBA SMTP] Verificación SMTP ESFIM",
      type: "test_email",
      createdAt: new Date().toISOString(),
      status: "simulated",
      smtpMessage: `Fallo en prueba SMTP (${resolved.key}): ${err.message}`
    });
    saveEmails(emails);
    res.status(500).json({ success: false, message: `Fallo SMTP (${resolved.key}): ${err.message}` });
  }
});

router.post("/send-email", protect, async (req, res) => {
  const { to, toName, subject, html, text, type, metadata, senderAccount } = req.body;
  const cfg = await loadConfig();

  const resolved = resolveAccount(cfg, senderAccount, req.user);
  const targetCfg = resolved.cfg;

  const sanitizedHtml = sanitizeAppUrl(html, req, cfg);
  const sanitizedText = sanitizeAppUrl(text, req, cfg);

  const emailRecord = {
    id: "email-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    to,
    toName: toName || to,
    from: (targetCfg && (targetCfg.fromAddress || targetCfg.user)) || "decanatura@esfim.edu.co",
    fromName: (targetCfg && targetCfg.fromName) || "Decanatura de Investigación ESFIM",
    senderAccount: resolved.key,
    subject,
    html: sanitizedHtml,
    text: sanitizedText,
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
      const fromStr = getOptimalFrom(targetCfg);
      const replyTo = formatFrom(targetCfg.fromName, targetCfg.fromAddress || targetCfg.user);

      const { info, from, usedAuthenticatedSender } = await sendMailWithRetry(t, {
        from: fromStr,
        replyTo: replyTo,
        to: toStr,
        subject,
        html: sanitizedHtml,
        text: sanitizedText,
        attachments: getLogoAttachment()
      }, targetCfg);
      smtpSuccess = true;
      messageId = info.messageId;
      emailRecord.from = usedAuthenticatedSender ? targetCfg.user : fromStr;
      emailRecord.status = "sent_smtp";
      emailRecord.smtpMessage = `Aceptado por SMTP desde ${from} [${info.messageId}]`;
    } else {
      smtpError = `Servidor SMTP (${resolved.key}) no configurado.`;
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
    res.status(502).json({
      success: false,
      status: "simulated",
      senderAccount: resolved.key,
      warning: smtpError,
      message: smtpError ? `Fallo SMTP (${smtpError}), registrado solo en buzón virtual.` : "El correo quedó solo en el simulador y no se envió por SMTP."
    });
  }
});

// POST /api/send-email-batch - Envío masivo por lotes a nivel Decanatura
router.post("/send-email-batch", protect, async (req, res) => {
  const { recipients, subject, html, text, type, metadata, senderAccount } = req.body;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ success: false, message: "Lista de destinatarios requerida." });
  }

  const cfg = await loadConfig();
  const resolved = resolveAccount(cfg, senderAccount, req.user);
  const targetCfg = resolved.cfg;

  const t = getTransporterForAccount(targetCfg);
  const results = [];
  const emails = loadEmails();

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const to = typeof item === 'string' ? item : item.to || item.email;
    const toName = typeof item === 'object' ? (item.toName || item.name || to) : to;
    if (!to || !to.includes('@')) {
      results.push({ to, toName, success: false, error: "Destinatario inválido." });
      continue;
    }

    const rawHtml = (typeof item === 'object' && item.html) || html;
    const rawText = (typeof item === 'object' && item.text) || text;
    const sanitizedHtml = sanitizeAppUrl(rawHtml, req, cfg);
    const sanitizedText = sanitizeAppUrl(rawText, req, cfg);

    const emailRecord = {
      id: "email-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      to,
      toName,
      from: (targetCfg && (targetCfg.fromAddress || targetCfg.user)) || "decanatura@esfim.edu.co",
      fromName: (targetCfg && targetCfg.fromName) || "Decanatura de Investigación ESFIM",
      senderAccount: resolved.key,
      subject: (typeof item === 'object' && item.subject) || subject,
      html: sanitizedHtml,
      text: sanitizedText,
      type: type || "task_assignment",
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      status: "simulated"
    };

    let smtpSuccess = false;
    let smtpError = null;

    if (t) {
      try {
        const fromStr = getOptimalFrom(targetCfg);
        const replyToStr = formatFrom(targetCfg.fromName, targetCfg.fromAddress || targetCfg.user);
        const toStr = toName ? `"${String(toName).replace(/"/g, "")}" <${to.trim()}>` : to.trim();
        const { info, from, usedAuthenticatedSender } = await sendMailWithRetry(t, {
          from: fromStr,
          replyTo: replyToStr,
          to: toStr,
          subject: emailRecord.subject,
          html: emailRecord.html,
          text: emailRecord.text,
          attachments: getLogoAttachment()
        }, targetCfg);
        smtpSuccess = true;
        emailRecord.from = usedAuthenticatedSender ? targetCfg.user : fromStr;
        emailRecord.status = "sent_smtp";
        emailRecord.smtpMessage = `Aceptado por SMTP desde ${from} [${info.messageId}]`;
      } catch (e) {
        console.error(`Error SMTP enviando a ${to}:`, e.message);
        smtpError = e.message;
        emailRecord.status = "simulated";
        emailRecord.smtpMessage = `Fallo de envío SMTP (${resolved.key}): ${e.message} (Disponible en buzón virtual EFIM)`;
      }
    } else {
      smtpError = `Servidor SMTP (${resolved.key}) no configurado. Configure credenciales en el módulo de correo o defina SMTP_USER y SMTP_PASS en Render.`;
      emailRecord.status = "simulated";
      emailRecord.smtpMessage = `${smtpError} Registrado en buzón virtual.`;
    }

    emails.unshift(emailRecord);
    results.push({ to, toName, success: smtpSuccess, error: smtpError });

    // Pausa controlada de 800ms entre destinatarios para evitar rate-limiting de Microsoft 365
    if (i < recipients.length - 1 && t) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  saveEmails(emails);

  const sentCount = results.filter(r => r.success).length;
  const failedCount = results.length - sentCount;
  res.json({
    success: true,
    senderAccount: resolved.key,
    sentCount,
    failedCount,
    totalCount: results.length,
    results,
    message: failedCount === 0
      ? `SMTP aceptó los ${sentCount} correos para envío.`
      : `SMTP aceptó ${sentCount} de ${results.length} correos; ${failedCount} fallaron o quedaron solo registrados en el buzón virtual.`
  });
});

module.exports = router;
