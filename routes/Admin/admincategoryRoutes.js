const express = require("express");
const router = express.Router();

const adminAuth = require("../../middlewares/adminAuth");

const {
  categories,
  createCategory,
  updateCategory,
  upload,
  uploadMiddleware,
  toggleCategoryStatus,
  deleteCategory,
} = require("../../controllers/Admin/CategoryController");

router.get("/categories", adminAuth, categories);
router.post("/categories/create", adminAuth, upload, createCategory);
router.post("/categories/update", adminAuth, uploadMiddleware, updateCategory);
router.post("/categories/toggle/:id", adminAuth, toggleCategoryStatus);
router.delete("/categories/delete/:id", adminAuth, deleteCategory);

module.exports = router;
