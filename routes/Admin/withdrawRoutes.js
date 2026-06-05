const express = require("express");
const router  = express.Router();
const C       = require("../../controllers/Admin/withdrawController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/withdraw-requests",          adminAuth, C.list);
router.post("/withdraw-requests/:id/approve", adminAuth, C.approve);
router.post("/withdraw-requests/:id/reject",  adminAuth, C.reject);

module.exports = router;
