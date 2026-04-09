const express = require("express");
const { index, show } = require("../../controllers/Api/settingController");

const router = express.Router();

// ✅ All active pages list
router.get("/settings", index);

// ✅ Single page by slug
router.get("/settings/:slug", show);

module.exports = router;
