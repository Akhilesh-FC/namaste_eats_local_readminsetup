const db = require("../../config/db");

// List Unit Types with Pagination
exports.index = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = 10;
    let offset = (page - 1) * limit;

    const [countResult] = await db.query("SELECT COUNT(*) as count FROM unit_types");
    let total = countResult[0].count;
    let totalPages = Math.ceil(total / limit);

    const [unitTypes] = await db.query(`SELECT * FROM unit_types ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);

    res.render("unit-types/index", { unitTypes, currentPage: page, totalPages });
  } catch (err) {
    console.error("Unit Types Error:", err);
    res.status(500).send("Server Error");
  }
};

// Create Form
exports.create = (req, res) => {
  res.render("unit-types/create");
};

// Store Unit Type
exports.store = async (req, res) => {
  const { name, short_code } = req.body;
  if (!name || !short_code) return res.status(400).send("All fields are required");

  try {
    await db.query("INSERT INTO unit_types (name, short_code) VALUES (?, ?)", [name, short_code]);
    res.redirect("/admin/unit-types");
  } catch (err) {
    console.error("Store Unit Type Error:", err);
    res.status(500).send("Database Error");
  }
};

// Edit Form
exports.edit = async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query("SELECT * FROM unit_types WHERE id=?", [id]);
  if (!rows.length) return res.redirect("/admin/unit-types");
  res.render("unit-types/edit", { unitType: rows[0] });
};

// Update Unit Type
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, short_code } = req.body;
  if (!name || !short_code) return res.status(400).send("All fields are required");

  try {
    await db.query("UPDATE unit_types SET name=?, short_code=?, updated_at=NOW() WHERE id=?", [name, short_code, id]);
    res.redirect("/admin/unit-types");
  } catch (err) {
    console.error("Update Unit Type Error:", err);
    res.status(500).send("Database Error");
  }
};

// Toggle Active/Inactive
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE unit_types SET is_active = IF(is_active=1,0,1), updated_at=NOW() WHERE id=?", [id]);
    res.redirect("/admin/unit-types");
  } catch (err) {
    console.error("Toggle Status Error:", err);
    res.status(500).send("Server Error");
  }
};
