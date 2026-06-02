const express = require("express");
const { index, show, getCategories } = require("../../controllers/Api/settingController");

const router = express.Router();

// ✅ All active pages list
router.get("/settings", index);

// ✅ Single page by slug
router.get("/settings/:slug", show);

// ✅ Categories with limit & offset
router.get("/categories", getCategories);

module.exports = router;
