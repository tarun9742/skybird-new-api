const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  module: { type: String, default: "Module 1", trim: true },
  moduleOrder: { type: Number, default: 1, min: 1 },
  order: { type: Number, default: 0, min: 0 },
  duration: { type: String, default: "" },
  // Legacy field retained for backward compatibility but is never exposed by
  // public course APIs and is never used as a public streaming URL.
  link: { type: String, default: "" },
  videoId: { type: String, default: "" },
}, { _id: false });

const courseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, default: "" },
    lessons: { type: Number, default: 0 },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    thumbnail: { type: String, default: "" },
    description: { type: String, default: "" },
    // Legacy field retained only so old documents remain readable by admins.
    videoUrl: { type: String, default: "" },
    videos: [videoSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
