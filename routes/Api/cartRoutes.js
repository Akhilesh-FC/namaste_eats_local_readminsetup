const express = require("express");
const { addOrRemoveCart, getCart } = require("../../controllers/Api/cartController");

const router = express.Router();

router.post("/addRemove", addOrRemoveCart);   // POST /api/cart/add
router.post("/list", getCart);   // POST /api/cart/list

module.exports = router;
