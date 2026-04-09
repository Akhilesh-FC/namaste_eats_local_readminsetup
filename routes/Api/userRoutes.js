const express = require("express");
const router = express.Router();
const { register, login, profile,verifyOtp, sendOtp, updateProfile,createWalletSession,cashfreeCallback,paymentCallback,getWalletTransactionHistory,getCashfreeStatus,updateProfileformdata } = require("../../controllers/Api/userController");

const upload = require("../../middlewares/upload");

router.post(
  "/update-profile",
  upload.single("profile_image"), // 🔥 FORM-DATA FILE KEY
  updateProfileformdata
);

// Send OTP
router.post("/send-otp",sendOtp);

// Verify OTP
router.post("/verify-otp",verifyOtp);


router.post("/register", register);
router.post("/login", login);
router.get("/profile/:id", profile);
router.post("/profile/update", updateProfile);
// router.post("/addwalletbalance", createWalletSession );98p
// router.post("/wallet_callback", handleWalletCallback);

router.post('/payment-callback', paymentCallback);
router.post("/addwalletbalance", createWalletSession);
router.post("/wallet/callback", cashfreeCallback);
router.get("/transactions_history", getWalletTransactionHistory );
router.get("/getcashfree/status", getCashfreeStatus );

module.exports = router;

