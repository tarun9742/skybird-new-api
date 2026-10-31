const express = require("express");
const router = express.Router();
const {
  getMasterPlaylist,
  getMediaPlaylist,
  getSegment,
  getKey,
} = require("../controllers/videoController");

router.get("/:videoId/master.m3u8", getMasterPlaylist);
router.get("/:videoId/media.m3u8", getMediaPlaylist);
router.get("/:videoId/key", getKey);
router.get("/:videoId/:filename", getSegment);

module.exports = router;
