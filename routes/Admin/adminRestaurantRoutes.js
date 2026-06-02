const express = require("express");
const router = express.Router();
const { restaurants, toggleActive, verifyPage, verifyStep, blockRestaurant } = require("../../controllers/Admin/RestaurantController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/restaurants", adminAuth, restaurants);
router.post("/restaurants/:id/toggle", adminAuth, toggleActive);
router.get("/restaurants/:id/verify", adminAuth, verifyPage);
router.post("/restaurants/:id/verify-step", adminAuth, verifyStep);
router.post("/restaurants/:id/block", adminAuth, blockRestaurant);


module.exports = router;
