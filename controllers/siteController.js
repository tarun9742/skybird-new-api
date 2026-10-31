const SiteContent = require("../models/SiteContent");
const DEFAULTS = require("../config/siteDefaults");

const DEFAULT_SUPPORT = {
  email: "support@skybirds.in",
  mobile: "+91 98765 43210 / +91 80000 12345",
  location: "SkyBirds E-Commerce Academy, Cyber City, Sector 24, Gurugram, Haryana - 122002",
  heading: "How Can Our Marketplace Team Help You?",
  description: "Have questions about our video courses, seller onboarding services, or account management? Send us a message and our specialists will respond promptly.",
  responseTime: "Typical response time: Under 4 business hours",
};

const DEFAULT_LEGAL = {
  privacy: "Your privacy policy content can be managed from the admin panel.",
  terms: "Your terms & conditions content can be managed from the admin panel.",
};

async function getOrCreate() {
  let doc = await SiteContent.findOne({ key: "main" });
  if (!doc) {
    doc = await SiteContent.create({
      key: "main",
      ...DEFAULTS,
      support: { ...DEFAULT_SUPPORT, ...(DEFAULTS.support || {}) },
      legal: { ...DEFAULT_LEGAL, ...(DEFAULTS.legal || {}) },
    });
  }
  return doc;
}

exports.getPublicSiteContent = async (req, res) => {
  try {
    const doc = await getOrCreate();
    res.json({
      success: true,
      data: {
        home: doc.home || {},
        about: doc.about || {},
        seo: doc.seo || {},
        support: { ...DEFAULT_SUPPORT, ...(doc.support || {}), socialLinks: Array.isArray(doc.support?.socialLinks) ? doc.support.socialLinks : [] },
        legal: { ...DEFAULT_LEGAL, ...(doc.legal || {}) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminSiteContent = async (req, res) => {
  try {
    const doc = await getOrCreate();
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSiteContent = async (req, res) => {
  try {
    const allowed = ["home", "about", "seo", "support", "legal"];
    const update = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        update[key] = req.body[key];
      }
    }

    const doc = await SiteContent.findOneAndUpdate(
      { key: "main" },
      { $set: update, $setOnInsert: { key: "main" } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, message: "Site content updated", data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
