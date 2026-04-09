const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.memoryStorage(); // Buffer me milegi file

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
