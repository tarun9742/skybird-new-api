const express = require("express");
const router = express.Router();
const { protectCustomer } = require("../middleware/auth");
const {
  getPurchasedCourses,
  purchaseCourse,
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/customerController");

router.use(protectCustomer); // all routes below need customer token

router.get("/purchased", getPurchasedCourses);
router.post("/purchase", purchaseCourse);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.patch("/change-password", changePassword);

module.exports = router;
