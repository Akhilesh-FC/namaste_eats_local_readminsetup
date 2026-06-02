const express = require("express");
const router  = express.Router();
const S       = require("../../controllers/Admin/SliderController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/sliders",            adminAuth, S.index);
router.post("/sliders/store",     adminAuth, S.store);
router.post("/sliders/update",    adminAuth, S.update);
router.post("/sliders/toggle/:id",adminAuth, S.toggleStatus);
router.delete("/sliders/delete/:id", adminAuth, S.delete);

module.exports = router;
