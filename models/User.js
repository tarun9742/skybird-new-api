const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      sparse: true,
      default: undefined,
    },
    name: {
      type: String,
      default: "",
      maxlength: 100,
    },
    passwordHash: {
      type: String,
      select: false,
      default: undefined,
    },
    passwordResetJti: {
      type: String,
      select: false,
      default: undefined,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    purchasedCourses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
        },
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
