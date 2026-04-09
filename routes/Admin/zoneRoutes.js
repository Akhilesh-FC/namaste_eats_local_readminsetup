const express = require("express");
const router = express.Router();
const zoneController = require("../../controllers/Admin/zoneController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/zones", adminAuth, zoneController.list);
router.get("/zone", (req, res) => { res.redirect("/zones"); });
router.get("/zones/create", zoneController.createPage);
router.post("/zones/store", zoneController.store);
router.post("/zones/toggle/:id", zoneController.toggle);
router.delete("/zones/delete/:id", zoneController.deleteZone);

module.exports = router;
