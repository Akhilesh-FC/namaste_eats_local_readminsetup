const express = require("express");
const router  = express.Router();
const C       = require("../../controllers/Admin/deliveryBoyAdminController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/delivery-boys",          adminAuth, C.list);
router.get("/delivery-boys/:id/orders", adminAuth, C.orders);

module.exports = router;
