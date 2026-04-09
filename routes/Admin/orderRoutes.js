const express = require("express");
const router = express.Router();
const { orders } = require("../../controllers/Admin/OrderController");
const adminAuth = require("../../middlewares/adminAuth");

// Orders List
router.get("/orders",adminAuth, orders);

module.exports = router;
