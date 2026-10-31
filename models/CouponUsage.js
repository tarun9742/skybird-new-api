const mongoose = require("mongoose");

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Your existing order ID
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    transactionId: { type: String, trim: true  },
    originalAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, default: 0, min: 0 },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);


couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model(
  "CouponUsage",
  couponUsageSchema
);