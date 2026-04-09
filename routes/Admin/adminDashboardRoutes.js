const express = require("express");
const router = express.Router();
const { home } = require("../../controllers/Admin/adminDashboard");

// Sidebar se aane wale "/home" route ke liye
router.get("/home", home);

module.exports = router;
