const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const privateTempDir = path.join(
  path.resolve(
    process.env.VIDEO_STORAGE_PATH || path.join(__dirname, "../private-videos"),
  ),
  "tmp",
);
const thumbnailDir = path.join(__dirname, "../uploads/thumbnails");

fs.mkdirSync(privateTempDir, { recursive: true });
fs.mkdirSync(thumbnailDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, file.fieldname === "thumbnail" ? thumbnailDir : privateTempDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, uniqueName);
  },
});

const memoryStorage = multer.memoryStorage();

const allowedMimeByExt = {
  ".jpeg": ["image/jpeg"], ".jpg": ["image/jpeg"], ".png": ["image/png"], ".gif": ["image/gif"], ".webp": ["image/webp"],
  ".mp4": ["video/mp4"], ".webm": ["video/webm"], ".mov": ["video/quicktime"], ".avi": ["video/x-msvideo", "video/avi"], ".mkv": ["video/x-matroska"],
};
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowed = allowedMimeByExt[ext];
  if (allowed && allowed.includes(String(file.mimetype || "").toLowerCase())) return cb(null, true);
  return cb(new Error("Unsupported file type"));
};
const upload = multer({ storage, limits: { fileSize: Math.min(Number(process.env.MAX_VIDEO_UPLOAD_BYTES) || 1024 * 1024 * 1024, 2 * 1024 * 1024 * 1024), files: 2, fields: 40, parts: 50 }, fileFilter });
const memoryUpload = multer({ storage: memoryStorage, limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 20, parts: 25 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase(); const allowed = allowedMimeByExt[ext];
  if (allowed && allowed[0].startsWith("image/") && allowed.includes(String(file.mimetype || "").toLowerCase())) return cb(null, true);
  return cb(new Error("Only supported image files are allowed for this upload"));
} });

module.exports = { upload, memoryUpload };
