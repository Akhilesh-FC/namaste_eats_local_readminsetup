const express = require("express");
const router = express.Router();

const adminAuth = require("../../middlewares/adminAuth");

const {
  categories,
  createCategory,
  upload,
  toggleCategoryStatus,
} = require("../../controllers/Admin/CategoryController");

// 🔐 List categories
router.get("/categories", adminAuth, categories);

// 🔐 Create category
router.post("/categories/create", adminAuth, upload, createCategory);

// 🔐 Toggle category status (AJAX)
router.post("/categories/toggle/:id", adminAuth, toggleCategoryStatus);

module.exports = router;
