const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const Testimonial = require("../models/Testimonial");
const { processVideo, cleanupTempFile, videoDir } = require("../services/videoService");

exports.getPublicTestimonials = async (req, res) => {
  try {
    const items = await Testimonial.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const base = `${req.protocol}://${req.get("host")}/api/testimonials`;
    res.json({
      success: true,
      data: items.map((item) => ({
        ...item,
        videoUrl: `${base}/${item.id}/master.m3u8`,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminTestimonials = async (req, res) => {
  try {
    const items = await Testimonial.find().sort({ order: 1, createdAt: 1 }).lean();
    const base = `${req.protocol}://${req.get("host")}/api/testimonials`;
    res.json({
      success: true,
      data: items.map((item) => ({ ...item, videoUrl: `${base}/${item.id}/master.m3u8` })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTestimonial = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please select a video file" });
    }
    const name = String(req.body.name || "").trim();
    if (!name) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const processed = await processVideo(req.file.path);
    const item = await Testimonial.create({
      id: uuidv4(),
      name,
      role: String(req.body.role || ""),
      quote: String(req.body.quote || ""),
      videoId: processed.videoId,
      isActive: req.body.isActive !== "false",
      order: Number(req.body.order || 0),
    });

    res.status(201).json({ success: true, message: "Testimonial created", data: item });
  } catch (error) {
    if (req.file?.path) cleanupTempFile(req.file.path);
    res.status(500).json({ success: false, message: "Failed to create testimonial" });
  }
};

exports.updateTestimonial = async (req, res) => {
  try {
    const update = {};
    for (const key of ["name", "role", "quote", "isActive", "order"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) update[key] = req.body[key];
    }
    if (update.name !== undefined) update.name = String(update.name).trim();
    if (update.order !== undefined) update.order = Number(update.order || 0);

    const item = await Testimonial.findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Testimonial not found" });
    res.json({ success: true, message: "Testimonial updated", data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    const item = await Testimonial.findOneAndDelete({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: "Testimonial not found" });
    if (item.videoId) fs.rmSync(videoDir(item.videoId), { recursive: true, force: true });
    res.json({ success: true, message: "Testimonial deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function sendFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.set({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });
  fs.createReadStream(filePath).pipe(res);
}

async function getTestimonialVideo(req, res, filename) {
  try {
    const item = await Testimonial.findOne({ id: req.params.id, isActive: true }).lean();
    if (!item) return res.status(404).end();

    const root = videoDir(item.videoId);
    const safe = filename === "master.m3u8" || filename === "media.m3u8" || filename === "enc.key" || /^segment_\d+\.(?:ts|m4s)$/.test(filename);
    if (!safe) return res.status(404).end();

    const filePath = path.join(root, filename);
    if (!filePath.startsWith(path.resolve(root) + path.sep)) return res.status(404).end();
    if (!fs.existsSync(filePath)) return res.status(404).end();

    if (filename === "master.m3u8") {
      const content = fs.readFileSync(filePath, "utf8").replace("media.m3u8", "media.m3u8");
      return res.type("application/vnd.apple.mpegurl").send(content);
    }

    if (filename === "media.m3u8") {
      let content = fs.readFileSync(filePath, "utf8");
      content = content
        .replace(/URI="enc\.key"/g, `URI="/api/testimonials/${encodeURIComponent(req.params.id)}/key"`)
        .split(/\r?\n/)
        .map((line) => /^segment_\d+\.ts$/.test(line.trim()) ? `/api/testimonials/${encodeURIComponent(req.params.id)}/${line.trim()}` : line)
        .join("\n");
      return res.type("application/vnd.apple.mpegurl").send(content);
    }

    if (filename === "enc.key") return sendFile(res, filePath, "application/octet-stream");
    return sendFile(res, filePath, "video/mp2t");
  } catch (error) {
    res.status(500).end();
  }
}

exports.getMaster = (req, res) => getTestimonialVideo(req, res, "master.m3u8");
exports.getMedia = (req, res) => getTestimonialVideo(req, res, "media.m3u8");
exports.getKey = (req, res) => getTestimonialVideo(req, res, "enc.key");
exports.getSegment = (req, res) => getTestimonialVideo(req, res, req.params.filename);
