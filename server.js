const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const cors = require("cors");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

// DB instance
const sequelize = require("./config/db");

const app = express();

// -------------------------
// SESSION FIX (MOST IMPORTANT)
// -------------------------
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});


app.use(
  session({
    key: "namaste_admin_session_v2", // 🔥 CHANGE NAME
    secret: "namasteeats_super_secret_key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000,
    },
  })
);

app.use(express.static('public')); 

// -------------------------
// STATIC & BODY PARSER
// -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("public/uploads"));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// -------------------------
// --------------- CORS FIXED ----------------
const allowedOrigins = [
  "http://localhost:5176",
  "https://namasteats.com",
  "https://root.namasteeats.com",
  "http://root.namasteeats.com",
  "http://192.168.1.26:5176"
];

// USE CORS ONLY FOR API
app.use("/api", cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true,
}));

// -------------------------
// VIEW ENGINE
// -------------------------
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// -------------------------
// SMART LAYOUT HANDLER
// -------------------------
app.use((req, res, next) => {
  if (req.path === "/admin/login" || req.path === "/admin") {
    app.set("layout", false);
  } else {
    app.set("layout", "layout/administrator");
  }
  next();
});

// -------------------------
// REQUEST LOGGING
// -------------------------
app.use((req, res, next) => {
  console.log("Incoming Request:", req.method, req.url);
  next();
});

// -------------------------
// IMPORT ROUTES
// -------------------------
const authRoutes = require("./routes/Admin/authRoutes");
const admincategoryRoutes = require("./routes/Admin/admincategoryRoutes");
const subCategoryRoutes = require("./routes/Admin/adminSubCategoryRoutes");
const adminRestaurantRoutes = require("./routes/Admin/adminRestaurantRoutes");
const usersRoutes = require("./routes/Admin/usersRoutes");
const adminorderRoutes = require("./routes/Admin/orderRoutes");
const adminsliderRoutes = require("./routes/Admin/adminsliderRoutes");
const chargesRoutes = require("./routes/Admin/chargesRoutes");
const unitTypeRoutes = require("./routes/Admin/unitTypeRoutes");
const zoneRoutes = require("./routes/Admin/zoneRoutes");
const CouponAdminRoutes = require("./routes/Admin/CouponAdminRoutes");
//const admin =  require("./routes/Admin/dashboard");


// API Routes
const userRoutes = require("./routes/Api/userRoutes");
const addressRoutes = require("./routes/Api/addressRoutes");
const cartRoutes = require("./routes/Api/cartRoutes");
const categoryRoutes = require("./routes/Api/categoriesRoutes");
const orderRoutes = require("./routes/Api/orderRoutes");
const productRoutes = require("./routes/Api/productsRoutes");
const restaurantRoutes = require("./routes/Api/restaurantRoutes");
const settingRoutes = require("./routes/Api/settingRoutes");
const feedbackRoutes = require("./routes/Api/feedbackRoutes");
const favoriteRoutes = require("./routes/Api/favoriteRoutes");
const searchRoutes = require("./routes/Api/searchRoutes");
const couponRoutes = require("./routes/Api/couponRoutes");
const deliveryBoyRoutes = require("./routes/Api/deliveryBoyRoutes");
const accountRoutes = require("./routes/Api/accountRoutes");
const ewithdrawDBRequest = require("./routes/Api/ewithdrawDBRequest");

// -------------------------
// ADMIN & API ROUTES BIND
// -------------------------
app.use("/admin", authRoutes);

app.use("/", admincategoryRoutes);
app.use("/", subCategoryRoutes);
app.use("/", adminRestaurantRoutes);
app.use("/", usersRoutes);
app.use("/", adminorderRoutes);
app.use("/", adminsliderRoutes);
app.use("/", chargesRoutes);
app.use("/", unitTypeRoutes);
app.use("/", zoneRoutes);
app.use("/", CouponAdminRoutes);


app.use("/api/user", userRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/product", productRoutes);
app.use("/api/restaurant", restaurantRoutes);
app.use("/api/setting", settingRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/deliveryBoy", deliveryBoyRoutes);
app.use("/api/accountdeatils", accountRoutes);
app.use("/api/withdrawRequestDB", ewithdrawDBRequest);

// -------------------------
// ERROR HANDLER
// -------------------------
app.use((error, req, res, next) => {
  console.error("Unhandled Error:", error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      status: false,
      message: "Request payload too large",
    });
  }

  res.status(500).json({
    status: false,
    message: "Internal server error",
    error: error.message,
  });
});

// -------------------------
// START SERVER
// -------------------------
sequelize
  .sync()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Connection failed:", err);
  });

module.exports = app;
