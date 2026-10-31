
const fs = require("fs");
const path = require("path");

const {
  verifyPlaybackToken,
  getProtectedFile,
  setPrivateHeaders,
  keyPath,
} = require("../services/playbackService");

const { validateVideoId } = require("../services/videoService");

function authorize(req, videoId) {
  return verifyPlaybackToken(req, videoId);
}

function getPlaybackToken(req) {
  const queryToken =
    typeof req.query.token === "string" ? req.query.token : "";

  const authorization = req.headers.authorization || "";
  const headerToken = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  return queryToken || headerToken;
}

function tokenQuery(token) {
  return `token=${encodeURIComponent(token)}`;
}

function sendNotFound(res, message) {
  return res.status(404).json({
    success: false,
    message,
  });
}

// GET /:videoId/master.m3u8
exports.getMasterPlaylist = async (req, res) => { 
  try {
    const { videoId } = req.params;

    if (!validateVideoId(videoId)) {
      return sendNotFound(res, "Video not found");
    }

    const auth = authorize(req, videoId);
 

    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message,
      });
    }

    const masterPath = getProtectedFile(
      videoId,
      "master.m3u8"
    );

    if (!masterPath) {
      return sendNotFound(res, "Video not found");
    }

    const token = getPlaybackToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Playback token is required",
      });
    }

    const content = fs
      .readFileSync(masterPath, "utf8")
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }

        if (/\.m3u8(?:\?.*)?$/i.test(trimmed)) {
          const filename = path.basename(
            trimmed.split("?")[0]
          );

          if (filename === "media.m3u8") {
            return `media.m3u8?${tokenQuery(token)}`;
          }
        }

        return line;
      })
      .join("\n");

    setPrivateHeaders(
      res,
      "application/vnd.apple.mpegurl"
    );

    return res.send(content);
  } catch (error) {
    console.error("Master playlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load video playlist",
    });
  }
};

// GET /:videoId/media.m3u8
exports.getMediaPlaylist = async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!validateVideoId(videoId)) {
      return sendNotFound(res, "Video not found");
    }

    const auth = authorize(req, videoId);

    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message,
      });
    }

    const playlistPath = getProtectedFile(
      videoId,
      "media.m3u8"
    );

    if (!playlistPath) {
      return sendNotFound(
        res,
        "Video playlist not found"
      );
    }

    const token = getPlaybackToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Playback token is required",
      });
    }

    const query = tokenQuery(token);

    const content = fs
      .readFileSync(playlistPath, "utf8")
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return line;
        }

        // Rewrite encryption-key URI.
        if (
          trimmed.startsWith("#") &&
          /URI\s*=\s*"[^"]+"/i.test(trimmed)
        ) {
          return line.replace(
            /URI\s*=\s*"[^"]+"/i,
            `URI="/api/videos/${encodeURIComponent(
              videoId
            )}/key?${query}"`
          );
        }

        // Rewrite .ts and .m4s segment URLs.
        if (!trimmed.startsWith("#")) {
          const withoutQuery = trimmed.split("?")[0];
          const filename = path.basename(withoutQuery);

          if (/\.(?:ts|m4s)$/i.test(filename)) {
            return (
              `/api/videos/${encodeURIComponent(videoId)}/` +
              `${encodeURIComponent(filename)}?${query}`
            );
          }
        }

        return line;
      })
      .join("\n");

    setPrivateHeaders(
      res,
      "application/vnd.apple.mpegurl"
    );

    return res.send(content);
  } catch (error) {
    console.error("Media playlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load media playlist",
    });
  }
};

// GET /:videoId/:filename
exports.getSegment = async (req, res) => {
  try {
    const { videoId, filename } = req.params;

    if (!validateVideoId(videoId)) {
      return sendNotFound(res, "Video not found");
    }

    const auth = authorize(req, videoId);

    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message,
      });
    }

    // Prevent directory traversal and unexpected file types.
    if (
      !filename ||
      filename !== path.basename(filename) ||
      !/\.(?:ts|m4s)$/i.test(filename)
    ) {
      return sendNotFound(res, "Segment not found");
    }

    const filePath = getProtectedFile(
      videoId,
      filename
    );

    if (!filePath) {
      return sendNotFound(res, "Segment not found");
    }

    setPrivateHeaders(
      res,
      /\.m4s$/i.test(filename)
        ? "video/iso.segment"
        : "video/mp2t"
    );

    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      console.error("Video segment read error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to read video segment",
        });
      } else {
        res.destroy(error);
      }
    });

    return stream.pipe(res);
  } catch (error) {
    console.error("Segment handler error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load video segment",
    });
  }
};

// GET /:videoId/key
exports.getKey = async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!validateVideoId(videoId)) {
      return sendNotFound(res, "Video not found");
    }

    const auth = authorize(req, videoId);

    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message,
      });
    }

    const filePath = keyPath(videoId);

    if (!filePath || !fs.existsSync(filePath)) {
      return sendNotFound(
        res,
        "Encryption key not found"
      );
    }

    setPrivateHeaders(
      res,
      "application/octet-stream"
    );

    res.set(
      "Content-Length",
      fs.statSync(filePath).size
    );

    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      console.error("Encryption key read error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to read encryption key",
        });
      } else {
        res.destroy(error);
      }
    });

    return stream.pipe(res);
  } catch (error) {
    console.error("Key handler error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load encryption key",
    });
  }
};
