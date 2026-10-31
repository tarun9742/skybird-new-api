const buckets = new Map();

// Periodic sweep every minute to prevent memory leaks from inactive IPs
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [bucketKey, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(bucketKey);
  }
}, 60000);
if (cleanupTimer.unref) cleanupTimer.unref();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests. Please try again later." } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    buckets.set(key, entry);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, message });
    }
    // Opportunistically keep the map bounded and remove expired buckets.
    if (buckets.size > 1000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    next();
  };
}

module.exports = rateLimit;
