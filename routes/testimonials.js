const express = require("express");
const router = express.Router();
const {
  getPublicTestimonials,
  getMaster,
  getMedia,
  getKey,
  getSegment,
} = require("../controllers/testimonialController");

router.get("/", getPublicTestimonials);
router.get("/:id/master.m3u8", getMaster);
router.get("/:id/media.m3u8", getMedia);
router.get("/:id/key", getKey);
router.get("/:id/:filename", getSegment);

module.exports = router;
