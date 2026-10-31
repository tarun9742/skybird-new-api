const express = require("express");
const router = express.Router();
const {
  sendOtp,
  verifyOtp,
  customerLogin,
  setPassword,
  resetPassword,
  adminLogin,
} = require("../controllers/authController");

// Customer registration and password recovery
router.post("/customer/send-otp", sendOtp);
router.post("/customer/verify-otp", verifyOtp);
router.post("/customer/login", customerLogin);
router.post("/customer/set-password", setPassword);
router.post("/customer/reset-password", resetPassword);

// Admin login
router.post("/admin/login", adminLogin);

module.exports = router;
