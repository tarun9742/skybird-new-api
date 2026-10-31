const mongoose = require('mongoose');
const assessmentShareSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '', trim: true, maxlength: 2000 },
  originalName: { type: String, required: true, maxlength: 255 },
  storedName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  targetType: { type: String, enum: ['students', 'course', 'free', 'purchased'], required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
assessmentShareSchema.index({ isActive: 1, createdAt: -1 });
module.exports = mongoose.model('AssessmentShare', assessmentShareSchema);
