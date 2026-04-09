const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "namasteats_root",
  password: "namasteats_root",
  database: "namasteats_root"
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL error:", err);
  } else {
    console.log("✅ MySQL connected (mysql2)");
  }
});

module.exports = db;
