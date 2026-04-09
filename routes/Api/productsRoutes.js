const express = require("express");
const { getProducts,getProductQuantity } = require("../../controllers/Api/productController");

const router = express.Router();

// ✅ GET /api/products?type=veg&category_id=3
router.get("/products", getProducts);



module.exports = router;
