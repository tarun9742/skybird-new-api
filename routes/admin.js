const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/auth");
const { createPlaybackToken, getProtectedFile } = require("../services/playbackService");
const { validateVideoId } = require("../services/videoService");
const { upload, memoryUpload } = require("../middleware/upload");
const {
  uploadThumbnail,
  uploadVideo,
  createPlatform,
  updatePlatform,
  deletePlatform,
  getAllPlatformsAdmin,
  createCourse,
  updateCourse,
  deleteCourse,
  getAllCoursesAdmin,
  addVideoToCourse,
  removeVideoFromCourse,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getStats,
} = require("../controllers/adminController");
const { getAdminSiteContent, updateSiteContent } = require("../controllers/siteController");
const {
  getAdminTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} = require("../controllers/testimonialController");
const {
  getAllContacts,
  updateContactStatus,
  deleteContact,
} = require("../controllers/contactController");

router.use(protectAdmin);

router.get("/stats", getStats);

router.get("/site-content", getAdminSiteContent);
router.put("/site-content", updateSiteContent);

router.get("/testimonials", getAdminTestimonials);
router.post("/testimonials", upload.single("video"), createTestimonial);
router.put("/testimonials/:id", updateTestimonial);
router.delete("/testimonials/:id", deleteTestimonial);

router.post("/upload/thumbnail", memoryUpload.single("thumbnail"), uploadThumbnail);
router.post("/upload/video", upload.single("video"), uploadVideo);

// Short-lived, admin-only authorization for previewing a private HLS upload.
router.post("/videos/:videoId/preview-token", (req, res) => {
  const { videoId } = req.params;
  if (!validateVideoId(videoId) || !getProtectedFile(videoId, "master.m3u8")) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  const token = createPlaybackToken({
    userId: req.admin?._id?.toString() || req.user?.id || "admin-preview",
    videoId,
    role: "admin",
  });

  res.set("Cache-Control", "private, no-store");
  return res.status(200).json({
    success: true,
    token,
    expiresIn: Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS || 300),
    masterUrl: `/api/videos/${videoId}/master.m3u8`,
  });
});

router.get("/platforms", getAllPlatformsAdmin);
router.post("/platforms", createPlatform);
router.put("/platforms/:id", updatePlatform);
router.delete("/platforms/:id", deletePlatform);

router.get("/courses", getAllCoursesAdmin);
router.post(
  "/courses",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createCourse
);
router.put(
  "/courses/:id",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  updateCourse
);
router.delete("/courses/:id", deleteCourse);
router.post("/courses/:id/videos", addVideoToCourse);
router.delete("/courses/:id/videos/:videoId", removeVideoFromCourse);

router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerById);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);

router.get("/contacts", getAllContacts);
router.put("/contacts/:id/status", updateContactStatus);
router.delete("/contacts/:id", deleteContact);

module.exports = router;
