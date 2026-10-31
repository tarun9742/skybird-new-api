const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../models/User");
const Course = require("../models/Course");
const { validateCoupon } = require("../services/couponService");
const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error("Payment provider is not configured");
    error.statusCode = 503;
    throw error;
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

const getCoursePrice = (course) => {
  const price = Number(course.salePrice ?? course.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid course price");
  }

  return price;
};

// POST /api/payment/razorpay/initiate
exports.initiateRazorpayPayment = async (req, res) => {
  try {
    const { courseId } = req.body;
    const razorpay = getRazorpay();

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course =
      (await Course.findOne({ id: courseId, isActive: true })) ||
      (await Course.findById(courseId).catch(() => null));

    if (!course || course.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Course not found or inactive",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const alreadyPurchased = user.purchasedCourses.some(
      (item) => String(item.course) === String(course._id),
    );

    if (alreadyPurchased) {
      return res.status(409).json({
        success: false,
        message: "You have already purchased this course",
      });
    }

    // Never trust the amount sent by the frontend.
    const originalAmount = getCoursePrice(course);
    let finalAmount = originalAmount;
    let couponResult = null;

    if (req.body.couponCode?.trim()) {
      couponResult = await validateCoupon({
        code: req.body.couponCode.trim().toUpperCase(),
        userId: user._id,
        amount: originalAmount,
      });

      if (!couponResult.valid) {
        return res.status(400).json({
          success: false,
          message: couponResult.message || "Invalid coupon",
        });
      }

      finalAmount = Number(couponResult.finalAmount);
    }

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payable amount",
      });
    }

    const amount = Math.round(finalAmount * 100);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `course_${String(course._id).slice(-10)}_${Date.now()}`,
      notes: {
        userId: String(user._id),
        courseId: String(course._id),
        couponCode: couponResult?.code || "",
        couponId: couponResult?.coupon?._id ? String(couponResult.coupon._id) : "",
        originalAmount: String(originalAmount),
        discountAmount: String(couponResult?.discountAmount || 0),
        finalAmount: String(finalAmount),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "Sky Birds Solution",
        description: course.title,
      },
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);

    return res.status(error.statusCode === 503 ? 503 : 500).json({
      success: false,
      message: error.statusCode === 503 ? error.message : "Unable to create payment order",
    });
  }
};

// POST /api/payment/razorpay/verify

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const razorpay = getRazorpay();
    const {
      courseId,
      couponCode,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 1. Validate required fields
    if (
      !courseId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Required payment details are missing",
      });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error("RAZORPAY_KEY_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Payment configuration error",
      });
    }

    // 2. Verify Razorpay payment signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const receivedSignature = Buffer.from(razorpay_signature, "hex");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

    if (
      receivedSignature.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // 3. Fetch the order directly from Razorpay
    const order = await razorpay.orders.fetch(razorpay_order_id);

    // 4. Match the order with the authenticated user and course
    const orderUserId = String(order.notes?.userId || "");
    const orderCourseId = String(order.notes?.courseId || "");
    const loggedInUserId = String(req.user._id);
    const requestedCourseId = String(courseId);

    if (orderUserId !== loggedInUserId) {
      return res.status(400).json({
        success: false,
        message: "Payment order does not belong to this user",
      });
    }

    // Resolve the frontend slug/ID to the MongoDB course document.
    let course = await Course.findOne({
      id: courseId,
      isActive: true,
    });

    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course || course.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Course not found or inactive",
      });
    }

    if (String(course._id) !== orderCourseId) {
      return res.status(400).json({
        success: false,
        message: "Payment order does not match this course",
      });
    }

    // 5. Fetch and verify the payment
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      payment.amount !== order.amount ||
      payment.currency !== order.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment has not been captured successfully",
      });
    }

     

    // Payment is captured; continue with the server-recorded order amount.

    // 7. Load the authenticated user
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Verify values recorded in the server-created Razorpay order notes.
    // Coupon expiry/usage may change after order creation; do not invalidate an already captured payment.
    const originalAmount = Number(order.notes?.originalAmount);
    const expectedFinalAmount = Number(order.notes?.finalAmount);
    const discountAmount = Number(order.notes?.discountAmount || 0);
    const orderCouponCode = String(order.notes?.couponCode || "").trim().toUpperCase();
    const requestedCouponCode = String(couponCode || "").trim().toUpperCase();
    if (orderCouponCode !== requestedCouponCode) {
      return res.status(400).json({ success: false, message: "Payment coupon does not match this purchase" });
    }
    if (!Number.isFinite(originalAmount) || !Number.isFinite(expectedFinalAmount) || expectedFinalAmount <= 0 || discountAmount < 0 || Math.abs((originalAmount - discountAmount) - expectedFinalAmount) > 0.02 || order.amount !== Math.round(expectedFinalAmount * 100)) {
      return res.status(400).json({ success: false, message: "Payment amount does not match this purchase" });
    }

    // 9. Grant access only if the course has not already been purchased
    const alreadyPurchased = user.purchasedCourses.some(
      (item) => String(item.course?._id || item.course) === String(course._id),
    );

    if (!alreadyPurchased) {
      user.purchasedCourses.push({
        course: course._id,
        purchasedAt: new Date(),
      });

      await user.save();
    }

    // Unique transactionId makes coupon accounting idempotent on payment retries.
    if (orderCouponCode && order.notes?.couponId) {
      const existingUsage = await CouponUsage.findOne({ transactionId: razorpay_payment_id }).select("_id");
      if (!existingUsage) {
        try {
          await CouponUsage.create({ coupon: order.notes.couponId, user: user._id, code: orderCouponCode, course: course._id, transactionId: razorpay_payment_id, originalAmount, finalAmount: expectedFinalAmount, discountAmount });
          await Coupon.updateOne({ _id: order.notes.couponId }, { $inc: { usedCount: 1 } });
        } catch (usageError) {
          if (usageError.code !== 11000) throw usageError;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: alreadyPurchased
        ? "Payment verified; course access already exists"
        : "Payment verified and course access granted",
    });
  } catch (error) {
    console.error("Razorpay verification error:", error);

    return res.status(error.statusCode === 503 ? 503 : 500).json({
      success: false,
      message: error.statusCode === 503 ? error.message : "Unable to verify payment",
    });
  }
};
