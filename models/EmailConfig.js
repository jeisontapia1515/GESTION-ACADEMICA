const mongoose = require("mongoose");

const emailAccountSchema = new mongoose.Schema({
  host: { type: String, default: "smtp.office365.com" },
  port: { type: Number, default: 587 },
  secure: { type: Boolean, default: false },
  user: { type: String, default: "" },
  pass: { type: String, default: "" },
  fromAddress: { type: String, default: "" },
  fromName: { type: String, default: "" }
}, { _id: false });

const emailConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "institutional" },
  appUrl: { type: String, default: "" },
  decano: { type: emailAccountSchema, default: () => ({}) },
  gestor: { type: emailAccountSchema, default: () => ({}) },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EmailConfig", emailConfigSchema);
