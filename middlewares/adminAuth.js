const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

module.exports = async (req, res, next) => {
  try {
    if (!req.session || !req.session.admin) {
      return res.redirect("/admin/login");
    }

    // session_version check — agar column na ho to skip karo
    try {
      const result = await sequelize.query(
        "SELECT session_version FROM admins WHERE id = :id",
        { replacements: { id: req.session.admin.id }, type: QueryTypes.SELECT }
      );

      if (!result || result.length === 0) {
        req.session.destroy(() => res.redirect("/admin/login"));
        return;
      }

      const dbVersion = result[0].session_version;
      // only check if both exist
      if (dbVersion !== undefined && req.session.admin.session_version !== undefined) {
        if (dbVersion !== req.session.admin.session_version) {
          req.session.destroy(() => res.redirect("/admin/login"));
          return;
        }
      }
    } catch (vErr) {
      // session_version column missing — ignore, allow access
      console.warn("session_version check skipped:", vErr.message);
    }

    next();
  } catch (error) {
    console.error("ADMIN AUTH ERROR:", error);
    return res.redirect("/admin/login");
  }
};
