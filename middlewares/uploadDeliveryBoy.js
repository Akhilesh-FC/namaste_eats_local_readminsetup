// middlewares/uploadDeliveryBoy.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 🟢 Create uploads folder if not exists
const dir = "uploads/delivery_boys";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 🟢 Storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// 🟢 Export full multer instance (not single)
const upload = multer({ storage });

module.exports = upload;
