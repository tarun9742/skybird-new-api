const express = require("express");
const router = express.Router();
const { getAllPlatforms } = require("../controllers/platformController");

router.get("/", getAllPlatforms);

module.exports = router;
