const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const jwt = require("jsonwebtoken");
const Course = require("../models/Course");
const User = require("../models/User");
const Admin = require("../models/Admin");
const {
  verifyPlaybackToken,
  createPlaybackToken,
  getProtectedFile,
} = require("../services/playbackService");

const verifyAuthUser = async (req) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "skybirds-api",
      audience: "skybirds-client",
    });
    if (decoded.role === "admin") {
      const admin = await Admin.findById(decoded.id);
      if (admin) return { user: admin, role: "admin" };
    }
    const user = await User.findById(decoded.id);
    if (user && !user.isBlocked) return { user, role: "customer" };
    return null;
  } catch (err) {
    return null;
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { platform, level, search } = req.query;
    const filter = { isActive: true };

    if (platform && platform !== "all") filter.platform = platform;
    if (level) filter.level = level;
    if (search) {
      const safeSearch = String(search)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .slice(0, 100);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const courses = await Course.find(filter).sort({ createdAt: -1 }).lean();
    const safeCourses = courses.map((course) => ({
      ...course,
      videoUrl: "",
      videos: (course.videos || []).map((video) => ({
        id: video.id,
        title: video.title,
        module: video.module || "Module 1",
        moduleOrder: Number(video.moduleOrder || 1),
        order: Number(video.order || 0),
        duration: video.duration || "",
        videoId: video.videoId || "",
      })),
    }));

    res.status(200).json({
      success: true,
      count: safeCourses.length,
      data: safeCourses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
    });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    let course = await Course.findOne({
      id: req.params.id,
      isActive: true,
    }).lean();
    if (!course) course = await Course.findById(req.params.id).lean();

    if (!course || !course.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Never expose legacy link/videoUrl values to customer-facing clients.
    course.videoUrl = "";
    course.videos = (course.videos || []).map((video) => ({
      id: video.id,
      title: video.title,
      module: video.module || "Module 1",
      moduleOrder: Number(video.moduleOrder || 1),
      order: Number(video.order || 0),
      duration: video.duration || "",
      videoId: video.videoId || "",
    }));

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load course" });
  }
};

exports.createPlaybackAuthorization = async (req, res) => {
  try {
    const auth = await verifyAuthUser(req);

    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { id, videoId } = req.params;

    const course =
      (await Course.findOne({ id, isActive: true })) ||
      (await Course.findById(id));

    if (!course || !course.isActive) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (auth.role !== "admin") {
      const purchasedCourses = auth.user.purchasedCourses || [];

      const owned = purchasedCourses.some(
        (item) =>
          item.course && item.course.toString() === course._id.toString(),
      );

      if (!owned) {
        return res.status(403).json({
          success: false,
          message: "Please purchase this course to stream video",
        });
      }
    }

    const lesson = (course.videos || []).find((video) => video.id === videoId);

    const secureVideoId = lesson?.videoId;

    if (!secureVideoId) {
      return res.status(404).json({
        success: false,
        message: "Video not found for this course",
      });
    }

    // Default to one hour; configure through environment variables.
    const ttl = Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS || 3600);

    if (!Number.isSafeInteger(ttl) || ttl < 60) {
      return res.status(500).json({
        success: false,
        message: "Invalid playback token configuration",
      });
    }

    const token = createPlaybackToken({
      userId: auth.user._id.toString(),
      courseId: course._id.toString(),
      videoId: secureVideoId,
      role: auth.role,
    });

    res.set({
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.status(200).json({
      success: true,
      token,
      expiresIn: ttl,
      masterUrl: `/api/videos/${encodeURIComponent(secureVideoId)}/master.m3u8`,
    });
  } catch (error) {
    console.error("Playback authorization failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to authorize playback",
    });
  }
};

exports.streamCourseVideo = async (req, res) => {
  // Kept as a compatibility endpoint, but it no longer streams raw MP4 files.
  return res.status(410).json({
    success: false,
    message:
      "Legacy direct video streaming is disabled. Use protected HLS playback.",
  });
};
