const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

module.exports = async (req, res, next) => {
  try {
    if (!req.session || !req.session.admin) {
      return res.redirect("/admin/login");
    }

    const result = await sequelize.query(
      "SELECT session_version, session_token FROM admins WHERE id = :id LIMIT 1",
      { replacements: { id: req.session.admin.id }, type: QueryTypes.SELECT }
    );

    if (!result || result.length === 0) {
      req.session.destroy(() => res.redirect("/admin/login"));
      return;
    }

    const { session_version, session_token } = result[0];

    console.log("DB token:", session_token, "| Session token:", req.session.admin.session_token);

    // session_version check
    if (session_version !== undefined && req.session.admin.session_version !== undefined) {
      if (session_version !== req.session.admin.session_version) {
        req.session.destroy(() => res.redirect("/admin/login"));
        return;
      }
    }

    // single session check — agar DB token aur session token alag ho to logout
    if (session_token && req.session.admin.session_token) {
      if (session_token !== req.session.admin.session_token) {
        req.session.destroy(() => res.redirect("/admin/login"));
        return;
      }
    }

    next();
  } catch (error) {
    console.error("ADMIN AUTH ERROR:", error);
    return res.redirect("/admin/login");
  }
};
