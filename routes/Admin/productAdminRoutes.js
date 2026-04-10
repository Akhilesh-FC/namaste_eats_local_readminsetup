const express = require("express");
const router  = express.Router();
const C       = require("../../controllers/Admin/productAdminController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/products", adminAuth, C.list);

module.exports = router;
