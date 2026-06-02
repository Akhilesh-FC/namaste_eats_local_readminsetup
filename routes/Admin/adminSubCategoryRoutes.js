const express = require("express");
const router = express.Router();
const {
  subCategories,
  createSubCategory,
  upload,
  uploadMiddleware,
  getSubCategory,
  updateSubCategory,
  deleteSubCategory,
  toggleSubCategoryStatus
} = require("../../controllers/Admin/SubCategoryController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/subcategories", adminAuth, subCategories);
router.post("/subcategories/create", ...upload, createSubCategory);
router.get("/subcategories/:id", getSubCategory);
router.post("/subcategories/:id/update", ...uploadMiddleware, updateSubCategory);
router.delete("/subcategories/:id/delete", deleteSubCategory);
router.post("/subcategories/toggle/:id", toggleSubCategoryStatus);

module.exports = router;
