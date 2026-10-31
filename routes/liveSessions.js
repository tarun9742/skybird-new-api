const express = require("express");
const router = express.Router();
const { protectCustomer, protectAdmin } = require("../middleware/auth");
const { memoryUpload } = require("../middleware/upload");
const ctrl = require("../controllers/liveSessionController");

router.get("/", protectCustomer, ctrl.listForCustomer);
router.get("/admin", protectAdmin, ctrl.listForAdmin);
router.post("/admin/upload-thumbnail", protectAdmin, memoryUpload.single("thumbnail"), ctrl.uploadThumbnail);
router.post("/admin", protectAdmin, ctrl.create);
router.put("/admin/:id", protectAdmin, ctrl.update);
router.delete("/admin/:id", protectAdmin, ctrl.remove);
module.exports = router;
