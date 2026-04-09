const express = require("express");
const router = express.Router();
const ChargesController = require("../../controllers/Admin/ChargesController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/charges", adminAuth, ChargesController.index);
router.post("/charges/update/:id", ChargesController.update);
router.post("/charges/toggle/:id", ChargesController.toggleStatus);
router.post("/charges/addon/update/:id", ChargesController.updateAddon);

module.exports = router;
