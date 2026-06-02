const express = require("express");
const {
  categories_lists,filterRestaurants,getSubCategories,getRecommended,getAllRestaurants
 
} = require("../../controllers/Api/categoryController");

const router = express.Router();

router.post("/home_page", categories_lists); 


router.get("/filter", filterRestaurants);

// Paginated APIs
router.post("/sub_categories", getSubCategories);
router.post("/recommended", getRecommended);
router.post("/all_restaurants", getAllRestaurants);



module.exports = router;
