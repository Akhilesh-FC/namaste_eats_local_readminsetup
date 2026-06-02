const express = require("express");
const router  = express.Router();
const C       = require("../../controllers/Admin/CouponAdminController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/coupons",           adminAuth, C.index);
router.get("/coupons/get",       C.getCoupons);
router.post("/coupons/store",    C.createCoupon);
router.post("/coupons/update/:id", C.updateCoupon);
router.delete("/coupons/delete/:id", C.deleteCoupon);

module.exports = router;
