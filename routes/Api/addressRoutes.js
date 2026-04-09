const express = require("express");
const { address_store, address_list, search, update, destroy } = require("../../controllers/Api/addressController");

const router = express.Router();

router.post("/add_address", address_store);
router.get("/address_list/:user_id", address_list);

router.post("/search", search);
router.post("/update-address", update);
router.post("/delete-address", destroy);

module.exports = router;
