const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");

exports.index = async (req, res) => {
  try {
    const page   = parseInt(req.query.page) || 1;
    const limit  = 10;
    const offset = (page - 1) * limit;

    const [{ total }] = await sequelize.query("SELECT COUNT(*) as total FROM unit_types", { type: QueryTypes.SELECT });
    const totalPages = Math.ceil(total / limit);
    const unitTypes  = await sequelize.query(`SELECT * FROM unit_types ORDER BY id DESC LIMIT :limit OFFSET :offset`, { replacements: { limit, offset }, type: QueryTypes.SELECT });

    res.render("unit-types/index", { unitTypes, currentPage: page, totalPages });
  } catch (err) {
    console.error("Unit Types Error:", err);
    res.status(500).send("Server Error");
  }
};

exports.create = (req, res) => res.render("unit-types/create");

exports.store = async (req, res) => {
  const { name, short_code } = req.body;
  if (!name || !short_code) return res.status(400).send("All fields are required");
  try {
    await sequelize.query("INSERT INTO unit_types (name, short_code) VALUES (:name, :short_code)", { replacements: { name, short_code }, type: QueryTypes.INSERT });
    res.redirect("/unit-types");
  } catch (err) {
    console.error("Store Unit Type Error:", err);
    res.status(500).send("Database Error");
  }
};

exports.edit = async (req, res) => {
  const { id } = req.params;
  const rows = await sequelize.query("SELECT * FROM unit_types WHERE id = :id", { replacements: { id }, type: QueryTypes.SELECT });
  if (!rows.length) return res.redirect("/unit-types");
  res.render("unit-types/edit", { unitType: rows[0] });
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, short_code } = req.body;
  if (!name || !short_code) return res.status(400).send("All fields are required");
  try {
    await sequelize.query("UPDATE unit_types SET name=:name, short_code=:short_code, updated_at=NOW() WHERE id=:id", { replacements: { name, short_code, id }, type: QueryTypes.UPDATE });
    res.redirect("/unit-types");
  } catch (err) {
    console.error("Update Unit Type Error:", err);
    res.status(500).send("Database Error");
  }
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    await sequelize.query("UPDATE unit_types SET is_active = IF(is_active=1,0,1), updated_at=NOW() WHERE id=:id", { replacements: { id }, type: QueryTypes.UPDATE });
    res.redirect("/unit-types");
  } catch (err) {
    console.error("Toggle Status Error:", err);
    res.status(500).send("Server Error");
  }
};
