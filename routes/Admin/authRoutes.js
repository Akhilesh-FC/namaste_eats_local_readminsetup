const express = require("express");
const router = express.Router();

const AuthController = require("../../controllers/Admin/authController");
const adminAuth = require("../../middlewares/adminAuth");


// Login page
router.get("/login", AuthController.showLogin);

// Login submit
router.post("/login", AuthController.doLogin);

// Dashboard (protected)
router.get("/dashboard", adminAuth, AuthController.dashboard);

// Logout
router.get("/logout", AuthController.logout);

router.get("/change-password", adminAuth, AuthController.showChangePassword);
router.post("/change-password", adminAuth, AuthController.changePassword);



module.exports = router;
