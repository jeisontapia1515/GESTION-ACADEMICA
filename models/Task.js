const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema({
  id: String,
  text: String,
  completed: { type: Boolean, default: false }
}, { _id: false });

const issueReportSchema = new mongoose.Schema({
  text: String,
  description: String,
  type: String,
  reportedBy: String,
  reportedAt: Date,
  status: { type: String, default: "revision_pendiente" }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  id: String,
  authorId: String,
  authorName: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
  type: { type: String, default: "general" }
}, { _id: false });

const assigneeProgressSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userEmail: String,
  avatar: String,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ["pendiente", "en_progreso", "completado"], default: "pendiente" },
  checklist: [checklistItemSchema],
  lastNote: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  assignedTo: { type: mongoose.Schema.Types.Mixed },
  area: { type: String, enum: ["formativa", "aplicada", "editorial", "doctrina", "decanatura"], default: "formativa" },
  priority: { type: String, enum: ["urgent", "high", "normal", "low", "urgente", "alta", "media", "baja", "medium"], default: "alta" },
  status: { type: String, enum: ["pendiente", "en_progreso", "completado", "bloqueado", "revision_pendiente", "archivado", "borrador"], default: "pendiente" },
  isDraft: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },
  completedAt: { type: Date },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  dueDate: { type: Date },
  startDate: { type: Date, default: Date.now },
  checklist: [checklistItemSchema],
  assigneeProgress: [assigneeProgressSchema],
  issueReport: issueReportSchema,
  comments: [commentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.pre("save", function() {
  this.updatedAt = new Date();
});

taskSchema.set("toJSON", {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    return ret;
  }
});

module.exports = mongoose.model("Task", taskSchema);

