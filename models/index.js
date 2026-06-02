const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// 1️⃣ Import models properly
const Category = require("./Category")(sequelize, DataTypes);
const SubCategory = require("./SubCategory")(sequelize, DataTypes);
const Restaurant = require("./Restaurant")(sequelize, DataTypes);
const RestaurantDocument  = require("./RestaurantDocument")(sequelize, DataTypes);
const Product = require("./Product")(sequelize, DataTypes);
const RestaurantOffer = require("./RestaurantOffer")(sequelize, DataTypes);
const RestaurantRating = require("./RestaurantRating")(sequelize, DataTypes);
const RestaurantTiming = require("./RestaurantTiming")(sequelize, DataTypes);
const ProductMedia = require("./ProductMedia")(sequelize, DataTypes);
const ProductVariant = require("./ProductVariant")(sequelize, DataTypes);
const UnitType = require("./UnitType")(sequelize, DataTypes);  
const Cart = require("./Cart")(sequelize, DataTypes);
const Favorite = require("./Favorite")(sequelize, DataTypes);   // ✅ function call
//const User = require("./User")(sequelize, DataTypes);
const User = require("./User"); 

const Order = require("./Order");
const Paymode = require("./Paymode")(sequelize, DataTypes);
const Coupon = require("./Coupon").default;
const RestaurantFeedback = require("./RestaurantFeedback")(sequelize, DataTypes);
const Wallet = require("./Wallet")(sequelize, DataTypes);
const Transaction = require("./Transaction")(sequelize, DataTypes);
const Payin = require("./Payin")(sequelize, DataTypes);
const RestaurantSetting = require("./RestaurantSetting")(sequelize, DataTypes);
const DeliveryBoy = require("./DeliveryBoy")(sequelize, DataTypes);
const DeliverySetting = require("./DeliverySetting")(sequelize, DataTypes);
const AddonCharge = require("./AddonCharge")(sequelize, DataTypes);
const WithdrawRequest = require("./WithdrawRequest")(sequelize, DataTypes);
const Zone = require("./Zone");
const CouponHistory = require("./CouponHistory").default;
//const Coupon = require("./Coupon").default;


const Filter = require("./Filter");
const Slider = require("./Slider");


// 2️⃣ Define associations
Category.hasMany(SubCategory, { as: "sub_categories", foreignKey: "category_id" });
SubCategory.belongsTo(Category, { as: "category", foreignKey: "category_id" });

Category.hasMany(Product, { as: "products", foreignKey: "category_id" });
Product.belongsTo(Category, { as: "category", foreignKey: "category_id" });

SubCategory.hasMany(Product, { as: "products", foreignKey: "sub_category_id" });
Product.belongsTo(SubCategory, { as: "sub_category", foreignKey: "sub_category_id" });

Restaurant.hasMany(Product, { as: "products", foreignKey: "restaurant_id" });
Product.belongsTo(Restaurant, { as: "restaurant", foreignKey: "restaurant_id" });

Restaurant.hasMany(RestaurantOffer, { as: "offers", foreignKey: "restaurant_id" });
RestaurantOffer.belongsTo(Restaurant, { as: "restaurant", foreignKey: "restaurant_id" });

Restaurant.hasMany(RestaurantRating, { as: "ratings", foreignKey: "restaurant_id" });
RestaurantRating.belongsTo(Restaurant, { as: "restaurant", foreignKey: "restaurant_id" });

Restaurant.hasMany(RestaurantTiming, { as: "timings", foreignKey: "restaurant_id" });
RestaurantTiming.belongsTo(Restaurant, { as: "restaurant", foreignKey: "restaurant_id" });

Product.hasMany(ProductMedia, { as: "media", foreignKey: "product_id" });
ProductMedia.belongsTo(Product, { as: "product", foreignKey: "product_id" });

Product.hasMany(ProductVariant, { as: "variants", foreignKey: "product_id" });
ProductVariant.belongsTo(Product, { as: "product", foreignKey: "product_id" });

UnitType.hasMany(ProductVariant, { as: "variants", foreignKey: "unit_type_id" });
ProductVariant.belongsTo(UnitType, { as: "unitType", foreignKey: "unit_type_id" });

// ✅ Cart <-> Product association (missing part fixed)
Cart.belongsTo(Product, { as: "product", foreignKey: "product_id" });
Product.hasMany(Cart, { as: "cartItems", foreignKey: "product_id" });

// ✅ Favorite associations
Favorite.belongsTo(User, { as: "user", foreignKey: "user_id" });
Favorite.belongsTo(Restaurant, { as: "restaurant", foreignKey: "restaurant_id" });
User.hasMany(Favorite, { as: "favorites", foreignKey: "user_id" });
Restaurant.hasMany(Favorite, { as: "favorites", foreignKey: "restaurant_id" });

// Cart <-> ProductVariant association
Cart.belongsTo(ProductVariant, { as: "variant", foreignKey: "product_id" });
ProductVariant.hasMany(Cart, { as: "cartItems", foreignKey: "product_id" });


// Order.js
Order.belongsTo(Product, { foreignKey: "product_id", as: "productDetails" });
Order.belongsTo(ProductVariant, { foreignKey: "product_variant_id", as: "variantDetails" });

// 3️⃣ Export models and sequelize instance
module.exports = {
  sequelize,
  Sequelize,
  Category,
  SubCategory,
  Restaurant,
  Product,
  RestaurantOffer,
  RestaurantRating,
  RestaurantTiming,
  ProductMedia,
  ProductVariant,
  UnitType,
  Filter,
  Slider,
  Cart,
  Favorite,
  User,
  Order,
  Paymode,
  RestaurantDocument,
  RestaurantFeedback,
	Wallet,
  Payin,
  Transaction,RestaurantSetting,
	DeliveryBoy,DeliverySetting,AddonCharge,WithdrawRequest,Zone, CouponHistory,
  Coupon 
};
