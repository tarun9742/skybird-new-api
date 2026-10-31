const User = require("../models/User");
const Course = require("../models/Course");

// @desc    Get courses purchased by logged-in customer
// @route   GET /api/customer/purchased
exports.getPurchasedCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "purchasedCourses.course",
      model: "Course",
    });

    const purchased = user.purchasedCourses
      .filter((item) => item.course) // remove deleted courses
      .map((item) => ({
        ...item.course.toObject(),
        purchasedAt: item.purchasedAt,
      }));

    res.status(200).json({
      success: true,
      count: purchased.length,
      data: purchased,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Purchase a course (simulation)
// @route   POST /api/customer/purchase
exports.purchaseCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    // Find course by custom id or Mongo _id
    let course = await Course.findOne({ id: courseId, isActive: true });
    if (!course) {
      course = await Course.findById(courseId);
    }

    if (!course || !course.isActive) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.price > 0) {
      return res.status(400).json({
        success: false,
        message: "Paid courses must be purchased through payment checkout",
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already purchased
    const alreadyPurchased = user.purchasedCourses.some(
      (item) => item.course.toString() === course._id.toString()
    );

    if (alreadyPurchased) {
      return res.status(400).json({
        success: false,
        message: "You have already purchased this course",
      });
    }

    user.purchasedCourses.push({
      course: course._id,
      purchasedAt: new Date(),
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "Course purchased successfully",
      data: {
        courseId: course.id,
        title: course.title,
        price: course.price,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get customer profile
// @route   GET /api/customer/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-__v");

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update customer profile (name only; mobile is immutable here)
// @route   PUT /api/customer/profile

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body || {};

    if (typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 1 and 100 characters",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Check whether another user already has this email.
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user._id },
    }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email address is already in use",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          name: trimmedName,
          email: normalizedEmail,
        },
      },
      {
        new: true,
        runValidators: true,
        projection: "-__v -passwordHash -passwordResetJti",
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    // Handles duplicate-key errors if email has a unique index.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email address is already in use",
      });
    }

    console.error("Profile update failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile right now",
    });
  }
};


// @desc    Change password for the authenticated customer
// @route   PATCH /api/customer/change-password
exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new passwords are required" });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ success: false, message: "New password must be 8–128 characters long" });
    }
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.passwordHash) {
      return res.status(400).json({ success: false, message: "This account has no password yet. Use the password setup or reset flow." });
    }
    const bcrypt = require("bcryptjs");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: "Current password is incorrect" });
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "Choose a different new password" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to change password right now" });
  }
};
