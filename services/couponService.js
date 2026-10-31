const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");

async function validateCoupon({
  code,
  userId,
  amount,
}) {
  if (!code) {
    return {
      valid: false,
      message: "Coupon code is required",
    };
  }

  if (typeof code !== "string" || code.length > 64) return { valid: false, message: "Invalid coupon code" };
  const normalizedCode = code.trim().toUpperCase();

  const coupon = await Coupon.findOne({
    code: normalizedCode,
  });

  if (!coupon) {
    return {
      valid: false,
      message: "Invalid coupon code",
    };
  }

  // -----------------------------
  // STATUS
  // -----------------------------

  if (coupon.status !== "active") {
    return {
      valid: false,
      message: "This coupon is currently unavailable",
    };
  }

  // -----------------------------
  // START DATE
  // -----------------------------

  const now = new Date();

  if (
    coupon.startsAt &&
    now < coupon.startsAt
  ) {
    return {
      valid: false,
      message: "This coupon is not active yet",
    };
  }

  // -----------------------------
  // EXPIRY
  // -----------------------------

  if (
    coupon.expiresAt &&
    now > coupon.expiresAt
  ) {
    return {
      valid: false,
      message: "This coupon has expired",
    };
  }

  // -----------------------------
  // TOTAL USAGE LIMIT
  // -----------------------------

  if (
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return {
      valid: false,
      message: "This coupon usage limit has been reached",
    };
  }

  // -----------------------------
  // MINIMUM PURCHASE
  // -----------------------------

  const purchaseAmount = Number(amount);
  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) return { valid: false, message: "Invalid purchase amount" };

  if (
    purchaseAmount < Number(coupon.minPurchase || 0)
  ) {
    return {
      valid: false,
      message: `Minimum purchase of ₹${coupon.minPurchase} required`,
    };
  }

  // -----------------------------
  // USER LIMIT
  // -----------------------------

  const userUsageCount =
    await CouponUsage.countDocuments({
      coupon: coupon._id,
      user: userId,
    });

  if (
    userUsageCount >= Number(coupon.perUserLimit || 1)
  ) {
    return {
      valid: false,
      message: "You have already used this coupon",
    };
  }

  // -----------------------------
  // CALCULATE DISCOUNT
  // -----------------------------

  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount =
      purchaseAmount *
      (Number(coupon.discountValue) / 100);

    // Maximum discount
    if (
      coupon.maxDiscount !== null &&
      coupon.maxDiscount !== undefined
    ) {
      discount = Math.min(
        discount,
        Number(coupon.maxDiscount)
      );
    }
  }

  if (coupon.discountType === "fixed") {
    discount = Number(coupon.discountValue);
  }

  // Never allow discount greater than purchase
  discount = Math.min(
    Math.max(discount, 0),
    purchaseAmount
  );

  discount = Number(
    discount.toFixed(2)
  );

  const finalAmount = Number(
    Math.max(
      0,
      purchaseAmount - discount
    ).toFixed(2)
  );

  return {
    valid: true,

    coupon,

    code: coupon.code,

    discountType: coupon.discountType,

    discountValue: coupon.discountValue,

    originalAmount: purchaseAmount,

    discountAmount: discount,

    finalAmount,
  };
}

module.exports = {
  validateCoupon,
};