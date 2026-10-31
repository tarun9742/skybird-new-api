const LiveSession = require("../models/LiveSession");
const { isConfigured, uploadStream } = require("../config/cloudinary");

const safeSession = (session, canJoin = false) => {
  const s = session.toObject ? session.toObject() : session;
  const now = Date.now();
  const starts = new Date(s.startsAt).getTime();
  const ends = new Date(s.endsAt).getTime();
  const status = now < starts ? "upcoming" : now <= ends ? "live" : "ended";
  return { id: String(s._id), title: s.title, description: s.description, thumbnail: s.thumbnail, startsAt: s.startsAt, endsAt: s.endsAt, status, isPublished: s.isPublished !== false, meetingUrl: canJoin && status === "live" ? s.meetingUrl : undefined, createdAt: s.createdAt, updatedAt: s.updatedAt };
};
const validMeetingUrl = (value) => {
  try { const u = new URL(value); return u.protocol === "https:" && (u.hostname === "meet.google.com" || u.hostname.endsWith(".meet.google.com")); } catch { return false; }
};
exports.listForCustomer = async (req, res) => {
  try {
    const hasPurchase = Array.isArray(req.user.purchasedCourses) && req.user.purchasedCourses.length > 0;
    const sessions = await LiveSession.find({ isPublished: true, endsAt: { $gt: new Date() } }).sort({ startsAt: 1 }).limit(100).lean();
    const now = Date.now();
    return res.json({ success: true, eligible: hasPurchase, data: sessions.map(s => { const status = now < new Date(s.startsAt).getTime() ? "upcoming" : "live"; return safeSession(s, hasPurchase && status === "live"); }) });
  } catch (e) { return res.status(500).json({ success: false, message: "Unable to load live sessions" }); }
};
exports.listForAdmin = async (_req, res) => {
  try { const sessions = await LiveSession.find().sort({ startsAt: -1 }).lean(); res.json({ success: true, data: sessions.map(s => safeSession(s, true)) }); }
  catch { res.status(500).json({ success: false, message: "Unable to load sessions" }); }
};
exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype)) return res.status(400).json({ success: false, message: "Upload a JPG, PNG, or WebP image" });
    if (!isConfigured()) return res.status(503).json({ success: false, message: "Cloudinary is not configured on the server" });
    const uploaded = await uploadStream(req.file.buffer, { folder: "skybirds/live-sessions", resource_type: "image" });
    res.json({ success: true, url: uploaded.secure_url, public_id: uploaded.public_id });
  } catch { res.status(500).json({ success: false, message: "Thumbnail upload failed" }); }
};
exports.create = async (req, res) => save(req, res, null);
exports.update = async (req, res) => save(req, res, req.params.id);
async function save(req, res, id) {
  try {
    const { title, description, thumbnail, meetingUrl, startsAt, endsAt, isPublished } = req.body;
    const start = new Date(startsAt), end = new Date(endsAt);
    if (typeof title !== "string" || !title.trim() || title.trim().length > 140) return res.status(400).json({ success: false, message: "Title is required (max 140 characters)" });
    if (typeof description !== "string" || !description.trim() || description.length > 3000) return res.status(400).json({ success: false, message: "Description is required (max 3000 characters)" });
    if (typeof thumbnail !== "string" || !/^https:\/\//.test(thumbnail) || thumbnail.length > 2000) return res.status(400).json({ success: false, message: "A valid Cloudinary thumbnail URL is required" });
    if (!validMeetingUrl(meetingUrl)) return res.status(400).json({ success: false, message: "Use a valid https://meet.google.com/ meeting link" });
    if (!startsAt || !endsAt || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return res.status(400).json({ success: false, message: "End time must be after start time" });
    const values = { title: title.trim(), description: description.trim(), thumbnail, meetingUrl, startsAt: start, endsAt: end, isPublished: isPublished !== false && isPublished !== "false" };
    let doc;
    if (id) { doc = await LiveSession.findByIdAndUpdate(id, values, { new: true, runValidators: true }); if (!doc) return res.status(404).json({ success: false, message: "Session not found" }); }
    else { doc = await LiveSession.create({ ...values, createdBy: req.admin._id }); }
    res.status(id ? 200 : 201).json({ success: true, data: safeSession(doc, true) });
  } catch (e) { res.status(500).json({ success: false, message: "Unable to save live session" }); }
}
exports.remove = async (req, res) => { try { const doc = await LiveSession.findByIdAndDelete(req.params.id); if (!doc) return res.status(404).json({ success: false, message: "Session not found" }); res.json({ success: true }); } catch { res.status(500).json({ success: false, message: "Unable to delete session" }); } };
