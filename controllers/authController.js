const crypto = require("crypto");
const https = require("https");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");
const OtpChallenge = require("../models/OtpChallenge");

const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Authentication is not configured securely");
  }
  return jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
    issuer: "skybirds-api",
    audience: "skybirds-client",
  });
};

function sendApiTxtOtp(to, otp, expiresAt) {
  const authkey = process.env.APITXT_AUTH_KEY;
  const endpoint = process.env.APITXT_OTP_URL || "https://apitxt.com/api/sendOTP";
  const countryCode = String(process.env.APITXT_COUNTRY_CODE || "91").replace(/\D/g, "");
  if (!authkey || !/^https:\/\//i.test(endpoint) || !countryCode) {
    const error = new Error("APITxT OTP delivery is not configured. Please contact support.");
    error.statusCode = 503;
    return Promise.reject(error);
  }

  // The API key and OTP stay server-side. Never return the OTP to the browser.
  const payload = new URLSearchParams({
    authkey,
    mobile: `${countryCode}${to}`,
    otp, 
  }).toString();
  const target = new URL(endpoint);
  if (target.hostname !== "apitxt.com" && target.hostname !== "www.apitxt.com") {
    const error = new Error("APITxT OTP endpoint must use the official APITxT host.");
    error.statusCode = 500;
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(payload),
        Accept: "application/json",
      },
      timeout: 10000,
    }, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        if (data.length < 16384) data += chunk;
      });
      response.on("end", () => {
        let result;
        try { result = JSON.parse(data); } catch { result = null; }
        const httpOk = response.statusCode >= 200 && response.statusCode < 300;
        const apiStatus = String(result?.status ?? result?.type ?? "").toLowerCase();
        const apiMessage = String(result?.message ?? "").toLowerCase();
        const apiOk = result?.success === true || apiStatus === "200" || apiStatus === "success" || apiMessage === "success";
        if (httpOk && apiOk) return resolve();
        const error = new Error(`APITxT rejected OTP delivery (HTTP ${response.statusCode || 0}).`);
        error.statusCode = httpOk ? 502 : 503;
        reject(error);
      });
    });
    request.on("timeout", () => request.destroy(new Error("APITxT OTP request timed out")));
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}


function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "");
}

function hashOtp(mobile, otp) {
  const pepper = process.env.OTP_PEPPER || process.env.JWT_SECRET;
  if (!pepper || pepper.length < 32) throw new Error("OTP security is not configured");
  return crypto.createHash("sha256").update(`${mobile}:${otp}:${pepper}`).digest("hex");
}

function issuePurposeToken(mobile, purpose) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Authentication is not configured securely");
  }
  const jti = crypto.randomBytes(24).toString("hex");
  const token = jwt.sign(
    { mobile, purpose, jti },
    process.env.JWT_SECRET,
    { expiresIn: "10m", issuer: "skybirds-api", audience: "skybirds-client" }
  );
  return { token, jti };
}

function readPurposeToken(token, purpose, mobile) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "skybirds-api",
      audience: "skybirds-client",
    });
    return payload.purpose === purpose && payload.mobile === mobile && payload.jti
      ? payload
      : null;
  } catch {
    return null;
  }
}

function verifyPurposeToken(token, purpose, mobile) {
  return Boolean(readPurposeToken(token, purpose, mobile));
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 &&
    password.length <= 128 && !/[\u0000-\u001F\u007F]/.test(password);
}

exports.sendOtp = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const purpose = req.body?.purpose === "reset" ? "reset" : "register";
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number" });
    }

    const existingUser = await User.findOne({ mobile }).select("_id");
    if (purpose === "register" && existingUser) {
      // Preserve endpoint compatibility while avoiding unnecessary SMS for registered users.
      return res.status(200).json({ success: true, existingUser: true, message: "Please log in with your mobile number and password." });
    }
    if (purpose === "reset" && !existingUser) {
      return res.status(404).json({ success: false, message: "No account found for this mobile number." });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtp(mobile, otp);
    const expiresAt = new Date(Date.now() + Math.min(10, Math.max(2, Number(process.env.OTP_EXPIRE_MINUTES) || 5)) * 60 * 1000);

    await OtpChallenge.deleteOne({ mobile });
    await sendApiTxtOtp(mobile, otp, expiresAt);
    await OtpChallenge.findOneAndUpdate(
      { mobile },
      { $set: { codeHash, purpose, expiresAt, attempts: 0, createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      existingUser: !!existingUser,
    });
  } catch (error) {
    const status = Number(error.statusCode) || 503;
    console.error("OTP delivery failed:", error.message);
    return res.status(status).json({
      success: false,
      message: status === 503 ? error.message : "Unable to send OTP right now",
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const otp = String(req.body?.otp || "").trim();
    const purpose = req.body?.purpose === "reset" ? "reset" : "register";
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 100) : "";
    if (!/^\d{10}$/.test(mobile) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "Please provide a valid mobile number and 6-digit OTP" });
    }

    const challenge = await OtpChallenge.findOne({ mobile, purpose });
    if (!challenge || challenge.expiresAt <= new Date()) {
      if (challenge) await OtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({ success: false, message: "OTP expired or not requested. Please request a new OTP." });
    }

    const attempt = await OtpChallenge.findOneAndUpdate(
      { _id: challenge._id, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() }, purpose },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!attempt) {
      await OtpChallenge.deleteOne({ mobile, purpose, attempts: { $gte: 5 } });
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new OTP." });
    }

    const supplied = Buffer.from(hashOtp(mobile, otp), "hex");
    const expected = Buffer.from(attempt.codeHash, "hex");
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      if (attempt.attempts >= 5) await OtpChallenge.deleteOne({ _id: attempt._id });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const consumed = await OtpChallenge.findOneAndDelete({
      _id: attempt._id,
      codeHash: attempt.codeHash,
      purpose,
    });
    if (!consumed) {
      return res.status(400).json({ success: false, message: "OTP already used. Please request a new OTP." });
    }

    const user = await User.findOne({ mobile }).select("_id isBlocked");
    if (purpose === "register" && user) {
      return res.status(409).json({ success: false, message: "An account already exists. Please log in with your password." });
    }
    if (purpose === "reset" && !user) {
      return res.status(404).json({ success: false, message: "No account found for this mobile number." });
    }
    if (user?.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account has been blocked. Contact support." });
    }

    const issued = issuePurposeToken(mobile, purpose === "reset" ? "password_reset" : "password_setup");
    if (purpose === "reset") {
      const resetUser = await User.findOne({ mobile }).select("+passwordResetJti");
      if (!resetUser || resetUser.isBlocked) {
        return res.status(resetUser ? 403 : 404).json({
          success: false,
          message: resetUser ? "Your account has been blocked. Contact support." : "No account found for this mobile number.",
        });
      }
      resetUser.passwordResetJti = issued.jti;
      await resetUser.save();
    }
    return res.status(200).json({
      success: true,
      verified: true,
      message: "Mobile number verified",
      verificationToken: issued.token,
      purpose,
      name,
    });
  } catch (error) {
    console.error("OTP verification failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to verify OTP right now" });
  }
};

exports.customerLogin = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const password = String(req.body?.password || "");
    if (!/^\d{10}$/.test(mobile) || !password || password.length > 128) {
      return res.status(400).json({ success: false, message: "Enter a valid mobile number and password." });
    }
    const user = await User.findOne({ mobile }).select("+passwordHash");
    if (!user || !user.passwordHash || !(await require("bcryptjs").compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid mobile number or password. If you have not set a password, use Forgot password." });
    }
    if (user.isBlocked) return res.status(403).json({ success: false, message: "Your account has been blocked. Contact support." });
    const token = generateToken(user._id, "customer");
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, mobile: user.mobile, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Customer login failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log in right now" });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const password = req.body?.password;
    const verificationToken = String(req.body?.verificationToken || "");
    if (!/^\d{10}$/.test(mobile) || !validPassword(password) ||
        !verifyPurposeToken(verificationToken, "password_setup", mobile)) {
      return res.status(400).json({ success: false, message: "Verification expired or password is invalid. Verify your mobile again." });
    }
    const alreadyExists = await User.findOne({ mobile }).select("_id");
    if (alreadyExists) return res.status(409).json({ success: false, message: "An account already exists. Please log in or reset your password." });

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 100) : "";
    const user = await User.create({ mobile, name, passwordHash });
    const token = generateToken(user._id, "customer");
    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: { id: user._id, mobile: user.mobile, name: user.name, role: user.role },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "An account already exists. Please log in." });
    console.error("Set customer password failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create your account right now" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const password = req.body?.password;
    const verificationToken = String(req.body?.verificationToken || "");
    if (!/^\d{10}$/.test(mobile) || !validPassword(password) ||
        !verifyPurposeToken(verificationToken, "password_reset", mobile)) {
      return res.status(400).json({ success: false, message: "Verification expired or password is invalid. Verify your mobile again." });
    }
    const tokenPayload = readPurposeToken(verificationToken, "password_reset", mobile);
    if (!tokenPayload) {
      return res.status(400).json({ success: false, message: "Verification expired or invalid. Verify your mobile again." });
    }
    const user = await User.findOne({ mobile }).select("+passwordHash +passwordResetJti");
    if (!user) return res.status(404).json({ success: false, message: "No account found for this mobile number." });
    if (user.isBlocked) return res.status(403).json({ success: false, message: "Your account has been blocked. Contact support." });
    if (!user.passwordResetJti || user.passwordResetJti !== tokenPayload.jti) {
      return res.status(400).json({ success: false, message: "Reset token has already been used or replaced. Verify your mobile again." });
    }
    const passwordHash = await require("bcryptjs").hash(password, 12);
    const updated = await User.updateOne(
      { _id: user._id, passwordResetJti: tokenPayload.jti },
      { $set: { passwordHash }, $unset: { passwordResetJti: 1 } }
    );
    if (!updated.modifiedCount) {
      return res.status(400).json({ success: false, message: "Reset token has already been used. Verify your mobile again." });
    }
    return res.status(200).json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to reset password right now" });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password || email.length > 254 || password.length > 256) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    // Never accept the publicly disclosed demo password, even if an old seeded account still uses it.
    // if (process.env.NODE_ENV === "production" && password === "admin123") return res.status(401).json({ success: false, message: "Invalid credentials" });
    const admin = await Admin.findOne({ email }).select("+password"); 
    if (!admin || password !== admin.password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const token = generateToken(admin._id, "admin");
    return res.status(200).json({ success: true, message: "Admin login successful", token, admin: { id: admin._id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error("Admin login failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to log in right now" });
  }
};
