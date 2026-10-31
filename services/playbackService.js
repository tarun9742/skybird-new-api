const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { videoDir, keyPath, validateVideoId } = require("./videoService");


const PLAYBACK_TOKEN_TTL_SECONDS = Number(
  process.env.PLAYBACK_TOKEN_TTL_SECONDS || 3600
);

function createPlaybackToken(payload) {
  return jwt.sign(
    {
      typ: "video-playback",
      ...payload,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: PLAYBACK_TOKEN_TTL_SECONDS,
      issuer: "skybirds-api",
      audience: "skybirds-playback",
    }
  );
}


function getTokenFromRequest(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  if (req.query.token) return req.query.token;
  return null;
}

function verifyPlaybackToken(req, expectedVideoId) {
  const token = getTokenFromRequest(req);
  if (!token) return { ok: false, status: 401, message: "Playback authorization required" };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: "skybirds-api", audience: "skybirds-playback" });
    if (decoded.typ !== "video-playback" || decoded.videoId !== expectedVideoId) {
      return { ok: false, status: 403, message: "Invalid playback authorization" };
    }
    return { ok: true, decoded };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { ok: false, status: 410, message: "Playback authorization expired" };
    }
    return { ok: false, status: 401, message: "Invalid playback authorization" };
  }
}

function safeFilename(name) {
  return /^[a-zA-Z0-9_.-]+\.(?:m3u8|ts|m4s)$/i.test(name);
}

function getProtectedFile(videoId, filename) {
  if (!validateVideoId(videoId) || !safeFilename(filename)) return null;
  const root = videoDir(videoId);
  const resolved = path.resolve(root, filename);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

function setPrivateHeaders(res, contentType) {
  res.set({
    "Content-Type": contentType,
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
}

module.exports = {
  createPlaybackToken,
  verifyPlaybackToken,
  getProtectedFile,
  getTokenFromRequest,
  setPrivateHeaders,
  keyPath,
};
