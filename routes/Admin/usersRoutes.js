const express = require("express");
const router = express.Router();
const { users, toggleStatus, userOrders } = require("../../controllers/Admin/UserController");
const adminAuth = require("../../middlewares/adminAuth");

router.get("/users", adminAuth, users);
router.get("/users/:id/orders", adminAuth, userOrders);
router.post("/users/:id/toggle", adminAuth, toggleStatus);

module.exports = router;
