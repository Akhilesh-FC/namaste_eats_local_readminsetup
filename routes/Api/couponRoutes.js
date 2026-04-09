const express = require("express");
const { 
  getCoupons, 
  createCoupon, 
  updateCoupon, 
  deleteCoupon 
} = require("../../controllers/Api/couponController");

const router = express.Router();

// ✅ Routes
router.get("/getCoupons", getCoupons);       // GET all coupons
router.post("/", createCoupon);              // CREATE new coupon
router.put("/:id", updateCoupon);            // UPDATE coupon
router.delete("/:id", deleteCoupon);         // DELETE coupon

module.exports = router;   // ✅ CommonJS export
