const express = require("express");

const router = express.Router();
const { protectAdmin } = require("../middleware/auth");
const CouponUsage = require("../models/CouponUsage");
router.use(protectAdmin);

const {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  updateCouponStatus,
} = require("../controllers/couponAdminController");


// Usage summary and individual coupon usage records
router.get("/usage", async (req, res) => {
  try {
    const usages = await CouponUsage.find()
      .populate("coupon", "title code discountType discountValue")
      .populate("user", "name email mobile")
      .populate("course", "title id")
      .sort({ createdAt: -1 })
      .limit(1000);
    return res.json({ success: true, data: usages });
  } catch (error) {
    console.error("GET COUPON USAGE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load coupon usage" });
  }
});

// GET
router.get("/", getCoupons);

// CREATE
router.post("/", createCoupon);

// UPDATE
router.put("/:id", updateCoupon);

// DELETE
router.delete("/:id", deleteCoupon);

// ACTIVE / PAUSED
router.patch(
  "/:id/status",
  updateCouponStatus
);

module.exports = router;