const express = require("express");
const router = express.Router();
const { restaurants, toggleActive ,verifyPage,verifyStep} = require("../../controllers/Admin/RestaurantController");
const adminAuth = require("../../middlewares/adminAuth");

// List
router.get("/restaurants",adminAuth, restaurants);

// Toggle Active/Inactive
router.post("/restaurants/:id/toggle",adminAuth, toggleActive);

router.get("/restaurants/:id/verify",adminAuth, verifyPage);

router.post("/restaurants/:id/verify-step", adminAuth,verifyStep);


module.exports = router;
