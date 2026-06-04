// routes/Api/deliveryBoyRoutes.js
const express = require("express");
const router = express.Router();
const path = require("path");
const { upload, convertFields, ensureDir } = require("../../middlewares/uploadHelper");

const DB_DIR = path.join(__dirname, "../../public/uploads/delivery_boys");
ensureDir(DB_DIR);
const dbConvert = convertFields({
    profile_picture: DB_DIR,
    identity_image: DB_DIR,
    driving_license_image: DB_DIR
});
const {
registerDeliveryBoy,loginDeliveryBoy,updateDeliveryBoyProfile,viewProfile,changePassword,testPushOrders,getDeliveryBoySettings,updateLocationAndStatus,notifyNearestPartnersForReadyOrders,partnerAcceptOrder,createWalletSession_DB,cashfreeCallback_DB,getDeliveryBoyOrders,getDeliveryBoyWalletSummary,getDeliveryBoyTransactionHistory,deliveryBoyForgotPassword
} = require("../../controllers/Api/deliveryBoyController");


router.post("/registerDeliveryBoy", upload.fields([{ name: "profile_picture", maxCount: 1 }, { name: "identity_image", maxCount: 1 }, { name: "driving_license_image", maxCount: 1 }]), dbConvert, registerDeliveryBoy);

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
router.post("/updateDeliveryBoyProfile", upload.fields([{ name: "profile_picture", maxCount: 1 }]), dbConvert, updateDeliveryBoyProfile);

module.exports = router;
