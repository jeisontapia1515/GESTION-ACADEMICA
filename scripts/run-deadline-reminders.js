require("dotenv").config();
const mongoose = require("mongoose");
const { sendDueDateReminders } = require("../services/deadlineReminders");

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("MONGODB_URI es obligatoria para ejecutar el cron de recordatorios.");
  process.exitCode = 1;
} else {
  mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
    .then(async () => {
      const count = await sendDueDateReminders();
      console.log(`Cron de recordatorios finalizado. Nuevos recordatorios: ${count}.`);
    })
    .catch(error => {
      console.error("Error ejecutando cron de recordatorios:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
