const Platform = require("../models/Platform");

// @desc    Get all active platforms
// @route   GET /api/platforms
exports.getAllPlatforms = async (req, res) => {
  try {
    const platforms = await Platform.find({ isActive: true }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: platforms.length,
      data: platforms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
