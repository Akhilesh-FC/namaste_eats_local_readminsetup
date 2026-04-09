const express = require("express");
const router = express.Router();
const {
  subCategories,
  createSubCategory,
  upload,
  getSubCategory,
  updateSubCategory,
  deleteSubCategory,toggleSubCategoryStatus
} = require("../../controllers/Admin/SubCategoryController");
const adminAuth = require("../../middlewares/adminAuth");

// List + form
router.get("/subcategories", adminAuth, subCategories);

// Create
router.post("/subcategories/create", upload, createSubCategory);

// Edit fetch
router.get("/subcategories/:id", getSubCategory);

// Update
router.post("/subcategories/:id/update", upload, updateSubCategory);

// Delete
router.delete("/subcategories/:id/delete", deleteSubCategory);

router.post("/subcategories/toggle/:id", toggleSubCategoryStatus);

module.exports = router;
