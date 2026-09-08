const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ["admin", "employee"], default: "employee" },
  area: { type: String, enum: ["formativa", "aplicada", "editorial", "doctrina", "decanatura", null], default: null },
  department: { type: String, default: "Decanatura de Investigacion - EFIM" },
  avatar: { type: String, default: "US" },
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.id = obj._id ? obj._id.toString() : undefined;
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
