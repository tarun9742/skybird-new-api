const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const rateLimit = require("./middleware/rateLimit");
const connectDB = require("./config/db");

const adminCouponRoutes = require("./routes/adminCouponRoutes");
const couponRoutes = require("./routes/couponRoutes");

dotenv.config();

// Validate JWT secret.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET must be configured with at least 32 characters."
  );
  process.exit(1);
}

// Connect to database.
connectDB();

const app = express();

// Trust proxy when explicitly enabled.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// --------------------------------------------------
// SECURITY HEADERS
// --------------------------------------------------

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });

  if (process.env.NODE_ENV === "production") {
    res.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
});

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header.
    // Examples: server-to-server requests and certain CLI clients.
    if (!origin) {
      return callback(null, true);
    }

    // Reflect the requesting origin.
    // This supports credentials: true and avoids using "*".
    return callback(null, origin);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Range",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "Content-Type",
  ],

  maxAge: 600,
  optionsSuccessStatus: 204,
};

// IMPORTANT:
// Register CORS before rate limiting and API routes.
// The cors middleware handles preflight OPTIONS requests.
app.use(cors(corsOptions));

// --------------------------------------------------
// GENERAL MIDDLEWARE
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    parameterLimit: 1000,
  })
);

app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path.includes("/videos/"),
  })
);

// --------------------------------------------------
// GENERAL API RATE LIMIT
// --------------------------------------------------

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: "Too many API requests. Please try again later.",
  })
);

// --------------------------------------------------
// AUTHENTICATION RATE LIMITS
// --------------------------------------------------

app.use(
  "/api/auth/customer/send-otp",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Too many OTP requests. Please try again later.",
  })
);

app.use(
  "/api/auth/customer/verify-otp",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many OTP attempts. Please try again later.",
  })
);

app.use(
  "/api/auth/customer/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please try again later.",
  })
);

app.use(
  "/api/auth/customer/reset-password",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many password reset attempts. Please try again later.",
  })
);

app.use(
  "/api/auth/admin/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Too many login attempts. Please try again later.",
  })
);

// --------------------------------------------------
// CONTACT RATE LIMIT
// --------------------------------------------------

app.use(
  "/api/contact",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many contact submissions. Please try again later.",
  })
);

// --------------------------------------------------
// STATIC FILES
// --------------------------------------------------

app.use(
  "/uploads/thumbnails",
  express.static(path.join(__dirname, "uploads", "thumbnails"), {
    fallthrough: false,
    index: false,
    dotfiles: "deny",
    maxAge: "1d",
    immutable: false,
  })
);

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

app.use("/api/auth", require("./routes/auth"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/platforms", require("./routes/platforms"));
app.use("/api/customer", require("./routes/customer"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/site", require("./routes/site"));
app.use("/api/testimonials", require("./routes/testimonials"));
app.use("/api/live-sessions", require("./routes/liveSessions"));
app.use("/api/assessments", require("./routes/assessments"));

app.use("/api/admin/coupons", adminCouponRoutes);
app.use("/api/coupons", couponRoutes);

// --------------------------------------------------
// ROOT ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SkyBirds E-Commerce Course Platform API is running 🚀",
    version: "2.0.0",
  });
});

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "MulterError" || err.statusCode === 413) {
    return res.status(413).json({
      success: false,
      message: "Uploaded file or request is too large",
    });
  }

  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unhandled API error:", err.message);

  return res.status(500).json({
    success: false,
    message: "Server error. Please try again later.",
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 