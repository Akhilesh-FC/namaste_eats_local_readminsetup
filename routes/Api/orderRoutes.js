const express = require("express");
const { initiateCheckout, paymentSuccess,createSession,getOrderHistory,getOrderSummary ,downloadInvoice,checkPaymentStatus} = require("../../controllers/Api/orderController");

const router = express.Router();
router.get("/check_payment_status", checkPaymentStatus);

// 🚀 Step 1: Checkout initiate (payment session create)
router.post("/checkout_initiate", initiateCheckout);

// 🚀 Step 2: Checkout success (payment confirm → order create)
router.post("/checkout_success", paymentSuccess);
router.post("/createsession", createSession);
router.post("/getOrderHistory", getOrderHistory);


router.post("/order_summary", getOrderSummary);
router.get("/order_invoice/:order_id", downloadInvoice);

module.exports = router;
