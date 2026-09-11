const express = require("express");
const { protect } = require("../middleware/auth");
const { getPushConfig } = require("../services/push");

const router = express.Router();

router.get("/config", protect, (req, res) => {
  res.json({ success: true, ...getPushConfig() });
});

router.post("/subscribe", protect, async (req, res) => {
  const subscription = req.body;
  if (!subscription || typeof subscription.endpoint !== "string" ||
      !subscription.keys || typeof subscription.keys.p256dh !== "string" ||
      typeof subscription.keys.auth !== "string") {
    return res.status(400).json({ success: false, message: "Suscripción push inválida." });
  }

  const normalizedSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    updatedAt: new Date()
  };
  if (!Array.isArray(req.user.pushSubscriptions)) {
    req.user.pushSubscriptions = [];
  }
  const existing = req.user.pushSubscriptions.findIndex(
    item => item.endpoint === normalizedSubscription.endpoint
  );

  if (existing >= 0) {
    req.user.pushSubscriptions[existing] = normalizedSubscription;
  } else {
    req.user.pushSubscriptions.push(normalizedSubscription);
  }
  await req.user.save();
  res.status(201).json({ success: true });
});

router.delete("/subscribe", protect, async (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (!endpoint) {
    return res.status(400).json({ success: false, message: "Endpoint requerido." });
  }
  req.user.pushSubscriptions = (req.user.pushSubscriptions || []).filter(
    subscription => subscription.endpoint !== endpoint
  );
  await req.user.save();
  res.json({ success: true });
});

module.exports = router;
