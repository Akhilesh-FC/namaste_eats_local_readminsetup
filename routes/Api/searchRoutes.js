const express = require("express");
const router = express.Router();
const searchController = require("../../controllers/Api/searchController");

// 🔍 Global Search Route
router.get("/global-search", searchController.globalSearch);

module.exports = router;
