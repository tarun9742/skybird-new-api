const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    // Admin-facing coupon title
    title: { type: String, trim: true, maxlength: 120, default: "" },

    // Coupon code shown to users
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    // percentage OR fixed
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    // Example:
    // percentage => 20 means 20%
    // fixed => 500 means ₹500
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    // Minimum course price required
    minPurchase: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Only useful for percentage coupons
    // Example:
    // 20% discount but maximum ₹500
    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },

    // Total number of times coupon can be used
    // null = unlimited
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    // How many times one user can use it
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Total successful usages
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Coupon start date
    startsAt: {
      type: Date,
      default: null,
    },

    // Coupon expiry date
    expiresAt: {
      type: Date,
      default: null,
    },

    // Admin can pause coupon
    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Always store coupon code uppercase
couponSchema.pre("save", function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  next();
});

module.exports = mongoose.model("Coupon", couponSchema);