const mongoose = require("mongoose");

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "main" },
    home: { type: mongoose.Schema.Types.Mixed, default: {} },
    about: { type: mongoose.Schema.Types.Mixed, default: {} },
    seo: { type: mongoose.Schema.Types.Mixed, default: {} },
    support: { type: mongoose.Schema.Types.Mixed, default: {} },
    legal: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteContent", siteContentSchema);
