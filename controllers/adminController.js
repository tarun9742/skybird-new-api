const Platform = require("../models/Platform");
const Course = require("../models/Course");
const User = require("../models/User");
const Contact = require("../models/Contact");
const { isConfigured, uploadStream } = require("../config/cloudinary");
const { v4: uuidv4 } = require("uuid");
const { processVideo, cleanupTempFile } = require("../services/videoService");

exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image file to upload",
      });
    }

    if (isConfigured()) {
      try {
        const result = await uploadStream(req.file.buffer, {
          folder: "skybirds/courses/thumbnails",
        });
        return res.status(200).json({
          success: true,
          message: "Thumbnail uploaded to Cloudinary",
          url: result.secure_url,
          public_id: result.public_id,
        });
      } catch (cloudErr) {
        console.warn("Cloudinary upload failed, using fallback:", cloudErr.message);
      }
    }

    const base64Data = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    res.status(200).json({
      success: true,
      message: "Thumbnail processed (Cloudinary credentials not set, using Data URI/fallback)",
      url: dataUri,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload thumbnail",
    });
  }
};

exports.uploadVideo = async (req, res) => { 
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select a video file to upload" });
    }

    const duration = typeof req.body?.duration === "string" ? req.body.duration.trim() : "";
    const processed = await processVideo(req.file.path, { duration });
    return res.status(200).json({
      success: true,
      message: "Video processed into protected HLS",
      videoId: processed.videoId,
      duration: processed.duration || duration,
      size: req.file.size,
    });
  } catch (error) {
    console.log(error)
    if (req.file?.path) cleanupTempFile(req.file.path);
    return res.status(500).json({ success: false, message: "Failed to process video" });
  }
};

exports.createPlatform = async (req, res) => {
  try {
    const { id, name, tagline } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: "id and name are required",
      });
    }

    const exists = await Platform.findOne({ id });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Platform with this id already exists",
      });
    }

    const platform = await Platform.create({ id, name, tagline });

    res.status(201).json({
      success: true,
      message: "Platform created",
      data: platform,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePlatform = async (req, res) => {
  try {
    const { name, tagline, logo, isActive, displayOrder } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (logo !== undefined) updateData.logo = logo;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

    const platform = await Platform.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!platform) {
      return res.status(404).json({
        success: false,
        message: "Platform not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Platform updated",
      data: platform,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deletePlatform = async (req, res) => {
  try {
    const platform = await Platform.findOneAndUpdate(
      { id: req.params.id },
      { isActive: false },
      { new: true }
    );

    if (!platform) {
      return res.status(404).json({
        success: false,
        message: "Platform not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Platform deactivated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllPlatformsAdmin = async (req, res) => {
  try {
    const platforms = await Platform.find().sort({ name: 1 });
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

exports.createCourse = async (req, res) => {
  try {
    const {
      id,
      platform,
      title,
      price,
      duration,
      lessons,
      level,
      description,
      videos,
    } = req.body;

    if (!id || !platform || !title || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "id, platform, title and price are required",
      });
    }

    const platformExists = await Platform.findOne({ id: platform, isActive: true });
    if (!platformExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive platform",
      });
    }

    const exists = await Course.findOne({ id });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Course with this id already exists",
      });
    }

    let thumbnail = req.body.thumbnail || "";
    let processedVideoId = "";

    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        thumbnail = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;
      }
      if (req.files.video && req.files.video[0]) {
        const processed = await processVideo(req.files.video[0].path);
        processedVideoId = processed.videoId;
      }
    }

    let parsedVideos = [];
    if (videos) {
      parsedVideos = typeof videos === "string" ? JSON.parse(videos) : videos;
    }

    if (processedVideoId) {
      parsedVideos.push({
        id: `vid-${uuidv4().slice(0, 8)}`,
        title: title,
        module: "Module 1",
        moduleOrder: 1,
        order: parsedVideos.length,
        duration: duration || "",
        videoId: processedVideoId,
      });
    }

    parsedVideos = parsedVideos.map((video) => ({
      id: video.id || `vid-${uuidv4().slice(0, 8)}`,
      title: video.title,
      module: video.module || "Module 1",
      moduleOrder: Number(video.moduleOrder || 1),
      order: Number(video.order || 0),
      duration: video.duration || "",
      videoId: video.videoId || "",
      link: "",
    }));

    const course = await Course.create({
      id,
      platform,
      title,
      price: Number(price),
      duration,
      lessons: parsedVideos.length > 0 ? parsedVideos.length : (Number(lessons) || 0),
      level: level || "Beginner",
      thumbnail,
      description,
      videoUrl: "",
      videos: parsedVideos,
    });

    res.status(201).json({
      success: true,
      message: "Course created",
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const allowed = [
      "platform",
      "title",
      "price",
      "duration",
      "lessons",
      "level",
      "thumbnail",
      "description",
      "videos",
      "isActive",
      "isPopular",
      "displayOrder",
      "videoId",
    ];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        updateData.thumbnail = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;
      }
      if (req.files.video && req.files.video[0]) {
        const processed = await processVideo(req.files.video[0].path);
        updateData.videoUrl = "";
        const currentVideos = updateData.videos
          ? (typeof updateData.videos === "string" ? JSON.parse(updateData.videos) : updateData.videos)
          : [];
        currentVideos.push({
          id: `vid-${uuidv4().slice(0, 8)}`,
          title: updateData.title || "Lesson",
          module: "Module 1",
          moduleOrder: 1,
          order: currentVideos.length,
          duration: updateData.duration || "",
          videoId: processed.videoId,
          link: "",
        });
        updateData.videos = currentVideos;
      }
    }

    if (updateData.videos && typeof updateData.videos === "string") {
      updateData.videos = JSON.parse(updateData.videos);
    }
    if (Array.isArray(updateData.videos)) {
      updateData.videos = updateData.videos.map((video) => ({
        id: video.id || `vid-${uuidv4().slice(0, 8)}`,
        title: video.title || "Lesson",
        module: video.module || "Module 1",
        moduleOrder: Number(video.moduleOrder || 1),
        order: Number(video.order || 0),
        duration: video.duration || "",
        videoId: video.videoId || "",
        link: "",
      }));
    }
    updateData.videoUrl = "";

    if (updateData.price !== undefined) updateData.price = Number(updateData.price);
    if (updateData.videos && Array.isArray(updateData.videos)) {
      updateData.lessons = updateData.videos.length;
    } else if (updateData.lessons !== undefined) {
      updateData.lessons = Number(updateData.lessons);
    }

    let course = await Course.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!course) {
      course = await Course.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      });
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course updated",
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    let course = await Course.findOneAndUpdate(
      { id: req.params.id },
      { isActive: false },
      { new: true }
    );

    if (!course) {
      course = await Course.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course deactivated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllCoursesAdmin = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addVideoToCourse = async (req, res) => {
  try {
    const { title, duration, videoId, link } = req.body;
    if (!title || (!videoId && !link)) {
      return res.status(400).json({ success: false, message: "title and videoId are required" });
    }

    let course = await Course.findOne({ id: req.params.id });
    if (!course) course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Legacy public video links are no longer accepted. Upload/process the video first.",
      });
    }

    course.videos.push({
      id: `vid-${uuidv4().slice(0, 8)}`,
      title,
      duration: duration || "",
      videoId,
      link: "",
    });
    course.videoUrl = "";
    course.lessons = course.videos.length;
    await course.save();

    res.status(200).json({ success: true, message: "Video added", data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeVideoFromCourse = async (req, res) => {
  try {
    let course = await Course.findOne({ id: req.params.id });
    if (!course) {
      course = await Course.findById(req.params.id);
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    course.videos = course.videos.filter((v) => v.id !== req.params.videoId);
    course.lessons = course.videos.length;
    await course.save();

    res.status(200).json({
      success: true,
      message: "Video removed",
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find()
      .select("-__v")
      .populate("purchasedCourses.course", "id title price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id)
      .select("-__v")
      .populate("purchasedCourses.course");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { name, isBlocked } = req.body;

    const customer = await User.findByIdAndUpdate(
      req.params.id,
      { name, isBlocked },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated",
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await User.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments();
    const totalCourses = await Course.countDocuments({ isActive: true });
    const totalPlatforms = await Platform.countDocuments({ isActive: true });
    const blockedCustomers = await User.countDocuments({ isBlocked: true });
    const totalQueries = await Contact.countDocuments();
    const newQueries = await Contact.countDocuments({ status: "new" });

    const users = await User.find().select("purchasedCourses");
    const totalPurchases = users.reduce(
      (sum, u) => sum + (u.purchasedCourses ? u.purchasedCourses.length : 0),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        totalCourses,
        totalPlatforms,
        blockedCustomers,
        totalPurchases,
        totalQueries,
        newQueries,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
