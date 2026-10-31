 
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { v4: uuidv4 } = require("uuid");

if (!ffmpegPath) {
  throw new Error(
    "FFmpeg executable not found. Check your ffmpeg-static installation."
  );
}

ffmpeg.setFfmpegPath(ffmpegPath);

// Resolve storage paths relative to this utility file.
// This avoids depending on the directory from which Node.js starts.
const PRIVATE_ROOT = path.resolve(__dirname, "../private-videos");
const TEMP_ROOT = path.join(PRIVATE_ROOT, "tmp");
const VIDEO_ROOT = path.join(PRIVATE_ROOT, "hls");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Unable to create output directory: ${dir}`);
  }
}

ensureDir(TEMP_ROOT);
ensureDir(VIDEO_ROOT);

function safeVideoId() {
  return uuidv4();
}

function videoDir(videoId) {
  return path.join(VIDEO_ROOT, videoId);
}

function keyPath(videoId) {
  return path.join(videoDir(videoId), "enc.key");
}

function validateVideoId(videoId) {
  return /^[0-9a-f-]{36}$/i.test(videoId);
}

async function processVideo(inputPath, options = {}) {
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error("Input video file does not exist.");
  }

  const videoId = safeVideoId();
  const outDir = videoDir(videoId);

  // Explicitly create and verify the output directory before FFmpeg starts.
  ensureDir(outDir);

  const output = path.join(outDir, "media.m3u8");
  const segmentPattern = path.join(outDir, "segment_%05d.ts");
  const keyInfoPath = path.join(outDir, "keyinfo");
  const encryptionKeyPath = keyPath(videoId);

  let completed = false;

  try {
    const key = crypto.randomBytes(16);

    fs.writeFileSync(encryptionKeyPath, key, { mode: 0o600 });

    // FFmpeg expects the key-info file to contain:
    // 1. Key URI written into the playlist.
    // 2. Local key-file path.
    // 3. Optional IV (omitted here).
    //
    // Use an absolute path for the local key file.
    fs.writeFileSync(
      keyInfoPath,
      `enc.key\n${encryptionKeyPath.replace(/\\/g, "/")}\n`,
      { mode: 0o600 }
    );

    console.log("[Video] Input:", path.resolve(inputPath));
    console.log("[Video] Output directory:", outDir);
    console.log("[Video] Playlist:", output);
    console.log("[Video] Segment pattern:", segmentPattern);

    await new Promise((resolve, reject) => {
      ffmpeg(path.resolve(inputPath))
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-preset",
          process.env.FFMPEG_PRESET || "veryfast",

          "-crf",
          process.env.FFMPEG_CRF || "23",

          "-profile:v",
          "main",

          "-level",
          "4.0",

          "-pix_fmt",
          "yuv420p",

          "-vf",
          "scale=w='min(1280,iw)':h='-2'",

          "-maxrate",
          "2800k",

          "-bufsize",
          "5600k",

          "-g",
          "48",

          "-keyint_min",
          "48",

          "-sc_threshold",
          "0",

          "-hls_time",
          "6",

          "-hls_playlist_type",
          "vod",

          "-hls_flags",
          "independent_segments",

          "-movflags",
          "+faststart",
        ])
        .addOutputOption("-hls_segment_filename", segmentPattern)
        .addOutputOption("-hls_key_info_file", keyInfoPath)
        .output(output)
        .on("start", (commandLine) => {
          console.log("[Video] FFmpeg started:", commandLine);
        })
        .on("stderr", (line) => {
          // FFmpeg writes progress and diagnostic messages to stderr.
          // Avoid logging sensitive key contents or environment variables.
          if (
            /error|failed|invalid|unable|no such file/i.test(line)
          ) {
            console.error("[Video] FFmpeg:", line);
          }
        })
        .on("end", resolve)
        .on("error", (error, stdout, stderr) => {
          console.error("[Video] FFmpeg failed:", error.message);

          if (stderr) {
            console.error("[Video] FFmpeg stderr:", stderr);
          }

          reject(error);
        })
        .run();
    });

    // Verify that FFmpeg actually generated the expected playlist and segments.
    if (!fs.existsSync(output)) {
      throw new Error("FFmpeg finished without creating media.m3u8.");
    }

    const segmentFiles = fs
      .readdirSync(outDir)
      .filter((file) => /^segment_\d+\.ts$/i.test(file));

    if (segmentFiles.length === 0) {
      throw new Error("FFmpeg did not generate any HLS media segments.");
    }

    const master = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-STREAM-INF:BANDWIDTH=3200000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS=\"avc1.4d401f,mp4a.40.2\"",
      "media.m3u8",
      "",
    ].join("\n");

    fs.writeFileSync(path.join(outDir, "master.m3u8"), master);

    // Remove temporary FFmpeg key information.
    fs.rmSync(keyInfoPath, { force: true });

    // Delete the uploaded temporary source only after successful conversion.
    fs.rmSync(inputPath, { force: true });

    completed = true;

    console.log(
      `[Video] Processing completed: ${videoId} (${segmentFiles.length} segments)`
    );

    return {
      videoId,
      duration: options.duration || "",
      storage: "hls-aes128",
      directory: outDir,
    };
  } catch (error) {
    console.error("[Video] Processing failed:", error.message);

    // Remove incomplete output, including the encryption key.
    if (!completed) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    // Preserve the source file here for diagnosis/retry.
    // The controller can clean it up according to your existing policy.
    throw error;
  }
}

function cleanupTempFile(filePath) {
  if (filePath) {
    fs.rmSync(filePath, { force: true });
  }
}

module.exports = {
  PRIVATE_ROOT,
  TEMP_ROOT,
  VIDEO_ROOT,
  videoDir,
  keyPath,
  validateVideoId,
  processVideo,
  cleanupTempFile,
}; 