const sequelize = require("../../config/db");

// controllers/Admin/adminDashboard.js
exports.home = async (req, res) => {
  try {
    // Ye direct dashboard page par redirect karega
    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Dashboard redirect error:", err);
    res.status(500).send("Server Error");
  }
};


