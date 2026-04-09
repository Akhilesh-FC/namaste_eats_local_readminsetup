const sequelize = require("../../config/db");

// List users
exports.users = async (req, res) => {
  try {
    const users = await sequelize.query(
      `SELECT id, u_id, name, profile_image, email, mobile_no, dob, anniversary, gender, status, created_at, updated_at
       FROM users ORDER BY id DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.render("users/index", { title: "Users", users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Toggle Active/Inactive
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await sequelize.query(
      `SELECT status FROM users WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔥 STRING BASED TOGGLE
    const newStatus = user[0].status === 'active' ? 'inactive' : 'active';

    await sequelize.query(
      `UPDATE users SET status = :status, updated_at = NOW() WHERE id = :id`,
      {
        replacements: { status: newStatus, id },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    res.json({
      success: true,
      status: newStatus
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
