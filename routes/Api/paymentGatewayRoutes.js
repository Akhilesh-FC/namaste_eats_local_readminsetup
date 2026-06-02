const express = require("express");
const { createOrder } = require("../../controllers/Api/paymentGatewayRoutes");

const router = express.Router();


router.post("/createOrder", createOrder);



module.exports = router;
