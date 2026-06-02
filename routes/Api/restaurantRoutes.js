const express = require("express");
const path = require("path");
const fs = require("fs");
const { upload, convertFields, ensureDir } = require("../../middlewares/uploadHelper");

const {
restaurantProducts,getRestaurantProducts,registerOrLoginRestaurant,restaurantInformationStepId1,addRestaurantDocumentStepId2,
updateRestaurantWorkingDays,getCategoriesWithSubCategories,getUnitTypes,menuSetupStepId3,checkRestaurantVerification,getRestaurantProfile,
restaurant_list,updateRestaurantProfile,getRestaurantOrdersSummary,updateOrderStatus,addRestaurantFeedback,addBankDetails,deleteBankDetails,
addRestaurantOffer,updateRestaurantAddress,getOrderStatuses,getRestaurantAccountDetails,viewBankDetails,viewRestaurantOffer,
	getRestaurantAddress,getAllRestaurantSettings,getRestaurantTimings,updateRestaurantStatus,updateRestaurantTimings,restaurantWithdraw,restaurantWithdrawHistory,updateProducts
} = require("../../controllers/Api/restaurantController");

const router = express.Router();
/* ---------------- Upload dirs ---------------- */
const RESTAURANT_MEDIA_DIR = path.join(__dirname, "../../public/uploads/restaurant_media");
const PRODUCTS_DIR = path.join(__dirname, "../../public/uploads/products");
const RESTAURANTS_DIR = path.join(__dirname, "../../uploads/restaurants");
ensureDir(RESTAURANT_MEDIA_DIR);
ensureDir(PRODUCTS_DIR);
ensureDir(RESTAURANTS_DIR);

const restaurantUpload = {
  fields: (fieldsArr) => [
    upload.fields(fieldsArr),
    convertFields({ image: RESTAURANT_MEDIA_DIR, video: RESTAURANT_MEDIA_DIR, default: RESTAURANT_MEDIA_DIR })
  ]
};

const productConvert = convertFields({ default: PRODUCTS_DIR });
const restaurantProfileConvert = convertFields({ image: RESTAURANTS_DIR, default: RESTAURANTS_DIR });

router.post("/menuSetupStepId3", upload.any(), productConvert, menuSetupStepId3);

//router.post("/menuSetupStepId3", upload.any(),menuSetupStepId3);


router.post("/checkRestaurantVerification",checkRestaurantVerification);
router.get("/profile",getRestaurantProfile);


router.post("/update_status", updateRestaurantStatus);

router.get("/product_list", restaurant_list);
router.post("/update-products", upload.any(), productConvert, updateProducts);
router.put("/update-profile", upload.single("image"), restaurantProfileConvert, updateRestaurantProfile);
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
router.post("/restaurantInformationStepId1", ...restaurantUpload.fields([{ name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]), restaurantInformationStepId1);

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
