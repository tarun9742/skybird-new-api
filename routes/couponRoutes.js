const express = require("express");
const router = express.Router();
const { protectCustomer } = require("../middleware/auth");
const { validateCoupon } = require("../controllers/couponController");
router.post("/validate", protectCustomer, validateCoupon);
module.exports = router;
