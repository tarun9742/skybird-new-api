const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  thumbnail: { type: String, required: true, trim: true },
  meetingUrl: { type: String, required: true, trim: true },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true, index: true },
  isPublished: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true });

liveSessionSchema.index({ isPublished: 1, startsAt: 1 });
module.exports = mongoose.model("LiveSession", liveSessionSchema);
