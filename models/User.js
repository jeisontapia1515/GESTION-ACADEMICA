const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  expirationTime: { type: Number, default: null },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

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
  pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
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
