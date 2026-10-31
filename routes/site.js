const express = require("express");
const router = express.Router();
const { getPublicSiteContent } = require("../controllers/siteController");

router.get("/", getPublicSiteContent);

module.exports = router;
