const express = require("express");
const router = express.Router();
const zoneController = require("../../controllers/Admin/zoneController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/zones", adminAuth, zoneController.list);
router.get("/zone", (req, res) => { res.redirect("/zones"); });
router.get("/zones/create", zoneController.createPage);
router.post("/zones/store", zoneController.store);
router.get("/zones/:id/edit", adminAuth, zoneController.editPage);
router.post("/zones/:id/update", zoneController.update);
router.post("/zones/toggle/:id", zoneController.toggle);
router.delete("/zones/delete/:id", zoneController.deleteZone);

module.exports = router;
