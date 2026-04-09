const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const upload = multer();

const {
restaurantProducts,getRestaurantProducts,registerOrLoginRestaurant,restaurantInformationStepId1,addRestaurantDocumentStepId2,
updateRestaurantWorkingDays,getCategoriesWithSubCategories,getUnitTypes,menuSetupStepId3,checkRestaurantVerification,getRestaurantProfile,
restaurant_list,updateRestaurantProfile,getRestaurantOrdersSummary,updateOrderStatus,addRestaurantFeedback,addBankDetails,deleteBankDetails,
addRestaurantOffer,updateRestaurantAddress,getOrderStatuses,getRestaurantAccountDetails,viewBankDetails,viewRestaurantOffer,
	getRestaurantAddress,getAllRestaurantSettings,getRestaurantTimings,updateRestaurantStatus,updateRestaurantTimings,restaurantWithdraw,restaurantWithdrawHistory,updateProducts
} = require("../../controllers/Api/restaurantController");

const router = express.Router();
/* ---------------- Multer setup for restaurant media ---------------- */
const restaurantUploadPath = "uploads/restaurant_media/";
if (!fs.existsSync(restaurantUploadPath)) {
  fs.mkdirSync(restaurantUploadPath, { recursive: true });
}

const restaurantStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, restaurantUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const restaurantUpload = multer({ storage: restaurantStorage });

/* ---------------- Multer setup for products (menu step 3) ---------------- */
const productUploadPath = "uploads/products/";
if (!fs.existsSync(productUploadPath)) {
  fs.mkdirSync(productUploadPath, { recursive: true });
}

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// ✅ Expect fields: one thumbnail + multiple product images
//const productUpload = multer({ storage: productStorage }).fields([
 // { name: "image", maxCount: 1 },     // for thumbnail
 // { name: "images", maxCount: 10 }    // for product images
//]);
const productUpload = multer({ storage: productStorage }).any();
router.post("/menuSetupStepId3", productUpload, menuSetupStepId3);

//router.post("/menuSetupStepId3", upload.any(),menuSetupStepId3);


router.post("/checkRestaurantVerification",checkRestaurantVerification);
router.get("/profile",getRestaurantProfile);


router.post("/update_status", updateRestaurantStatus);

router.get("/product_list", restaurant_list);
router.post("/update-products", productUpload, updateProducts);
router.put("/update-profile", updateRestaurantProfile);
router.get("/getRestaurantOrdersSummary", getRestaurantOrdersSummary);
router.post("/updateOrderStatus", updateOrderStatus);
router.post("/add-feedback", addRestaurantFeedback);
router.post("/addBankDetails", addBankDetails);
router.post("/viewBankDetails", viewBankDetails);
router.delete("/deleteBankDetails", deleteBankDetails);
router.post("/addRestaurantOffer", addRestaurantOffer);
router.post("/offers/view",viewRestaurantOffer);
router.put("/updateRestaurantAddress", updateRestaurantAddress);
router.get("/order-statuses",getOrderStatuses);
router.get("/restaurant-account",getRestaurantAccountDetails);
router.get('/restaurantaddress/:id', getRestaurantAddress);
router.get('/getAllRestaurantSettings', getAllRestaurantSettings);
// ✅ Restaurant product fetching routes
router.get("/restaurantProducts/:id", restaurantProducts);
router.post("/res_products", getRestaurantProducts);
// ✅ Register / Login
router.post("/restaurant_login_register", registerOrLoginRestaurant);
// ✅ Step 1: info + timings + image + video upload
router.post("/restaurantInformationStepId1",restaurantUpload.fields([  { name: "image", maxCount: 1 },  { name: "video", maxCount: 1 }, ]),
  restaurantInformationStepId1
);

// ✅ Step 2: documents & timings
router.post("/addRestaurantDocumentStepId2", addRestaurantDocumentStepId2);
router.post("/updateRestaurantWorkingDays", updateRestaurantWorkingDays);
// ✅ Fetch categories, subcategories, unit types
router.get("/categories_with_subcategories", getCategoriesWithSubCategories);
router.get("/unit-types", getUnitTypes);
router.get("/:restaurant_id/timings",getRestaurantTimings);
router.post("/updateRestaurantTimings",updateRestaurantTimings);
router.post("/restaurantWithdraw",restaurantWithdraw);
router.get("/withdraw_history",restaurantWithdrawHistory);


module.exports = router;
