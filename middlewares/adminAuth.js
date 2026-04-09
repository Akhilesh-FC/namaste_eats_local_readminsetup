const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

module.exports = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }

    const result = await sequelize.query(
      "SELECT session_version FROM admins WHERE id = :id",
      {
        replacements: { id: req.session.admin.id },
        type: QueryTypes.SELECT
      }
    );

    if (!result || result.length === 0) {
      req.session.destroy(() => {
        return res.redirect("/admin/login");
      });
      return;
    }

    const dbSessionVersion = result[0].session_version;

    if (dbSessionVersion !== req.session.admin.session_version) {
      req.session.destroy(() => {
        return res.redirect("/admin/login");
      });
      return;
    }

    next();
  } catch (error) {
    console.error("❌ ADMIN AUTH ERROR 👉", error);
    req.session.destroy(() => {
      return res.redirect("/admin/login");
    });
  }
};
