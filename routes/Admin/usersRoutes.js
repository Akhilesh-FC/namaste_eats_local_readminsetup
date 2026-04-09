const express = require("express");
const router = express.Router();
const { users, toggleStatus } = require("../../controllers/Admin/UserController");
const adminAuth = require("../../middlewares/adminAuth");

// List
router.get("/users", adminAuth,users);

// Toggle Active/Inactive
router.post("/users/:id/toggle", adminAuth,toggleStatus);

module.exports = router;
