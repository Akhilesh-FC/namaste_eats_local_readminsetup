const express = require("express");
const router = express.Router();
const unitTypeController = require("../../controllers/Admin/UnitTypeController");
const adminAuth = require("../../middlewares/adminAuth");

// List & Pagination
router.get("/unit-types",adminAuth, unitTypeController.index);

// Create Form
router.get("/unit-types/create", adminAuth, unitTypeController.create);

// Store
router.post("/unit-types/store", unitTypeController.store);

// Edit Form
router.get("/unit-types/edit/:id", unitTypeController.edit);

// Update
router.post("/unit-types/update/:id", unitTypeController.update);

// Toggle Active/Inactive
router.get("/unit-types/toggle/:id", unitTypeController.toggleStatus);

module.exports = router;
