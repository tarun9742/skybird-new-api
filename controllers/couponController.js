const { validateCoupon } =
  require("../services/couponService");

exports.validateCoupon = async (
  req,
  res
) => {
  try {
    const {
      code,
      amount,
    } = req.body;

    const userId = req.user._id;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const result =
      await validateCoupon({
        code,
        userId,
        amount: Number(amount),
      });

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,

      data: {
        code: result.code,

        discountType:
          result.discountType,

        discountValue:
          result.discountValue,

        originalAmount:
          result.originalAmount,

        discountAmount:
          result.discountAmount,

        finalAmount:
          result.finalAmount,
      },
    });

  } catch (error) {
    console.error(
      "VALIDATE COUPON ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to validate coupon",
    });
  }
};