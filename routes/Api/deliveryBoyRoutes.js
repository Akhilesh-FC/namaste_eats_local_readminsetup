// routes/Api/deliveryBoyRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// 🟢 File upload storage setup
const storage = multer.diskStorage({destination: function (req, file, cb) {  cb(null, "uploads/delivery_boys");},
  filename: function (req, file, cb) {cb(null, Date.now() + "-" + file.originalname); },
});

// 🟢 Import upload middleware & controller functions
const upload = require("../../middlewares/uploadDeliveryBoy");
const {
registerDeliveryBoy,loginDeliveryBoy,updateDeliveryBoyProfile,viewProfile,changePassword,testPushOrders,getDeliveryBoySettings,updateLocationAndStatus,notifyNearestPartnersForReadyOrders,partnerAcceptOrder,createWalletSession_DB,cashfreeCallback_DB,getDeliveryBoyOrders,getDeliveryBoyWalletSummary,getDeliveryBoyTransactionHistory,deliveryBoyForgotPassword
} = require("../../controllers/Api/deliveryBoyController");


router.post("/registerDeliveryBoy",upload.fields([  { name: "profile_picture", maxCount: 1 },{ name: "identity_image", maxCount: 1 },
    { name: "driving_license_image", maxCount: 1 }, ]), registerDeliveryBoy);

router.post("/addwalletbalance_DB", createWalletSession_DB);
router.post("/wallet/callback_DB", cashfreeCallback_DB);

router.post("/deliveryboy_orders", getDeliveryBoyOrders);
router.post("/getDeliveryBoyWalletSummary", getDeliveryBoyWalletSummary);
router.post("/getDeliveryBoyTransactionHistory", getDeliveryBoyTransactionHistory);

//router.post("/notify-ready-orders", notifyNearestPartnersForReadyOrders);
//router.post("/orders/accept", partnerAcceptOrder);

//router.post("/updateLocationAndStatus", updateLocationAndStatus);
router.post("/loginDeliveryBoy", loginDeliveryBoy);
router.post("/deliveryBoyForgotPassword", deliveryBoyForgotPassword);
router.post("/viewProfile", viewProfile);
router.post("/changePassword", changePassword);
router.get("/deliveryBoySettings", getDeliveryBoySettings);
router.post("/test-push-orders", testPushOrders);
router.post("/updateDeliveryBoyProfile",upload.fields([{ name: "profile_picture", maxCount: 1 }]),updateDeliveryBoyProfile);

module.exports = router;
