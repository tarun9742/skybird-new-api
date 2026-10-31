
const express = require("express");
const router = express.Router();

const {
  initiateRazorpayPayment,
  verifyRazorpayPayment,
} = require("../controllers/paymentController");

// IMPORTANT:
// Change this import to the exact middleware file used by
// your existing customer routes, if the path or export differs.
const { protectCustomer } = require("../middleware/auth");

router.post(
  "/razorpay/initiate",
  protectCustomer,
  initiateRazorpayPayment
);

router.post(
  "/razorpay/verify",
  protectCustomer,
  verifyRazorpayPayment
);

module.exports = router;
