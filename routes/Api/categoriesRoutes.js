const express = require("express");
const {
  categories_lists,filterRestaurants,
 
} = require("../../controllers/Api/categoryController");

const router = express.Router();

router.post("/home_page", categories_lists); 


router.get("/filter", filterRestaurants);



module.exports = router;
