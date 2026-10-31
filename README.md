# SkyBirds Course API — protected HLS video streaming

This version keeps the existing Express/MongoDB/JWT/course/purchase architecture and replaces direct MP4 delivery with protected HLS.

## What changed
- Original uploaded videos are written to private temporary storage.
- FFmpeg converts uploads to AES-128 encrypted HLS.
- Original MP4 is deleted after successful processing.
- Public course responses never expose `videoUrl` or legacy `link` values.
- Playback requires the existing customer/admin JWT and, for customers, an existing `purchasedCourses` entry.
- A short-lived playback JWT is issued per lesson.
- HLS master playlist, media playlist, segments and encryption key are protected.
- Segment filenames are validated to prevent path traversal.
- Sensitive streaming responses use `Cache-Control: private, no-store`.
- CORS is restricted to `CLIENT_URL`/`FRONTEND_URL`.
- The legacy `/api/courses/:id/stream` endpoint now returns 410 and never streams MP4.

## Install / run

```bash
npm install
cp .env.example .env
npm start
```

`ffmpeg-static` is already included in `package.json`; the server uses its bundled FFmpeg binary.

## Environment

Required:
- `MONGODB_URI`
- `JWT_SECRET` (at least 32 characters; rotate any value included in an older shared archive)
- `CLIENT_URL` (comma-separated frontend and admin origins)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` for customer OTP delivery
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` for paid checkout

Optional:
- `OTP_PEPPER` (recommended separate random secret)
- `VIDEO_STORAGE_PATH=./private-videos`
- `PLAYBACK_TOKEN_TTL_SECONDS=300`
- `MAX_VIDEO_UPLOAD_BYTES=1073741824`
- `TRUST_PROXY=true` only when deployed behind a trusted reverse proxy

OTP codes are never returned by the API. If Twilio is not configured, OTP sending fails closed with HTTP 503. The in-process rate limiter is suitable only for a single backend instance; use a shared Redis-backed limiter for horizontally scaled deployments.

The seed script is destructive and now refuses to run unless `SEED_ALLOW_DESTRUCTIVE=true` is explicitly set. Use only with a disposable database and a unique `ADMIN_EMAIL`/`ADMIN_PASSWORD` (at least 12 characters). The script never logs the password.

Never put these backend secrets in Vite `VITE_*` variables.

## Upload flow

1. Admin uploads a video to `POST /api/admin/upload/video`.
2. The server processes it to `private-videos/hls/<videoId>/`.
3. The response contains only the secure `videoId`.
4. Add that `videoId` to a course lesson with `POST /api/admin/courses/:id/videos`.
5. Customers receive only lesson metadata (`id`, `title`, `duration`, `videoId`) from the public course endpoint.
6. The frontend asks `POST /api/courses/:courseId/videos/:lessonId/playback` for a short-lived token.
7. The HLS player loads the protected `master.m3u8`.

## Existing course creation

The existing admin course create/update endpoint can still accept a `video` multipart field. It now processes that file into protected HLS and creates a lesson automatically.

## Production storage

Local disk is acceptable for local development, but Render-style ephemeral filesystems are not a durable production video store. For production, use private object storage such as S3, Cloudflare R2 or Backblaze B2, keep the bucket private, and serve through an authenticated/signed delivery layer. The current code intentionally does not expose `private-videos` as Express static files.

## Security reality

This substantially raises the bar but cannot make browser video impossible to copy. An authorized browser receives media data and a determined user can capture it or record the screen. JavaScript restrictions (`nodownload`, disabled PiP/remote playback, context-menu/shortcut blocking) are deterrents, not DRM.

For high-value content, the next production upgrade is multi-DRM:
- Widevine (Chrome/Android)
- FairPlay (Safari/iOS)
- PlayReady (Edge/Windows)

That requires a DRM-capable video/packaging provider or your own license infrastructure; React/Node alone does not provide DRM.

## Compatibility

Safari/iOS uses native HLS when available. Chrome/Firefox/Edge use HLS.js. The custom player fullscreen container holds the watermark so the watermark remains part of desktop/fullscreen rendering where the browser Fullscreen API is available. iOS may still use browser-native fullscreen behavior depending on the device/browser version.

## Error meanings

- 401: login/authentication missing or invalid
- 403: course/lesson authorization failed
- 404: course, lesson or HLS file not found
- 410: short-lived playback authorization expired
- 500: generic server-side processing/streaming failure
