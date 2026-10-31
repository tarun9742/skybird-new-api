const express = require("express");
const router = express.Router();
const {
  getAllCourses,
  getCourseById,
  streamCourseVideo,
  createPlaybackAuthorization,
} = require("../controllers/courseController");

router.get("/", getAllCourses);
router.get("/:id", getCourseById);
router.get("/:id/stream", streamCourseVideo);
router.post("/:id/videos/:videoId/playback", createPlaybackAuthorization);

module.exports = router;
