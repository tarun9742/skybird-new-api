const Coupon = require("../models/Coupon");


// ==========================================
// GET ALL COUPONS
// ==========================================

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error("GET COUPONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load coupons",
    });
  }
};


// ==========================================
// CREATE COUPON
// ==========================================

exports.createCoupon = async (req, res) => {
  try {
    const {
      title,
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      usageLimit,
      perUserLimit,
      startsAt,
      expiresAt,
      status,
    } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (
      !["percentage", "fixed"].includes(
        discountType
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount type",
      });
    }

    const value = Number(discountValue);

    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0",
      });
    }

    if (
      discountType === "percentage" &&
      value > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    const normalizedCode =
      code.trim().toUpperCase();

    const existing = await Coupon.findOne({
      code: normalizedCode,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create({
      title: String(title || "").trim(),
      code: normalizedCode,

      discountType,

      discountValue: value,

      minPurchase:
        Number(minPurchase || 0),

      maxDiscount:
        maxDiscount === "" ||
        maxDiscount === null ||
        maxDiscount === undefined
          ? null
          : Number(maxDiscount),

      usageLimit:
        usageLimit === "" ||
        usageLimit === null ||
        usageLimit === undefined
          ? null
          : Number(usageLimit),

      perUserLimit:
        Number(perUserLimit || 1),

      startsAt:
        startsAt || null,

      expiresAt:
        expiresAt || null,

      status:
        status === "paused"
          ? "paused"
          : "active",
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });

  } catch (error) {
    console.error(
      "CREATE COUPON ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create coupon",
    });
  }
};


// ==========================================
// UPDATE COUPON
// ==========================================

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      usageLimit,
      perUserLimit,
      startsAt,
      expiresAt,
      status,
    } = req.body;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    if (
      discountType &&
      !["percentage", "fixed"].includes(
        discountType
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount type",
      });
    }

    if (
      discountType === "percentage" &&
      Number(discountValue) > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Percentage discount cannot exceed 100%",
      });
    }

    if (title !== undefined) {
      coupon.title = String(title || "").trim();
    }

    if (code !== undefined) {
      coupon.code =
        code.trim().toUpperCase();
    }

    if (discountType !== undefined) {
      coupon.discountType =
        discountType;
    }

    if (discountValue !== undefined) {
      coupon.discountValue =
        Number(discountValue);
    }

    if (minPurchase !== undefined) {
      coupon.minPurchase =
        Number(minPurchase || 0);
    }

    if (maxDiscount !== undefined) {
      coupon.maxDiscount =
        maxDiscount === null ||
        maxDiscount === ""
          ? null
          : Number(maxDiscount);
    }

    if (usageLimit !== undefined) {
      coupon.usageLimit =
        usageLimit === null ||
        usageLimit === ""
          ? null
          : Number(usageLimit);
    }

    if (perUserLimit !== undefined) {
      coupon.perUserLimit =
        Number(perUserLimit || 1);
    }

    if (startsAt !== undefined) {
      coupon.startsAt =
        startsAt || null;
    }

    if (expiresAt !== undefined) {
      coupon.expiresAt =
        expiresAt || null;
    }

    if (status !== undefined) {
      coupon.status =
        status === "paused"
          ? "paused"
          : "active";
    }

    await coupon.save();

    return res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });

  } catch (error) {
    console.error(
      "UPDATE COUPON ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update coupon",
    });
  }
};


// ==========================================
// DELETE COUPON
// ==========================================

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon =
      await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      message: "Coupon deleted successfully",
    });

  } catch (error) {
    console.error(
      "DELETE COUPON ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
    });
  }
};


// ==========================================
// CHANGE STATUS
// ==========================================

exports.updateCouponStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    if (
      !["active", "paused"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const coupon =
      await Coupon.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.json({
      success: true,
      message: `Coupon ${
        status === "active"
          ? "activated"
          : "paused"
      } successfully`,
      data: coupon,
    });

  } catch (error) {
    console.error(
      "STATUS UPDATE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update coupon status",
    });
  }
};