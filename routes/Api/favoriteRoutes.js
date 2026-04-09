const express = require("express");
const router = express.Router();

const { addFavorite, getFavorites,removeFavorite} = require("../../controllers/Api/favoriteController");

router.post("/add", addFavorite);
router.get("/", getFavorites);
router.post("/remove-favorite", removeFavorite);

module.exports = router;
