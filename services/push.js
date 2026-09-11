const webpush = require("web-push");
const User = require("../models/User");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:eduardo.puello@esfim.edu.co";
const isConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (isConfigured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function getPushConfig() {
  return { enabled: isConfigured, publicKey: isConfigured ? vapidPublicKey : null };
}

function getTargetUserFilter(notification) {
  const targetIds = [
    notification.targetUserId,
    ...(Array.isArray(notification.targetUserIds) ? notification.targetUserIds : [])
  ].filter(Boolean).map(value => String(value).trim());
  const targetRole = String(notification.targetRole || "").toLowerCase().trim();
  const normalizedIds = targetIds.map(value => value.toLowerCase());
  const hasSpecificTarget = normalizedIds.some(
    value => !["all", "admin", "employee"].includes(value)
  );

  if (normalizedIds.includes("all") || (!hasSpecificTarget && targetRole === "all")) {
    return { isActive: true };
  }
  if (!hasSpecificTarget && (normalizedIds.includes("admin") || targetRole === "admin")) {
    return { isActive: true, role: "admin" };
  }
  if (!hasSpecificTarget && (normalizedIds.includes("employee") || targetRole === "employee")) {
    return { isActive: true, role: "employee" };
  }

  const filters = [{ email: { $in: normalizedIds } }];
  const objectIds = targetIds
    .filter(value => /^[a-f0-9]{24}$/i.test(value));
  if (objectIds.length) {
    filters.push({ _id: { $in: objectIds } });
  }
  return { isActive: true, $or: filters };
}

async function sendNotificationPush(notification) {
  if (!isConfigured) return;

  const users = await User.find(getTargetUserFilter(notification))
    .select("_id pushSubscriptions");
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: "/img/icon-192.png",
    badge: "/img/icon-192.png",
    data: {
      notificationId: notification.id,
      taskId: notification.taskId || null,
      url: "/app"
    }
  });

  await Promise.all(users.map(async user => {
    const subscriptions = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions : [];
    await Promise.all(subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification(subscription.toObject ? subscription.toObject() : subscription, payload);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          user.pushSubscriptions = user.pushSubscriptions.filter(
            item => item.endpoint !== subscription.endpoint
          );
          await user.save();
          return;
        }
        console.error("Error enviando notificación push:", error.message);
      }
    }));
  }));
}

module.exports = { getPushConfig, sendNotificationPush };
